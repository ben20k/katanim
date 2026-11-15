-- =====================================================================
-- Katanim Modern Agriculture — initial schema
-- Tables, row-level security, business-logic RPCs, storage buckets.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.user_role      as enum ('customer', 'manager');
create type public.order_status   as enum (
  'pending_payment',   -- order placed, waiting for proof of payment
  'for_verification',  -- all proofs uploaded, manager is checking the bank / GCash
  'payment_rejected',  -- manager could not verify; see comments
  'payment_verified',  -- manager confirmed money arrived
  'shipped',
  'delivered',
  'received',          -- customer pressed "Received"
  'cancelled'
);
create type public.payment_type   as enum ('gcash', 'bank', 'maya', 'other');
create type public.payment_status as enum ('awaiting_proof', 'submitted', 'verified', 'rejected');

-- ---------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  phone      text,
  role       public.user_role not null default 'customer',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'manager');
$$;

-- ---------------------------------------------------------------------
-- Products (with promo fields)
-- ---------------------------------------------------------------------
create table public.products (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  category      text,
  unit          text not null default 'pc',
  price         numeric(12,2) not null check (price >= 0),
  is_promo      boolean not null default false,
  promo_price   numeric(12,2) check (promo_price is null or promo_price >= 0),
  promo_label   text,
  promo_ends_at timestamptz,
  stock         integer not null default 0 check (stock >= 0),
  weight_kg     numeric(8,2) not null default 1 check (weight_kg >= 0),
  image_url     text,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Price the customer actually pays (promo price when the promo is live).
-- Also exposed by PostgREST as a computed column: select=*,effective_price
create or replace function public.effective_price(p public.products)
returns numeric language sql stable as $$
  select case
    when p.is_promo and p.promo_price is not null
         and (p.promo_ends_at is null or p.promo_ends_at > now())
    then p.promo_price else p.price end;
$$;

-- ---------------------------------------------------------------------
-- Shipping rate table (stand-in for the J&T rate API — see README)
-- ---------------------------------------------------------------------
create table public.shipping_zones (
  code       text primary key,
  name       text not null,
  base_fee   numeric(10,2) not null,
  base_kg    numeric(6,2)  not null default 1,
  per_kg_fee numeric(10,2) not null,
  eta        text
);

create table public.shipping_regions (
  region    text primary key,
  zone_code text not null references public.shipping_zones(code),
  sort      integer not null default 0
);

-- fee = base_fee + (every started kg above base_kg) * per_kg_fee
create or replace function public.quote_shipping(p_region text, p_weight_kg numeric)
returns numeric language sql stable security definer set search_path = public as $$
  select z.base_fee + greatest(0, ceil(coalesce(p_weight_kg, 0) - z.base_kg)) * z.per_kg_fee
  from public.shipping_regions r
  join public.shipping_zones z on z.code = r.zone_code
  where r.region = p_region;
$$;

-- ---------------------------------------------------------------------
-- Payment methods (each GCash number is its own row with its own limits)
-- ---------------------------------------------------------------------
create table public.payment_methods (
  id             uuid primary key default gen_random_uuid(),
  type           public.payment_type not null,
  label          text not null,
  account_name   text,
  account_number text,
  qr_url         text,
  instructions   text,
  daily_limit    numeric(12,2),   -- null = no limit
  monthly_limit  numeric(12,2),   -- null = no limit
  active         boolean not null default true,
  sort           integer not null default 0,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------
create table public.orders (
  id              uuid primary key default gen_random_uuid(),
  order_no        text unique not null default (
                    'KTM-' || to_char(now() at time zone 'Asia/Manila', 'YYMMDD') || '-' ||
                    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  status          public.order_status not null default 'pending_payment',
  subtotal        numeric(12,2) not null default 0,
  shipping_fee    numeric(12,2) not null default 0,
  total           numeric(12,2) not null default 0,
  total_weight_kg numeric(10,2) not null default 0,
  ship_name       text not null,
  ship_phone      text not null,
  ship_address    text not null,
  ship_city       text not null,
  ship_province   text,
  ship_region     text not null,
  ship_zip        text,
  notes           text,
  courier         text default 'J&T Express',
  tracking_no     text,
  verified_at     timestamptz,
  shipped_at      timestamptz,
  received_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index orders_user_idx   on public.orders(user_id);
create index orders_status_idx on public.orders(status);

create table public.order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name       text not null,
  unit       text,
  unit_price numeric(12,2) not null,
  qty        integer not null check (qty > 0),
  line_total numeric(12,2) not null
);
create index order_items_order_idx on public.order_items(order_id);

-- One row per payment "split" (several rows when paying across multiple GCash accounts)
create table public.order_payments (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  method_id    uuid not null references public.payment_methods(id),
  amount       numeric(12,2) not null check (amount > 0),
  reference_no text,
  proof_path   text,
  status       public.payment_status not null default 'awaiting_proof',
  review_note  text,
  submitted_at timestamptz,
  reviewed_at  timestamptz,
  reviewed_by  uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);
create index order_payments_order_idx  on public.order_payments(order_id);
create index order_payments_method_idx on public.order_payments(method_id);

create table public.order_comments (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  author_id   uuid not null references public.profiles(id),
  body        text not null check (length(trim(body)) > 0),
  is_internal boolean not null default false,  -- manager-only notes
  created_at  timestamptz not null default now()
);
create index order_comments_order_idx on public.order_comments(order_id);

create table public.order_status_history (
  id         bigint generated always as identity primary key,
  order_id   uuid not null references public.orders(id) on delete cascade,
  status     public.order_status not null,
  changed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history(order_id);

create or replace function public.touch_order()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger orders_touch before update on public.orders
  for each row execute function public.touch_order();

create or replace function public.log_order_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.order_status_history (order_id, status, changed_by)
    values (new.id, new.status, auth.uid());
  end if;
  return null;
end $$;

create trigger orders_status_log after insert or update of status on public.orders
  for each row execute function public.log_order_status();

-- ---------------------------------------------------------------------
-- Payment method usage / remaining capacity (GCash limit tracking)
-- Counts every split that is not rejected and whose order is not cancelled.
-- Day / month boundaries use Philippine time.
-- ---------------------------------------------------------------------
create or replace function public.payment_method_capacity()
returns table (
  id uuid, type public.payment_type, label text, account_name text, account_number text,
  qr_url text, instructions text, daily_limit numeric, monthly_limit numeric,
  active boolean, sort integer,
  used_today numeric, used_month numeric, verified_month numeric, remaining numeric
)
language sql stable security definer set search_path = public as $$
  with usage as (
    select op.method_id,
      coalesce(sum(op.amount) filter (
        where (op.created_at at time zone 'Asia/Manila')::date = (now() at time zone 'Asia/Manila')::date), 0) as used_today,
      coalesce(sum(op.amount) filter (
        where date_trunc('month', op.created_at at time zone 'Asia/Manila')
            = date_trunc('month', now() at time zone 'Asia/Manila')), 0) as used_month,
      coalesce(sum(op.amount) filter (
        where op.status = 'verified'
          and date_trunc('month', op.created_at at time zone 'Asia/Manila')
            = date_trunc('month', now() at time zone 'Asia/Manila')), 0) as verified_month
    from public.order_payments op
    join public.orders o on o.id = op.order_id
    where op.status <> 'rejected' and o.status <> 'cancelled'
    group by op.method_id
  )
  select pm.id, pm.type, pm.label, pm.account_name, pm.account_number, pm.qr_url, pm.instructions,
         pm.daily_limit, pm.monthly_limit, pm.active, pm.sort,
         coalesce(u.used_today, 0), coalesce(u.used_month, 0), coalesce(u.verified_month, 0),
         least(   -- LEAST ignores NULLs; NULL result = unlimited
           case when pm.daily_limit   is null then null else greatest(pm.daily_limit   - coalesce(u.used_today, 0), 0) end,
           case when pm.monthly_limit is null then null else greatest(pm.monthly_limit - coalesce(u.used_month, 0), 0) end
         )
  from public.payment_methods pm
  left join usage u on u.method_id = pm.id
  where pm.active or public.is_manager()
  order by pm.sort, pm.label;
$$;

-- =====================================================================
-- Business-logic RPCs (all state changes go through these)
-- =====================================================================

-- Customer places an order. Prices, shipping and limits are computed server-side.
-- p_items:    [{ "product_id": uuid, "qty": int }]
-- p_shipping: { name, phone, address, city, province, region, zip, notes }
-- p_payments: [{ "method_id": uuid, "amount": number }]  (several rows only for GCash splits)
create or replace function public.place_order(p_items jsonb, p_shipping jsonb, p_payments jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid      uuid := auth.uid();
  v_order_id uuid;
  v_subtotal numeric := 0;
  v_weight   numeric := 0;
  v_fee      numeric;
  v_total    numeric;
  v_item     jsonb;
  v_prod     public.products%rowtype;
  v_qty      integer;
  v_price    numeric;
  v_pay      jsonb;
  v_amount   numeric;
  v_pay_sum  numeric := 0;
  v_cap      record;
  v_types    integer;
begin
  if v_uid is null then raise exception 'Please sign in first'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'Your cart is empty'; end if;
  if p_payments is null or jsonb_array_length(p_payments) = 0 then raise exception 'Please choose a payment method'; end if;
  if coalesce(trim(p_shipping->>'name'), '') = '' or coalesce(trim(p_shipping->>'phone'), '') = ''
     or coalesce(trim(p_shipping->>'address'), '') = '' or coalesce(trim(p_shipping->>'city'), '') = ''
     or coalesce(trim(p_shipping->>'region'), '') = '' then
    raise exception 'Please complete the delivery address';
  end if;

  insert into public.orders (user_id, ship_name, ship_phone, ship_address, ship_city,
                             ship_province, ship_region, ship_zip, notes)
  values (v_uid, trim(p_shipping->>'name'), trim(p_shipping->>'phone'), trim(p_shipping->>'address'),
          trim(p_shipping->>'city'), nullif(trim(p_shipping->>'province'), ''), p_shipping->>'region',
          nullif(trim(p_shipping->>'zip'), ''), nullif(trim(p_shipping->>'notes'), ''))
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'qty')::integer;
    if v_qty is null or v_qty < 1 then raise exception 'Invalid quantity'; end if;

    select * into v_prod from public.products
    where id = (v_item->>'product_id')::uuid and active
    for update;
    if not found then raise exception 'A product in your cart is no longer available'; end if;
    if v_prod.stock < v_qty then
      raise exception 'Only % left in stock for %', v_prod.stock, v_prod.name;
    end if;

    v_price := public.effective_price(v_prod);
    insert into public.order_items (order_id, product_id, name, unit, unit_price, qty, line_total)
    values (v_order_id, v_prod.id, v_prod.name, v_prod.unit, v_price, v_qty, v_price * v_qty);

    update public.products set stock = stock - v_qty where id = v_prod.id;
    v_subtotal := v_subtotal + v_price * v_qty;
    v_weight   := v_weight + v_prod.weight_kg * v_qty;
  end loop;

  v_fee := public.quote_shipping(p_shipping->>'region', v_weight);
  if v_fee is null then raise exception 'We do not ship to % yet', p_shipping->>'region'; end if;
  v_total := v_subtotal + v_fee;

  update public.orders
  set subtotal = v_subtotal, shipping_fee = v_fee, total = v_total, total_weight_kg = v_weight
  where id = v_order_id;

  -- payment splits
  if (select count(*) from jsonb_array_elements(p_payments)) <>
     (select count(distinct e->>'method_id') from jsonb_array_elements(p_payments) e) then
    raise exception 'Each payment account can only be used once per order';
  end if;

  for v_pay in select * from jsonb_array_elements(p_payments) loop
    v_amount := round((v_pay->>'amount')::numeric, 2);
    if v_amount is null or v_amount <= 0 then raise exception 'Invalid payment amount'; end if;

    select * into v_cap from public.payment_method_capacity() c
    where c.id = (v_pay->>'method_id')::uuid and c.active;
    if not found then raise exception 'Selected payment method is not available'; end if;

    if v_cap.remaining is not null and v_amount > v_cap.remaining then
      raise exception '% can only receive ₱% more right now (transaction limit). Split the payment across another account.',
        v_cap.label, to_char(v_cap.remaining, 'FM999,999,990.00');
    end if;

    insert into public.order_payments (order_id, method_id, amount) values (v_order_id, v_cap.id, v_amount);
    v_pay_sum := v_pay_sum + v_amount;
  end loop;

  select count(distinct pm.type) into v_types
  from jsonb_array_elements(p_payments) e
  join public.payment_methods pm on pm.id = (e->>'method_id')::uuid;
  if jsonb_array_length(p_payments) > 1 and (v_types > 1 or exists (
       select 1 from jsonb_array_elements(p_payments) e
       join public.payment_methods pm on pm.id = (e->>'method_id')::uuid where pm.type <> 'gcash')) then
    raise exception 'Only GCash payments can be split across several accounts';
  end if;

  if abs(v_pay_sum - v_total) > 0.009 then
    raise exception 'Payment amounts (₱%) must add up to the order total (₱%)',
      to_char(v_pay_sum, 'FM999,999,990.00'), to_char(v_total, 'FM999,999,990.00');
  end if;

  return v_order_id;
end $$;

-- Customer attaches proof of payment to one split. Returns the order's new status.
create or replace function public.submit_payment_proof(p_payment_id uuid, p_proof_path text, p_reference text)
returns public.order_status language plpgsql security definer set search_path = public as $$
declare
  v_pay   public.order_payments%rowtype;
  v_order public.orders%rowtype;
  v_new   public.order_status;
begin
  select * into v_pay from public.order_payments where id = p_payment_id for update;
  if not found then raise exception 'Payment not found'; end if;
  select * into v_order from public.orders where id = v_pay.order_id for update;

  if v_order.user_id <> auth.uid() then raise exception 'This is not your order'; end if;
  if v_order.status not in ('pending_payment', 'payment_rejected', 'for_verification') then
    raise exception 'This order is no longer waiting for payment';
  end if;
  if v_pay.status = 'verified' then raise exception 'This payment is already verified'; end if;
  if p_proof_path is null or split_part(p_proof_path, '/', 1) <> auth.uid()::text then
    raise exception 'Invalid proof file';
  end if;

  update public.order_payments
  set proof_path = p_proof_path, reference_no = nullif(trim(p_reference), ''),
      status = 'submitted', submitted_at = now(), review_note = null
  where id = p_payment_id;

  if not exists (select 1 from public.order_payments
                 where order_id = v_order.id and status in ('awaiting_proof', 'rejected')) then
    v_new := 'for_verification';
  else
    v_new := case when v_order.status = 'payment_rejected'
                  and not exists (select 1 from public.order_payments where order_id = v_order.id and status = 'rejected')
             then 'pending_payment' else v_order.status end;
  end if;

  update public.orders set status = v_new where id = v_order.id and status is distinct from v_new;
  return v_new;
end $$;

-- Manager verifies or rejects one payment split. Comment is required when rejecting.
create or replace function public.manager_review_payment(p_payment_id uuid, p_approve boolean, p_comment text)
returns public.order_status language plpgsql security definer set search_path = public as $$
declare
  v_pay   public.order_payments%rowtype;
  v_order public.orders%rowtype;
  v_new   public.order_status;
begin
  if not public.is_manager() then raise exception 'Managers only'; end if;

  select * into v_pay from public.order_payments where id = p_payment_id for update;
  if not found then raise exception 'Payment not found'; end if;
  select * into v_order from public.orders where id = v_pay.order_id for update;

  if v_pay.status <> 'submitted' then raise exception 'This payment has no proof waiting for review'; end if;
  if not p_approve and coalesce(trim(p_comment), '') = '' then
    raise exception 'Please add a comment telling the customer why the payment could not be verified';
  end if;

  update public.order_payments
  set status = case when p_approve then 'verified'::public.payment_status else 'rejected'::public.payment_status end,
      reviewed_at = now(), reviewed_by = auth.uid(), review_note = nullif(trim(p_comment), '')
  where id = p_payment_id;

  if coalesce(trim(p_comment), '') <> '' then
    insert into public.order_comments (order_id, author_id, body) values (v_order.id, auth.uid(), trim(p_comment));
  end if;

  if exists (select 1 from public.order_payments where order_id = v_order.id and status = 'rejected') then
    v_new := 'payment_rejected';
  elsif not exists (select 1 from public.order_payments where order_id = v_order.id and status <> 'verified') then
    v_new := 'payment_verified';
  elsif exists (select 1 from public.order_payments where order_id = v_order.id and status = 'awaiting_proof') then
    v_new := 'pending_payment';
  else
    v_new := 'for_verification';
  end if;

  update public.orders
  set status = v_new,
      verified_at = case when v_new = 'payment_verified' then now() else verified_at end
  where id = v_order.id and status is distinct from v_new;

  return v_new;
end $$;

-- Manager moves an order through fulfilment or cancels it (cancel restores stock).
create or replace function public.manager_update_order(p_order_id uuid, p_status public.order_status,
                                                       p_tracking text default null, p_note text default null)
returns public.order_status language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
begin
  if not public.is_manager() then raise exception 'Managers only'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;

  if p_status = 'shipped' and v_order.status <> 'payment_verified' then
    raise exception 'Only orders with verified payment can be shipped';
  elsif p_status = 'delivered' and v_order.status <> 'shipped' then
    raise exception 'Only shipped orders can be marked delivered';
  elsif p_status = 'cancelled' and v_order.status in ('shipped', 'delivered', 'received', 'cancelled') then
    raise exception 'This order can no longer be cancelled';
  elsif p_status not in ('shipped', 'delivered', 'cancelled') then
    raise exception 'Use the payment review to change payment status';
  end if;

  if p_status = 'cancelled' then
    update public.products p set stock = p.stock + oi.qty
    from public.order_items oi where oi.order_id = p_order_id and oi.product_id = p.id;
  end if;

  update public.orders
  set status = p_status,
      tracking_no = coalesce(nullif(trim(p_tracking), ''), tracking_no),
      shipped_at = case when p_status = 'shipped' then now() else shipped_at end
  where id = p_order_id;

  if coalesce(trim(p_note), '') <> '' then
    insert into public.order_comments (order_id, author_id, body) values (p_order_id, auth.uid(), trim(p_note));
  end if;

  return p_status;
end $$;

-- Customer presses "Received".
create or replace function public.customer_mark_received(p_order_id uuid)
returns public.order_status language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.user_id <> auth.uid() then raise exception 'Order not found'; end if;
  if v_order.status not in ('shipped', 'delivered') then
    raise exception 'You can confirm receipt once the order has been shipped';
  end if;
  update public.orders set status = 'received', received_at = now() where id = p_order_id;
  return 'received';
end $$;

-- =====================================================================
-- Row-level security
-- =====================================================================
alter table public.profiles             enable row level security;
alter table public.products             enable row level security;
alter table public.shipping_zones       enable row level security;
alter table public.shipping_regions     enable row level security;
alter table public.payment_methods      enable row level security;
alter table public.orders               enable row level security;
alter table public.order_items          enable row level security;
alter table public.order_payments       enable row level security;
alter table public.order_comments       enable row level security;
alter table public.order_status_history enable row level security;

-- profiles: own row, managers see everyone, everyone can see manager names (for comments)
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or role = 'manager' or public.is_manager());
create policy profiles_update_own on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;   -- role cannot be self-promoted

-- catalogue & config: public read, manager write
create policy products_read  on public.products for select using (active or public.is_manager());
create policy products_write on public.products for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

create policy zones_read    on public.shipping_zones for select using (true);
create policy zones_write   on public.shipping_zones for all to authenticated
  using (public.is_manager()) with check (public.is_manager());
create policy regions_read  on public.shipping_regions for select using (true);
create policy regions_write on public.shipping_regions for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

create policy pm_read  on public.payment_methods for select using (active or public.is_manager());
create policy pm_write on public.payment_methods for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- orders: read own / manager reads all. Writes only via the RPCs above.
create policy orders_read on public.orders for select
  using (user_id = auth.uid() or public.is_manager());

create policy items_read on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id));
create policy payments_read on public.order_payments for select
  using (exists (select 1 from public.orders o where o.id = order_id));
create policy history_read on public.order_status_history for select
  using (exists (select 1 from public.orders o where o.id = order_id));

-- comments: customers see non-internal comments on their orders and can reply
create policy comments_read on public.order_comments for select
  using (public.is_manager()
         or (not is_internal and exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())));
