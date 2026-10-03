-- NailSwap: subscriptions, invoices, payments, admin, moderation, feature flags

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null unique references public.salons (id) on delete cascade,
  plan_code public.plan_code not null default 'trial',
  status public.subscription_status not null default 'trialing',
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null default now() + interval '14 days',
  trial_ends_at timestamptz,
  grace_ends_at timestamptz,
  grace_days integer not null default 7,
  cancel_at_period_end boolean not null default false,
  -- Plan to fall back to when a paid period lapses unpaid.
  downgrade_to public.plan_code not null default 'basic',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_period_idx on public.subscriptions (current_period_end) where status in ('active', 'trialing', 'grace', 'past_due');
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Every new salon starts on a 14-day trial.
create or replace function public.create_trial_subscription()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  days integer;
begin
  select trial_days into days from public.plans where code = 'trial';
  insert into public.subscriptions (salon_id, plan_code, status, current_period_start, current_period_end, trial_ends_at)
  values (new.id, 'trial', 'trialing', now(), now() + make_interval(days => days), now() + make_interval(days => days))
  on conflict (salon_id) do nothing;
  return new;
end $$;
create trigger salons_create_trial after insert on public.salons
  for each row execute function public.create_trial_subscription();

create sequence public.invoice_number_seq start 1000;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  number text not null unique default ('NS-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.invoice_number_seq')::text, 6, '0')),
  status public.invoice_status not null default 'open',
  currency text not null default 'USD',
  subtotal numeric(10, 2) not null default 0,
  tax numeric(10, 2) not null default 0,
  total numeric(10, 2) not null default 0,
  line_items jsonb not null default '[]'::jsonb,
  period_start timestamptz,
  period_end timestamptz,
  due_at timestamptz not null default now() + interval '7 days',
  paid_at timestamptz,
  pdf_path text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index invoices_salon_idx on public.invoices (salon_id, created_at desc);
