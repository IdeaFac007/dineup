-- Phase 18: explicitly remove anonymous execution from the booking function.
revoke execute on function public.create_restaurant_reservation(bigint,date,time,integer,text,text,text) from anon;
revoke execute on function public.get_restaurant_reservation_slots(bigint,date) from anon;
grant execute on function public.get_restaurant_reservation_slots(bigint,date) to anon, authenticated;
grant execute on function public.create_restaurant_reservation(bigint,date,time,integer,text,text,text) to authenticated;