create policy comments_insert on public.order_comments for insert to authenticated
  with check (author_id = auth.uid() and (
    public.is_manager()
    or (not is_internal and exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()))));

-- RPC access
revoke execute on function public.place_order(jsonb, jsonb, jsonb)                       from anon;
revoke execute on function public.submit_payment_proof(uuid, text, text)                 from anon;
revoke execute on function public.manager_review_payment(uuid, boolean, text)            from anon;
revoke execute on function public.manager_update_order(uuid, public.order_status, text, text) from anon;
revoke execute on function public.customer_mark_received(uuid)                           from anon;

-- Live status updates on the order page (Supabase Realtime respects RLS)
alter publication supabase_realtime add table public.orders;

-- =====================================================================
-- Storage: private proofs bucket, public assets bucket (product photos, QR codes)
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']),
       ('public-assets', 'public-assets', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

-- proofs live under <user_id>/<order_id>/...
create policy "proofs: upload to own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "proofs: read own or manager" on storage.objects for select to authenticated
  using (bucket_id = 'payment-proofs'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_manager()));

create policy "assets: public read" on storage.objects for select
  using (bucket_id = 'public-assets');
create policy "assets: manager insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'public-assets' and public.is_manager());
create policy "assets: manager update" on storage.objects for update to authenticated
  using (bucket_id = 'public-assets' and public.is_manager());
