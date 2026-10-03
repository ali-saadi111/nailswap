import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createClient, getClaims } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getImpersonatedSalonId } from "@/lib/admin/impersonation";
import { publicMediaUrl } from "@/lib/storage";
import { publicEnv } from "@/lib/env";
import type { Salon, Subscription } from "@/lib/supabase/types";

export const SALON_COOKIE = "ns_salon";

export type DashboardRole = "owner" | "manager" | "staff" | "admin";

export interface DashboardContext {
  userId: string;
  isPlatformAdmin: boolean;
  impersonating: { salonId: string; expiresAt: string | null } | null;
  salons: { id: string; slug: string; name: string; role: DashboardRole; onboardingComplete: boolean }[];
  salon: Salon | null;
  role: DashboardRole | null;
  subscription: Pick<
    Subscription,
    "plan_code" | "status" | "trial_ends_at" | "current_period_end" | "grace_ends_at"
  > | null;
  planName: string;
  host: string;
  logoUrl: string | null;
  pendingBookings: number;
}

/**
 * Resolves who is looking at the dashboard and which salon they are working on:
 * admin impersonation → `ns_salon` cookie → first membership. Memoised per request.
 */
export const getDashboardContext = cache(async (): Promise<DashboardContext> => {
  const claims = await getClaims();
  const userId = claims.userId!;
  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: memberships } = await supabase
    .from("salon_members")
    .select("role, salons(id, slug, name, onboarding_completed_at, created_at)")
    .eq("user_id", userId);
  const salons = (memberships ?? [])
    .filter((m) => m.salons)
    .map((m) => ({
      id: m.salons!.id,
      slug: m.salons!.slug,
      name: m.salons!.name,
      role: m.role as DashboardRole,
      onboardingComplete: Boolean(m.salons!.onboarding_completed_at),
      createdAt: m.salons!.created_at,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  let impersonating: DashboardContext["impersonating"] = null;
  let salonId: string | null = null;
  let role: DashboardRole | null = null;

  if (claims.isPlatformAdmin) {
    const imp = await getImpersonatedSalonId();
    if (imp) {
      const store = await cookies();
      const raw = store.get("ns_impersonate")?.value ?? "";
      const sessionId = raw.split(":")[0];
      const { data: sess } = await admin
        .from("impersonation_sessions")
        .select("expires_at")
        .eq("id", sessionId)
        .maybeSingle();
      impersonating = { salonId: imp, expiresAt: sess?.expires_at ?? null };
      salonId = imp;
      role = "admin";
    }
  }
  if (!salonId) {
    const store = await cookies();
    const preferred = store.get(SALON_COOKIE)?.value;
    const pick = salons.find((s) => s.id === preferred) ?? salons[0] ?? null;
    if (pick) {
      salonId = pick.id;
      role = claims.isPlatformAdmin ? "admin" : pick.role;
    }
  }

  let salon: Salon | null = null;
  let subscription: DashboardContext["subscription"] = null;
  let pendingBookings = 0;
  if (salonId) {
    const client = role === "admin" ? admin : supabase;
    const [{ data: s }, { data: sub }, { count }] = await Promise.all([
      client.from("salons").select("*").eq("id", salonId).maybeSingle(),
      client
        .from("subscriptions")
        .select("plan_code, status, trial_ends_at, current_period_end, grace_ends_at")
        .eq("salon_id", salonId)
        .maybeSingle(),
      client
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("salon_id", salonId)
        .eq("status", "new")
        .gt("starts_at", new Date().toISOString()),
    ]);
    salon = s;
    subscription = sub;
    pendingBookings = count ?? 0;
  }

  const planName = subscription
    ? subscription.plan_code.charAt(0).toUpperCase() + subscription.plan_code.slice(1)
    : "";

  return {
    userId,
    isPlatformAdmin: claims.isPlatformAdmin,
    impersonating,
    salons: salons.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      role: s.role,
      onboardingComplete: s.onboardingComplete,
    })),
    salon,
    role,
    subscription,
    planName,
    host: salon ? `${salon.slug}.${publicEnv.rootDomain}` : "",
    logoUrl: publicMediaUrl(salon?.logo_path),
    pendingBookings,
  };
});

export function salonPublicUrl(slug: string, locale: string, path = "") {
  const appUrl = new URL(publicEnv.appUrl);
  const root = publicEnv.rootDomain;
  if (appUrl.hostname === root || appUrl.hostname.endsWith(`.${root}`)) {
    return `${appUrl.protocol}//${slug}.${root}/${locale}${path}`;
  }
  return `${publicEnv.appUrl}/${locale}/s/${slug}${path}`;
}
