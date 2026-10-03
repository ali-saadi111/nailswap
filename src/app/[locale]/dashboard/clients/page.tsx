import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getDashboardContext } from "@/lib/dashboard/context";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { nowMs } from "@/lib/format";
import { ClientsView, type ClientRow } from "./clients-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "clientsPage" });
  return { title: t("title") };
}

export default async function ClientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ client?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await getDashboardContext();
  if (!ctx.salon) redirect({ href: "/dashboard/onboarding", locale });
  const salon = ctx.salon!;
  const sp = await searchParams;
  const client = ctx.role === "admin" ? createAdminClient() : await createClient();
  const [{ data: clients, count }, { data: spend }, { data: staff }, { data: services }] = await Promise.all([
    client
      .from("clients")
      .select("id, full_name, phone, email, notes, visit_count, no_show_count, last_visit_at, created_at", {
        count: "exact",
      })
      .eq("salon_id", salon.id)
      .order("last_visit_at", { ascending: false, nullsFirst: false })
      .limit(500),
    client
      .from("bookings")
      .select("client_id, total_price, status")
      .eq("salon_id", salon.id)
      .in("status", ["completed", "confirmed", "new"]),
    client
      .from("staff")
      .select("id, display_name")
      .eq("salon_id", salon.id)
      .eq("is_active", true)
      .order("sort_order"),
    client
      .from("services")
      .select("id, name, duration_min, price")
      .eq("salon_id", salon.id)
      .eq("is_active", true)
      .order("sort_order"),
  ]);
  const spent = new Map<string, number>();
  for (const b of spend ?? []) spent.set(b.client_id, (spent.get(b.client_id) ?? 0) + Number(b.total_price));
  const monthAgo = nowMs() - 30 * 86400000;
  const rows: ClientRow[] = (clients ?? []).map((c) => ({
    id: c.id,
    name: c.full_name,
    phone: c.phone,
    email: c.email,
    notes: c.notes,
    visits: c.visit_count,
    noShows: c.no_show_count,
    lastVisitAt: c.last_visit_at,
    createdAt: c.created_at,
    spent: spent.get(c.id) ?? 0,
  }));
  return (
    <ClientsView
      salon={{ id: salon.id, name: salon.name, timezone: salon.timezone, currency: salon.currency }}
      rows={rows}
      total={count ?? rows.length}
      newThisMonth={rows.filter((r) => new Date(r.createdAt).getTime() > monthAgo).length}
      initialClientId={sp.client ?? null}
      staff={(staff ?? []).map((s) => ({ id: s.id, name: s.display_name }))}
      services={(services ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        durationMin: s.duration_min,
        price: Number(s.price),
      }))}
      canEdit={ctx.role !== "staff"}
    />
  );
}
