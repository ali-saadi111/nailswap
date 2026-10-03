-- NailSwap: Row Level Security for every table
-- Convention: platform admins can do everything; salon owners/managers manage their salon;
-- staff read their salon and manage their own bookings; the public reads only what a
-- public salon page needs; clients see their own data.

-- Enable RLS everywhere
do $$
declare t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ── app_config: admin only ───────────────────────────────────────────────────
create policy "app_config admin all" on public.app_config
  for all using (public.is_platform_admin()) with check (public.is_platform_admin());

-- ── profiles ─────────────────────────────────────────────────────────────────
create policy "profiles read own" on public.profiles for select
  using (id = auth.uid() or public.is_platform_admin());
create policy "profiles read salon colleagues" on public.profiles for select
  using (exists (
    select 1 from public.salon_members a join public.salon_members b on a.salon_id = b.salon_id
    where a.user_id = auth.uid() and b.user_id = profiles.id
  ));
create policy "profiles update own" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid() and is_platform_admin = (select p.is_platform_admin from public.profiles p where p.id = auth.uid()));
create policy "profiles admin update" on public.profiles for update
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- ── plans: public read, admin write ──────────────────────────────────────────
create policy "plans public read" on public.plans for select using (true);
create policy "plans admin write" on public.plans for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- ── salons ───────────────────────────────────────────────────────────────────
create policy "salons public read" on public.salons for select
  using (status in ('active', 'pending') or public.is_salon_member(id) or public.is_platform_admin());
create policy "salons owner insert" on public.salons for insert
  with check (owner_id = auth.uid() and status = 'pending' and directory_approved = false and remove_branding = false);
create policy "salons manager update" on public.salons for update
  using (public.is_salon_manager(id))
  with check (
    public.is_salon_manager(id)
    -- Members cannot self-approve, self-activate or change plan-gated flags.
    and status = (select s.status from public.salons s where s.id = salons.id)
    and directory_approved = (select s.directory_approved from public.salons s where s.id = salons.id)
    and remove_branding = (select s.remove_branding from public.salons s where s.id = salons.id)
    and owner_id = (select s.owner_id from public.salons s where s.id = salons.id)
  );
create policy "salons admin all" on public.salons for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- ── salon_members ────────────────────────────────────────────────────────────
create policy "members read own salons" on public.salon_members for select
  using (public.is_salon_member(salon_id) or public.is_platform_admin());
create policy "members owner manage" on public.salon_members for insert
  with check (public.is_salon_owner(salon_id) and role <> 'owner');
create policy "members owner update" on public.salon_members for update
  using (public.is_salon_owner(salon_id) and role <> 'owner')
  with check (public.is_salon_owner(salon_id) and role <> 'owner');
create policy "members owner delete" on public.salon_members for delete
  using (public.is_salon_owner(salon_id) and role <> 'owner');
create policy "members admin all" on public.salon_members for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- ── salon_hours / holidays ───────────────────────────────────────────────────
create policy "salon_hours public read" on public.salon_hours for select
  using (public.salon_is_public(salon_id) or public.is_salon_member(salon_id) or public.is_platform_admin());
create policy "salon_hours manager write" on public.salon_hours for all
  using (public.is_salon_manager(salon_id) or public.is_platform_admin())
  with check (public.is_salon_manager(salon_id) or public.is_platform_admin());

create policy "salon_holidays public read" on public.salon_holidays for select
  using (public.salon_is_public(salon_id) or public.is_salon_member(salon_id) or public.is_platform_admin());
create policy "salon_holidays manager write" on public.salon_holidays for all
  using (public.is_salon_manager(salon_id) or public.is_platform_admin())
  with check (public.is_salon_manager(salon_id) or public.is_platform_admin());

-- ── staff ────────────────────────────────────────────────────────────────────
create policy "staff public read" on public.staff for select
  using ((is_active and public.salon_is_public(salon_id)) or public.is_salon_member(salon_id) or public.is_platform_admin());
create policy "staff manager write" on public.staff for all
  using (public.is_salon_manager(salon_id) or public.is_platform_admin())
  with check (public.is_salon_manager(salon_id) or public.is_platform_admin());

create policy "schedule public read" on public.staff_schedule_rules for select
  using (exists (select 1 from public.staff s where s.id = staff_id and (public.salon_is_public(s.salon_id) or public.is_salon_member(s.salon_id))) or public.is_platform_admin());
create policy "schedule manager write" on public.staff_schedule_rules for all
  using (exists (select 1 from public.staff s where s.id = staff_id and public.is_salon_manager(s.salon_id)) or public.is_platform_admin())
  with check (exists (select 1 from public.staff s where s.id = staff_id and public.is_salon_manager(s.salon_id)) or public.is_platform_admin());