create index invoices_open_idx on public.invoices (due_at) where status = 'open';
create trigger invoices_updated_at before update on public.invoices
  for each row execute function public.set_updated_at();

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  invoice_id uuid references public.invoices (id) on delete set null,
  booking_id uuid references public.bookings (id) on delete set null,
  purpose public.payment_purpose not null,
  amount numeric(10, 2) not null check (amount >= 0),
  currency text not null default 'USD',
  method public.payment_method not null,
  provider text not null, -- mpgs | manual
  provider_ref text,
  provider_session_id text,
  status public.payment_status not null default 'pending',
  reference_note text, -- e.g. Whish/OMT transfer reference typed by the salon
  marked_by uuid references public.profiles (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_salon_idx on public.payments (salon_id, created_at desc);
create index payments_invoice_idx on public.payments (invoice_id);
create unique index payments_provider_ref_idx on public.payments (provider, provider_ref) where provider_ref is not null;
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

alter table public.quota_topups
  add constraint quota_topups_payment_fk foreign key (payment_id) references public.payments (id) on delete set null;
alter table public.bookings
  add constraint bookings_deposit_payment_fk foreign key (deposit_payment_id) references public.payments (id) on delete set null;

-- When a payment is marked paid, settle its invoice / activate subscription / grant top-up.
create or replace function public.on_payment_paid()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  inv record;
  sub record;
  plan record;
  credits integer;
begin
  if new.status <> 'paid' or (tg_op = 'UPDATE' and old.status = 'paid') then
    return new;
  end if;

  if new.invoice_id is not null then
    update public.invoices set status = 'paid', paid_at = now() where id = new.invoice_id returning * into inv;

    if new.purpose = 'subscription' and inv.subscription_id is not null then
      select * into sub from public.subscriptions where id = inv.subscription_id;
      update public.subscriptions
      set status = 'active',
          plan_code = coalesce((inv.line_items -> 0 ->> 'plan_code')::public.plan_code, sub.plan_code),
          current_period_start = coalesce(inv.period_start, now()),
          current_period_end = coalesce(inv.period_end, now() + interval '1 month'),
          grace_ends_at = null
      where id = inv.subscription_id;
      -- Sync branding flag from the plan
      select * into plan from public.plans p join public.subscriptions s on s.plan_code = p.code where s.id = inv.subscription_id;
      update public.salons set remove_branding = plan.remove_branding where id = new.salon_id;
    elsif new.purpose = 'topup' then
      credits := coalesce((inv.line_items -> 0 ->> 'credits')::integer, (new.metadata ->> 'credits')::integer, 0);
      if credits > 0 then
        insert into public.quota_topups (salon_id, credits, payment_id) values (new.salon_id, credits, new.id);
      end if;
    end if;
  elsif new.purpose = 'topup' then
    credits := coalesce((new.metadata ->> 'credits')::integer, 0);
    if credits > 0 then
      insert into public.quota_topups (salon_id, credits, payment_id) values (new.salon_id, credits, new.id);
    end if;
  end if;

  return new;
end $$;
create trigger payments_on_paid after insert or update of status on public.payments
  for each row execute function public.on_payment_paid();

-- ── AI quota ─────────────────────────────────────────────────────────────────
-- Returns the salon's monthly AI quota, used count for the current period and remaining credits.
create or replace function public.salon_ai_quota(p_salon_id uuid)
returns table (
  plan_code public.plan_code,
  quota integer,
  used integer,
  topup_credits integer,
  remaining integer,
  period_start timestamptz,
  period_end timestamptz,
  subscription_status public.subscription_status
) language sql stable security definer set search_path = public as $$
  with sub as (
    select s.plan_code, s.status, s.current_period_start, s.current_period_end
    from public.subscriptions s where s.salon_id = p_salon_id
  ),
  p as (select ai_quota_monthly from public.plans pl, sub where pl.code = sub.plan_code),
  used as (
    select count(*)::integer as n
    from public.tryon_jobs j, sub
    where j.salon_id = p_salon_id
      and j.provider in ('fal', 'replicate')
      and j.status in ('succeeded', 'generating')
      and j.created_at >= sub.current_period_start
      and j.created_at < sub.current_period_end
  ),
  topups as (
    select coalesce(sum(t.credits), 0)::integer as c
    from public.quota_topups t
    where t.salon_id = p_salon_id and (t.expires_at is null or t.expires_at > now())
  ),
  topups_used as (
    -- A job that ran while the plan quota was exhausted is stamped params.used_topup = true
    -- by reserve_ai_credit(); top-up credits never reset, so we count them over the salon lifetime.
    select greatest(0, (
      select count(*) from public.tryon_jobs j2
      where j2.salon_id = p_salon_id and j2.provider in ('fal','replicate') and j2.status = 'succeeded'
        and (j2.params ->> 'used_topup')::boolean is true
    ))::integer as n
  )
  select
    sub.plan_code,
    p.ai_quota_monthly as quota,
    used.n as used,
    greatest(0, topups.c - topups_used.n) as topup_credits,
    greatest(0, p.ai_quota_monthly - used.n) + greatest(0, topups.c - topups_used.n) as remaining,
    sub.current_period_start,
    sub.current_period_end,
    sub.status
  from sub, p, used, topups, topups_used;
$$;

-- ── Feature flags & announcements ────────────────────────────────────────────
create table public.feature_flags (
  key text primary key,
  description text,
  enabled boolean not null default false,
  -- Optional per-salon overrides: {"salon_ids": [...], "plans": ["pro"]}
  rules jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create trigger feature_flags_updated_at before update on public.feature_flags
  for each row execute function public.set_updated_at();

insert into public.feature_flags (key, description, enabled) values
  ('ar_tryon', 'Live camera AR try-on', true),
  ('ai_tryon', 'AI photo try-on', true),
  ('describe_mode', 'Free-text "describe it" try-on mode', true),
  ('deposits', 'Booking deposits via card', false),
  ('link_in_bio', 'Link-in-bio pages', true);

create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  level text not null default 'info' check (level in ('info', 'warning', 'success')),
  audience text not null default 'salons' check (audience in ('salons', 'admins', 'all')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.announcement_dismissals (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  dismissed_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

-- ── Admin audit log & impersonation ──────────────────────────────────────────
create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  payload jsonb not null default '{}'::jsonb,
  ip text,
  created_at timestamptz not null default now()
);
create index admin_audit_log_admin_idx on public.admin_audit_log (admin_id, created_at desc);

create table public.impersonation_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles (id) on delete cascade,
  salon_id uuid not null references public.salons (id) on delete cascade,
  reason text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  expires_at timestamptz not null default now() + interval '2 hours'
);
create index impersonation_sessions_admin_idx on public.impersonation_sessions (admin_id) where ended_at is null;

-- ── Moderation queue ─────────────────────────────────────────────────────────
create table public.moderation_queue (
  id uuid primary key default gen_random_uuid(),
  kind public.moderation_kind not null,
  ref_id uuid not null,
  salon_id uuid references public.salons (id) on delete cascade,
  reason text,
  image_path text,
  status public.moderation_status not null default 'pending',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index moderation_queue_status_idx on public.moderation_queue (status, created_at);

-- Flagged reviews enter the moderation queue automatically.
create or replace function public.on_review_flagged()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'pending' and (tg_op = 'INSERT' or old.status <> 'pending') then
    insert into public.moderation_queue (kind, ref_id, salon_id, reason)
    values ('review', new.id, new.salon_id, coalesce(new.flagged_reason, 'flagged'));
  end if;
  return new;
end $$;
create trigger reviews_flagged after insert or update of status on public.reviews
  for each row execute function public.on_review_flagged();
