-- NailSwap: RPC functions (booking, quota, onboarding, admin)

-- ── Create a salon (onboarding step 1) ──────────────────────────────────────
create or replace function public.create_salon(
  p_name text,
  p_slug text,
  p_city text default null,
  p_default_locale public.app_locale default 'en',
  p_brand_color text default '#8B5E3C'
) returns public.salons language plpgsql security definer set search_path = public as $$
declare
  s public.salons;
  final_slug text := public.slugify(coalesce(p_slug, p_name));
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if length(final_slug) < 3 then
    raise exception 'Slug too short' using errcode = '22023';
  end if;
  if final_slug in ('www', 'app', 'admin', 'api', 'dashboard', 'explore', 'salons', 'try', 'auth', 'login', 'account', 'static', 'assets') then
    raise exception 'Reserved slug' using errcode = '23505';
  end if;
  insert into public.salons (name, slug, city, default_locale, brand_color, owner_id, status, onboarding_step)
  values (p_name, final_slug, p_city, p_default_locale, p_brand_color, auth.uid(), 'pending', 1)
  returning * into s;
  -- Default hours Mon–Sat 10:00–19:00, closed Sunday
  insert into public.salon_hours (salon_id, weekday, open_time, close_time, is_closed)
  select s.id, d, '10:00', '19:00', d = 0 from generate_series(0, 6) d;
  return s;
end $$;

