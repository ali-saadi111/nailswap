import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getDashboardContext } from "@/lib/dashboard/context";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { nowMs } from "@/lib/format";
import { BookingsTable, type DashBooking } from "./bookings-table";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "bookingsPage" });
  return { title: t("title") };
}

export default async function BookingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tab?: string; from?: string; to?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await getDashboardContext();
  if (!ctx.salon) redirect({ href: "/dashboard/onboarding", locale });
  const salon = ctx.salon!;
  const sp = await searchParams;
  const client = ctx.role === "admin" ? createAdminClient() : await createClient();
  const from =
    sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from)
      ? sp.from
      : new Date(nowMs() - 30 * 86400000).toISOString().slice(0, 10);
  const to = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : null;

  let q = client
    .from("bookings")
    .select(
      "id, starts_at, ends_at, status, source, staff_id, total_price, currency, created_at, clients(full_name, phone), services(name), designs(name, category, cover_path, shape), staff(display_name)",
    )
    .eq("salon_id", salon.id)
    .gte("starts_at", `${from}T00:00:00Z`)
    .order("starts_at", { ascending: false })
    .limit(500);
  if (to) q = q.lt("starts_at", `${to}T23:59:59Z`);
  const [{ data }, { data: staff }] = await Promise.all([
    q,
    client.from("staff").select("id, display_name").eq("salon_id", salon.id).order("sort_order"),
  ]);

  const rows: DashBooking[] = (data ?? []).map((b) => ({
    id: b.id,
    startsAt: b.starts_at,
    endsAt: b.ends_at,
    status: b.status,
    source: b.source,
    staffId: b.staff_id,
    staffName: b.staff?.display_name ?? "",
    clientName: b.clients?.full_name ?? "",
    clientPhone: b.clients?.phone ?? "",
    serviceName: b.services?.name ?? "",
    design: b.designs
      ? {
          name: b.designs.name,
          category: b.designs.category,
          coverUrl: b.designs.cover_path
            ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/public-media/${b.designs.cover_path}`
            : null,
          shape: b.designs.shape,
        }
      : null,
    totalPrice: Number(b.total_price),
    currency: b.currency,
    createdAt: b.created_at,
  }));

  return (
    <BookingsTable
      salon={{ id: salon.id, name: salon.name, timezone: salon.timezone, currency: salon.currency }}
      rows={rows}
      staff={(staff ?? []).map((s) => ({ id: s.id, name: s.display_name }))}
      initialTab={sp.tab ?? "all"}
      range={{ from, to }}
      canEdit={ctx.role !== "staff"}
    />
  );
}
