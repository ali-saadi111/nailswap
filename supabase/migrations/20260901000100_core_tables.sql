-- NailSwap: core tables (identity, salons, plans, catalog)

-- ── Platform config (single-row key/value, admin only) ───────────────────────
create table public.app_config (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
comment on table public.app_config is 'Internal settings such as the app URL used by pg_cron/pg_net callbacks.';

-- ── Profiles ─────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text unique,
  email text,
  full_name text,
  avatar_path text,
  preferred_locale public.app_locale not null default 'en',
  is_platform_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, phone, email, full_name, preferred_locale)
  values (
    new.id,
    new.phone,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce((new.raw_user_meta_data ->> 'locale')::public.app_locale, 'en')
  )
  on conflict (id) do update set
    phone = coalesce(excluded.phone, public.profiles.phone),
    email = coalesce(excluded.email, public.profiles.email);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_user_updated()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
  set phone = coalesce(new.phone, phone), email = coalesce(new.email, email)
  where id = new.id;
  return new;
end $$;
create trigger on_auth_user_updated after update of phone, email on auth.users
  for each row execute function public.handle_user_updated();

-- ── Plans ────────────────────────────────────────────────────────────────────
create table public.plans (
  code public.plan_code primary key,
  name text not null,
  price_usd numeric(10, 2) not null,
  ai_quota_monthly integer not null,
  staff_seats integer not null,
  directory_priority integer not null default 0,
  remove_branding boolean not null default false,
  trial_days integer not null default 0,
  is_active boolean not null default true,
  features jsonb not null default '{}'::jsonb
);

insert into public.plans (code, name, price_usd, ai_quota_monthly, staff_seats, directory_priority, remove_branding, trial_days, features) values
  ('trial', 'Trial', 0, 50, 2, 0, false, 14, '{"analytics":"basic","marketing":true}'),
  ('basic', 'Basic', 29, 200, 3, 1, false, 0, '{"analytics":"basic","marketing":true}'),
  ('pro', 'Pro', 79, 1000, 10, 2, true, 0, '{"analytics":"advanced","marketing":true,"link_in_bio":true,"priority_support":true}');

-- ── Salons ───────────────────────────────────────────────────────────────────
create table public.salons (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])?$'),
  name text not null,
  description text,
  description_i18n jsonb not null default '{}'::jsonb,
  status public.salon_status not null default 'pending',
  owner_id uuid not null references public.profiles (id) on delete restrict,
  brand_color text not null default '#8B5E3C' check (brand_color ~ '^#[0-9a-fA-F]{6}$'),
  logo_path text,
  cover_path text,
  gallery_paths text[] not null default '{}',
  default_locale public.app_locale not null default 'en',
  languages public.app_locale[] not null default '{en,ar,fr}',
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'Asia/Beirut',
  country text not null default 'LB',
  city text,
  area text,
  address text,
  lat double precision,
  lng double precision,
  phone text,
  whatsapp_number text,
  email text,
  instagram text,
  website text,
  booking_mode public.booking_mode not null default 'instant',
  cancel_cutoff_hours integer not null default 12 check (cancel_cutoff_hours >= 0),
  reschedule_cutoff_hours integer not null default 12 check (reschedule_cutoff_hours >= 0),
  slot_interval_min integer not null default 15 check (slot_interval_min in (5, 10, 15, 20, 30, 60)),
  min_lead_time_min integer not null default 60,
  max_advance_days integer not null default 60,
  deposit_required boolean not null default false,
  deposit_amount numeric(10, 2) not null default 0,
  remove_branding boolean not null default false,
  directory_approved boolean not null default false,
  onboarding_step integer not null default 0,
  onboarding_completed_at timestamptz,
  rating_avg numeric(3, 2) not null default 0,
  rating_count integer not null default 0,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index salons_owner_idx on public.salons (owner_id);
create index salons_city_idx on public.salons (city, area);
create index salons_geo_idx on public.salons (lat, lng);
create index salons_status_idx on public.salons (status) where status = 'active';
create trigger salons_updated_at before update on public.salons
  for each row execute function public.set_updated_at();