create policy "time_off public read" on public.staff_time_off for select
  using (exists (select 1 from public.staff s where s.id = staff_id and (public.salon_is_public(s.salon_id) or public.is_salon_member(s.salon_id))) or public.is_platform_admin());
create policy "time_off manager write" on public.staff_time_off for all
  using (exists (select 1 from public.staff s where s.id = staff_id and (public.is_salon_manager(s.salon_id) or s.user_id = auth.uid())) or public.is_platform_admin())
  with check (exists (select 1 from public.staff s where s.id = staff_id and (public.is_salon_manager(s.salon_id) or s.user_id = auth.uid())) or public.is_platform_admin());

-- ── services ─────────────────────────────────────────────────────────────────
create policy "services public read" on public.services for select
  using ((is_active and public.salon_is_public(salon_id)) or public.is_salon_member(salon_id) or public.is_platform_admin());
create policy "services manager write" on public.services for all
  using (public.is_salon_manager(salon_id) or public.is_platform_admin())
  with check (public.is_salon_manager(salon_id) or public.is_platform_admin());

create policy "staff_services public read" on public.staff_services for select
  using (exists (select 1 from public.staff s where s.id = staff_id and (public.salon_is_public(s.salon_id) or public.is_salon_member(s.salon_id))) or public.is_platform_admin());
create policy "staff_services manager write" on public.staff_services for all
  using (exists (select 1 from public.staff s where s.id = staff_id and public.is_salon_manager(s.salon_id)) or public.is_platform_admin())
  with check (exists (select 1 from public.staff s where s.id = staff_id and public.is_salon_manager(s.salon_id)) or public.is_platform_admin());

-- ── polishes ─────────────────────────────────────────────────────────────────
create policy "polishes public read" on public.polishes for select
  using ((in_stock and public.salon_is_public(salon_id)) or public.is_salon_member(salon_id) or public.is_platform_admin());
create policy "polishes manager write" on public.polishes for all
  using (public.is_salon_manager(salon_id) or public.is_platform_admin())
  with check (public.is_salon_manager(salon_id) or public.is_platform_admin());

-- ── designs ──────────────────────────────────────────────────────────────────
create policy "designs public read" on public.designs for select
  using ((is_visible and public.salon_is_public(salon_id)) or public.is_salon_member(salon_id) or public.is_platform_admin());
create policy "designs manager write" on public.designs for all
  using (public.is_salon_manager(salon_id) or public.is_platform_admin())
  with check (public.is_salon_manager(salon_id) or public.is_platform_admin());

create policy "design_images public read" on public.design_images for select
  using (exists (select 1 from public.designs d where d.id = design_id and ((d.is_visible and public.salon_is_public(d.salon_id)) or public.is_salon_member(d.salon_id))) or public.is_platform_admin());
create policy "design_images manager write" on public.design_images for all
  using (exists (select 1 from public.designs d where d.id = design_id and public.is_salon_manager(d.salon_id)) or public.is_platform_admin())
  with check (exists (select 1 from public.designs d where d.id = design_id and public.is_salon_manager(d.salon_id)) or public.is_platform_admin());

create policy "design_services public read" on public.design_services for select
  using (exists (select 1 from public.designs d where d.id = design_id and (public.salon_is_public(d.salon_id) or public.is_salon_member(d.salon_id))) or public.is_platform_admin());
create policy "design_services manager write" on public.design_services for all
  using (exists (select 1 from public.designs d where d.id = design_id and public.is_salon_manager(d.salon_id)) or public.is_platform_admin())
  with check (exists (select 1 from public.designs d where d.id = design_id and public.is_salon_manager(d.salon_id)) or public.is_platform_admin());

create policy "design_polishes public read" on public.design_polishes for select
  using (exists (select 1 from public.designs d where d.id = design_id and (public.salon_is_public(d.salon_id) or public.is_salon_member(d.salon_id))) or public.is_platform_admin());
create policy "design_polishes manager write" on public.design_polishes for all
  using (exists (select 1 from public.designs d where d.id = design_id and public.is_salon_manager(d.salon_id)) or public.is_platform_admin())
  with check (exists (select 1 from public.designs d where d.id = design_id and public.is_salon_manager(d.salon_id)) or public.is_platform_admin());

-- ── clients (CRM) ────────────────────────────────────────────────────────────
create policy "clients salon read" on public.clients for select
  using (public.is_salon_member(salon_id) or user_id = auth.uid() or public.is_platform_admin());
create policy "clients salon write" on public.clients for insert
  with check (public.is_salon_member(salon_id) or public.is_platform_admin());
