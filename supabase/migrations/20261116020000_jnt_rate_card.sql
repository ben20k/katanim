-- =====================================================================
-- J&T Express rate card
-- Fees by ORIGIN zone × DESTINATION zone × WEIGHT bracket (up to 6 kg),
-- plus a per-kg rate above the top bracket. Destination zone is decided by
-- PROVINCE (so island provinces get J&T's "Island" rate), falling back to region.
--
-- Seeded from J&T Express Philippines' published rate card (as reproduced from
-- J&T's Facebook page, last listed January 2025). Rates change — managers can
-- edit everything in Manager → Shipping rates.
-- =====================================================================

-- 1. Island zone
insert into public.shipping_zones (code, name, base_fee, base_kg, per_kg_fee, eta)
values ('ISLAND', 'Island provinces', 0, 0, 0, '5–6 days')
on conflict (code) do nothing;

-- 2. Store settings (single row): where Katanim ships FROM
create table if not exists public.store_settings (
  id             integer primary key default 1 check (id = 1),
  origin_zone    text not null default 'METRO_MANILA' references public.shipping_zones(code),
  rates_source   text,
  rates_updated  date,
  updated_at     timestamptz not null default now()
);
insert into public.store_settings (id, origin_zone, rates_source, rates_updated)
values (1, 'METRO_MANILA', 'J&T Express PH published rate card (listed Jan 2025)', '2025-01-07')
on conflict (id) do nothing;

-- 3. Rate brackets: fee for parcels up to max_kg
create table if not exists public.shipping_rates (
  origin_zone text not null references public.shipping_zones(code),
  dest_zone   text not null references public.shipping_zones(code),
  max_kg      numeric(6,2) not null check (max_kg > 0),
  fee         numeric(10,2) not null check (fee >= 0),
  primary key (origin_zone, dest_zone, max_kg)
);

-- 4. Per-lane extras: charge per kg above the top bracket, delivery estimate
create table if not exists public.shipping_lanes (
  origin_zone  text not null references public.shipping_zones(code),
  dest_zone    text not null references public.shipping_zones(code),
  extra_per_kg numeric(10,2) not null default 0 check (extra_per_kg >= 0),
  eta          text,
  primary key (origin_zone, dest_zone)
);

-- 5. Province → zone (overrides the region's zone)
create table if not exists public.shipping_provinces (
  province  text primary key,
  region    text not null references public.shipping_regions(region) on update cascade,
  zone_code text not null references public.shipping_zones(code)
);

insert into public.shipping_rates (origin_zone, dest_zone, max_kg, fee) values
  ('METRO_MANILA','METRO_MANILA',0.5,85),
  ('METRO_MANILA','METRO_MANILA',1,115),
  ('METRO_MANILA','METRO_MANILA',3,155),
  ('METRO_MANILA','METRO_MANILA',4,225),
  ('METRO_MANILA','METRO_MANILA',5,305),
  ('METRO_MANILA','METRO_MANILA',6,455),
  ('METRO_MANILA','LUZON',0.5,95),
  ('METRO_MANILA','LUZON',1,165),
  ('METRO_MANILA','LUZON',3,190),
  ('METRO_MANILA','LUZON',4,280),
  ('METRO_MANILA','LUZON',5,370),
  ('METRO_MANILA','LUZON',6,465),
  ('METRO_MANILA','VISAYAS',0.5,100),
  ('METRO_MANILA','VISAYAS',1,180),
  ('METRO_MANILA','VISAYAS',3,200),
  ('METRO_MANILA','VISAYAS',4,300),
  ('METRO_MANILA','VISAYAS',5,400),
  ('METRO_MANILA','VISAYAS',6,500),
  ('METRO_MANILA','MINDANAO',0.5,105),
  ('METRO_MANILA','MINDANAO',1,195),
  ('METRO_MANILA','MINDANAO',3,220),
  ('METRO_MANILA','MINDANAO',4,330),
  ('METRO_MANILA','MINDANAO',5,440),
  ('METRO_MANILA','MINDANAO',6,550),
  ('METRO_MANILA','ISLAND',0.5,115),
  ('METRO_MANILA','ISLAND',1,205),
  ('METRO_MANILA','ISLAND',3,230),
  ('METRO_MANILA','ISLAND',4,340),
  ('METRO_MANILA','ISLAND',5,450),
  ('METRO_MANILA','ISLAND',6,560),
  ('LUZON','METRO_MANILA',0.5,95),
  ('LUZON','METRO_MANILA',1,165),
  ('LUZON','METRO_MANILA',3,190),
  ('LUZON','METRO_MANILA',4,280),
  ('LUZON','METRO_MANILA',5,370),
  ('LUZON','METRO_MANILA',6,465),
  ('LUZON','LUZON',0.5,85),
  ('LUZON','LUZON',1,155),
  ('LUZON','LUZON',3,180),
  ('LUZON','LUZON',4,270),
  ('LUZON','LUZON',5,360),
  ('LUZON','LUZON',6,455),
  ('LUZON','VISAYAS',0.5,100),
  ('LUZON','VISAYAS',1,180),
  ('LUZON','VISAYAS',3,200),
  ('LUZON','VISAYAS',4,300),
  ('LUZON','VISAYAS',5,400),
  ('LUZON','VISAYAS',6,500),
  ('LUZON','MINDANAO',0.5,105),
  ('LUZON','MINDANAO',1,195),
  ('LUZON','MINDANAO',3,220),
  ('LUZON','MINDANAO',4,330),
  ('LUZON','MINDANAO',5,440),
  ('LUZON','MINDANAO',6,550),
  ('LUZON','ISLAND',0.5,115),
  ('LUZON','ISLAND',1,205),
  ('LUZON','ISLAND',3,230),
  ('LUZON','ISLAND',4,340),
  ('LUZON','ISLAND',5,450),
  ('LUZON','ISLAND',6,560),
  ('VISAYAS','METRO_MANILA',0.5,100),
  ('VISAYAS','METRO_MANILA',1,180),
  ('VISAYAS','METRO_MANILA',3,200),
  ('VISAYAS','METRO_MANILA',4,300),
  ('VISAYAS','METRO_MANILA',5,400),
  ('VISAYAS','METRO_MANILA',6,500),
  ('VISAYAS','LUZON',0.5,100),
  ('VISAYAS','LUZON',1,180),
  ('VISAYAS','LUZON',3,200),
  ('VISAYAS','LUZON',4,300),
  ('VISAYAS','LUZON',5,400),
  ('VISAYAS','LUZON',6,500),
  ('VISAYAS','VISAYAS',0.5,85),
  ('VISAYAS','VISAYAS',1,155),
  ('VISAYAS','VISAYAS',3,180),
  ('VISAYAS','VISAYAS',4,270),
  ('VISAYAS','VISAYAS',5,360),
  ('VISAYAS','VISAYAS',6,455),
  ('VISAYAS','MINDANAO',0.5,105),
  ('VISAYAS','MINDANAO',1,175),
  ('VISAYAS','MINDANAO',3,200),
  ('VISAYAS','MINDANAO',4,290),
  ('VISAYAS','MINDANAO',5,380),
  ('VISAYAS','MINDANAO',6,475),
  ('VISAYAS','ISLAND',0.5,115),
  ('VISAYAS','ISLAND',1,185),
  ('VISAYAS','ISLAND',3,210),
  ('VISAYAS','ISLAND',4,300),
  ('VISAYAS','ISLAND',5,390),
  ('VISAYAS','ISLAND',6,485),
  ('MINDANAO','METRO_MANILA',0.5,105),
  ('MINDANAO','METRO_MANILA',1,195),
  ('MINDANAO','METRO_MANILA',3,215),
  ('MINDANAO','METRO_MANILA',4,325),
  ('MINDANAO','METRO_MANILA',5,435),
  ('MINDANAO','METRO_MANILA',6,545),
  ('MINDANAO','LUZON',0.5,105),
  ('MINDANAO','LUZON',1,195),
  ('MINDANAO','LUZON',3,215),
  ('MINDANAO','LUZON',4,325),
  ('MINDANAO','LUZON',5,435),
  ('MINDANAO','LUZON',6,545),
  ('MINDANAO','VISAYAS',0.5,105),
  ('MINDANAO','VISAYAS',1,175),
  ('MINDANAO','VISAYAS',3,195),
  ('MINDANAO','VISAYAS',4,285),
  ('MINDANAO','VISAYAS',5,375),
  ('MINDANAO','VISAYAS',6,470),
  ('MINDANAO','MINDANAO',0.5,85),
  ('MINDANAO','MINDANAO',1,155),
  ('MINDANAO','MINDANAO',3,180),
  ('MINDANAO','MINDANAO',4,270),
  ('MINDANAO','MINDANAO',5,360),
  ('MINDANAO','MINDANAO',6,455),
  ('MINDANAO','ISLAND',0.5,115),
  ('MINDANAO','ISLAND',1,205),
  ('MINDANAO','ISLAND',3,230),
  ('MINDANAO','ISLAND',4,340),
  ('MINDANAO','ISLAND',5,450),
  ('MINDANAO','ISLAND',6,560),
  ('ISLAND','METRO_MANILA',0.5,115),
  ('ISLAND','METRO_MANILA',1,205),
  ('ISLAND','METRO_MANILA',3,230),
  ('ISLAND','METRO_MANILA',4,340),
  ('ISLAND','METRO_MANILA',5,450),
  ('ISLAND','METRO_MANILA',6,560),
  ('ISLAND','LUZON',0.5,115),
  ('ISLAND','LUZON',1,205),
  ('ISLAND','LUZON',3,230),
  ('ISLAND','LUZON',4,340),
  ('ISLAND','LUZON',5,450),
  ('ISLAND','LUZON',6,560),
  ('ISLAND','VISAYAS',0.5,115),
  ('ISLAND','VISAYAS',1,185),
  ('ISLAND','VISAYAS',3,210),
  ('ISLAND','VISAYAS',4,300),
  ('ISLAND','VISAYAS',5,390),
  ('ISLAND','VISAYAS',6,485),
  ('ISLAND','MINDANAO',0.5,115),
  ('ISLAND','MINDANAO',1,205),
  ('ISLAND','MINDANAO',3,230),
  ('ISLAND','MINDANAO',4,340),
  ('ISLAND','MINDANAO',5,450),
  ('ISLAND','MINDANAO',6,560),
  ('ISLAND','ISLAND',0.5,115),
  ('ISLAND','ISLAND',1,205),
  ('ISLAND','ISLAND',3,230),
  ('ISLAND','ISLAND',4,340),
  ('ISLAND','ISLAND',5,450),
  ('ISLAND','ISLAND',6,560)
on conflict (origin_zone, dest_zone, max_kg) do update set fee = excluded.fee;

-- extra_per_kg above 6 kg = the step between the 5 kg and 6 kg brackets (estimate; confirm with J&T)
insert into public.shipping_lanes (origin_zone, dest_zone, extra_per_kg, eta) values
  ('METRO_MANILA','METRO_MANILA',150,'1–2 days'),
  ('METRO_MANILA','LUZON',95,'1–5 days'),
  ('METRO_MANILA','VISAYAS',100,'3–7 days'),
  ('METRO_MANILA','MINDANAO',110,'3–7 days'),
  ('METRO_MANILA','ISLAND',110,'5–6 days'),
  ('LUZON','METRO_MANILA',95,'1–5 days'),
  ('LUZON','LUZON',95,'1–5 days'),
  ('LUZON','VISAYAS',100,'3–7 days'),
  ('LUZON','MINDANAO',110,'3–7 days'),
  ('LUZON','ISLAND',110,'5–6 days'),
  ('VISAYAS','METRO_MANILA',100,'3–7 days'),
  ('VISAYAS','LUZON',100,'3–7 days'),
  ('VISAYAS','VISAYAS',95,'1–5 days'),
  ('VISAYAS','MINDANAO',95,'3–7 days'),
  ('VISAYAS','ISLAND',95,'5–6 days'),
  ('MINDANAO','METRO_MANILA',110,'3–7 days'),
  ('MINDANAO','LUZON',110,'3–7 days'),
  ('MINDANAO','VISAYAS',95,'3–7 days'),
  ('MINDANAO','MINDANAO',95,'1–5 days'),
  ('MINDANAO','ISLAND',110,'5–6 days'),
  ('ISLAND','METRO_MANILA',110,'5–6 days'),
  ('ISLAND','LUZON',110,'5–6 days'),
  ('ISLAND','VISAYAS',95,'5–6 days'),
  ('ISLAND','MINDANAO',110,'5–6 days'),
  ('ISLAND','ISLAND',110,'5–6 days')
on conflict (origin_zone, dest_zone) do update set extra_per_kg = excluded.extra_per_kg, eta = excluded.eta;

-- Island provinces are marked ISLAND (best guess — confirm with J&T and adjust in the manager page)
insert into public.shipping_provinces (province, region, zone_code) values
  ('Metro Manila','NCR – Metro Manila',(select zone_code from public.shipping_regions where region = 'NCR – Metro Manila')),
  ('Abra','CAR – Cordillera',(select zone_code from public.shipping_regions where region = 'CAR – Cordillera')),
  ('Apayao','CAR – Cordillera',(select zone_code from public.shipping_regions where region = 'CAR – Cordillera')),
  ('Benguet','CAR – Cordillera',(select zone_code from public.shipping_regions where region = 'CAR – Cordillera')),
  ('Ifugao','CAR – Cordillera',(select zone_code from public.shipping_regions where region = 'CAR – Cordillera')),
  ('Kalinga','CAR – Cordillera',(select zone_code from public.shipping_regions where region = 'CAR – Cordillera')),
  ('Mountain Province','CAR – Cordillera',(select zone_code from public.shipping_regions where region = 'CAR – Cordillera')),
  ('Ilocos Norte','Region I – Ilocos',(select zone_code from public.shipping_regions where region = 'Region I – Ilocos')),
  ('Ilocos Sur','Region I – Ilocos',(select zone_code from public.shipping_regions where region = 'Region I – Ilocos')),
  ('La Union','Region I – Ilocos',(select zone_code from public.shipping_regions where region = 'Region I – Ilocos')),
  ('Pangasinan','Region I – Ilocos',(select zone_code from public.shipping_regions where region = 'Region I – Ilocos')),
  ('Batanes','Region II – Cagayan Valley','ISLAND'),
  ('Cagayan','Region II – Cagayan Valley',(select zone_code from public.shipping_regions where region = 'Region II – Cagayan Valley')),
  ('Isabela','Region II – Cagayan Valley',(select zone_code from public.shipping_regions where region = 'Region II – Cagayan Valley')),
  ('Nueva Vizcaya','Region II – Cagayan Valley',(select zone_code from public.shipping_regions where region = 'Region II – Cagayan Valley')),
  ('Quirino','Region II – Cagayan Valley',(select zone_code from public.shipping_regions where region = 'Region II – Cagayan Valley')),
  ('Aurora','Region III – Central Luzon',(select zone_code from public.shipping_regions where region = 'Region III – Central Luzon')),
  ('Bataan','Region III – Central Luzon',(select zone_code from public.shipping_regions where region = 'Region III – Central Luzon')),
  ('Bulacan','Region III – Central Luzon',(select zone_code from public.shipping_regions where region = 'Region III – Central Luzon')),
  ('Nueva Ecija','Region III – Central Luzon',(select zone_code from public.shipping_regions where region = 'Region III – Central Luzon')),
  ('Pampanga','Region III – Central Luzon',(select zone_code from public.shipping_regions where region = 'Region III – Central Luzon')),
  ('Tarlac','Region III – Central Luzon',(select zone_code from public.shipping_regions where region = 'Region III – Central Luzon')),
  ('Zambales','Region III – Central Luzon',(select zone_code from public.shipping_regions where region = 'Region III – Central Luzon')),
  ('Batangas','Region IV-A – CALABARZON',(select zone_code from public.shipping_regions where region = 'Region IV-A – CALABARZON')),
  ('Cavite','Region IV-A – CALABARZON',(select zone_code from public.shipping_regions where region = 'Region IV-A – CALABARZON')),
  ('Laguna','Region IV-A – CALABARZON',(select zone_code from public.shipping_regions where region = 'Region IV-A – CALABARZON')),
  ('Quezon','Region IV-A – CALABARZON',(select zone_code from public.shipping_regions where region = 'Region IV-A – CALABARZON')),
  ('Rizal','Region IV-A – CALABARZON',(select zone_code from public.shipping_regions where region = 'Region IV-A – CALABARZON')),
  ('Marinduque','MIMAROPA','ISLAND'),
  ('Occidental Mindoro','MIMAROPA','ISLAND'),
  ('Oriental Mindoro','MIMAROPA','ISLAND'),
  ('Palawan','MIMAROPA','ISLAND'),
  ('Romblon','MIMAROPA','ISLAND'),
  ('Albay','Region V – Bicol',(select zone_code from public.shipping_regions where region = 'Region V – Bicol')),
  ('Camarines Norte','Region V – Bicol',(select zone_code from public.shipping_regions where region = 'Region V – Bicol')),
  ('Camarines Sur','Region V – Bicol',(select zone_code from public.shipping_regions where region = 'Region V – Bicol')),
  ('Catanduanes','Region V – Bicol','ISLAND'),
  ('Masbate','Region V – Bicol','ISLAND'),
  ('Sorsogon','Region V – Bicol',(select zone_code from public.shipping_regions where region = 'Region V – Bicol')),
  ('Aklan','Region VI – Western Visayas',(select zone_code from public.shipping_regions where region = 'Region VI – Western Visayas')),
  ('Antique','Region VI – Western Visayas',(select zone_code from public.shipping_regions where region = 'Region VI – Western Visayas')),
  ('Capiz','Region VI – Western Visayas',(select zone_code from public.shipping_regions where region = 'Region VI – Western Visayas')),
  ('Guimaras','Region VI – Western Visayas',(select zone_code from public.shipping_regions where region = 'Region VI – Western Visayas')),
  ('Iloilo','Region VI – Western Visayas',(select zone_code from public.shipping_regions where region = 'Region VI – Western Visayas')),
  ('Negros Occidental','NIR – Negros Island',(select zone_code from public.shipping_regions where region = 'NIR – Negros Island')),
  ('Negros Oriental','NIR – Negros Island',(select zone_code from public.shipping_regions where region = 'NIR – Negros Island')),
  ('Siquijor','NIR – Negros Island','ISLAND'),
  ('Bohol','Region VII – Central Visayas',(select zone_code from public.shipping_regions where region = 'Region VII – Central Visayas')),
  ('Cebu','Region VII – Central Visayas',(select zone_code from public.shipping_regions where region = 'Region VII – Central Visayas')),
  ('Biliran','Region VIII – Eastern Visayas',(select zone_code from public.shipping_regions where region = 'Region VIII – Eastern Visayas')),
  ('Eastern Samar','Region VIII – Eastern Visayas',(select zone_code from public.shipping_regions where region = 'Region VIII – Eastern Visayas')),
  ('Leyte','Region VIII – Eastern Visayas',(select zone_code from public.shipping_regions where region = 'Region VIII – Eastern Visayas')),
  ('Northern Samar','Region VIII – Eastern Visayas',(select zone_code from public.shipping_regions where region = 'Region VIII – Eastern Visayas')),
  ('Samar','Region VIII – Eastern Visayas',(select zone_code from public.shipping_regions where region = 'Region VIII – Eastern Visayas')),
  ('Southern Leyte','Region VIII – Eastern Visayas',(select zone_code from public.shipping_regions where region = 'Region VIII – Eastern Visayas')),
  ('Zamboanga del Norte','Region IX – Zamboanga Peninsula',(select zone_code from public.shipping_regions where region = 'Region IX – Zamboanga Peninsula')),
  ('Zamboanga del Sur','Region IX – Zamboanga Peninsula',(select zone_code from public.shipping_regions where region = 'Region IX – Zamboanga Peninsula')),
  ('Zamboanga Sibugay','Region IX – Zamboanga Peninsula',(select zone_code from public.shipping_regions where region = 'Region IX – Zamboanga Peninsula')),
  ('Bukidnon','Region X – Northern Mindanao',(select zone_code from public.shipping_regions where region = 'Region X – Northern Mindanao')),
  ('Camiguin','Region X – Northern Mindanao','ISLAND'),
  ('Lanao del Norte','Region X – Northern Mindanao',(select zone_code from public.shipping_regions where region = 'Region X – Northern Mindanao')),
  ('Misamis Occidental','Region X – Northern Mindanao',(select zone_code from public.shipping_regions where region = 'Region X – Northern Mindanao')),
  ('Misamis Oriental','Region X – Northern Mindanao',(select zone_code from public.shipping_regions where region = 'Region X – Northern Mindanao')),
  ('Davao de Oro','Region XI – Davao',(select zone_code from public.shipping_regions where region = 'Region XI – Davao')),
  ('Davao del Norte','Region XI – Davao',(select zone_code from public.shipping_regions where region = 'Region XI – Davao')),
  ('Davao del Sur','Region XI – Davao',(select zone_code from public.shipping_regions where region = 'Region XI – Davao')),
  ('Davao Occidental','Region XI – Davao',(select zone_code from public.shipping_regions where region = 'Region XI – Davao')),
  ('Davao Oriental','Region XI – Davao',(select zone_code from public.shipping_regions where region = 'Region XI – Davao')),
  ('Cotabato','Region XII – SOCCSKSARGEN',(select zone_code from public.shipping_regions where region = 'Region XII – SOCCSKSARGEN')),
  ('Sarangani','Region XII – SOCCSKSARGEN',(select zone_code from public.shipping_regions where region = 'Region XII – SOCCSKSARGEN')),
  ('South Cotabato','Region XII – SOCCSKSARGEN',(select zone_code from public.shipping_regions where region = 'Region XII – SOCCSKSARGEN')),
  ('Sultan Kudarat','Region XII – SOCCSKSARGEN',(select zone_code from public.shipping_regions where region = 'Region XII – SOCCSKSARGEN')),
  ('Agusan del Norte','Region XIII – Caraga',(select zone_code from public.shipping_regions where region = 'Region XIII – Caraga')),
  ('Agusan del Sur','Region XIII – Caraga',(select zone_code from public.shipping_regions where region = 'Region XIII – Caraga')),
  ('Dinagat Islands','Region XIII – Caraga','ISLAND'),
  ('Surigao del Norte','Region XIII – Caraga',(select zone_code from public.shipping_regions where region = 'Region XIII – Caraga')),
  ('Surigao del Sur','Region XIII – Caraga',(select zone_code from public.shipping_regions where region = 'Region XIII – Caraga')),
  ('Basilan','BARMM','ISLAND'),
  ('Lanao del Sur','BARMM',(select zone_code from public.shipping_regions where region = 'BARMM')),
  ('Maguindanao del Norte','BARMM',(select zone_code from public.shipping_regions where region = 'BARMM')),
  ('Maguindanao del Sur','BARMM',(select zone_code from public.shipping_regions where region = 'BARMM')),
  ('Sulu','BARMM','ISLAND'),
  ('Tawi-Tawi','BARMM','ISLAND')
on conflict (province) do nothing;

-- 6. Quote functions
drop function if exists public.quote_shipping(text, numeric);

create or replace function public.shipping_quote(p_region text, p_weight_kg numeric, p_province text default null)
returns table (fee numeric, origin_zone text, dest_zone text, dest_name text, eta text, chargeable_kg numeric)
language plpgsql stable security definer set search_path = public as $$
declare
  v_origin text;
  v_dest   text;
  v_w      numeric := greatest(coalesce(p_weight_kg, 0), 0.01);
  v_fee    numeric;
  v_top    numeric;
  v_topfee numeric;
  v_extra  numeric;
begin
  select s.origin_zone into v_origin from public.store_settings s where s.id = 1;

  select sp.zone_code into v_dest from public.shipping_provinces sp
  where p_province is not null and lower(sp.province) = lower(trim(p_province));
  if v_dest is null then
    select r.zone_code into v_dest from public.shipping_regions r where r.region = p_region;
  end if;
  if v_origin is null or v_dest is null then return; end if;

  select sr.fee into v_fee from public.shipping_rates sr
  where sr.origin_zone = v_origin and sr.dest_zone = v_dest and sr.max_kg >= v_w
  order by sr.max_kg limit 1;

  if v_fee is null then
    select sr.max_kg, sr.fee into v_top, v_topfee from public.shipping_rates sr
    where sr.origin_zone = v_origin and sr.dest_zone = v_dest
    order by sr.max_kg desc limit 1;
    if v_top is null then return; end if;
    select l.extra_per_kg into v_extra from public.shipping_lanes l
    where l.origin_zone = v_origin and l.dest_zone = v_dest;
    v_fee := v_topfee + ceil(v_w - v_top) * coalesce(v_extra, 0);
  end if;

  return query
  select v_fee, v_origin, v_dest, z.name,
         (select l.eta from public.shipping_lanes l where l.origin_zone = v_origin and l.dest_zone = v_dest),
         round(v_w, 2)
  from public.shipping_zones z where z.code = v_dest;
end $$;

-- Simple numeric version (used by place_order)
create or replace function public.quote_shipping(p_region text, p_weight_kg numeric, p_province text default null)
returns numeric language sql stable security definer set search_path = public as $$
  select q.fee from public.shipping_quote(p_region, p_weight_kg, p_province) q;
$$;

-- 7. RLS
alter table public.store_settings     enable row level security;
alter table public.shipping_rates     enable row level security;
alter table public.shipping_lanes     enable row level security;
alter table public.shipping_provinces enable row level security;

create policy settings_read  on public.store_settings for select using (true);
create policy settings_write on public.store_settings for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy rates_read     on public.shipping_rates for select using (true);
create policy rates_write    on public.shipping_rates for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy lanes_read     on public.shipping_lanes for select using (true);
create policy lanes_write    on public.shipping_lanes for all to authenticated using (public.is_manager()) with check (public.is_manager());
create policy provinces_read  on public.shipping_provinces for select using (true);
create policy provinces_write on public.shipping_provinces for all to authenticated using (public.is_manager()) with check (public.is_manager());

-- 8. place_order now prices shipping by province as well
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

  v_fee := public.quote_shipping(p_shipping->>'region', v_weight, p_shipping->>'province');
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
