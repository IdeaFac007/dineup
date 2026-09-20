-- 10.0.8.11: order cancellation + Razorpay refund tracking
alter table public.orders add column if not exists razorpay_refund_id text;
alter table public.orders add column if not exists refund_status text;
alter table public.orders add column if not exists refund_amount numeric not null default 0;
alter table public.orders add column if not exists refunded_at timestamptz;
alter table public.orders add column if not exists refund_error text;
alter table public.orders drop constraint if exists orders_refund_status_check;
alter table public.orders add constraint orders_refund_status_check
  check (refund_status is null or refund_status in ('requested','processed','failed'));
create unique index if not exists orders_razorpay_refund_id_uidx
  on public.orders(razorpay_refund_id) where razorpay_refund_id is not null;
create index if not exists orders_refund_status_idx
  on public.orders(refund_status) where refund_status is not null;