create policy "clients salon update" on public.clients for update
  using (public.is_salon_member(salon_id) or public.is_platform_admin())
  with check (public.is_salon_member(salon_id) or public.is_platform_admin());
create policy "clients manager delete" on public.clients for delete
  using (public.is_salon_manager(salon_id) or public.is_platform_admin());

-- ── leads ────────────────────────────────────────────────────────────────────
create policy "leads salon all" on public.leads for all
  using (public.is_salon_member(salon_id) or public.is_platform_admin())
  with check (public.is_salon_member(salon_id) or public.is_platform_admin());

-- ── notification templates ───────────────────────────────────────────────────
create policy "templates salon read" on public.salon_notification_templates for select
  using (public.is_salon_member(salon_id) or public.is_platform_admin());
create policy "templates manager write" on public.salon_notification_templates for all
  using (public.is_salon_manager(salon_id) or public.is_platform_admin())
  with check (public.is_salon_manager(salon_id) or public.is_platform_admin());

-- ── tryon_sessions ───────────────────────────────────────────────────────────
-- Inserts happen through the server (service role). Salons read their own analytics.
create policy "tryon_sessions salon read" on public.tryon_sessions for select
  using (public.is_salon_member(salon_id) or user_id = auth.uid() or public.is_platform_admin());

-- ── tryon_jobs ───────────────────────────────────────────────────────────────
-- Anonymous clients subscribe to their job via Realtime using the job id (unguessable UUID);
-- the row itself is only readable by the signed-in owner, the salon, or admins. Anonymous
-- status reads go through a server route that checks the anon cookie.
create policy "tryon_jobs owner read" on public.tryon_jobs for select
  using (user_id = auth.uid() or public.is_salon_member(salon_id) or public.is_platform_admin());
create policy "tryon_jobs owner update saved" on public.tryon_jobs for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ── saved_looks ──────────────────────────────────────────────────────────────
create policy "saved_looks own" on public.saved_looks for all
  using (user_id = auth.uid() or public.is_platform_admin())
  with check (user_id = auth.uid() or public.is_platform_admin());

-- ── ai_cost_log / quota_topups / analytics_events ────────────────────────────
create policy "ai_cost_log read" on public.ai_cost_log for select
  using (public.is_salon_manager(salon_id) or public.is_platform_admin());
create policy "quota_topups read" on public.quota_topups for select
  using (public.is_salon_member(salon_id) or public.is_platform_admin());
create policy "quota_topups admin write" on public.quota_topups for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "analytics_events salon read" on public.analytics_events for select
  using (public.is_salon_member(salon_id) or public.is_platform_admin());

-- ── bookings ─────────────────────────────────────────────────────────────────
create policy "bookings salon read" on public.bookings for select
  using (
    public.is_salon_manager(salon_id)
    or (public.is_salon_member(salon_id) and staff_id = public.my_staff_id(salon_id))
    or exists (select 1 from public.clients c where c.id = client_id and (c.user_id = auth.uid() or c.phone = public.current_phone()))
    or public.is_platform_admin()
  );
create policy "bookings salon insert" on public.bookings for insert
  with check (public.is_salon_member(salon_id) or public.is_platform_admin());
create policy "bookings manager update" on public.bookings for update
  using (public.is_salon_manager(salon_id) or public.is_platform_admin())
  with check (public.is_salon_manager(salon_id) or public.is_platform_admin());
-- Staff: only their own bookings, only status/notes (enforced by trigger below).
create policy "bookings staff update own" on public.bookings for update
  using (public.is_salon_member(salon_id) and staff_id = public.my_staff_id(salon_id))
  with check (public.is_salon_member(salon_id) and staff_id = public.my_staff_id(salon_id));
create policy "bookings manager delete" on public.bookings for delete
  using (public.is_salon_owner(salon_id) or public.is_platform_admin());

create or replace function public.restrict_staff_booking_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_platform_admin() or public.is_salon_manager(new.salon_id) then
    return new;
  end if;
  -- Staff (non-manager) may only change status between confirmed/completed/no_show and edit staff_notes.
  if new.staff_id <> old.staff_id or new.starts_at <> old.starts_at or new.ends_at <> old.ends_at
     or new.service_id <> old.service_id or new.client_id <> old.client_id
     or new.total_price <> old.total_price or new.design_id is distinct from old.design_id then
    raise exception 'Staff may only update booking status and notes' using errcode = '42501';
  end if;
  if new.status not in ('confirmed', 'completed', 'no_show') then
    raise exception 'Staff may only mark bookings as attended or no-show' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger bookings_restrict_staff before update on public.bookings
  for each row when (auth.uid() is not null) execute function public.restrict_staff_booking_update();

