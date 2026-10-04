"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PageHeader } from "@/components/shell/dashboard-shell";
import { Dot, Kpi, Skeleton, Tabs } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { csvEscape, downloadText } from "@/lib/client/dashboard";
import { fmtDay, money, num, pct } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Analytics {
  range: { from: string; to: string };
  daily: { date: string; page_views: number; tryons: number; bookings: number }[];
  bookings: {
    total: number;
    by_status: Record<string, number>;
    by_source: Record<string, number>;
    revenue: number;
    no_show_rate: number;
  };
  clients: { new: number; returning: number; total: number };
  tryon: {
    ar_sessions: number;
    ai_jobs: number;
    ai_succeeded: number;
    ai_cached: number;
    ai_cost_usd: number;
  };
  top_designs: { design_id: string; name: string; tryons: number; bookings: number }[];
  top_polishes: { id: string; name: string; tryons: number }[];
  funnel: {
    pageViews: number;
    tryons: number;
    bookClicks: number;
    bookings: number;
    tryonToBookingRate: number;
  };
}

type Range = "7" | "30" | "90";

export function AnalyticsView({
  salon,
}: {
  salon: { id: string; name: string; timezone: string; currency: string };
}) {
  const t = useTranslations("analytics");
  const td = useTranslations("ui.dash");
  const locale = useLocale();
  const [range, setRange] = React.useState<Range>("30");
  const [store, setStore] = React.useState<{ range: Range; data: Analytics; prev: Analytics | null } | null>(
    null,
  );
  const data = store?.range === range ? store.data : null;
  const prev = store?.range === range ? store.prev : null;

  React.useEffect(() => {
    let cancelled = false;
    const days = Number(range);
    const to = new Date();
    const from = new Date(to.getTime() - days * 86400000);
    const pFrom = new Date(from.getTime() - days * 86400000);
    Promise.all([
      api.get<Analytics>(
        `/api/dashboard/${salon.id}/analytics?from=${from.toISOString()}&to=${to.toISOString()}`,
      ),
      api
        .get<Analytics>(
          `/api/dashboard/${salon.id}/analytics?from=${pFrom.toISOString()}&to=${from.toISOString()}`,
        )
        .catch(() => null),
    ])
      .then(([d, p]) => {
        if (cancelled) return;
        setStore({ range, data: d, prev: p });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [salon.id, range]);

  const delta = (cur: number, before: number | undefined, unit: "pct" | "pts" = "pct") => {
    if (before === undefined || before === null) return undefined;
    if (unit === "pts") {
      const d = (cur - before) * 100;
      return `${d >= 0 ? "+" : ""}${d.toFixed(1)} ${td("pts")}`;
    }
    if (!before) return undefined;
    const d = ((cur - before) / before) * 100;
    return `${d >= 0 ? "+" : ""}${d.toFixed(0)}%`;
  };
  const tone = (cur: number, before: number | undefined, lowerIsBetter = false) => {
    if (before === undefined) return "muted" as const;
    const up = cur >= before;
    return (lowerIsBetter ? !up : up) ? ("success" as const) : ("danger" as const);
  };

  function exportCsv() {
    if (!data) return;
    const lines = data.daily.map((d) =>
      [d.date, d.page_views, d.tryons, d.bookings].map(csvEscape).join(","),
    );
    downloadText(`analytics-${range}d.csv`, ["date,page_views,tryons,bookings", ...lines].join("\n"));
  }

  const rangeLabel = data
    ? `${fmtDay(data.range.from, locale, salon.timezone, { day: "numeric", month: "short" })} – ${fmtDay(data.range.to, locale, salon.timezone, { day: "numeric", month: "short", year: "numeric" })}`
    : "";
  const maxDay = Math.max(1, ...(data?.daily.map((d) => d.bookings) ?? [1]));
  const today = new Date().toISOString().slice(0, 10);
  const sources = data ? Object.entries(data.bookings.by_source).sort((a, b) => b[1] - a[1]) : [];
  const sourceTotal = sources.reduce((s, [, n]) => s + n, 0) || 1;
  const sourceTone = ["bg-accent", "bg-[#a67c6a]", "bg-success", "bg-nude"];
  const sourceLabel = (s: string) =>
    s === "tryon"
      ? td("sourceTryon")
      : s === "direct"
        ? td("sourceDirect")
        : s === "rebook"
          ? td("sourceRebook")
          : td("sourceDashboard");

  return (
    <>
      <PageHeader
        context={`${salon.name} · ${td("lastDays", { days: Number(range) })}`}
        title={t("title")}
        actions={
          <>
            <Tabs
              value={range}
              onChange={setRange}
              items={[
                { value: "7", label: t("range7") },
                { value: "30", label: t("range30") },
                { value: "90", label: t("range90") },
              ]}
            />
            {rangeLabel && <span className="text-muted text-[15px]">{rangeLabel}</span>}
            <button
              type="button"
              onClick={exportCsv}
              className="text-accent hover:text-foreground inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium"
            >
              <Download className="size-5" strokeWidth={1.75} />
              {td("export")}
            </button>
          </>
        }
      />

      {!data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-10 w-24" />
              <Skeleton className="mt-3 w-32" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              value={num(data.bookings.total, locale)}
              label={t("bookingsCount")}
              delta={delta(data.bookings.total, prev?.bookings.total)}
              deltaTone={tone(data.bookings.total, prev?.bookings.total)}
              hint={prev ? td("vsPrevious", { days: Number(range) }) : undefined}
            />
            <Kpi
              value={money(data.bookings.revenue, salon.currency, locale)}
              label={t("revenue")}
              delta={delta(data.bookings.revenue, prev?.bookings.revenue)}
              deltaTone={tone(data.bookings.revenue, prev?.bookings.revenue)}
              hint={prev ? td("vsPrevious", { days: Number(range) }) : undefined}
            />
            <Kpi
              value={pct(data.funnel.tryonToBookingRate, locale, 1)}
              label={t("conversion")}
              delta={delta(data.funnel.tryonToBookingRate, prev?.funnel.tryonToBookingRate, "pts")}
              deltaTone={tone(data.funnel.tryonToBookingRate, prev?.funnel.tryonToBookingRate)}
              hint={prev ? td("vsPrevious", { days: Number(range) }) : undefined}
            />
            <Kpi
              value={pct(data.bookings.no_show_rate, locale, 1)}
              label={t("noShowRate")}
              delta={delta(data.bookings.no_show_rate, prev?.bookings.no_show_rate, "pts")}
              deltaTone={tone(data.bookings.no_show_rate, prev?.bookings.no_show_rate, true)}
              hint={td("lowerBetter")}
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <section className="dashboard-card">
              <div className="flex flex-wrap items-end justify-between gap-4 gap-y-2">
                <h2 className="font-display text-[28px] leading-none">{td("bookingsPerDay")}</h2>
                <span className="flex items-center gap-4 text-sm">
                  <span className="inline-flex items-center gap-2">
                    <span className="size-[7px] rounded-full bg-[#a67c6a]" />
                    {t("bookingsCount")}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Dot tone="accent" />
                    {td("todayLabel")}
                  </span>
                </span>
              </div>
              <div
                className="mt-6 flex h-56 items-end gap-[3px]"
                role="img"
                aria-label={td("bookingsPerDay")}
              >
                {data.daily.map((d) => (
                  <div
                    key={d.date}
                    className="group relative flex h-full flex-1 items-end"
                    title={`${fmtDay(d.date, locale, "UTC")} · ${d.bookings}`}
                  >
                    <div
                      className={cn(
                        "w-full rounded-t-[4px]",
                        d.date === today ? "bg-accent" : "bg-[#a67c6a]",
                      )}
                      style={{ height: `${Math.max(d.bookings ? 3 : 1, (d.bookings / maxDay) * 100)}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="border-border text-muted mt-0 flex justify-between border-t pt-2 text-[13px]">
                <span>
                  {fmtDay(data.range.from, locale, salon.timezone, { day: "numeric", month: "short" })}
                </span>
                <span>
                  {fmtDay(data.range.to, locale, salon.timezone, { day: "numeric", month: "short" })}
                </span>
              </div>

              <div className="mt-14 flex flex-wrap items-end justify-between gap-y-2">
                <h2 className="font-display text-[28px] leading-none">{t("topDesigns")}</h2>
                <Link
                  href="/dashboard/catalog"
                  className="text-accent hover:text-foreground text-[15px] font-medium"
                >
                  {td("openCatalog")}
                </Link>
              </div>
              <div className="dashboard-table dashboard-table mt-4">
                <div className="table-head grid-cols-[32px_minmax(140px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)_70px]">
                  <span>#</span>
                  <span>{td("design")}</span>
                  <span>{t("tryons")}</span>
                  <span>{t("bookingsCount")}</span>
                  <span className="text-end">{td("conv")}</span>
                </div>
                {data.top_designs.slice(0, 6).map((d, i) => {
                  const maxT = Math.max(1, ...data.top_designs.map((x) => x.tryons));
                  const maxB = Math.max(1, ...data.top_designs.map((x) => x.bookings));
                  return (
                    <div
                      key={d.design_id}
                      className="data-row h-14 grid-cols-[32px_minmax(140px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)_70px]"
                    >
                      <span className="text-muted">{i + 1}</span>
                      <span className="truncate text-[15px]">{d.name}</span>
                      <span className="flex items-center gap-3 tabular-nums">
                        {d.tryons}
                        <span className="bg-border h-1 flex-1 rounded-full">
                          <span
                            className="block h-1 rounded-full bg-[#a67c6a]"
                            style={{ width: `${(d.tryons / maxT) * 100}%` }}
                          />
                        </span>
                      </span>
                      <span className="flex items-center gap-3 tabular-nums">
                        {d.bookings}
                        <span className="bg-border h-1 flex-1 rounded-full">
                          <span
                            className="bg-accent block h-1 rounded-full"
                            style={{ width: `${(d.bookings / maxB) * 100}%` }}
                          />
                        </span>
                      </span>
                      <span className="text-end font-medium tabular-nums">
                        {d.tryons ? pct(d.bookings / d.tryons, locale, 1) : "–"}
                      </span>
                    </div>
                  );
                })}
                {data.top_designs.length === 0 && (
                  <div className="text-muted py-6 text-sm">{t("noData")}</div>
                )}
              </div>
            </section>

            <section className="dashboard-card">
              <div className="flex flex-wrap items-end justify-between gap-y-2">
                <h2 className="font-display text-[28px] leading-none">{td("funnel")}</h2>
                <span className="text-muted text-sm">{td("lastDays", { days: Number(range) })}</span>
              </div>
              <div className="mt-6 space-y-6">
                {[
                  {
                    label: t("tryons"),
                    value: data.funnel.tryons,
                    base: data.funnel.tryons,
                    tone: "bg-accent",
                  },
                  {
                    label: td("bookClicks"),
                    value: data.funnel.bookClicks,
                    base: data.funnel.tryons,
                    tone: "bg-[#a67c6a]",
                  },
                  {
                    label: t("bookingsCount"),
                    value: data.funnel.bookings,
                    base: data.funnel.tryons,
                    tone: "bg-success",
                  },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[15px] font-medium">{row.label}</span>
                      <span className="text-[15px] tabular-nums">
                        <b className="font-semibold">{num(row.value, locale)}</b>{" "}
                        <span className="text-muted">
                          {row.base ? pct(row.value / row.base, locale, 1) : "–"}
                        </span>
                      </span>
                    </div>
                    <div className="bg-border mt-2 h-1 rounded-full">
                      <div
                        className={cn("h-1 rounded-full", row.tone)}
                        style={{ width: `${row.base ? Math.max(1, (row.value / row.base) * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
                <p className="text-muted text-[13px]">
                  {td("funnelNote", { rate: pct(data.funnel.tryonToBookingRate, locale, 1) })}
                </p>
              </div>

              <h2 className="font-display mt-14 text-[28px] leading-none">{td("sources")}</h2>
              <div className="mt-6 flex h-1.5 gap-1">
                {sources.map(([k, n], i) => (
                  <span
                    key={k}
                    className={cn("h-1.5 rounded-full", sourceTone[i % sourceTone.length])}
                    style={{ width: `${(n / sourceTotal) * 100}%` }}
                  />
                ))}
              </div>
              <ul className="mt-3">
                {sources.map(([k, n], i) => (
                  <li
                    key={k}
                    className="border-border flex h-12 items-center justify-between border-b text-[15px] last:border-b-0"
                  >
                    <span className="inline-flex items-center gap-2.5">
                      <span className={cn("size-[7px] rounded-full", sourceTone[i % sourceTone.length])} />
                      {sourceLabel(k)}
                    </span>
                    <span className="tabular-nums">
                      <b className="font-semibold">{n}</b>{" "}
                      <span className="text-muted">{pct(n / sourceTotal, locale)}</span>
                    </span>
                  </li>
                ))}
                {sources.length === 0 && <li className="text-muted py-3 text-sm">{t("noData")}</li>}
              </ul>

              <h2 className="font-display mt-14 text-[28px] leading-none">{t("tryons")}</h2>
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Kpi value={num(data.tryon.ar_sessions, locale)} label={t("ar")} />
                <Kpi value={num(data.tryon.ai_jobs, locale)} label={t("ai")} />
                <Kpi value={money(data.tryon.ai_cost_usd, "USD", locale)} label={td("aiCost")} />
              </div>
            </section>
          </div>
        </>
      )}
    </>
  );
}
