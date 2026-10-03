import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminSettings } from "./admin-settings";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });
  return { title: t("settings") };
}

export default async function AdminSettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const admin = createAdminClient();
  const [{ data: flags }, { data: announcements }, { data: audit }, { data: plans }] = await Promise.all([
    admin.from("feature_flags").select("key, enabled, description, updated_at").order("key"),
    admin
      .from("announcements")
      .select("id, title, body, level, audience, starts_at, ends_at, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("admin_audit_log")
      .select("id, action, target_type, target_id, created_at, profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(50),
    admin
      .from("plans")
      .select("code, name, price_usd, ai_quota_monthly, staff_seats, is_active")
      .order("price_usd"),
  ]);
  return (
    <AdminSettings
      flags={flags ?? []}
      announcements={announcements ?? []}
      audit={(audit ?? []).map((a) => ({
        id: a.id,
        action: a.action,
        targetType: a.target_type,
        targetId: a.target_id,
        createdAt: a.created_at,
        admin: a.profiles?.full_name ?? "Admin",
      }))}
      plans={plans ?? []}
    />
  );
}
