-- NailSwap: JWT claims hook and authorization helper functions

-- Adds `is_platform_admin` and `salon_roles` ({salon_id: role}) to the access token so the
-- app (and RLS) can authorize without extra round-trips.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  claims jsonb := event -> 'claims';
  uid uuid := (event ->> 'user_id')::uuid;
  admin boolean;
  roles jsonb;
begin
  select is_platform_admin into admin from public.profiles where id = uid;
  select coalesce(jsonb_object_agg(salon_id::text, role::text), '{}'::jsonb) into roles
  from public.salon_members where user_id = uid;

  claims := jsonb_set(claims, '{is_platform_admin}', to_jsonb(coalesce(admin, false)));
  claims := jsonb_set(claims, '{salon_roles}', coalesce(roles, '{}'::jsonb));
  return jsonb_set(event, '{claims}', claims);
end $$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
grant select on public.profiles, public.salon_members to supabase_auth_admin;

-- ── Helpers used by RLS ──────────────────────────────────────────────────────
-- SECURITY DEFINER so the lookups on salon_members/profiles/salons bypass RLS: otherwise a policy
-- on salon_members that calls is_salon_member() re-enters the same policy (infinite recursion).
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((auth.jwt() ->> 'is_platform_admin')::boolean, false)
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_platform_admin);
$$;

create or replace function public.salon_role(p_salon_id uuid)
returns public.salon_member_role language sql stable security definer set search_path = public as $$
  select m.role from public.salon_members m
  where m.salon_id = p_salon_id and m.user_id = auth.uid();
$$;

create or replace function public.is_salon_member(p_salon_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.salon_members m
    where m.salon_id = p_salon_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_salon_manager(p_salon_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.salon_members m
    where m.salon_id = p_salon_id and m.user_id = auth.uid() and m.role in ('owner', 'manager')
  );
$$;

create or replace function public.is_salon_owner(p_salon_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.salon_members m
    where m.salon_id = p_salon_id and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

-- Staff member row linked to the current user in a salon (if any).
create or replace function public.my_staff_id(p_salon_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select s.id from public.staff s where s.salon_id = p_salon_id and s.user_id = auth.uid() limit 1;
$$;

-- Phone of the current user (from JWT), normalised without '+'.
create or replace function public.current_phone()
returns text language sql stable as $$
  select nullif(regexp_replace(coalesce(auth.jwt() ->> 'phone', ''), '[^0-9]', '', 'g'), '');
$$;

-- Salon is publicly visible (active). Pending salons are still reachable by direct link so a
-- new owner can preview their page before directory approval.
create or replace function public.salon_is_public(p_salon_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.salons s where s.id = p_salon_id and s.status in ('active', 'pending'));
$$;