create policy "assets: manager delete" on storage.objects for delete to authenticated
  using (bucket_id = 'public-assets' and public.is_manager());

-- =====================================================================
-- Shipping configuration (sample rates — replace with your J&T rate card)
-- =====================================================================
insert into public.shipping_zones (code, name, base_fee, base_kg, per_kg_fee, eta) values
  ('METRO_MANILA', 'Metro Manila',      120, 1, 40, '1–3 days'),
  ('LUZON',        'Luzon (provincial)', 160, 1, 50, '2–5 days'),
  ('VISAYAS',      'Visayas',           190, 1, 60, '3–7 days'),
  ('MINDANAO',     'Mindanao',          210, 1, 70, '4–8 days');

insert into public.shipping_regions (region, zone_code, sort) values
  ('NCR – Metro Manila',               'METRO_MANILA', 1),
  ('CAR – Cordillera',                 'LUZON', 2),
  ('Region I – Ilocos',                'LUZON', 3),
  ('Region II – Cagayan Valley',       'LUZON', 4),
  ('Region III – Central Luzon',       'LUZON', 5),
  ('Region IV-A – CALABARZON',         'LUZON', 6),
  ('MIMAROPA',                         'LUZON', 7),
  ('Region V – Bicol',                 'LUZON', 8),
  ('Region VI – Western Visayas',      'VISAYAS', 9),
  ('NIR – Negros Island',              'VISAYAS', 10),
  ('Region VII – Central Visayas',     'VISAYAS', 11),
  ('Region VIII – Eastern Visayas',    'VISAYAS', 12),
  ('Region IX – Zamboanga Peninsula',  'MINDANAO', 13),
  ('Region X – Northern Mindanao',     'MINDANAO', 14),
  ('Region XI – Davao',                'MINDANAO', 15),
  ('Region XII – SOCCSKSARGEN',        'MINDANAO', 16),
  ('Region XIII – Caraga',             'MINDANAO', 17),
  ('BARMM',                            'MINDANAO', 18);
