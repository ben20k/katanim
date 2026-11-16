# Katanim Modern Agriculture — Web App

An online store for farm inputs: customers order, pay by GCash, Maya or bank QR, and upload proof of payment. The manager verifies each payment against the bank or GCash account, then ships through J&T.

**Stack:** React 18 + Vite · Supabase (Postgres, Auth, Storage, Realtime, Edge Functions) · Resend (email) · Cloudflare (domain, DNS, Pages hosting)

## Brand

| Token | Color | Use |
|---|---|---|
| Katanim green | `#00a651` | Wordmark, accents, large text |
| Button green | `#007a3c` | Buttons and links (accessible on white) |
| Forest | `#065535` | Dark leaf, prices |
| Ink | `#0b260f` | Headings, footer |
| Water blue | `#1a5fc0` / `#0082e9` | Info states, "hydroponic" highlight |
| Sun | `#fde26a` | Highlights, footer tagline |
| Orange | `#e37238` / `#b4501a` | Promo tags, cart count |
| Soil | `#5f3c14` | Brand stripe |

Fonts: **Poppins** (UI, wordmark in 800 italic) and **Kaushan Script** (`#Katanim`, "So clean, so good."), loaded from Google Fonts.
Assets live in `public/brand/` (emblem, full logo, "How I Grow Hydroponics" banner, social preview image), plus `public/favicon.png` and `public/apple-touch-icon.png`.

---

## User stories → where they live

| # | Story | Implementation |
|---|-------|----------------|
| 0 | Customer can order products | `Shop` → `Cart` → `Checkout`. The `place_order()` RPC re-prices items server-side and deducts stock. |
| 0.1 | Automatic shipping fee (J&T rate card: origin × province × weight) | `quote_shipping(region, weight)` uses the zone rate table (base fee + per extra kg). It is recalculated live at checkout and enforced again in `place_order`. Rates are editable in **Manager → Shipping rates**. *(J&T API impediment: see below.)* |
| 1 | Upload proof of payment | `OrderDetail` → each payment box has an upload field. Files go to the private `payment-proofs` bucket, then `submit_payment_proof()` runs. |
| 2 | Manager views proof | **Manager → Orders → order**. The proof image is shown inline (signed URL) with the reference no. and upload time. |
| – | Manager verifies payment reached the account | "✓ Payment received — verify" / "✕ Cannot verify" buttons call `manager_review_payment()`. |
| 4 | Customer sees **Status: For verification** | Set automatically once every payment split has a proof. |
| 5 | Customer sees **Status: Payment verified** | Set when the manager has verified every split. The page updates live (Realtime) and an email is sent. |
| 6 | Payment method options | `payment_methods` table (GCash, bank/QR Ph, Maya, other). Managed in **Manager → Payment methods**. |
| – | Verify without proof of payment | If a payment has no proof, the manager clicks **Verify without proof…**. A warning popup shows the account and amount, and the manager must tick **I agree** before **Confirm & verify payment**. An optional reference no. can be entered. The payment is flagged `verified_without_proof`, and an internal note records who confirmed it and when. |
| 6.1 | Manager comments when unable to verify | A comment is required to reject. It is stored on the payment and in `order_comments`. |
| 6.2 | Customer sees comments on order page | Shown in the red status banner, under the rejected payment and in the comment thread. Customers can reply. |
| 7 | Customer sees promo products | "🔥 Promo deals" section at the top of the shop, with promo badge, % off, strikethrough price and end date. |
| 8 | Manager sets promos via dropdown | **Manager → Products**: a *Regular price / On promo* dropdown on every row, plus promo price, label and end date in the editor. |
| 8.1 | Pay via QR codes | The manager uploads a QR image for each account. The customer sees the QR plus the exact amount for each payment after ordering. |
| 9 | Manager checks GCash limit | **Dashboard** and **Payment methods** show used today and this month against the daily/monthly limit for each GCash account, with *Near limit* and *Limit reached* badges. |
| 10 | Split across multiple GCash accounts | At checkout, "+ Pay part with another GCash account" or "Auto-split". Accounts at their limit are marked and blocked. Limits are enforced server-side. |
| 11 | **Received** button | Shown when the order is Shipped or Delivered. It calls `customer_mark_received()` and emails the manager. |

### Order status flow

```
pending_payment ──(all proofs uploaded)──▶ for_verification ──(all verified)──▶ payment_verified ──▶ shipped ──▶ delivered ──▶ received
        ▲                                         │                                                      └───────(Received)───────┘
        └──── payment_rejected ◀──(manager rejects with comment)
                 └──(customer re-uploads)──▶ for_verification
cancelled  ← manager can cancel any time before shipping (stock is returned)
```

