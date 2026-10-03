import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getDashboardContext, salonPublicUrl } from "@/lib/dashboard/context";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Wizard } from "./wizard";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "onboarding" });
  return { title: t("title") };
}

export default async function OnboardingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ new?: string; step?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const ctx = await getDashboardContext();
  const salon = sp.new ? null : ctx.salon;
  const client = ctx.role === "admin" ? createAdminClient() : await createClient();

  const [hours, services, staff, designs] = salon
    ? await Promise.all([
        client
          .from("salon_hours")
          .select("weekday, open_time, close_time, is_closed")
          .eq("salon_id", salon.id),
        client
          .from("services")
          .select("id, name, category, price, duration_min")
          .eq("salon_id", salon.id)
          .order("sort_order"),
        client.from("staff").select("id, display_name, color").eq("salon_id", salon.id).eq("is_active", true),
        client.from("designs").select("id, name, cover_path").eq("salon_id", salon.id),
      ])
    : [null, null, null, null];

  return (
    <Wizard
      locale={locale}
      salon={salon}
      publicUrl={salon ? salonPublicUrl(salon.slug, locale) : null}
      initialStep={sp.step ? Number(sp.step) : undefined}
      existing={{
        hours: hours?.data ?? [],
        services: (services?.data ?? []).map((s) => ({ ...s, price: Number(s.price) })),
        staff: staff?.data ?? [],
        designs: designs?.data ?? [],
      }}
    />
  );
}
