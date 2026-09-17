create or replace function public.block_expired_bid_payment_replay()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if old.payment_status = 'expired' and new.payment_status = 'captured' then
    raise exception 'Expired bid cannot be marked as captured';
  end if;

  return new;
end;
$$;

revoke all on function public.block_expired_bid_payment_replay() from public;
revoke all on function public.block_expired_bid_payment_replay() from anon;
revoke all on function public.block_expired_bid_payment_replay() from authenticated;
grant execute on function public.block_expired_bid_payment_replay() to service_role;

drop trigger if exists block_expired_bid_payment_replay on public.bids;
create trigger block_expired_bid_payment_replay
before update on public.bids
for each row
execute function public.block_expired_bid_payment_replay();
