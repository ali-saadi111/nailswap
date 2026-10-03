-- NailSwap: bookings, booking events, notifications

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete restrict,
  staff_id uuid not null references public.staff (id) on delete restrict,
  service_id uuid not null references public.services (id) on delete restrict,
  design_id uuid references public.designs (id) on delete set null,
  tryon_job_id uuid references public.tryon_jobs (id) on delete set null,
  -- Snapshot of the try-on image path so the technician sees exactly what was requested,
  -- even if the job row is later purged.
  tryon_image_path text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.booking_status not null default 'new',
  source public.booking_source not null default 'direct',
  service_price numeric(10, 2) not null default 0,
  design_price numeric(10, 2) not null default 0,
  total_price numeric(10, 2) not null default 0,
  currency text not null default 'USD',
  deposit_amount numeric(10, 2) not null default 0,
  deposit_payment_id uuid,
  client_notes text,
  staff_notes text,
  cancel_reason text,
  cancelled_by text check (cancelled_by in ('client', 'salon', 'system')),
  -- Random token embedded in reschedule/cancel links sent by WhatsApp/SMS.
  manage_token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  reminder_24h_sent_at timestamptz,
  reminder_2h_sent_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  locale public.app_locale not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  -- Double-booking is impossible at the database level: two live bookings for the same
  -- staff member can never overlap.
  constraint bookings_no_overlap exclude using gist (
    staff_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('new', 'confirmed'))
);
create index bookings_salon_time_idx on public.bookings (salon_id, starts_at);
create index bookings_staff_time_idx on public.bookings (staff_id, starts_at);
create index bookings_client_idx on public.bookings (client_id, starts_at desc);
create index bookings_status_idx on public.bookings (salon_id, status);
create index bookings_reminders_idx on public.bookings (starts_at) where status = 'confirmed';
create trigger bookings_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();

-- Audit trail of every state change on a booking.
create table public.booking_events (
  id bigint generated always as identity primary key,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  type text not null,
  actor_id uuid,
  actor_role text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index booking_events_booking_idx on public.booking_events (booking_id, created_at);

-- Outbound notifications (WhatsApp → SMS fallback → email).
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid references public.salons (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete cascade,
  kind public.notification_kind not null,
  channel public.notification_channel not null,
  recipient text not null,
  locale public.app_locale not null default 'en',
  payload jsonb not null default '{}'::jsonb,
  status public.notification_status not null default 'queued',
  provider_ref text,
  error text,
  attempts smallint not null default 0,
  scheduled_for timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_due_idx on public.notifications (scheduled_for) where status = 'queued';
create index notifications_booking_idx on public.notifications (booking_id);
create index notifications_salon_idx on public.notifications (salon_id, created_at desc);

-- ── Status transitions: keep client CRM counters and design stats in sync ────
create or replace function public.on_booking_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.design_id is not null then
      update public.designs set booking_count = booking_count + 1 where id = new.design_id;
    end if;
    insert into public.booking_events (booking_id, type, actor_id, payload)
    values (new.id, 'created', new.created_by, jsonb_build_object('status', new.status, 'source', new.source));
    return new;
  end if;

  if old.status is distinct from new.status then
    insert into public.booking_events (booking_id, type, actor_id, payload)
    values (new.id, 'status_changed', auth.uid(), jsonb_build_object('from', old.status, 'to', new.status));

    if new.status = 'completed' then
      update public.clients
      set visit_count = visit_count + 1, last_visit_at = new.starts_at
      where id = new.client_id;
    elsif new.status = 'no_show' then
      update public.clients set no_show_count = no_show_count + 1 where id = new.client_id;
    end if;

    -- Cancel any still-queued reminders when the booking is no longer live.
    if new.status in ('cancelled', 'completed', 'no_show') then
      update public.notifications
      set status = 'cancelled'
      where booking_id = new.id and status = 'queued'
        and kind in ('booking_reminder_24h', 'booking_reminder_2h');
    end if;
  end if;

  if old.starts_at is distinct from new.starts_at then
    insert into public.booking_events (booking_id, type, actor_id, payload)
    values (new.id, 'rescheduled', auth.uid(), jsonb_build_object('from', old.starts_at, 'to', new.starts_at));
  end if;

  return new;
end $$;
create trigger bookings_status_change after insert or update on public.bookings
  for each row execute function public.on_booking_status_change();

-- ── Schedule reminders when a booking becomes confirmed ──────────────────────
create or replace function public.schedule_booking_reminders(p_booking_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  b record;
begin
  select bk.*, c.phone as client_phone, c.preferred_locale as client_locale
  into b
  from public.bookings bk join public.clients c on c.id = bk.client_id
  where bk.id = p_booking_id;

  if b.status <> 'confirmed' then return; end if;

  -- Remove previously queued reminders (e.g. after a reschedule)
  update public.notifications set status = 'cancelled'
  where booking_id = p_booking_id and status = 'queued'
    and kind in ('booking_reminder_24h', 'booking_reminder_2h');

  if b.starts_at - interval '24 hours' > now() then
    insert into public.notifications (salon_id, booking_id, kind, channel, recipient, locale, scheduled_for)
    values (b.salon_id, p_booking_id, 'booking_reminder_24h', 'whatsapp', b.client_phone, b.locale, b.starts_at - interval '24 hours');
  end if;
  if b.starts_at - interval '2 hours' > now() then
    insert into public.notifications (salon_id, booking_id, kind, channel, recipient, locale, scheduled_for)
    values (b.salon_id, p_booking_id, 'booking_reminder_2h', 'whatsapp', b.client_phone, b.locale, b.starts_at - interval '2 hours');
  end if;
end $$;

create or replace function public.on_booking_confirmed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'confirmed' and (tg_op = 'INSERT' or old.status <> 'confirmed' or old.starts_at <> new.starts_at) then
    perform public.schedule_booking_reminders(new.id);
  end if;
  return new;
end $$;
create trigger bookings_schedule_reminders after insert or update of status, starts_at on public.bookings
  for each row execute function public.on_booking_confirmed();

-- ── Reviews (only after a completed booking) ─────────────────────────────────
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  booking_id uuid not null unique references public.bookings (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  body text,
  photo_paths text[] not null default '{}',
  status public.moderation_status not null default 'approved',
  flagged_reason text,
  salon_reply text,
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reviews_salon_idx on public.reviews (salon_id, created_at desc) where status = 'approved';
create trigger reviews_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();

create or replace function public.refresh_salon_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  sid uuid := coalesce(new.salon_id, old.salon_id);
begin
  update public.salons s
  set rating_avg = coalesce((select round(avg(rating)::numeric, 2) from public.reviews r where r.salon_id = sid and r.status = 'approved'), 0),
      rating_count = (select count(*) from public.reviews r where r.salon_id = sid and r.status = 'approved')
  where s.id = sid;
  return null;
end $$;
create trigger reviews_refresh_rating after insert or update or delete on public.reviews
  for each row execute function public.refresh_salon_rating();

-- Reviews require a completed booking
create or replace function public.check_review_allowed()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  b record;
begin
  select * into b from public.bookings where id = new.booking_id;
  if b is null or b.status <> 'completed' then
    raise exception 'A review can only be left after a completed booking' using errcode = 'P0001';
  end if;
  new.salon_id := b.salon_id;
  new.client_id := b.client_id;
  return new;
end $$;
create trigger reviews_check_allowed before insert on public.reviews
  for each row execute function public.check_review_allowed();
