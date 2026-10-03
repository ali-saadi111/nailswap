-- NailSwap: privilege hardening + analytics / helper RPCs
--
-- 1. Server-only RPCs are revoked from anon/authenticated. They are invoked with the service
--    role from trusted server code (route handlers, cron) after authorization has been checked:
--      • book_slot / cancel / reschedule / booking_by_token → require phone OTP or a manage token
--      • reserve_ai_credit / salon_ai_quota            → quota bookkeeping
--      • run_billing_lifecycle / call_internal          → cron only
-- 2. increment_design_tryon(): counter bump used by the AI worker.
-- 3. salon_analytics_summary(): dashboard analytics in one round-trip (member-checked).

revoke execute on function public.book_slot(uuid, uuid, uuid, timestamptz, text, text, uuid, uuid, uuid, text, public.booking_source, public.app_locale)
  from public, anon, authenticated;
revoke execute on function public.booking_by_token(text) from public, anon, authenticated;
revoke execute on function public.cancel_booking_by_token(text, text) from public, anon, authenticated;
revoke execute on function public.reschedule_booking_by_token(text, timestamptz) from public, anon, authenticated;
revoke execute on function public.schedule_booking_reminders(uuid) from public, anon, authenticated;
revoke execute on function public.reserve_ai_credit(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.salon_ai_quota(uuid) from public, anon, authenticated;
revoke execute on function public.run_billing_lifecycle() from public, anon, authenticated;
revoke execute on function public.call_internal(text, jsonb) from public, anon, authenticated;

-- ── Design try-on counter (worker) ──────────────────────────────────────────
create or replace function public.increment_design_tryon(p_design_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.designs set tryon_count = tryon_count + 1 where id = p_design_id;
$$;
revoke execute on function public.increment_design_tryon(uuid) from public, anon, authenticated;

-- ── Dashboard analytics ─────────────────────────────────────────────────────
create or replace function public.salon_analytics_summary(p_salon_id uuid, p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  result jsonb;
begin
  if not (public.is_salon_member(p_salon_id) or public.is_platform_admin()) then
    raise exception 'Not a member of this salon' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'range', jsonb_build_object('from', p_from, 'to', p_to),
    'events', (
      select coalesce(jsonb_object_agg(kind::text, n), '{}'::jsonb)
      from (
        select kind, count(*) as n
        from public.analytics_events
        where salon_id = p_salon_id and created_at >= p_from and created_at < p_to
        group by kind
      ) e
    ),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('date', d, 'page_views', pv, 'tryons', t, 'bookings', b) order by d), '[]'::jsonb)
      from (
        select date_trunc('day', created_at)::date as d,
          count(*) filter (where kind = 'page_view') as pv,
          count(*) filter (where kind in ('tryon_ar_capture', 'tryon_ai_success')) as t,
          count(*) filter (where kind = 'booking_created') as b
        from public.analytics_events
        where salon_id = p_salon_id and created_at >= p_from and created_at < p_to
        group by 1
      ) dd
    ),
    'bookings', jsonb_build_object(
      'total', (select count(*) from public.bookings where salon_id = p_salon_id and starts_at >= p_from and starts_at < p_to),
      'by_status', (
        select coalesce(jsonb_object_agg(status::text, n), '{}'::jsonb)
        from (select status, count(*) as n from public.bookings where salon_id = p_salon_id and starts_at >= p_from and starts_at < p_to group by status) s
      ),
      'by_source', (
        select coalesce(jsonb_object_agg(source::text, n), '{}'::jsonb)
        from (select source, count(*) as n from public.bookings where salon_id = p_salon_id and starts_at >= p_from and starts_at < p_to group by source) s
      ),
      'revenue', (select coalesce(sum(total_price), 0) from public.bookings where salon_id = p_salon_id and status = 'completed' and starts_at >= p_from and starts_at < p_to),
      'no_show_rate', (
        select case when count(*) = 0 then 0 else round(count(*) filter (where status = 'no_show')::numeric / count(*), 3) end
        from public.bookings where salon_id = p_salon_id and starts_at >= p_from and starts_at < p_to and status in ('completed', 'no_show')
      )
    ),
    'clients', jsonb_build_object(
      'new', (select count(*) from public.clients where salon_id = p_salon_id and created_at >= p_from and created_at < p_to),
      'returning', (
        select count(distinct b.client_id) from public.bookings b
        where b.salon_id = p_salon_id and b.starts_at >= p_from and b.starts_at < p_to
          and exists (select 1 from public.bookings b2 where b2.client_id = b.client_id and b2.status = 'completed' and b2.starts_at < b.starts_at)
      ),
      'total', (select count(*) from public.clients where salon_id = p_salon_id)
    ),
    'tryon', jsonb_build_object(
      'ar_sessions', (select count(*) from public.tryon_sessions where salon_id = p_salon_id and mode = 'ar' and created_at >= p_from and created_at < p_to),
      'ai_jobs', (select count(*) from public.tryon_jobs where salon_id = p_salon_id and created_at >= p_from and created_at < p_to),
      'ai_succeeded', (select count(*) from public.tryon_jobs where salon_id = p_salon_id and status = 'succeeded' and created_at >= p_from and created_at < p_to),
      'ai_cached', (select count(*) from public.tryon_jobs where salon_id = p_salon_id and provider = 'cache' and created_at >= p_from and created_at < p_to),
      'ai_cost_usd', (select coalesce(sum(cost_usd), 0) from public.ai_cost_log where salon_id = p_salon_id and created_at >= p_from and created_at < p_to)
    ),
    'top_designs', (
      select coalesce(jsonb_agg(jsonb_build_object('design_id', d.id, 'name', d.name, 'cover_path', d.cover_path, 'tryons', x.t, 'bookings', x.b) order by x.t desc, x.b desc), '[]'::jsonb)
      from (
        select design_id,
          count(*) filter (where kind in ('tryon_ar_start', 'tryon_ai_request')) as t,
          count(*) filter (where kind = 'booking_created') as b
        from public.analytics_events
        where salon_id = p_salon_id and design_id is not null and created_at >= p_from and created_at < p_to
        group by design_id
        order by t desc, b desc
        limit 10
      ) x join public.designs d on d.id = x.design_id
    ),
    'top_polishes', (
      select coalesce(jsonb_agg(jsonb_build_object('polish_id', p.id, 'brand', p.brand, 'shade_name', p.shade_name, 'hex_color', p.hex_color, 'tryons', x.t) order by x.t desc), '[]'::jsonb)
      from (
        select polish_id, count(*) as t
        from public.analytics_events
        where salon_id = p_salon_id and polish_id is not null and kind in ('tryon_ar_start', 'tryon_ai_request') and created_at >= p_from and created_at < p_to
        group by polish_id
        order by t desc
        limit 10
      ) x join public.polishes p on p.id = x.polish_id
    )
  ) into result;
  return result;
end $$;
revoke execute on function public.salon_analytics_summary(uuid, timestamptz, timestamptz) from public, anon;
