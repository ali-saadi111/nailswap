-- Minimal SQL seed applied on `supabase db reset`.
-- The full demo dataset (3 salons, designs, polishes, staff, bookings, images and auth users)
-- is created by `pnpm db:seed` (scripts/seed.ts), which needs the Storage API.

insert into public.app_config (key, value) values
  ('app_url', 'http://host.docker.internal:3000'),
  ('internal_secret', 'local-dev-internal-secret-change-me')
on conflict (key) do nothing;