-- ── Reserve one AI generation credit for a salon ────────────────────────────
-- Returns true and marks whether the plan quota or a top-up credit was used; raises when the
-- salon has no remaining credits (hard stop).
create or replace function public.reserve_ai_credit(p_salon_id uuid, p_job_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  q record;
  used_topup boolean := false;
begin
  -- Serialise per salon so concurrent requests cannot exceed the quota.
  perform pg_advisory_xact_lock(hashtext('ai_quota:' || p_salon_id::text));
  select * into q from public.salon_ai_quota(p_salon_id);
  if q is null then
    raise exception 'Salon has no subscription' using errcode = 'P0002';
  end if;
  if q.subscription_status in ('cancelled', 'expired') then
    raise exception 'Subscription inactive' using errcode = 'P0003';
  end if;
  if q.remaining <= 0 then
    raise exception 'AI quota exhausted' using errcode = 'P0004';
  end if;
  if q.used >= q.quota then
    used_topup := true;
  end if;
  update public.tryon_jobs
  set params = params || jsonb_build_object('used_topup', used_topup)
  where id = p_job_id;
  return jsonb_build_object('used_topup', used_topup, 'remaining', q.remaining - 1, 'quota', q.quota, 'used', q.used + 1);
end $$;

-- ── Book a slot (called by the server after OTP verification) ───────────────
-- The exclusion constraint on bookings guarantees no double booking even under concurrent
-- requests; this function turns the constraint violation into a clear error and applies
-- salon rules (lead time, advance window, opening hours, staff schedule).
create or replace function public.book_slot(
  p_salon_id uuid,
  p_service_id uuid,
  p_staff_id uuid,          -- null = any available staff
  p_starts_at timestamptz,
  p_client_name text,
  p_client_phone text,
  p_client_user_id uuid default null,
  p_design_id uuid default null,
  p_tryon_job_id uuid default null,
  p_client_notes text default null,
  p_source public.booking_source default 'direct',
  p_locale public.app_locale default 'en'
) returns public.bookings language plpgsql security definer set search_path = public as $$
declare
  s public.salons;
  svc public.services;
  d public.designs;
  c public.clients;
  b public.bookings;
  duration_min integer;
  ends timestamptz;
  chosen_staff uuid := p_staff_id;
  tryon_path text;
  status_init public.booking_status;
  candidate record;
begin
  select * into s from public.salons where id = p_salon_id and status in ('active', 'pending');
  if s is null then raise exception 'Salon not found' using errcode = 'P0002'; end if;

  select * into svc from public.services where id = p_service_id and salon_id = p_salon_id and is_active;
  if svc is null then raise exception 'Service not found' using errcode = 'P0002'; end if;

  if p_design_id is not null then
    select * into d from public.designs where id = p_design_id and salon_id = p_salon_id;
  end if;

  duration_min := svc.duration_min + coalesce(d.duration_addon_min, 0);
  ends := p_starts_at + make_interval(mins => duration_min + svc.buffer_min);

  if p_starts_at < now() + make_interval(mins => s.min_lead_time_min) then
    raise exception 'Slot is too soon' using errcode = 'P0010';
  end if;
  if p_starts_at > now() + make_interval(days => s.max_advance_days) then
    raise exception 'Slot is too far in advance' using errcode = 'P0011';
  end if;

  -- Pick staff: explicit, or the first qualified staff member free at that time.
  if chosen_staff is null then
    for candidate in
      select st.id from public.staff st
      join public.staff_services ss on ss.staff_id = st.id and ss.service_id = p_service_id
      where st.salon_id = p_salon_id and st.is_active and st.accepts_online_booking
      order by st.sort_order, st.id
    loop
      if public.staff_is_available(candidate.id, p_starts_at, ends) then
        chosen_staff := candidate.id;
        exit;
      end if;
    end loop;
    if chosen_staff is null then
      raise exception 'No staff available for this slot' using errcode = 'P0012';
    end if;
  else
    if not exists (select 1 from public.staff st where st.id = chosen_staff and st.salon_id = p_salon_id and st.is_active) then
      raise exception 'Staff not found' using errcode = 'P0002';
    end if;
    if not public.staff_is_available(chosen_staff, p_starts_at, ends) then
      raise exception 'Slot not available' using errcode = 'P0012';
    end if;
  end if;

  -- Upsert CRM client
  insert into public.clients (salon_id, user_id, full_name, phone, preferred_locale)
  values (p_salon_id, p_client_user_id, p_client_name, p_client_phone, p_locale)
  on conflict (salon_id, phone) do update
    set full_name = excluded.full_name,
        user_id = coalesce(public.clients.user_id, excluded.user_id),
        preferred_locale = excluded.preferred_locale
  returning * into c;

  if p_tryon_job_id is not null then
    select result_paths[1] into tryon_path from public.tryon_jobs where id = p_tryon_job_id;
    update public.tryon_jobs set is_saved = true where id = p_tryon_job_id;
  end if;

  status_init := case when s.booking_mode = 'instant' then 'confirmed' else 'new' end;

  begin
    insert into public.bookings (
      salon_id, client_id, staff_id, service_id, design_id, tryon_job_id, tryon_image_path,
      starts_at, ends_at, status, source, service_price, design_price, total_price, currency,
      deposit_amount, client_notes, created_by, locale
    ) values (
      p_salon_id, c.id, chosen_staff, p_service_id, p_design_id, p_tryon_job_id, tryon_path,
      p_starts_at, ends, status_init, p_source, svc.price, coalesce(d.price_addon, 0),
      svc.price + coalesce(d.price_addon, 0), s.currency,
      case when s.deposit_required then s.deposit_amount else 0 end,
      p_client_notes, p_client_user_id, p_locale
    ) returning * into b;
  exception when exclusion_violation then
    raise exception 'Slot was just taken' using errcode = 'P0013';
  end;

  -- Convert a lead if one exists for this phone
  update public.leads set status = 'converted' where salon_id = p_salon_id and phone = p_client_phone and status in ('new', 'contacted');

  -- Queue client + salon notifications (dispatched by the notifier)
  insert into public.notifications (salon_id, booking_id, kind, channel, recipient, locale)
  values (p_salon_id, b.id, (case when status_init = 'confirmed' then 'booking_confirmation' else 'booking_pending' end)::public.notification_kind, 'whatsapp', p_client_phone, p_locale);
  if s.email is not null then
    insert into public.notifications (salon_id, booking_id, kind, channel, recipient, locale)
    values (p_salon_id, b.id, 'salon_new_booking', 'email', s.email, s.default_locale);
  end if;

  return b;
end $$;

-- Is this staff member free and scheduled for [p_start, p_end)?
create or replace function public.staff_is_available(p_staff_id uuid, p_start timestamptz, p_end timestamptz)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare
  st public.staff;
  tz text;
  local_start timestamp;
  local_end timestamp;
  wd smallint;
  covered boolean;
begin
  select * into st from public.staff where id = p_staff_id;
  if st is null or not st.is_active then return false; end if;
  select timezone into tz from public.salons where id = st.salon_id;
  local_start := p_start at time zone tz;
  local_end := p_end at time zone tz;
  if local_start::date <> (local_end - interval '1 second')::date then return false; end if;
  wd := extract(dow from local_start);

  -- Salon holiday or closed day
  if exists (select 1 from public.salon_holidays h where h.salon_id = st.salon_id and h.date = local_start::date) then return false; end if;
  if exists (select 1 from public.salon_hours h where h.salon_id = st.salon_id and h.weekday = wd and (h.is_closed or local_start::time < h.open_time or local_end::time > h.close_time)) then return false; end if;

  -- Inside a work interval
  select exists (
    select 1 from public.staff_schedule_rules r
    where r.staff_id = p_staff_id and r.weekday = wd and r.kind = 'work'
      and r.start_time <= local_start::time and r.end_time >= local_end::time
  ) into covered;
  if not covered then return false; end if;

  -- Not overlapping a break
  if exists (
    select 1 from public.staff_schedule_rules r
    where r.staff_id = p_staff_id and r.weekday = wd and r.kind = 'break'
      and r.start_time < local_end::time and r.end_time > local_start::time
  ) then return false; end if;

  -- Not on time off
  if exists (select 1 from public.staff_time_off t where t.staff_id = p_staff_id and t.starts_at < p_end and t.ends_at > p_start) then return false; end if;

  -- No live booking overlap
  if exists (
    select 1 from public.bookings b where b.staff_id = p_staff_id and b.status in ('new', 'confirmed')
      and b.starts_at < p_end and b.ends_at > p_start
  ) then return false; end if;

  return true;
end $$;

-- ── Reschedule / cancel via manage token (links in WhatsApp/SMS) ────────────
create or replace function public.booking_by_token(p_token text)
returns table (
  id uuid, salon_id uuid, salon_name text, salon_slug text, starts_at timestamptz, ends_at timestamptz,
  status public.booking_status, service_name text, design_name text, staff_name text,
  total_price numeric, currency text, cancel_cutoff_hours integer, reschedule_cutoff_hours integer,
  service_id uuid, design_id uuid, staff_id uuid, client_name text, locale public.app_locale
) language sql stable security definer set search_path = public as $$
  select b.id, b.salon_id, s.name, s.slug, b.starts_at, b.ends_at, b.status, sv.name, d.name, st.display_name,
         b.total_price, b.currency, s.cancel_cutoff_hours, s.reschedule_cutoff_hours,
         b.service_id, b.design_id, b.staff_id, c.full_name, b.locale
  from public.bookings b
  join public.salons s on s.id = b.salon_id
  join public.services sv on sv.id = b.service_id
  join public.clients c on c.id = b.client_id
  left join public.designs d on d.id = b.design_id
  join public.staff st on st.id = b.staff_id
  where b.manage_token = p_token;
$$;

create or replace function public.cancel_booking_by_token(p_token text, p_reason text default null)
returns public.bookings language plpgsql security definer set search_path = public as $$
declare
  b public.bookings;
  s public.salons;
  c public.clients;
begin
  select * into b from public.bookings where manage_token = p_token;
  if b is null then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  select * into s from public.salons where id = b.salon_id;
  if b.status not in ('new', 'confirmed') then raise exception 'Booking cannot be cancelled' using errcode = 'P0020'; end if;
  if b.starts_at - make_interval(hours => s.cancel_cutoff_hours) < now() then
    raise exception 'Cancellation cutoff passed' using errcode = 'P0021';
  end if;
  update public.bookings set status = 'cancelled', cancel_reason = p_reason, cancelled_by = 'client'
  where id = b.id returning * into b;
  select * into c from public.clients where id = b.client_id;
  insert into public.notifications (salon_id, booking_id, kind, channel, recipient, locale)
  values (b.salon_id, b.id, 'booking_cancelled', 'whatsapp', c.phone, b.locale);
  return b;
end $$;

create or replace function public.reschedule_booking_by_token(p_token text, p_starts_at timestamptz)
returns public.bookings language plpgsql security definer set search_path = public as $$
declare
  b public.bookings;
  s public.salons;
  c public.clients;
  dur interval;
begin
  select * into b from public.bookings where manage_token = p_token;
  if b is null then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  select * into s from public.salons where id = b.salon_id;
  if b.status not in ('new', 'confirmed') then raise exception 'Booking cannot be rescheduled' using errcode = 'P0020'; end if;
  if b.starts_at - make_interval(hours => s.reschedule_cutoff_hours) < now() then
    raise exception 'Reschedule cutoff passed' using errcode = 'P0021';
  end if;
  if p_starts_at < now() + make_interval(mins => s.min_lead_time_min) then
    raise exception 'Slot is too soon' using errcode = 'P0010';
  end if;
  dur := b.ends_at - b.starts_at;
  -- Temporarily exclude this booking from the availability check by cancelling then re-inserting times.
  update public.bookings set status = 'cancelled' where id = b.id;
  if not public.staff_is_available(b.staff_id, p_starts_at, p_starts_at + dur) then
    update public.bookings set status = b.status where id = b.id;
    raise exception 'Slot not available' using errcode = 'P0012';
  end if;
  begin
    update public.bookings set status = b.status, starts_at = p_starts_at, ends_at = p_starts_at + dur,
      reminder_24h_sent_at = null, reminder_2h_sent_at = null
    where id = b.id returning * into b;
  exception when exclusion_violation then
    update public.bookings set status = b.status where id = b.id;
    raise exception 'Slot was just taken' using errcode = 'P0013';
  end;
  select * into c from public.clients where id = b.client_id;
  insert into public.notifications (salon_id, booking_id, kind, channel, recipient, locale)
  values (b.salon_id, b.id, 'booking_rescheduled', 'whatsapp', c.phone, b.locale);
  return b;
end $$;

-- ── Admin: change a salon's plan (immediate) ────────────────────────────────
create or replace function public.admin_change_plan(p_salon_id uuid, p_plan public.plan_code, p_reason text default null)
returns public.subscriptions language plpgsql security definer set search_path = public as $$
declare
  sub public.subscriptions;
  pl public.plans;
begin
  if not public.is_platform_admin() then raise exception 'Admin only' using errcode = '42501'; end if;
  select * into pl from public.plans where code = p_plan;
  update public.subscriptions
  set plan_code = p_plan,
      status = (case when p_plan = 'trial' then 'trialing' else 'active' end)::public.subscription_status,
      current_period_start = now(),
      current_period_end = now() + case when p_plan = 'trial' then make_interval(days => pl.trial_days) else interval '1 month' end,
      grace_ends_at = null
  where salon_id = p_salon_id returning * into sub;
  update public.salons set remove_branding = pl.remove_branding where id = p_salon_id;
  insert into public.admin_audit_log (admin_id, action, target_type, target_id, payload)
  values (auth.uid(), 'change_plan', 'salon', p_salon_id::text, jsonb_build_object('plan', p_plan, 'reason', p_reason));
  return sub;
end $$;

create or replace function public.admin_set_salon_status(p_salon_id uuid, p_status public.salon_status, p_directory_approved boolean default null, p_reason text default null)
returns public.salons language plpgsql security definer set search_path = public as $$
declare s public.salons;
begin
  if not public.is_platform_admin() then raise exception 'Admin only' using errcode = '42501'; end if;
  update public.salons
  set status = p_status,
      directory_approved = coalesce(p_directory_approved, directory_approved)
  where id = p_salon_id returning * into s;
  insert into public.admin_audit_log (admin_id, action, target_type, target_id, payload)
  values (auth.uid(), 'set_salon_status', 'salon', p_salon_id::text, jsonb_build_object('status', p_status, 'directory_approved', p_directory_approved, 'reason', p_reason));
  return s;
end $$;

-- ── Billing lifecycle (run daily by cron) ───────────────────────────────────
-- Trials that end → grace; paid periods that lapse → grace; grace that lapses → downgrade/expire.
create or replace function public.run_billing_lifecycle()
returns integer language plpgsql security definer set search_path = public as $$
declare
  n integer := 0;
  sub record;
  pl public.plans;
begin
  for sub in select * from public.subscriptions where status in ('trialing', 'active') and current_period_end < now() loop
    if sub.status = 'trialing' then
      update public.subscriptions set status = 'grace', grace_ends_at = now() + make_interval(days => grace_days) where id = sub.id;
      -- Issue the first invoice for the downgrade_to plan
      select * into pl from public.plans where code = sub.downgrade_to;
      insert into public.invoices (salon_id, subscription_id, total, subtotal, line_items, period_start, period_end)
      values (sub.salon_id, sub.id, pl.price_usd, pl.price_usd,
        jsonb_build_array(jsonb_build_object('plan_code', pl.code, 'description', pl.name || ' plan (monthly)', 'amount', pl.price_usd)),
        now(), now() + interval '1 month');
    else
      update public.subscriptions set status = 'grace', grace_ends_at = now() + make_interval(days => grace_days) where id = sub.id;
      select * into pl from public.plans where code = sub.plan_code;
      insert into public.invoices (salon_id, subscription_id, total, subtotal, line_items, period_start, period_end)
      values (sub.salon_id, sub.id, pl.price_usd, pl.price_usd,
        jsonb_build_array(jsonb_build_object('plan_code', pl.code, 'description', pl.name || ' plan (monthly)', 'amount', pl.price_usd)),
        sub.current_period_end, sub.current_period_end + interval '1 month');
    end if;
    n := n + 1;
  end loop;

  -- Grace expired: downgrade Pro → Basic (still unpaid → expired), Basic/Trial → expired.
  for sub in select * from public.subscriptions where status = 'grace' and grace_ends_at < now() loop
    if sub.plan_code = 'pro' then
      update public.subscriptions set plan_code = 'basic', status = 'past_due' where id = sub.id;
      update public.salons set remove_branding = false where id = sub.salon_id;
    else
      update public.subscriptions set status = 'expired' where id = sub.id;
    end if;
    update public.invoices set status = 'uncollectible' where subscription_id = sub.id and status = 'open' and due_at < now() - interval '30 days';
    n := n + 1;
  end loop;
  return n;
end $$;

-- ── Realtime ────────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.tryon_jobs;
alter publication supabase_realtime add table public.bookings;
alter publication supabase_realtime add table public.notifications;
