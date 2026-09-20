-- 10.0.10.2 Production performance: cover foreign-key columns flagged by Supabase Advisor.
-- Safe to re-run; all indexes are created only when missing.
create index if not exists customer_cart_items_menu_item_id_idx on public.customer_cart_items(menu_item_id);
create index if not exists customer_carts_restaurant_id_idx on public.customer_carts(restaurant_id);
create index if not exists customer_favorites_restaurant_id_idx on public.customer_favorites(restaurant_id);
create index if not exists growth_message_log_lead_id_idx on public.growth_message_log(lead_id);
create index if not exists growth_message_log_template_id_idx on public.growth_message_log(template_id);
create index if not exists order_items_menu_item_id_idx on public.order_items(menu_item_id);
create index if not exists referral_links_owner_user_id_idx on public.referral_links(owner_user_id);
create index if not exists restaurant_claim_requests_reviewed_by_idx on public.restaurant_claim_requests(reviewed_by);
create index if not exists restaurant_leads_assigned_to_idx on public.restaurant_leads(assigned_to);
create index if not exists restaurant_leads_restaurant_id_idx on public.restaurant_leads(restaurant_id);
create index if not exists restaurant_review_reports_reporter_id_idx on public.restaurant_review_reports(reporter_id);
create index if not exists restaurant_verification_documents_claim_request_id_idx on public.restaurant_verification_documents(claim_request_id);
create index if not exists restaurant_verification_documents_reviewed_by_idx on public.restaurant_verification_documents(reviewed_by);
create index if not exists restaurant_verification_documents_user_id_idx on public.restaurant_verification_documents(user_id);
