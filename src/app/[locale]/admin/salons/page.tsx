import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { nowMs } from "@/lib/format";
import { SalonsTable } from "./salons-table";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  return { title: t("salons") };
}

export default async function AdminSalonsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const admin = createAdminClient();
  const monthAgo = new Date(nowMs() - 30 * 86400000).toISOString();
  const [{ data: salons }, { data: bookings }] = await Promise.all([
    admin
      .from("salons")
      .select(
        "id, slug, name, city, area, status, directory_approved, created_at, rating_avg, rating_count, profiles!owner_id(full_name, phone), subscriptions(plan_code, status)",
      )
      .order("created_at", { ascending: false })
      .limit(500),
    admin.from("bookings").select("salon_id").gte("created_at", monthAgo),
  ]);
  const counts = new Map<string, number>();
  for (const b of bookings ?? []) counts.set(b.salon_id, (counts.get(b.salon_id) ?? 0) + 1);
  return (
    <SalonsTable
      rows={(salons ?? []).map((s) => ({
        id: s.id,
        slug: s.slug,
        name: s.name,
        area: s.area ?? s.city,
        status: s.status,
        directoryApproved: s.directory_approved,
        createdAt: s.created_at,
        rating: Number(s.rating_avg),
        ratingCount: s.rating_count,
        owner: s.profiles?.full_name ?? null,
        plan: s.subscriptions?.plan_code ?? "trial",
        subStatus: s.subscriptions?.status ?? null,
        bookings30: counts.get(s.id) ?? 0,
      }))}
    />
  );
}
