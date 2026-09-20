-- 10.0.10.4 Remove exact duplicate indexes flagged by Supabase Advisor.
-- Keep the index-backed UNIQUE constraint on onboarding steps.
drop index if exists public.orders_restaurant_created_at_idx;
drop index if exists public.restaurant_onboarding_steps_unique_step;
