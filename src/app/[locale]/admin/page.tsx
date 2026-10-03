import type { Metadata } from "next";
import { startOfMonth, subDays } from "date-fns";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/shell/dashboard-shell";
import { Kpi, StatusDot } from "@/components/ui/primitives";
import { fmtDateTime, fmtLongDate, fmtTime, money, num, pct } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ui.admin" });
  return { title: t("overview") };
}

export default async function AdminOverview({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("admin");
  const ta = await getTranslations("ui.admin");
  const admin = createAdminClient();
  const now = new Date();
  const monthStart = startOfMonth(now).toISOString();
  const weekAgo = subDays(now, 7).toISOString();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const count = (q: PromiseLike<{ count: number | null }>) => q.then((r) => r.count ?? 0);

  const [
    active,
    pending,
    bookingsWeek,
    newSalonsMonth,
    { data: revenue },
    jobsToday,
    jobsFailed,
    { data: cost },
    { data: queue },
    { data: audit },
    { data: health },
  ] = await Promise.all([
    count(admin.from("salons").select("id", { count: "exact", head: true }).eq("status", "active")),
    count(admin.from("salons").select("id", { count: "exact", head: true }).eq("status", "pending")),
    count(admin.from("bookings").select("id", { count: "exact", head: true }).gte("created_at", weekAgo)),
    count(admin.from("salons").select("id", { count: "exact", head: true }).gte("created_at", monthStart)),
    admin.from("payments").select("amount").eq("status", "paid").gte("updated_at", monthStart),
    count(
      admin
        .from("tryon_jobs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", dayStart.toISOString()),
    ),
    count(
      admin
        .from("tryon_jobs")
        .select("id", { count: "exact", head: true })
        .gte("created_at", dayStart.toISOString())
        .eq("status", "failed"),
    ),
    admin.from("ai_cost_log").select("cost_usd").gte("created_at", monthStart),
    admin
      .from("salons")
      .select("id, name, city, area, created_at, slug")
      .eq("status", "pending")
      .order("created_at")
      .limit(6),
    admin
      .from("admin_audit_log")
      .select("id, action, target_type, target_id, created_at, payload, profiles(full_name)")
      .order("created_at", { ascending: false })
      .limit(8),
    admin
      .from("notifications")
      .select("status")
      .gte("created_at", weekAgo)
      .in("channel", ["sms", "whatsapp"]),
  ]);
  const gmv = (revenue ?? []).reduce((s, r) => s + Number(r.amount), 0);
  const aiCost = (cost ?? []).reduce((s, r) => s + Number(r.cost_usd), 0);
  const delivered = (health ?? []).filter((n) => n.status === "sent" || n.status === "delivered").length;
  const deliveryRate = health?.length ? delivered / health.length : null;
  const oldestDays = queue?.[0]
    ? Math.max(0, Math.round((now.getTime() - new Date(queue[0].created_at).getTime()) / 86400000))
    : 0;

  return (
    <>
      <PageHeader
        context={`${fmtLongDate(now, locale)} · ${fmtTime(now, locale)} Beirut`}
        title={ta("overview")}
      />
      <div className="grid grid-cols-2 gap-x-12 gap-y-10 lg:grid-cols-5">
        <Kpi
          label={ta("activeSalons")}
          value={num(active, locale)}
          delta={newSalonsMonth ? `+${newSalonsMonth}` : undefined}
          hint={ta("thisMonth")}
          deltaTone="success"
        />
        <Kpi
          label={ta("pendingApprovals")}
          value={num(pending, locale)}
          hint={pending ? ta("oldestDays", { days: oldestDays }) : undefined}
          deltaTone="muted"
        />
        <Kpi label={ta("bookingsWeek")} value={num(bookingsWeek, locale)} />
        <Kpi
          label={ta("gmvMonth")}
          value={money(gmv, "USD", locale)}
          hint={`${t("aiCost")} ${money(aiCost, "USD", locale)}`}
          deltaTone="muted"
        />
        <Kpi
          label={ta("aiJobsToday")}
          value={num(jobsToday, locale)}
          delta={jobsToday ? pct(jobsFailed / jobsToday, locale, 1) : undefined}
          hint={jobsToday ? ta("failed", { count: jobsFailed }) : undefined}
          deltaTone={jobsFailed ? "danger" : "success"}
        />
      </div>

      <div className="mt-14 grid grid-cols-1 gap-x-16 gap-y-14 xl:grid-cols-2">
        <section>
          <div className="flex items-end justify-between">
            <h2 className="text-[17px] font-semibold">{ta("systemHealth")}</h2>
            <span className="text-muted text-sm">{ta("lastDays", { days: 7 })}</span>
          </div>
          <ul className="mt-2">
            <li className="border-border grid h-14 grid-cols-[1fr_1fr_1fr] items-center border-b text-[15px]">
              <StatusDot tone="success" className="text-[15px]">
                {ta("database")}
              </StatusDot>
              <span>{ta("operational")}</span>
              <span className="text-muted text-end text-sm">
                {ta("salonsCount", { count: active + pending })}
              </span>
            </li>
            <li className="border-border grid h-14 grid-cols-[1fr_1fr_1fr] items-center border-b text-[15px]">
              <StatusDot
                tone={jobsToday && jobsFailed / jobsToday > 0.1 ? "pending" : "success"}
                className="text-[15px]"
              >
                {ta("aiQueue")}
              </StatusDot>
              <span>{jobsToday && jobsFailed / jobsToday > 0.1 ? ta("degraded") : ta("healthy")}</span>
              <span className="text-muted text-end text-sm">{ta("jobsToday", { count: jobsToday })}</span>
            </li>
            <li className="border-border grid h-14 grid-cols-[1fr_1fr_1fr] items-center border-b text-[15px]">
              <StatusDot
                tone={deliveryRate === null ? "hollow" : deliveryRate > 0.95 ? "success" : "pending"}
                className="text-[15px]"
              >
                {ta("messaging")}
              </StatusDot>
              <span>
                {deliveryRate === null ? "–" : deliveryRate > 0.95 ? ta("operational") : ta("degraded")}
              </span>
              <span className="text-muted text-end text-sm">
                {deliveryRate === null ? "" : ta("delivered", { pct: pct(deliveryRate, locale, 1) })}
              </span>
            </li>
          </ul>

          <div className="mt-12 flex items-end justify-between">
            <h2 className="text-[17px] font-semibold">
              {ta("waitingApproval")} <span className="text-muted font-normal">· {pending}</span>
            </h2>
            <Link
              href="/admin/approvals"
              className="text-accent hover:text-foreground text-[15px] font-medium"
            >
              {ta("openQueue")}
            </Link>
          </div>
          <ul className="mt-2">
            {(queue ?? []).map((s) => (
              <li key={s.id} className="border-border flex h-[72px] items-center gap-4 border-b text-[15px]">
                <span className="min-w-0 flex-1 truncate">
                  {s.name} <span className="text-muted">· {s.area ?? s.city ?? ""}</span>
                </span>
                <span className="text-muted text-sm">
                  {ta("daysAgo", {
                    days: Math.round((now.getTime() - new Date(s.created_at).getTime()) / 86400000),
                  })}
                </span>
                <Link
                  href={`/admin/approvals?salon=${s.id}`}
                  className="text-accent hover:text-foreground font-medium"
                >
                  {ta("review")}
                </Link>
              </li>
            ))}
            {(queue ?? []).length === 0 && <li className="text-muted py-4 text-sm">–</li>}
          </ul>
        </section>

        <section>
          <div className="flex items-end justify-between">
            <h2 className="text-[17px] font-semibold">{ta("recentActivity")}</h2>
            <Link
              href="/admin/settings#audit"
              className="text-accent hover:text-foreground text-[15px] font-medium"
            >
              {t("audit")}
            </Link>
          </div>
          <ul className="mt-2">
            {(audit ?? []).map((a) => (
              <li
                key={a.id}
                className="border-border flex min-h-[72px] items-center gap-4 border-b text-[15px]"
              >
                <span className="min-w-0 flex-1">
                  <b className="font-semibold">{a.profiles?.full_name ?? "Admin"}</b>{" "}
                  <span className="text-muted">{a.action.replace(/[._]/g, " ")}</span>
                  {a.target_type && <span className="text-muted"> · {a.target_type}</span>}
                </span>
                <span className="text-muted shrink-0 text-sm" dir="ltr">
                  {fmtDateTime(a.created_at, locale)}
                </span>
              </li>
            ))}
            {(audit ?? []).length === 0 && <li className="text-muted py-4 text-sm">–</li>}
          </ul>
        </section>
      </div>
    </>
  );
}
