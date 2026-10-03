import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getImpersonatedSalonId } from "@/lib/admin/impersonation";
import { ImpersonationForm } from "./impersonation-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ui.admin" });
  return { title: t("impersonation") };
}

export default async function ImpersonationPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const admin = createAdminClient();
  const [{ data: salons }, { data: sessions }, current] = await Promise.all([
    admin
      .from("salons")
      .select("id, slug, name, city, area, status, profiles!owner_id(full_name), subscriptions(plan_code)")
      .order("name")
      .limit(500),
    admin
      .from("impersonation_sessions")
      .select("id, reason, started_at, ended_at, expires_at, salons(name), profiles(full_name)")
      .order("started_at", { ascending: false })
      .limit(20),
    getImpersonatedSalonId(),
  ]);
  return (
    <ImpersonationForm
      salons={(salons ?? []).map((s) => ({
        id: s.id,
        slug: s.slug,
        name: s.name,
        area: s.area ?? s.city,
        status: s.status,
        owner: s.profiles?.full_name ?? null,
        plan: s.subscriptions?.plan_code ?? "trial",
      }))}
      sessions={(sessions ?? []).map((x) => ({
        id: x.id,
        reason: x.reason,
        startedAt: x.started_at,
        endedAt: x.ended_at,
        expiresAt: x.expires_at,
        salonName: x.salons?.name ?? "",
        adminName: x.profiles?.full_name ?? "Admin",
      }))}
      currentSalonId={current}
    />
  );
}
