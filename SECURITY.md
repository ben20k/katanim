# Security review — Katanim Modern Agriculture

Reviewed 2026-11-16. Scope: Supabase schema, row-level security (RLS), database functions, storage, the `send-order-email` Edge Function, the React frontend, Cloudflare and GitHub deployment, and Supabase Auth settings.

Each issue was reproduced on a local PostgreSQL 16 copy of the schema, then re-tested after the fix. The full order flow (order → proof → reject → re-upload → verify → ship → received) still passes.

## Findings and fixes

| # | Severity | Issue | Fix |
|---|---|---|---|
| S1 | **High** | Unpaid orders reserve stock and GCash capacity forever, with no limit per customer. In testing, one account removed 80% of a product's stock with 4 orders and never paid. | Max **3 unpaid orders** per customer. Customers can **cancel** their own unpaid order, which returns the stock. An hourly job (pg_cron) auto-cancels orders with no proof after **48 h** (`store_settings.unpaid_cancel_hours`; set it to `null` to turn this off). |
| S3 | Medium | `payment_method_capacity()` showed **anyone, even logged-out visitors,** how much money each GCash account received today and this month, plus its limits. | Money figures and limits are now returned only to managers. Customers get just the remaining capacity, which checkout needs. Logged-out visitors can't call it. |
| S2 | Medium | Manager profiles (email, phone) were readable by anyone. | Profiles are visible only to their owner and to managers. Comments now carry a `from_staff` flag, so the app no longer needs to read manager profiles. |
| S7 | Medium | The email function could be called repeatedly for the same event, spamming the manager or customer and using up the Resend quota. | `notification_log` sends each email once per status change. Errors no longer reveal internal details. |
| H1 | Medium | No browser security headers: pages could be framed for clickjacking, e.g. tricking a manager into clicking "Verify", and there was no CSP. | `public/_headers` adds CSP, `X-Frame-Options: DENY`, HSTS, nosniff, Referrer-Policy and Permissions-Policy. All pages were tested with no violations. |
| S4 | Low | `revoke execute … from anon` had no effect, because Postgres also grants EXECUTE to `PUBLIC`. The functions' own sign-in checks still blocked misuse. | EXECUTE is now revoked from `public, anon`. Internal helpers can't be called through the API at all. |
| S5 | Low | Two orders placed at the same moment could both use the last of a GCash limit. | `place_order` locks the payment account row while it checks the limit. |
| S6 | Low | No size limits on comments, delivery details or reference numbers (for example, a 50,000-character comment was accepted). | Limits enforced in the database: comments 2,000 characters, address 300, notes 500, and so on. Very long sign-up names are trimmed. |
| S8 | Low | Managers could upload SVG files, which can contain scripts, and image URLs weren't restricted. | The public assets bucket accepts JPG, PNG and WebP only. Product and QR image URLs must be `https://`. |
| R1 | Low | The `?next=` redirect parameter after sign-in wasn't validated. | `safeNext()` only allows paths on this site. |

## Checked and OK
- **RLS** is enabled on every table. Customers can only see their own orders, items, payments, proofs and non-internal comments.
- **Every order and payment change** goes through `SECURITY DEFINER` functions with a fixed `search_path`. Each one checks ownership or the manager role and which status changes are allowed.
- **Prices, shipping fees and GCash limits** are calculated in the database, not in the browser.
- **Users can't make themselves managers.** Only `full_name` and `phone` can be edited, and the role isn't taken from sign-up data.
- **Payment proofs** are in a private bucket, stored under each user's own folder and opened through short-lived signed links.
- **React escapes all output.** No `dangerouslySetInnerHTML`, and email templates escape user text.
- **Secrets:** only the public anon key is in the frontend. The service-role key and Resend key live in Supabase secrets. CI secrets are only used on pushes to `main`, so pull requests from forks can't reach them.
- **Changing a password** requires the current password and signs out other devices.

## Settings to change in dashboards (not in code)
1. **Supabase → Authentication → Sign In / Providers → Email:**
   - Turn **Confirm email** back ON if you turned it off.
   - Set the minimum password length to **8**, with letters and digits required.
   - Turn **Secure password change** ON.
2. **Supabase → Authentication → Attack Protection:** turn on **CAPTCHA (Cloudflare Turnstile)** for sign-up and sign-in to stop bot accounts. This also needs a small frontend change.
3. **Manager accounts:** use long, unique passwords, and add MFA when possible.
4. **Cloudflare → SSL/TLS:** turn on "Always Use HTTPS".
5. **GitHub:** turn on 2FA for your account and protect the `main` branch.
6. **Dependencies:** upgrade to Vite 6+. `npm audit` flags the Vite 5 dev server, which affects local development only.
