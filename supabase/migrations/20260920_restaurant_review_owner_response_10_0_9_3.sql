-- 10.0.9.3 owner review responses
drop policy if exists "reviews owner read" on public.restaurant_reviews;
create policy "reviews owner read" on public.restaurant_reviews for select to authenticated
using (exists (select 1 from public.restaurants r where r.id=restaurant_id and r.owner_id=(select auth.uid())));
drop policy if exists "reviews owner response" on public.restaurant_reviews;
create policy "reviews owner response" on public.restaurant_reviews for update to authenticated
using (exists (select 1 from public.restaurants r where r.id=restaurant_id and r.owner_id=(select auth.uid())))
with check (exists (select 1 from public.restaurants r where r.id=restaurant_id and r.owner_id=(select auth.uid())));
grant update on public.restaurant_reviews to authenticated;