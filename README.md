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
| 0.1 | Automatic shipping fee | `quote_shipping(region, weight)` uses the zone rate table (base fee + per extra kg). It is recalculated live at checkout and enforced again in `place_order`. Rates are editable in **Manager → Shipping rates**. *(J&T API impediment: see below.)* |
| 1 | Upload proof of payment | `OrderDetail` → each payment box has an upload field. Files go to the private `payment-proofs` bucket, then `submit_payment_proof()` runs. |
| 2 | Manager views proof | **Manager → Orders → order**. The proof image is shown inline (signed URL) with the reference no. and upload time. |
| – | Manager verifies payment reached the account | "✓ Payment received — verify" / "✕ Cannot verify" buttons call `manager_review_payment()`. |
| 4 | Customer sees **Status: For verification** | Set automatically once every payment split has a proof. |
| 5 | Customer sees **Status: Payment verified** | Set when the manager has verified every split. The page updates live (Realtime) and an email is sent. |
| 6 | Payment method options | `payment_methods` table (GCash, bank/QR Ph, Maya, other). Managed in **Manager → Payment methods**. |
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

---

## Impediments and next steps

**J&T shipping-fee API (story 0.1).** J&T Express does not offer a self-serve public rate API. Access goes through their merchant/partner onboarding, so the app currently calculates fees from a **rate table you control** (zone by region, base fee for the first kg, fee per extra kg). This matches how J&T's published rate cards are structured. When API credentials are approved:
1. Create an Edge Function `jnt-quote` that calls the J&T API with the origin, destination and weight.
2. Call it from `Checkout.jsx` instead of `rpc('quote_shipping')`, and pass the quoted fee into `place_order`. Validate it server-side, for example by having the function store a signed quote ID that `place_order` checks.
3. Keep `quote_shipping` as a fallback if the API is down.

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
