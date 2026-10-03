-- NailSwap: try-on sessions, AI jobs, saved looks, cost log, analytics

-- Every AR or AI try-on interaction (used for analytics + quota).
create table public.tryon_sessions (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid references public.salons (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  anon_id text,
  mode public.tryon_mode not null,
  design_id uuid references public.designs (id) on delete set null,
  polish_id uuid references public.polishes (id) on delete set null,
  device jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index tryon_sessions_salon_idx on public.tryon_sessions (salon_id, created_at desc);
create index tryon_sessions_anon_idx on public.tryon_sessions (anon_id);

-- Queued AI generation jobs. Status is pushed to clients via Realtime.
create table public.tryon_jobs (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid references public.salons (id) on delete set null,
  user_id uuid references public.profiles (id) on delete set null,
  anon_id text,
  session_id uuid references public.tryon_sessions (id) on delete set null,
  status public.tryon_job_status not null default 'queued',
  progress smallint not null default 0 check (progress between 0 and 100),
  -- Input image in the private `tryon` bucket (EXIF stripped on upload).
  input_path text not null,
  input_hash text not null,
  mask_path text,
  design_id uuid references public.designs (id) on delete set null,
  polish_id uuid references public.polishes (id) on delete set null,
  -- Normalised generation parameters: shape, length, color hex, finish, art description, variations.
  params jsonb not null default '{}'::jsonb,
  prompt text,
  variations smallint not null default 1 check (variations between 1 and 4),
  cache_key text not null,
  cached_from_job_id uuid references public.tryon_jobs (id) on delete set null,
  provider public.ai_provider,
  provider_model text,
  provider_job_id text,
  result_paths text[] not null default '{}',
  error_code text,
  error_message text,
  cost_usd numeric(10, 5) not null default 0,
  duration_ms integer,
  attempts smallint not null default 0,
  locale public.app_locale not null default 'en',
  -- Hand photos auto-delete after 30 days unless saved.
  expires_at timestamptz not null default now() + interval '30 days',
  is_saved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tryon_jobs_salon_idx on public.tryon_jobs (salon_id, created_at desc);
create index tryon_jobs_user_idx on public.tryon_jobs (user_id, created_at desc);
create index tryon_jobs_anon_idx on public.tryon_jobs (anon_id, created_at desc);
create index tryon_jobs_cache_idx on public.tryon_jobs (cache_key) where status = 'succeeded';
create index tryon_jobs_status_idx on public.tryon_jobs (status) where status in ('queued','moderating','validating','masking','generating');
create index tryon_jobs_expiry_idx on public.tryon_jobs (expires_at) where not is_saved;
create trigger tryon_jobs_updated_at before update on public.tryon_jobs
  for each row execute function public.set_updated_at();

alter table public.leads
  add constraint leads_tryon_job_fk foreign key (tryon_job_id) references public.tryon_jobs (id) on delete set null;

-- Looks a signed-in client saved.
create table public.saved_looks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  job_id uuid references public.tryon_jobs (id) on delete set null,
  salon_id uuid references public.salons (id) on delete set null,
  design_id uuid references public.designs (id) on delete set null,
  polish_id uuid references public.polishes (id) on delete set null,
  image_path text not null,
  title text,
  created_at timestamptz not null default now()
);
create index saved_looks_user_idx on public.saved_looks (user_id, created_at desc);

-- Saving a look pins its job so the 30-day cleanup skips it.
create or replace function public.mark_job_saved()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.job_id is not null then
    update public.tryon_jobs set is_saved = true where id = new.job_id;
  end if;
  return new;
end $$;
create trigger saved_looks_pin_job after insert on public.saved_looks
  for each row execute function public.mark_job_saved();

-- Cost of every paid generation call (per provider, per salon).
create table public.ai_cost_log (
  id bigint generated always as identity primary key,
  salon_id uuid references public.salons (id) on delete set null,
  job_id uuid references public.tryon_jobs (id) on delete set null,
  provider public.ai_provider not null,
  model text not null,
  operation text not null, -- moderation | inpaint | upscale
  cost_usd numeric(10, 5) not null default 0,
  duration_ms integer,
  success boolean not null,
  created_at timestamptz not null default now()
);
create index ai_cost_log_salon_idx on public.ai_cost_log (salon_id, created_at desc);
create index ai_cost_log_provider_idx on public.ai_cost_log (provider, created_at desc);

-- Purchased AI credits (top-up packs) on top of the plan quota.
create table public.quota_topups (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  credits integer not null check (credits > 0),
  payment_id uuid,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index quota_topups_salon_idx on public.quota_topups (salon_id);

-- Lightweight analytics events (page views, try-on funnel, shares, QR scans).
create table public.analytics_events (
  id bigint generated always as identity primary key,
  salon_id uuid references public.salons (id) on delete cascade,
  kind public.analytics_event_kind not null,
  design_id uuid,
  polish_id uuid,
  user_id uuid,
  anon_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index analytics_events_salon_idx on public.analytics_events (salon_id, kind, created_at desc);
