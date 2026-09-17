alter table public.bids
  add column if not exists last_payment_failure_at timestamptz,
  add column if not exists last_razorpay_failure_payment_id text,
  add column if not exists last_payment_failure_code text,
  add column if not exists last_payment_failure_description text;

create or replace function public.expire_stale_pending_bids(p_expiry_minutes integer default 30)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_count integer;
begin
  if p_expiry_minutes < 1 or p_expiry_minutes > 1440 then
    raise exception 'Expiry window must be between 1 and 1440 minutes';
  end if;

  update public.bids
  set status = 'expired',
      payment_status = 'expired'
  where status = 'pending'
    and payment_status = 'pending'
    and created_at < now() - make_interval(mins => p_expiry_minutes);

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.expire_stale_pending_bids(integer) from public;
revoke all on function public.expire_stale_pending_bids(integer) from anon;
revoke all on function public.expire_stale_pending_bids(integer) from authenticated;
grant execute on function public.expire_stale_pending_bids(integer) to service_role;

create or replace function public.record_bid_payment_failure_from_webhook(
  p_bid_id bigint,
  p_razorpay_payment_id text,
  p_failure_code text,
  p_failure_description text
)
returns public.bids
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_bid public.bids;
begin
  select b.* into v_bid
  from public.bids b
  where b.id = p_bid_id
  for update;

  if v_bid.id is null then
    raise exception 'Bid not found';
  end if;

  if v_bid.payment_status = 'captured' then
    return v_bid;
  end if;

  update public.bids
  set last_payment_failure_at = now(),
      last_razorpay_failure_payment_id = nullif(trim(p_razorpay_payment_id), ''),
      last_payment_failure_code = nullif(trim(p_failure_code), ''),
      last_payment_failure_description = nullif(trim(p_failure_description), '')
  where id = p_bid_id
  returning * into v_bid;

  return v_bid;
end;
$$;

revoke all on function public.record_bid_payment_failure_from_webhook(bigint,text,text,text) from public;
revoke all on function public.record_bid_payment_failure_from_webhook(bigint,text,text,text) from anon;
revoke all on function public.record_bid_payment_failure_from_webhook(bigint,text,text,text) from authenticated;
grant execute on function public.record_bid_payment_failure_from_webhook(bigint,text,text,text) to service_role;

create or replace function public.create_pending_bid(p_restaurant_id bigint, p_amount numeric)
returns public.bids
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_restaurant public.restaurants;
  v_bid public.bids;
begin
  perform public.expire_stale_pending_bids(30);

  select * into v_restaurant
  from public.restaurants
  where id = p_restaurant_id
    and owner_id = auth.uid()
    and is_active = true;

  if v_restaurant.id is null then
    raise exception 'Restaurant not found or access denied';
  end if;

  if p_amount <= v_restaurant.current_bid then
    raise exception 'Bid must be higher than current bid of ₹% ', v_restaurant.current_bid;
  end if;

  insert into public.bids (restaurant_id, amount, status, payment_status)
  values (p_restaurant_id, p_amount, 'pending', 'pending')
  returning * into v_bid;

  return v_bid;
end;
$$;

revoke all on function public.create_pending_bid(bigint,numeric) from public;
revoke all on function public.create_pending_bid(bigint,numeric) from anon;
grant execute on function public.create_pending_bid(bigint,numeric) to authenticated;
grant execute on function public.create_pending_bid(bigint,numeric) to service_role;

create or replace function public.confirm_paid_bid_from_webhook(
  p_bid_id bigint,
  p_razorpay_order_id text,
  p_razorpay_payment_id text
)
returns public.bids
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_bid public.bids;
  v_restaurant public.restaurants;
