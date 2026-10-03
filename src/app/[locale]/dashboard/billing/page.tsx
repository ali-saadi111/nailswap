import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getDashboardContext } from "@/lib/dashboard/context";
import { BillingView } from "./billing-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "billing" });
  return { title: t("title") };
}

export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; paymentId?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await getDashboardContext();
  if (!ctx.salon) redirect({ href: "/dashboard/onboarding", locale });
  if (ctx.role === "staff") redirect({ href: "/dashboard/calendar", locale });
  const salon = ctx.salon!;
  const sp = await searchParams;
  return (
    <BillingView
      salon={{ id: salon.id, name: salon.name, currency: salon.currency, email: salon.email }}
      owner={ctx.role === "owner" || ctx.role === "admin"}
      returnStatus={sp.status ?? null}
    />
  );
}
