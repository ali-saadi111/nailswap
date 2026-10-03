import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getDashboardContext, salonPublicUrl } from "@/lib/dashboard/context";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicMediaUrl } from "@/lib/storage";
import { MarketingTools, type Lead } from "./marketing-tools";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "marketing" });
  return { title: t("title") };
}

export default async function MarketingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await getDashboardContext();
  if (!ctx.salon) redirect({ href: "/dashboard/onboarding", locale });
  if (ctx.role === "staff") redirect({ href: "/dashboard/calendar", locale });
  const salon = ctx.salon!;
  const client = ctx.role === "admin" ? createAdminClient() : await createClient();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [{ data: leads }, { data: events }, { data: designs }] = await Promise.all([
    client
      .from("leads")
      .select(
        "id, full_name, phone, status, notes, created_at, design_id, tryon_job_id, designs(name, category, cover_path, shape)",
      )
      .eq("salon_id", salon.id)
      .order("created_at", { ascending: false })
      .limit(100),
    client
      .from("analytics_events")
      .select("kind")
      .eq("salon_id", salon.id)
      .gte("created_at", monthStart.toISOString())
      .in("kind", ["qr_scan", "tryon_ar_start", "tryon_ai_request", "booking_created"]),
    client
      .from("designs")
      .select("id, name, category, cover_path, shape")
      .eq("salon_id", salon.id)
      .eq("is_visible", true)
      .order("tryon_count", { ascending: false })
      .limit(3),
  ]);
  const count = (k: string) => (events ?? []).filter((e) => e.kind === k).length;
  const tryons = count("tryon_ar_start") + count("tryon_ai_request");
  const bookings = count("booking_created");

  const rows: Lead[] = (leads ?? []).map((l) => ({
    id: l.id,
    name: l.full_name,
    phone: l.phone,
    status: l.status,
    notes: l.notes,
    createdAt: l.created_at,
    fromTryon: Boolean(l.tryon_job_id),
    design: l.designs
      ? {
          name: l.designs.name,
          category: l.designs.category,
          coverUrl: publicMediaUrl(l.designs.cover_path),
          shape: l.designs.shape,
        }
      : null,
  }));

  return (
    <MarketingTools
      salon={{
        id: salon.id,
        slug: salon.slug,
        name: salon.name,
        host: ctx.host,
        pageUrl: salonPublicUrl(salon.slug, locale),
        tryUrl: salonPublicUrl(salon.slug, locale, "/try"),
      }}
      locale={locale}
      stats={{ scans: count("qr_scan"), tryons, bookings }}
      leads={rows}
      topDesigns={(designs ?? []).map((d) => ({
        name: d.name,
        category: d.category,
        coverUrl: publicMediaUrl(d.cover_path),
        shape: d.shape,
      }))}
    />
  );
}
