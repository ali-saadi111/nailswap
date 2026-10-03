import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";
import { ApprovalsView, type Application } from "./approvals-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ui.admin" });
  return { title: t("approvals") };
}

export default async function ApprovalsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ salon?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const admin = createAdminClient();
  const { data: salons } = await admin
    .from("salons")
    .select(
      "id, slug, name, city, area, status, directory_approved, created_at, phone, whatsapp_number, email, instagram, description, logo_path, owner_id, profiles!owner_id(full_name, phone, email), subscriptions(plan_code, status)",
    )
    .in("status", ["pending", "suspended"])
    .order("created_at");
  const ids = (salons ?? []).map((s) => s.id);
  const [{ data: staff }, { data: services }, { data: designs }, { data: grace }] = await Promise.all([
    admin.from("staff").select("salon_id").in("salon_id", ids),
    admin.from("services").select("salon_id").in("salon_id", ids),
    admin.from("designs").select("salon_id").in("salon_id", ids),
    admin
      .from("subscriptions")
      .select("salon_id, plan_code, status, grace_ends_at, downgrade_to, salons(name, slug)")
      .in("status", ["grace", "past_due"])
      .order("grace_ends_at"),
  ]);
  const c = (rows: { salon_id: string }[] | null, id: string) =>
    (rows ?? []).filter((r) => r.salon_id === id).length;
  const apps: Application[] = (salons ?? []).map((s) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    city: s.city,
    area: s.area,
    status: s.status,
    directoryApproved: s.directory_approved,
    createdAt: s.created_at,
    phone: s.phone,
    whatsapp: s.whatsapp_number,
    email: s.email,
    instagram: s.instagram,
    description: s.description,
    owner: s.profiles
      ? { name: s.profiles.full_name, phone: s.profiles.phone, email: s.profiles.email }
      : null,
    plan: s.subscriptions?.plan_code ?? "trial",
    counts: { staff: c(staff, s.id), services: c(services, s.id), designs: c(designs, s.id) },
    previewUrl: `${publicEnv.appUrl}/${locale}/s/${s.slug}`,
  }));
  return (
    <ApprovalsView
      apps={apps}
      initialId={sp.salon ?? null}
      planChanges={(grace ?? []).map((g) => ({
        salonId: g.salon_id,
        salonName: g.salons?.name ?? "",
        plan: g.plan_code,
        status: g.status,
        graceEndsAt: g.grace_ends_at,
        downgradeTo: g.downgrade_to,
      }))}
    />
  );
}
