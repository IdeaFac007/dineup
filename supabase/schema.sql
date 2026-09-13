-- DineUp production starter schema for Supabase/Postgres
create extension if not exists pgcrypto;

create table if not exists restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  name text not null,
  category text not null,
  city text not null default 'Lucknow',
  area text,
  phone text,
  description text,
  menu_url text,
  image_url text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  current_bid numeric(12,2) not null default 1000 check (current_bid >= 0),
  status text not null default 'active' check (status in ('draft','active','paused','ended')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists bids (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded')),
  razorpay_order_id text,
  razorpay_payment_id text,
  created_at timestamptz not null default now()
);

create index if not exists campaigns_rank_idx on campaigns(status,current_bid desc);
create index if not exists restaurants_city_idx on restaurants(city,status);

alter table restaurants enable row level security;
alter table campaigns enable row level security;
alter table bids enable row level security;

-- Public can read approved restaurants and active campaigns.
create policy "public approved restaurants"
on restaurants for select using (status='approved');

create policy "public active campaigns"
on campaigns for select using (status='active');

-- Owners can manage their own restaurant profile.
create policy "owners manage restaurants"
on restaurants for all
using (auth.uid()=owner_id)
with check (auth.uid()=owner_id);

-- Owners can view their campaigns.
create policy "owners view campaigns"
on campaigns for select
using (exists (select 1 from restaurants r where r.id=restaurant_id and r.owner_id=auth.uid()));

-- Owners can view their bids.
create policy "owners view bids"
on bids for select
using (exists (select 1 from restaurants r where r.id=restaurant_id and r.owner_id=auth.uid()));

-- IMPORTANT:
-- Bid insertion/payment confirmation should happen through a trusted server-side API,
-- not directly from an untrusted browser. Add the API route + Razorpay webhook before taking real money.
