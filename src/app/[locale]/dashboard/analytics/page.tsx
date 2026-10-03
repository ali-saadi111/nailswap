import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getDashboardContext } from "@/lib/dashboard/context";
import { AnalyticsView } from "./analytics-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "analytics" });
  return { title: t("title") };
}

export default async function AnalyticsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await getDashboardContext();
  if (!ctx.salon) redirect({ href: "/dashboard/onboarding", locale });
  if (ctx.role === "staff") redirect({ href: "/dashboard/calendar", locale });
  const salon = ctx.salon!;
  return (
    <AnalyticsView
      salon={{ id: salon.id, name: salon.name, timezone: salon.timezone, currency: salon.currency }}
    />
  );
}