begin
  select b.* into v_bid
  from public.bids b
  join public.restaurants r on r.id = b.restaurant_id
  where b.id = p_bid_id and r.is_active = true
  for update;

  if v_bid.id is null then
    raise exception 'Bid not found or inactive';
  end if;

  if v_bid.razorpay_order_id is null or v_bid.razorpay_order_id <> p_razorpay_order_id then
    raise exception 'Razorpay order mismatch';
  end if;

  if v_bid.payment_status = 'captured' and v_bid.razorpay_payment_id = p_razorpay_payment_id then
    return v_bid;
  end if;

  if v_bid.payment_status not in ('pending', 'expired') then
    raise exception 'Bid is not eligible for payment confirmation';
  end if;

  update public.bids
  set razorpay_payment_id = p_razorpay_payment_id,
      payment_status = 'captured',
      status = 'active',
      last_payment_failure_at = null,
      last_razorpay_failure_payment_id = null,
      last_payment_failure_code = null,
      last_payment_failure_description = null
  where id = p_bid_id
  returning * into v_bid;

  select * into v_restaurant
  from public.restaurants
  where id = v_bid.restaurant_id
  for update;

  if v_restaurant.id is null or v_restaurant.is_active is not true then
    raise exception 'Restaurant not found or inactive';
  end if;

  if v_bid.amount > v_restaurant.current_bid then
    update public.restaurants set current_bid = v_bid.amount where id = v_restaurant.id;
  else
    update public.bids set status = 'paid_outbid' where id = p_bid_id returning * into v_bid;
  end if;

  return v_bid;
end;
$$;

revoke all on function public.confirm_paid_bid_from_webhook(bigint,text,text) from public;
revoke all on function public.confirm_paid_bid_from_webhook(bigint,text,text) from anon;
revoke all on function public.confirm_paid_bid_from_webhook(bigint,text,text) from authenticated;
grant execute on function public.confirm_paid_bid_from_webhook(bigint,text,text) to service_role;

create or replace function public.confirm_paid_bid(
  p_bid_id bigint,
  p_razorpay_order_id text,
  p_razorpay_payment_id text,
  p_razorpay_signature text
)
returns public.bids
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_bid public.bids;
  v_restaurant public.restaurants;
begin
  select b.* into v_bid
  from public.bids b
  join public.restaurants r on r.id = b.restaurant_id
  where b.id = p_bid_id and r.is_active = true
  for update;

  if v_bid.id is null then
    raise exception 'Bid not found or inactive';
  end if;

  if v_bid.razorpay_order_id is null or v_bid.razorpay_order_id <> p_razorpay_order_id then
    raise exception 'Razorpay order mismatch';
  end if;

  if v_bid.payment_status = 'captured' and v_bid.status = 'active' then
    return v_bid;
  end if;

  if v_bid.payment_status not in ('pending', 'expired') then
    raise exception 'Bid is not eligible for payment confirmation';
  end if;

  update public.bids
  set razorpay_payment_id = p_razorpay_payment_id,
      razorpay_signature = p_razorpay_signature,
      payment_status = 'captured',
      status = 'active',
      last_payment_failure_at = null,
      last_razorpay_failure_payment_id = null,
      last_payment_failure_code = null,
      last_payment_failure_description = null
  where id = p_bid_id
  returning * into v_bid;

  select * into v_restaurant
  from public.restaurants
  where id = v_bid.restaurant_id
  for update;

  if v_restaurant.id is null or v_restaurant.is_active is not true then
    raise exception 'Restaurant not found or inactive';
  end if;

  if v_bid.amount > v_restaurant.current_bid then
    update public.restaurants set current_bid = v_bid.amount where id = v_restaurant.id;
  else
    update public.bids set status = 'paid_outbid' where id = p_bid_id returning * into v_bid;
  end if;

  return v_bid;
end;
$$;

revoke all on function public.confirm_paid_bid(bigint,text,text,text) from public;
revoke all on function public.confirm_paid_bid(bigint,text,text,text) from anon;
revoke all on function public.confirm_paid_bid(bigint,text,text,text) from authenticated;
grant execute on function public.confirm_paid_bid(bigint,text,text,text) to service_role;
