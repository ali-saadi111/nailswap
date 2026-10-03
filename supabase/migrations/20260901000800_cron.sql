-- NailSwap: scheduled jobs (pg_cron → pg_net → internal API routes)
-- The app URL and internal secret are stored in app_config by the deploy step:
--   insert into app_config values ('app_url','https://nailswap.app'), ('internal_secret','...');

create or replace function public.call_internal(p_path text, p_body jsonb default '{}'::jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  base text;
  secret text;
  req bigint;
begin
  select value into base from public.app_config where key = 'app_url';
  select value into secret from public.app_config where key = 'internal_secret';
  if base is null or secret is null then
    return null;
  end if;
  select net.http_post(
    url := base || p_path,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret),
    body := p_body,
    timeout_milliseconds := 30000
  ) into req;
  return req;
end $$;

-- Dispatch due notifications every minute (reminders, confirmations, fallbacks).
select cron.schedule('nailswap-dispatch-notifications', '* * * * *', $$select public.call_internal('/api/internal/notifications/dispatch')$$);

-- Purge expired hand photos (30 days, unless saved) hourly.
select cron.schedule('nailswap-purge-tryon', '17 * * * *', $$select public.call_internal('/api/internal/tryon/purge')$$);

-- Billing lifecycle daily at 02:00 UTC (grace periods, downgrades, invoice generation + PDFs + emails).
select cron.schedule('nailswap-billing', '0 2 * * *', $$select public.run_billing_lifecycle(); select public.call_internal('/api/internal/billing/after-lifecycle')$$);

-- Re-queue stuck AI jobs (generating for >5 minutes) every 5 minutes.
select cron.schedule('nailswap-requeue-jobs', '*/5 * * * *', $$select public.call_internal('/api/internal/tryon/requeue')$$);

-- Mark past confirmed bookings that were never closed as completed after 24h (salon can still flip to no-show).
select cron.schedule('nailswap-autocomplete', '30 3 * * *', $$
  update public.bookings set status = 'completed'
  where status = 'confirmed' and ends_at < now() - interval '24 hours'
$$);

-- Clean up old analytics events (> 18 months) monthly.
select cron.schedule('nailswap-analytics-retention', '0 4 1 * *', $$delete from public.analytics_events where created_at < now() - interval '18 months'$$);