-- ── Salon members ────────────────────────────────────────────────────────────
create table public.salon_members (
  salon_id uuid not null references public.salons (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.salon_member_role not null default 'staff',
  permissions jsonb not null default '{}'::jsonb,
  invited_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (salon_id, user_id)
);
create index salon_members_user_idx on public.salon_members (user_id);

-- Owner is always a member
create or replace function public.ensure_owner_membership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.salon_members (salon_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (salon_id, user_id) do update set role = 'owner';
  return new;
end $$;
create trigger salons_owner_membership after insert or update of owner_id on public.salons
  for each row execute function public.ensure_owner_membership();

-- ── Salon opening hours ──────────────────────────────────────────────────────
create table public.salon_hours (
  salon_id uuid not null references public.salons (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  open_time time,
  close_time time,
  is_closed boolean not null default false,
  primary key (salon_id, weekday),
  check (is_closed or (open_time is not null and close_time is not null and close_time > open_time))
);

create table public.salon_holidays (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  date date not null,
  name text,
  unique (salon_id, date)
);

-- ── Staff ────────────────────────────────────────────────────────────────────
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  display_name text not null,
  avatar_path text,
  bio text,
  color text not null default '#A78BFA' check (color ~ '^#[0-9a-fA-F]{6}$'),
  is_active boolean not null default true,
  accepts_online_booking boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_id, user_id)
);
create index staff_salon_idx on public.staff (salon_id);
create trigger staff_updated_at before update on public.staff
  for each row execute function public.set_updated_at();

-- Weekly schedule: 'work' intervals define availability, 'break' intervals subtract from it.
create table public.staff_schedule_rules (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  kind public.schedule_rule_kind not null default 'work',
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);
create index staff_schedule_rules_staff_idx on public.staff_schedule_rules (staff_id, weekday);

create table public.staff_time_off (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  check (ends_at > starts_at)
);
create index staff_time_off_staff_idx on public.staff_time_off (staff_id, starts_at);

-- ── Services ─────────────────────────────────────────────────────────────────
create table public.services (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  name text not null,
  name_i18n jsonb not null default '{}'::jsonb,
  description text,
  category public.service_category not null default 'other',
  price numeric(10, 2) not null check (price >= 0),
  duration_min integer not null check (duration_min > 0 and duration_min <= 600),
  buffer_min integer not null default 0 check (buffer_min >= 0),
  is_active boolean not null default true,
  supports_tryon boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index services_salon_idx on public.services (salon_id);
create trigger services_updated_at before update on public.services
  for each row execute function public.set_updated_at();

create table public.staff_services (
  staff_id uuid not null references public.staff (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  primary key (staff_id, service_id)
);

-- ── Polish inventory ─────────────────────────────────────────────────────────
create table public.polishes (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  brand text not null,
  collection text,
  shade_name text not null,
  shade_code text,
  finish public.polish_finish not null default 'glossy',
  hex_color text not null check (hex_color ~ '^#[0-9a-fA-F]{6}$'),
  hex_color_auto text check (hex_color_auto is null or hex_color_auto ~ '^#[0-9a-fA-F]{6}$'),
  swatch_path text,
  in_stock boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index polishes_salon_idx on public.polishes (salon_id) where in_stock;
create unique index polishes_unique_shade on public.polishes (salon_id, brand, coalesce(collection, ''), shade_name);
create trigger polishes_updated_at before update on public.polishes
  for each row execute function public.set_updated_at();

-- ── Designs ──────────────────────────────────────────────────────────────────
create table public.designs (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  slug text not null,
  name text not null,
  name_i18n jsonb not null default '{}'::jsonb,
  description text,
  category public.design_category not null default 'minimal',
  tags text[] not null default '{}',
  shape public.nail_shape,
  length public.nail_length,
  -- Structured description passed to the AI pipeline (shape, length, color, finish, art).
  prompt_text text,
  price_addon numeric(10, 2) not null default 0 check (price_addon >= 0),
  duration_addon_min integer not null default 0 check (duration_addon_min >= 0),
  cover_path text,
  is_visible boolean not null default true,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  tryon_count integer not null default 0,
  booking_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_id, slug)
);
create index designs_salon_idx on public.designs (salon_id) where is_visible;
create index designs_category_idx on public.designs (category) where is_visible;
create index designs_tags_idx on public.designs using gin (tags);
create trigger designs_updated_at before update on public.designs
  for each row execute function public.set_updated_at();

create table public.design_images (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references public.designs (id) on delete cascade,
  path text not null,
  alt text,
  sort_order integer not null default 0
);
create index design_images_design_idx on public.design_images (design_id);

create table public.design_services (
  design_id uuid not null references public.designs (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  primary key (design_id, service_id)
);

create table public.design_polishes (
  design_id uuid not null references public.designs (id) on delete cascade,
  polish_id uuid not null references public.polishes (id) on delete cascade,
  primary key (design_id, polish_id)
);

-- ── Clients (per-salon CRM record; optionally linked to a user) ──────────────
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  full_name text not null,
  phone text not null,
  email text,
  notes text,
  preferred_locale public.app_locale not null default 'en',
  visit_count integer not null default 0,
  no_show_count integer not null default 0,
  last_visit_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_id, phone)
);
create index clients_user_idx on public.clients (user_id);
create trigger clients_updated_at before update on public.clients
  for each row execute function public.set_updated_at();

-- ── Leads (tried a look, left contact, has not booked) ───────────────────────
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  phone text,
  full_name text,
  design_id uuid references public.designs (id) on delete set null,
  tryon_job_id uuid,
  status public.lead_status not null default 'new',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_salon_idx on public.leads (salon_id, status);
create trigger leads_updated_at before update on public.leads
  for each row execute function public.set_updated_at();

-- ── Notification templates (salon-editable copy per kind/locale) ─────────────
create table public.salon_notification_templates (
  salon_id uuid not null references public.salons (id) on delete cascade,
  kind public.notification_kind not null,
  locale public.app_locale not null,
  body text not null,
  primary key (salon_id, kind, locale)
);