Every change is recorded in `order_status_history` and shown as a timeline.

---

## Project structure

```
supabase/
  migrations/20261115000000_init.sql   schema, RLS, RPCs, storage buckets, shipping zones
  seed.sql                             sample products + payment accounts
  functions/send-order-email/index.ts  Resend email notifications (Edge Function)
src/
  lib/            supabase client, formatting, status labels, storage helpers, notify()
  context/        AuthContext (session + role), CartContext (localStorage cart)
  components/     Navbar, ProductCard, StatusBadge, ProofViewer, Comments, CapacityCard, …
  pages/          Shop, Cart, Checkout, Orders, OrderDetail, Login, Register
  pages/manager/  Dashboard, ManagerOrders, OrderReview, ManagerProducts, PaymentMethods, ShippingRates
public/brand/     logo, emblem, hero banner, social image
wrangler.jsonc    Cloudflare Workers static-assets config (SPA routing + custom domain)
```

### Security model
- All order and payment state changes go through `SECURITY DEFINER` RPCs that check ownership, role and allowed status transitions. Customers can't insert or update orders directly.
- Prices, shipping fees and GCash limits are computed in the database, so a modified browser can't change what is charged.
- RLS: customers see only their own orders, payments and non-internal comments. Managers see everything.
- `profiles.role` can't be self-edited (column-level grant). Managers are promoted with SQL only.
- Proofs are in a **private** bucket under `<user_id>/…`. They are viewed through 30-minute signed URLs.
- The email function runs as the caller, so RLS applies. It also checks that the event matches the caller's role and the order's current status, so it can't be used to spam.

---

## Setup

### 1. Supabase
1. Create a project at supabase.com (region: Singapore is closest to PH).
2. Apply the schema, using **either** method:
   - CLI: `npm i -g supabase && supabase login && supabase link --project-ref <ref> && supabase db push`
   - Or paste `supabase/migrations/…_init.sql` into **SQL Editor** and run it.
3. (Optional) Run `supabase/seed.sql` for sample products and payment accounts. **Edit the GCash numbers and limits to match your real accounts.**
4. Register your own account in the app, then make it a manager:
   ```sql
   update public.profiles set role = 'manager' where email = 'you@yourdomain.com';
   ```
5. **Auth → URL Configuration:** set Site URL to `https://yourdomain.com` and add `http://localhost:5173/**` and `https://yourdomain.com/**` to Redirect URLs.
6. Copy **Project URL** and **anon key** (Settings → API) into `.env` (see `.env.example`).

### 2. Resend (email)
1. Create a Resend account → **Domains → Add domain** (e.g. `mail.yourdomain.com` or the root domain).
2. Add the DNS records Resend shows (SPF/TXT, DKIM, and optionally DMARC/MX) in **Cloudflare → DNS**. Set them to **DNS only** (grey cloud), then click Verify in Resend.
3. Create an API key, then deploy the function:
   ```bash
   supabase secrets set RESEND_API_KEY=re_xxx \
     EMAIL_FROM="Katanim <orders@yourdomain.com>" \
     MANAGER_EMAIL=manager@yourdomain.com \
     SITE_URL=https://yourdomain.com
   supabase functions deploy send-order-email
   ```
4. Recommended: send Supabase Auth emails (sign-up confirmation, password reset) through Resend too. In **Auth → SMTP Settings**, use host `smtp.resend.com`, port `465`, user `resend`, and your API key as the password.

Emails sent: order placed (customer), proof uploaded (manager), payment verified or rejected with the comment (customer), shipped with tracking number (customer), delivered (customer), received (manager), cancelled (customer).

### 3. Cloudflare (domain + hosting)
1. **Register the domain:** Cloudflare dashboard → **Domain Registration → Register Domains** → search and buy. It is added to your account with Cloudflare DNS automatically.
2. **Host the app on Cloudflare Pages:** push this repo to GitHub, then go to **Workers & Pages → Create → Pages → Connect to Git**:
   - Framework preset: **Vite** · Build command: `npm run build` · Output directory: `dist`
   - Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
3. Pages project → **Custom domains** → add `yourdomain.com` (and `www`). Cloudflare creates the DNS records.
4. Update the Supabase Site URL and the function's `SITE_URL` to the final domain.

### 4. Local development
```bash
cp .env.example .env    # fill in your Supabase URL + anon key
npm install
npm run dev             # http://localhost:5173
```

### 5. Continuous deployment (GitHub Actions)
`.github/workflows/deploy.yml` runs on every push to `main`:

1. **build**: `npm ci` and `npm run build`. This also runs on pull requests as a check.
2. **supabase** (only when files under `supabase/` changed): `supabase db push` applies new migrations, and `supabase functions deploy` deploys the Edge Functions.
3. **web**: deploys `dist/` to Cloudflare with `wrangler deploy`. It runs only after the database step succeeds or was skipped.

You can also start it manually: GitHub → **Actions → CI / Deploy → Run workflow**. A manual run redeploys everything.

**GitHub settings** (repo → Settings → Secrets and variables → Actions):

| Type | Name | Value |
|---|---|---|
| Variable | `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` |
| Variable | `VITE_SUPABASE_ANON_KEY` | publishable / anon key |
| Variable | `SUPABASE_PROJECT_ID` | `<ref>` |
| Secret | `SUPABASE_ACCESS_TOKEN` | supabase.com → Account → Access Tokens |
| Secret | `SUPABASE_DB_PASSWORD` | database password from project creation |
| Secret | `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → "Edit Cloudflare Workers" template |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages (right sidebar) |

**One-time steps:**
- The first migration was applied by hand in the SQL Editor, so mark it as applied. Otherwise CI will try to run it again:
  `npx supabase migration repair --status applied 20261115000000`
- Disconnect Cloudflare's own Git build (Workers → katanim → Settings → Build → Git repository → Disconnect) so each push deploys once, not twice.

**New database changes:** run `npx supabase migration new <name>`, write the SQL, and push. Never edit a migration that has already been applied.

### 6. Facebook login
The Sign in and Create account pages have a **Continue with Facebook** button, which uses Supabase Auth's Facebook provider. Configuration steps:
1. developers.facebook.com → **Create app** → use case **Authenticate and request data from users with Facebook Login**.
2. Facebook Login → Settings → **Valid OAuth Redirect URIs**: `https://<ref>.supabase.co/auth/v1/callback`
3. App settings → Basic: App domain `katanimmodernagriculture.com`, Privacy Policy URL `https://katanimmodernagriculture.com/privacy`, User data deletion URL `https://katanimmodernagriculture.com/data-deletion`. Copy the **App ID** and **App Secret**.
4. Supabase → Authentication → Sign In / Providers → **Facebook** → enable, then paste the App ID (as Client ID) and the App Secret.
5. Switch the Meta app to **Live** (it needs the privacy URLs above). Until then, only people with a role on the app can log in.

Edit the contact details in `src/lib/site.js` (used by the privacy pages).

---

## Impediments and next steps

**J&T shipping fees (story 0.1).** J&T has no public rate API, so the store uses J&T Express Philippines' **published rate card**. It's seeded in `20261116020000_jnt_rate_card.sql` from the card as listed in January 2025.
- Fee = rate for **origin zone → destination zone** for the order's total weight: up to 500 g, 1 kg, 3 kg, 4 kg, 5 kg and 6 kg.
- Above 6 kg, an estimated "+ per kg" is added. J&T doesn't publish rates above 6 kg, so confirm heavy items.
- The destination comes from the customer's **province**. Island provinces use J&T's Island rate.
- Managers set the store's origin and edit every rate, the per-kg extra, delivery estimates and the province zones in **Manager → Shipping rates**, which also has a quote tester.
- When J&T API access is approved, replace the body of `shipping_quote()` with a call to the API (via an Edge Function) and keep the table as a fallback.

**Payment-method API integration (story 6.3).** Payments are currently **manual**: the customer pays by QR or transfer and the manager verifies the proof, as the stories describe. To automate later, a PH payment gateway such as PayMongo, Xendit or Dragonpay can create GCash, Maya and QR Ph charges and send a webhook on success. A Supabase Edge Function webhook handler would then set the payment to `verified` automatically. Proof upload can stay as the fallback for direct transfers.

**GCash limits (stories 9–10).** Limits depend on each GCash account's verification level and on GCash's current policy. Enter the real daily and monthly receiving limits for each account in **Manager → Payment methods**. Usage counts all non-rejected payments on non-cancelled orders, including ones still waiting for proof, so an account isn't oversold. Cancel abandoned orders to free their capacity.

---

## Testing notes
The database logic was tested on PostgreSQL 16 with stubbed `auth`/`storage` schemas. The run covered:
- the over-limit GCash block, the GCash-only split rule, and a 2-account split order
- the reject-without-comment block, rejecting with a comment, the customer seeing the comment, re-uploading, verifying, shipping and Received
- stock deduction, the role-escalation block, and RLS isolation between customers

The full status history came out as expected: `pending_payment → for_verification → payment_rejected → for_verification → payment_verified → shipped → received`.

The frontend bundles without errors. Run `npm install && npm run build` once on your machine to confirm with the pinned dependency versions.
