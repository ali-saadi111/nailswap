import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getDashboardContext } from "@/lib/dashboard/context";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicMediaUrl } from "@/lib/storage";
import { SettingsForm } from "./settings-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "settings" });
  return { title: t("title") };
}

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await getDashboardContext();
  if (!ctx.salon) redirect({ href: "/dashboard/onboarding", locale });
  if (ctx.role === "staff") redirect({ href: "/dashboard/calendar", locale });
  const salon = ctx.salon!;
  const client = ctx.role === "admin" ? createAdminClient() : await createClient();
  const [{ data: members }, { data: staff }, { data: plan }, { data: templates }] = await Promise.all([
    client
      .from("salon_members")
      .select("user_id, role, profiles!user_id(full_name, phone)")
      .eq("salon_id", salon.id),
    client.from("staff").select("id, display_name, user_id").eq("salon_id", salon.id),
    ctx.subscription
      ? client
          .from("plans")
          .select("remove_branding, staff_seats")
          .eq("code", ctx.subscription.plan_code)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    client.from("salon_notification_templates").select("kind, locale, body").eq("salon_id", salon.id),
  ]);

  return (
    <SettingsForm
      salon={salon}
      host={ctx.host}
      logoUrl={publicMediaUrl(salon.logo_path)}
      coverUrl={publicMediaUrl(salon.cover_path)}
      role={ctx.role!}
      plan={{
        removeBranding: plan?.remove_branding ?? false,
        seats: plan?.staff_seats ?? 1,
        code: ctx.subscription?.plan_code ?? "trial",
      }}
      members={(members ?? []).map((m) => ({
        userId: m.user_id,
        role: m.role,
        name: m.profiles?.full_name ?? null,
        phone: m.profiles?.phone ?? null,
        staffName: (staff ?? []).find((s) => s.user_id === m.user_id)?.display_name ?? null,
      }))}
      templates={templates ?? []}
    />
  );
}
