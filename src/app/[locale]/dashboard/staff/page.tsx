import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getDashboardContext } from "@/lib/dashboard/context";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicMediaUrl } from "@/lib/storage";
import { StaffView, type StaffMember } from "./staff-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard" });
  return { title: t("staff") };
}

export default async function StaffPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await getDashboardContext();
  if (!ctx.salon) redirect({ href: "/dashboard/onboarding", locale });
  if (ctx.role === "staff") redirect({ href: "/dashboard/calendar", locale });
  const salon = ctx.salon!;
  const client = ctx.role === "admin" ? createAdminClient() : await createClient();

  const now = new Date();
  const dow = (now.getDay() + 6) % 7;
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - dow);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [
    { data: staff },
    { data: rules },
    { data: bookings },
    { data: services },
    { data: members },
    { data: reviews },
    { data: plan },
  ] = await Promise.all([
    client
      .from("staff")
      .select(
        "id, display_name, bio, color, avatar_path, accepts_online_booking, is_active, user_id, sort_order, staff_services(service_id)",
      )
      .eq("salon_id", salon.id)
      .order("sort_order"),
    client.from("staff_schedule_rules").select("id, staff_id, weekday, kind, start_time, end_time"),
    client
      .from("bookings")
      .select("staff_id, starts_at, ends_at, status, source")
      .eq("salon_id", salon.id)
      .gte("starts_at", weekStart.toISOString())
      .lt("starts_at", weekEnd.toISOString())
      .neq("status", "cancelled"),
    client
      .from("services")
      .select("id, name")
      .eq("salon_id", salon.id)
      .eq("is_active", true)
      .order("sort_order"),
    client.from("salon_members").select("user_id, role").eq("salon_id", salon.id),
    client
      .from("reviews")
      .select("rating, booking_id, bookings(staff_id)")
      .eq("salon_id", salon.id)
      .eq("status", "approved"),
    ctx.subscription
      ? client.from("plans").select("staff_seats").eq("code", ctx.subscription.plan_code).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const staffIds = new Set((staff ?? []).map((s) => s.id));
  const rows: StaffMember[] = (staff ?? []).map((s) => {
    const myRules = (rules ?? []).filter((r) => r.staff_id === s.id);
    const myBookings = (bookings ?? []).filter((b) => b.staff_id === s.id);
    const bookedMin = myBookings.reduce(
      (sum, b) => sum + (new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 60000,
      0,
    );
    const scheduledMin =
      myRules
        .filter((r) => r.kind === "work")
        .reduce((sum, r) => sum + (toMin(r.end_time) - toMin(r.start_time)), 0) -
      myRules
        .filter((r) => r.kind === "break")
        .reduce((sum, r) => sum + (toMin(r.end_time) - toMin(r.start_time)), 0);
    const myReviews = (reviews ?? []).filter((r) => r.bookings?.staff_id === s.id);
    return {
      id: s.id,
      name: s.display_name,
      bio: s.bio,
      color: s.color,
      avatarUrl: publicMediaUrl(s.avatar_path),
      acceptsOnline: s.accepts_online_booking,
      isActive: s.is_active,
      userId: s.user_id,
      role: (members ?? []).find((m) => m.user_id === s.user_id)?.role ?? null,
      serviceIds: s.staff_services.map((x) => x.service_id),
      rules: myRules.map((r) => ({
        id: r.id,
        weekday: r.weekday,
        kind: r.kind,
        start: r.start_time.slice(0, 5),
        end: r.end_time.slice(0, 5),
      })),
      bookedMin: Math.round(bookedMin),
      scheduledMin: Math.max(0, Math.round(scheduledMin)),
      rating: myReviews.length ? myReviews.reduce((a, r) => a + r.rating, 0) / myReviews.length : null,
      reviewCount: myReviews.length,
    };
  });
  const all = (bookings ?? []).filter((b) => staffIds.has(b.staff_id));
  const totals = {
    bookedMin: rows.reduce((s, r) => s + r.bookedMin, 0),
    scheduledMin: rows.reduce((s, r) => s + r.scheduledMin, 0),
    rating: (reviews ?? []).length
      ? (reviews ?? []).reduce((a, r) => a + r.rating, 0) / (reviews ?? []).length
      : null,
    reviewCount: (reviews ?? []).length,
    fromTryon: all.length ? all.filter((b) => b.source === "tryon").length / all.length : null,
  };

  return (
    <StaffView
      salon={{ id: salon.id, name: salon.name, timezone: salon.timezone }}
      staff={rows}
      services={services ?? []}
      totals={totals}
      seats={plan?.staff_seats ?? 1}
      owner={ctx.role === "owner" || ctx.role === "admin"}
      weekStart={weekStart.toISOString().slice(0, 10)}
    />
  );
}

function toMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
