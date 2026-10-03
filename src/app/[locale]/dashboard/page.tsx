import { setRequestLocale, getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { getDashboardContext } from "@/lib/dashboard/context";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/shell/dashboard-shell";
import { Kpi } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { money, pct } from "@/lib/format";

export default async function DashboardHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await getDashboardContext();
  if (!ctx.salon) redirect({ href: "/dashboard/onboarding", locale });
  const salon = ctx.salon!;
  if (!salon.onboarding_completed_at) redirect({ href: "/dashboard/onboarding", locale });

  const t = await getTranslations("dashboard");
  const td = await getTranslations("ui.dash");
  const client = ctx.role === "admin" ? createAdminClient() : await createClient();
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 86400000).toISOString();

  const [{ count: today }, { count: tryons }, { data: bookings }, { count: pending }] = await Promise.all([
    client
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .gte("starts_at", dayStart.toISOString())
      .lt("starts_at", dayEnd.toISOString())
      .in("status", ["new", "confirmed", "completed"]),
    client
      .from("tryon_sessions")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .gte("created_at", weekAgo),
    client
      .from("bookings")
      .select("status, source, total_price")
      .eq("salon_id", salon.id)
      .gte("created_at", monthAgo),
    client
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("status", "new"),
  ]);
  const rows = bookings ?? [];
  const live = rows.filter((b) => b.status !== "cancelled");
  const revenue = live.reduce((s, b) => s + Number(b.total_price), 0);
  const noShows = rows.filter((b) => b.status === "no_show").length;
  const done = rows.filter((b) => b.status === "completed" || b.status === "no_show").length;
  const fromTryon = live.filter((b) => b.source === "tryon").length;

  return (
    <>
      <PageHeader
        context={`${salon.name} · ${td("last30")}`}
        title={t("welcome", { name: "" }).replace(/,\s*$/, "")}
        actions={
          <>
            <Link
              href="/dashboard/calendar"
              className="text-accent hover:text-foreground text-[15px] font-medium"
            >
              {t("calendar")}
            </Link>
            <ButtonLink href="/dashboard/calendar?new=1">{td("newBooking")}</ButtonLink>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-x-14 gap-y-10 lg:grid-cols-4">
        <Kpi
          value={today ?? 0}
          label={t("todayBookings")}
          hint={pending ? td("pendingCount", { count: pending }) : undefined}
          deltaTone="muted"
        />
        <Kpi value={tryons ?? 0} label={t("weekTryons")} />
        <Kpi value={live.length ? pct(fromTryon / live.length, locale) : "–"} label={t("conversion")} />
        <Kpi
          value={money(revenue, salon.currency, locale)}
          label={t("revenue")}
          hint={done ? `${t("noShowRate")} ${pct(noShows / done, locale, 1)}` : undefined}
          deltaTone="muted"
        />
      </div>
      <div className="mt-14 grid gap-x-14 gap-y-8 md:grid-cols-3">
        {[
          {
            href: "/dashboard/bookings?tab=pending",
            title: t("bookings"),
            body: td("overviewBookings", { count: pending ?? 0 }),
          },
          { href: "/dashboard/catalog", title: t("catalog"), body: td("overviewCatalog") },
          { href: "/dashboard/marketing", title: t("marketing"), body: td("overviewMarketing") },
        ].map((c) => (
          <Link key={c.href} href={c.href} className="group min-w-0">
            <h2 className="font-display group-hover:text-accent text-2xl leading-tight">{c.title}</h2>
            <p className="text-muted mt-2 text-[15px] leading-6">{c.body}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
