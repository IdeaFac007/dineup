alter table public.orders
  add column if not exists razorpay_order_id text,
  add column if not exists razorpay_payment_id text,
  add column if not exists razorpay_signature text,
  add column if not exists paid_at timestamptz,
  add column if not exists payment_error text;

create unique index if not exists orders_razorpay_order_id_uidx
  on public.orders (razorpay_order_id)
  where razorpay_order_id is not null;

create unique index if not exists orders_razorpay_payment_id_uidx
  on public.orders (razorpay_payment_id)
  where razorpay_payment_id is not null;

alter table public.orders
  drop constraint if exists orders_payment_status_check;

alter table public.orders
  add constraint orders_payment_status_check
  check (payment_status in ('pending','paid','failed','refunded','partially_refunded'));
