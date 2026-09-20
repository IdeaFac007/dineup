begin;

create or replace function public.validate_order_status_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if old.status = 'pending' and new.status in ('accepted', 'rejected', 'cancelled') then
    null;
  elsif old.status = 'accepted' and new.status in ('preparing', 'cancelled') then
    null;
  elsif old.status = 'preparing' and new.status = 'ready' then
    null;
  elsif old.status = 'ready' and new.status = 'completed' then
    null;
  else
    raise exception 'Invalid order status transition: % -> %', old.status, new.status
      using errcode = '22023';
  end if;

  if new.status in ('accepted', 'preparing', 'ready', 'completed')
     and new.payment_status <> 'paid' then
    raise exception 'Order must be paid before status can become %', new.status
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_order_status_transition on public.orders;
create trigger validate_order_status_transition
before update of status on public.orders
for each row
execute function public.validate_order_status_transition();

revoke update on public.orders from authenticated;
grant update (status) on public.orders to authenticated;

create index if not exists orders_restaurant_created_at_idx
on public.orders (restaurant_id, created_at desc);

commit;
