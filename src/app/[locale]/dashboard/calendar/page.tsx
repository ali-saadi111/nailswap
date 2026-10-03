import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getDashboardContext } from "@/lib/dashboard/context";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isoDate } from "@/lib/format";
import { CalendarView, type CalBooking } from "./calendar-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard" });
  return { title: t("calendar") };
}

function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ date?: string; view?: string; staff?: string; new?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await getDashboardContext();
  if (!ctx.salon) redirect({ href: "/dashboard/onboarding", locale });
  const salon = ctx.salon!;
  const sp = await searchParams;
  const client = ctx.role === "admin" ? createAdminClient() : await createClient();
  const tz = salon.timezone;
  const today = isoDate(new Date(), tz);
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const view = sp.view === "week" ? "week" : "day";
  // Week starts Monday.
  const dow = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
  const from = view === "week" ? addDays(date, -dow) : date;
  const to = addDays(from, view === "week" ? 7 : 1);
  // Generous UTC window; the view filters by salon-local date.
  const fromIso = new Date(`${addDays(from, -1)}T00:00:00Z`).toISOString();
  const toIso = new Date(`${addDays(to, 1)}T00:00:00Z`).toISOString();

  const [{ data: staff }, { data: bookings }, { data: hours }, { data: services }] = await Promise.all([
    client
      .from("staff")
      .select("id, display_name, avatar_path, color, is_active, accepts_online_booking")
      .eq("salon_id", salon.id)
      .eq("is_active", true)
      .order("sort_order"),
    client
      .from("bookings")
      .select(
        "id, starts_at, ends_at, status, source, staff_id, client_notes, total_price, clients(full_name, phone), services(name, duration_min), designs(name, category, cover_path, shape)",
      )
      .eq("salon_id", salon.id)
      .gte("starts_at", fromIso)
      .lt("starts_at", toIso)
      .neq("status", "cancelled"),
    client.from("salon_hours").select("weekday, open_time, close_time, is_closed").eq("salon_id", salon.id),
    client
      .from("services")
      .select("id, name, duration_min, price")
      .eq("salon_id", salon.id)
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  const rows: CalBooking[] = (bookings ?? []).map((b) => ({
    id: b.id,
    startsAt: b.starts_at,
    endsAt: b.ends_at,
    status: b.status,
    source: b.source,
    staffId: b.staff_id,
    clientName: b.clients?.full_name ?? "",
    serviceName: b.services?.name ?? "",
    designName: b.designs?.name ?? null,
    totalPrice: Number(b.total_price),
  }));

  return (
    <CalendarView
      salon={{ id: salon.id, name: salon.name, timezone: tz, currency: salon.currency }}
      date={date}
      today={today}
      view={view}
      staff={(staff ?? []).map((s) => ({ id: s.id, name: s.display_name, color: s.color }))}
      staffFilter={sp.staff ?? null}
      bookings={rows}
      hours={hours ?? []}
      services={(services ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        durationMin: s.duration_min,
        price: Number(s.price),
      }))}
      pendingCount={ctx.pendingBookings}
      openNew={sp.new === "1"}
      canEdit={ctx.role !== "staff"}
    />
  );
}
