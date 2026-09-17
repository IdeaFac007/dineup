create or replace function public.track_marketing_event(
  p_session_id text,
  p_event_type text,
  p_source text default null,
  p_medium text default null,
  p_campaign text default null,
  p_content text default null,
  p_term text default null,
  p_landing_path text default null,
  p_referrer text default null,
  p_restaurant_id bigint default null,
  p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path='public'
as $$
begin
  if p_session_id is null or length(trim(p_session_id)) < 8 or length(p_session_id) > 128 then
    raise exception 'invalid session_id';
  end if;

  if p_event_type not in (
    'landing_view','restaurant_view','customer_action',
    'bid_start','bid_created','payment_started','bid_paid',
    'signup','restaurant_application'
  ) then
    raise exception 'invalid event_type';
  end if;

  if p_source is not null and length(p_source)>100 then raise exception 'source too long'; end if;
  if p_medium is not null and length(p_medium)>100 then raise exception 'medium too long'; end if;
  if p_campaign is not null and length(p_campaign)>150 then raise exception 'campaign too long'; end if;

  insert into public.marketing_attribution_events(
    session_id,event_type,source,medium,campaign,content,term,
    landing_path,referrer,restaurant_id,metadata
  ) values (
    trim(p_session_id),p_event_type,
    nullif(trim(p_source),''),nullif(trim(p_medium),''),nullif(trim(p_campaign),''),
    nullif(trim(p_content),''),nullif(trim(p_term),''),
    nullif(trim(p_landing_path),''),nullif(trim(p_referrer),''),
    p_restaurant_id,coalesce(p_metadata,'{}'::jsonb)
  );
end;
$$;
