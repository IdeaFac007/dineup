-- DineUp 10.0.8.3: atomic checkout and order creation

create or replace function public.create_order_from_cart(
  p_restaurant_id bigint,
  p_fulfillment_type text default 'pickup',
  p_customer_note text default null
)
returns public.orders
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_cart_id bigint;
  v_subtotal numeric(12,2);
  v_order public.orders;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_fulfillment_type not in ('pickup','dine_in','delivery') then raise exception 'INVALID_FULFILLMENT_TYPE'; end if;

  select id into v_cart_id from public.customer_carts
  where user_id=v_user_id and restaurant_id=p_restaurant_id limit 1;
  if v_cart_id is null then raise exception 'CART_NOT_FOUND'; end if;

  select coalesce(sum(mi.price*ci.quantity),0)::numeric(12,2) into v_subtotal
  from public.customer_cart_items ci
  join public.restaurant_menu_items mi on mi.id=ci.menu_item_id
  where ci.cart_id=v_cart_id and mi.restaurant_id=p_restaurant_id and mi.is_available=true;
  if v_subtotal<=0 then raise exception 'CART_EMPTY'; end if;

  insert into public.orders(order_number,customer_id,restaurant_id,status,payment_status,fulfillment_type,subtotal,discount_amount,delivery_fee,total_amount,customer_note)
  values('DU-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),v_user_id,p_restaurant_id,'pending','pending',p_fulfillment_type,v_subtotal,0,0,v_subtotal,nullif(trim(p_customer_note),''))
  returning * into v_order;

  insert into public.order_items(order_id,menu_item_id,item_name,unit_price,quantity,line_total)
  select v_order.id,mi.id,mi.name,mi.price,ci.quantity,(mi.price*ci.quantity)::numeric(12,2)
  from public.customer_cart_items ci
  join public.restaurant_menu_items mi on mi.id=ci.menu_item_id
  where ci.cart_id=v_cart_id and mi.restaurant_id=p_restaurant_id and mi.is_available=true;

  delete from public.customer_carts where id=v_cart_id;
  return v_order;
end;
$$;

revoke all on function public.create_order_from_cart(bigint,text,text) from public,anon;
grant execute on function public.create_order_from_cart(bigint,text,text) to authenticated;
