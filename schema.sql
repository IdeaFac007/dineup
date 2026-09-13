-- DineUp production database starter
create table restaurants (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 category text not null,
 city text not null default 'Lucknow',
 area text,
 phone text,
 menu_url text,
 image_url text,
 status text not null default 'pending',
 created_at timestamptz not null default now()
);

create table campaigns (
 id uuid primary key default gen_random_uuid(),
 restaurant_id uuid references restaurants(id) on delete cascade,
 current_bid numeric(12,2) not null default 0,
 status text not null default 'active',
 starts_at timestamptz,
 ends_at timestamptz,
 created_at timestamptz not null default now()
);

create table bids (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid references campaigns(id) on delete cascade,
 restaurant_id uuid references restaurants(id) on delete cascade,
 amount numeric(12,2) not null,
 payment_status text not null default 'pending',
 created_at timestamptz not null default now()
);

-- Ranking query:
select r.*, c.current_bid,
 row_number() over (order by c.current_bid desc) as rank
from restaurants r join campaigns c on c.restaurant_id=r.id
where r.city='Lucknow' and r.status='approved' and c.status='active'
order by c.current_bid desc;
