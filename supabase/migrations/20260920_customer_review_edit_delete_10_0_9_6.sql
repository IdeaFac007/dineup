-- 10.0.9.6 customer review history, edit and delete rules
drop policy if exists "reviews customer update own" on public.restaurant_reviews;
create policy "reviews customer update own" on public.restaurant_reviews for update to authenticated
using ((select auth.uid())=customer_id and exists (select 1 from public.orders o where o.id=order_id and o.customer_id=(select auth.uid()) and o.status='completed' and o.payment_status='paid'))
with check ((select auth.uid())=customer_id);
drop policy if exists "reviews customer delete own" on public.restaurant_reviews;
create policy "reviews customer delete own" on public.restaurant_reviews for delete to authenticated
using ((select auth.uid())=customer_id and exists (select 1 from public.orders o where o.id=order_id and o.customer_id=(select auth.uid()) and o.status='completed' and o.payment_status='paid'));
grant update,delete on public.restaurant_reviews to authenticated;