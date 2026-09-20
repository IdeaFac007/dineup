-- 11.0 final hardening: enforce that a review's restaurant matches the verified order restaurant.
drop policy if exists "Customers can create verified reviews" on public.restaurant_reviews;
drop policy if exists "reviews customer create verified order" on public.restaurant_reviews;

create policy "Customers can create verified reviews"
on public.restaurant_reviews
for insert
to authenticated
with check (
  customer_id = (select auth.uid())
  and exists (
    select 1
    from public.orders o
    where o.id = restaurant_reviews.order_id
      and o.customer_id = (select auth.uid())
      and o.restaurant_id = restaurant_reviews.restaurant_id
      and o.status = 'completed'
      and o.payment_status = 'paid'
  )
);