create policy "booking_events salon read" on public.booking_events for select
  using (exists (select 1 from public.bookings b where b.id = booking_id and (public.is_salon_member(b.salon_id))) or public.is_platform_admin());

-- ── notifications ────────────────────────────────────────────────────────────
create policy "notifications salon read" on public.notifications for select
  using (public.is_salon_manager(salon_id) or public.is_platform_admin());

-- ── reviews ──────────────────────────────────────────────────────────────────
create policy "reviews public read" on public.reviews for select
  using (status = 'approved' or public.is_salon_member(salon_id) or user_id = auth.uid() or public.is_platform_admin());
create policy "reviews client insert" on public.reviews for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.bookings b join public.clients c on c.id = b.client_id
      where b.id = booking_id and b.status = 'completed'
        and (c.user_id = auth.uid() or c.phone = public.current_phone())
    )
  );
create policy "reviews client update own" on public.reviews for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and salon_reply is not distinct from (select r.salon_reply from public.reviews r where r.id = reviews.id));
create policy "reviews salon reply" on public.reviews for update
  using (public.is_salon_manager(salon_id))
  with check (
    public.is_salon_manager(salon_id)
    and rating = (select r.rating from public.reviews r where r.id = reviews.id)
    and body is not distinct from (select r.body from public.reviews r where r.id = reviews.id)
  );
create policy "reviews admin all" on public.reviews for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- ── billing ──────────────────────────────────────────────────────────────────
create policy "subscriptions salon read" on public.subscriptions for select
  using (public.is_salon_member(salon_id) or public.is_platform_admin());
create policy "subscriptions admin write" on public.subscriptions for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "invoices salon read" on public.invoices for select
  using (public.is_salon_manager(salon_id) or public.is_platform_admin());
create policy "invoices admin write" on public.invoices for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "payments salon read" on public.payments for select
  using (public.is_salon_manager(salon_id) or public.is_platform_admin());
-- Salons can record a pending manual payment (cash/Whish/OMT/transfer); only admins mark paid.
create policy "payments salon insert pending" on public.payments for insert
  with check (public.is_salon_owner(salon_id) and status = 'pending' and provider = 'manual');
create policy "payments admin write" on public.payments for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- ── flags, announcements, admin ──────────────────────────────────────────────
create policy "feature_flags public read" on public.feature_flags for select using (true);
create policy "feature_flags admin write" on public.feature_flags for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "announcements read" on public.announcements for select
  using (starts_at <= now() and (ends_at is null or ends_at > now()) and (audience in ('all', 'salons') or public.is_platform_admin()) or public.is_platform_admin());
create policy "announcements admin write" on public.announcements for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "dismissals own" on public.announcement_dismissals for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "audit admin read" on public.admin_audit_log for select using (public.is_platform_admin());
create policy "audit admin insert" on public.admin_audit_log for insert with check (public.is_platform_admin() and admin_id = auth.uid());

create policy "impersonation admin" on public.impersonation_sessions for all
  using (public.is_platform_admin()) with check (public.is_platform_admin() and admin_id = auth.uid());

create policy "moderation admin all" on public.moderation_queue for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- ── Storage policies ─────────────────────────────────────────────────────────
-- public-media: <salon_id>/... anyone reads; salon managers write their folder.
create policy "public-media read" on storage.objects for select
  using (bucket_id = 'public-media');
create policy "public-media salon write" on storage.objects for insert
  with check (bucket_id = 'public-media' and (public.is_salon_manager((storage.foldername(name))[1]::uuid) or public.is_platform_admin()));
create policy "public-media salon update" on storage.objects for update
  using (bucket_id = 'public-media' and (public.is_salon_manager((storage.foldername(name))[1]::uuid) or public.is_platform_admin()));
create policy "public-media salon delete" on storage.objects for delete
  using (bucket_id = 'public-media' and (public.is_salon_manager((storage.foldername(name))[1]::uuid) or public.is_platform_admin()));

-- tryon: written only by the server (service role). Signed-in users can read their own folder
-- (users/<uid>/...); salons read jobs attached to their bookings through signed URLs from the server.
create policy "tryon user read own" on storage.objects for select
  using (bucket_id = 'tryon' and (storage.foldername(name))[1] = 'users' and (storage.foldername(name))[2] = auth.uid()::text);

-- private-docs: salon managers read their folder; writes via server.
create policy "private-docs salon read" on storage.objects for select
  using (bucket_id = 'private-docs' and (public.is_salon_manager((storage.foldername(name))[1]::uuid) or public.is_platform_admin()));
