create or replace function public.reconcile_restaurant_current_bid(p_restaurant_id bigint)
returns public.restaurants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_restaurant public.restaurants;
  v_next_bid numeric;
begin
  select coalesce(max(amount), 0)
    into v_next_bid
  from public.bids
  where restaurant_id = p_restaurant_id
    and status = 'active'
    and payment_status = 'captured'
    and refund_status <> 'processed';

  update public.restaurants
  set current_bid = v_next_bid
  where id = p_restaurant_id
  returning * into v_restaurant;

  return v_restaurant;
end;
$$;

revoke all on function public.reconcile_restaurant_current_bid(bigint) from public, anon, authenticated;
grant execute on function public.reconcile_restaurant_current_bid(bigint) to service_role;

create or replace function public.record_bid_refund_from_webhook(
  p_bid_id bigint,
  p_razorpay_refund_id text,
  p_refund_status text,
  p_refund_amount numeric,
  p_refund_reason text default null,
  p_razorpay_payment_id text default null
)
returns public.bids
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bid public.bids;
  v_total_refunded numeric;
begin
  if p_refund_status not in ('pending','processed','failed') then
    raise exception 'Invalid refund status';
  end if;

  if p_razorpay_refund_id is null or length(trim(p_razorpay_refund_id)) = 0 then
    raise exception 'Refund ID is required';
  end if;

  if p_refund_amount is null or p_refund_amount <= 0 then
    raise exception 'Refund amount must be greater than zero';
  end if;

  select * into v_bid
  from public.bids
  where id = p_bid_id
  for update;

  if v_bid.id is null then
    raise exception 'Bid not found';
  end if;

  insert into public.bid_refunds (
    bid_id,
    razorpay_refund_id,
    razorpay_payment_id,
    amount,
    status,
    reason,
    processed_at
  )
  values (
    p_bid_id,
    p_razorpay_refund_id,
    coalesce(nullif(trim(p_razorpay_payment_id), ''), v_bid.razorpay_payment_id),
    p_refund_amount,
    p_refund_status,
    nullif(trim(p_refund_reason), ''),
    case when p_refund_status = 'processed' then now() else null end
  )
  on conflict (razorpay_refund_id) do update
  set status = excluded.status,
      amount = excluded.amount,
      reason = coalesce(excluded.reason, public.bid_refunds.reason),
      processed_at = case
        when excluded.status = 'processed' then coalesce(public.bid_refunds.processed_at, now())
        when excluded.status in ('pending','failed') then null
        else public.bid_refunds.processed_at
      end;

  select coalesce(sum(amount), 0)
    into v_total_refunded
  from public.bid_refunds
  where bid_id = p_bid_id
    and status = 'processed';

  update public.bids
  set razorpay_refund_id = p_razorpay_refund_id,
      refund_status = p_refund_status,
      refund_amount = least(v_total_refunded, amount),
      refund_reason = coalesce(nullif(trim(p_refund_reason), ''), refund_reason),
      refunded_at = case
        when v_total_refunded >= amount then coalesce(refunded_at, now())
        else null
      end,
      status = case
        when p_refund_status = 'processed' and v_total_refunded >= amount then 'refunded'
        else status
      end,
      payment_status = case
        when p_refund_status = 'processed' and v_total_refunded >= amount then 'refunded'
        else payment_status
      end
  where id = p_bid_id
  returning * into v_bid;

  if p_refund_status = 'processed' and v_total_refunded >= v_bid.amount then
    perform public.reconcile_restaurant_current_bid(v_bid.restaurant_id);
  end if;

  return v_bid;
end;
$$;

revoke all on function public.record_bid_refund_from_webhook(bigint,text,text,numeric,text,text) from public, anon, authenticated;
grant execute on function public.record_bid_refund_from_webhook(bigint,text,text,numeric,text,text) to service_role;
