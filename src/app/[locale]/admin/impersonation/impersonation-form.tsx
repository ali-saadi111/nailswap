"use client";

import * as React from "react";
import { AlertTriangle, Eye, FileText, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { PageHeader } from "@/components/shell/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Avatar, Notice } from "@/components/ui/primitives";
import { Label, Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { api } from "@/lib/client/api";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface SalonOpt {
  id: string;
  slug: string;
  name: string;
  area: string | null;
  status: string;
  owner: string | null;
  plan: string;
}

export function ImpersonationForm({
  salons,
  sessions,
  currentSalonId,
}: {
  salons: SalonOpt[];
  sessions: {
    id: string;
    reason: string | null;
    startedAt: string;
    endedAt: string | null;
    expiresAt: string;
    salonName: string;
    adminName: string;
  }[];
  currentSalonId: string | null;
}) {
  const t = useTranslations("admin");
  const ta = useTranslations("ui.admin");
  const tc = useTranslations("common");
  const td = useTranslations("ui.dash");
  const locale = useLocale();
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [selected, setSelected] = React.useState<SalonOpt | null>(
    salons.find((s) => s.id === currentSalonId) ?? null,
  );
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const results = q.trim()
    ? salons
        .filter((s) =>
          `${s.name} ${s.slug} ${s.owner ?? ""} ${s.area ?? ""}`.toLowerCase().includes(q.toLowerCase()),
        )
        .slice(0, 8)
    : [];

  async function start() {
    if (!selected || reason.trim().length < 3) return;
    setBusy(true);
    try {
      await api.post("/api/admin/impersonation", { salonId: selected.id, reason: reason.trim() });
      window.location.assign(new URL(`/${locale}/dashboard`, window.location.origin).href);
    } catch {
      toast.error(tc("somethingWrong"));
      setBusy(false);
    }
  }

  async function end() {
    await api.del("/api/admin/impersonation").catch(() => undefined);
    router.refresh();
  }

  return (
    <>
      <PageHeader
        context={ta("impersonationSub")}
        title={ta("impersonation")}
        actions={
          <Link
            href="/legal/privacy"
            className="text-accent hover:text-foreground inline-flex items-center gap-1.5 text-[15px] font-medium"
          >
            <FileText className="size-5" strokeWidth={1.75} />
            {ta("accessPolicy")}
          </Link>
        }
      />
      {currentSalonId && (
        <Notice tone="warning" className="mb-8">
          {td("viewingAs", { salon: salons.find((s) => s.id === currentSalonId)?.name ?? "" })} ·{" "}
          <button type="button" onClick={end} className="font-semibold underline-offset-4 hover:underline">
            {td("endSession")}
          </button>
        </Notice>
      )}

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <div className="border-border lg:border-e lg:pe-12">
          <label className="relative block">
            <Search
              className="text-muted pointer-events-none absolute start-0 top-3.5 size-5"
              strokeWidth={1.75}
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={ta("searchSalonsUsers")}
              className="field h-12 ps-8 text-lg"
              aria-label={tc("search")}
              autoFocus
            />
          </label>
          {q.trim() && (
            <div className="text-muted mt-3 text-[15px]">{ta("results", { count: results.length })}</div>
          )}
          <ul className="mt-1">
            {results.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSelected(s)}
                  className={cn(
                    "border-border flex min-h-[72px] w-full items-center gap-4 border-b text-start",
                    selected?.id === s.id && "text-accent",
                  )}
                >
                  <Avatar name={s.name} size={48} serif />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[17px] font-medium">{s.name}</span>
                    <span className="text-muted block truncate text-[13px]">
                      {[s.area, s.owner ? ta("ownerName", { name: s.owner }) : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="text-muted text-sm">{ta("salon")}</span>
                </button>
              </li>
            ))}
          </ul>
          {sessions.length > 0 && (
            <div className="text-muted mt-4 text-[15px]">
              {ta("recent")}: {[...new Set(sessions.map((s) => s.salonName))].slice(0, 3).join(" · ")}
            </div>
          )}
        </div>

        <div>
          {selected ? (
            <>
              <div className="flex items-center gap-5">
                <Avatar name={selected.name} size={68} serif />
                <div className="min-w-0">
                  <h2 className="font-display truncate text-[32px] leading-tight">{selected.name}</h2>
                  <div className="text-muted text-[15px]" dir="ltr">
                    {ta("selected")} ·{" "}
                    {selected.owner ? `${ta("ownerName", { name: selected.owner })} · ` : ""}
                    <span className="capitalize">{selected.plan}</span> · {selected.slug}.nailswap.app
                  </div>
                </div>
              </div>
              <div className="mt-8">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="imp-reason">{ta("reason")}</Label>
                  <span className="text-muted text-[13px]">{tc("required")}</span>
                </div>
                <Textarea
                  id="imp-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={ta("reasonPlaceholder")}
                  maxLength={300}
                  className="min-h-16 text-lg"
                />
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-10">
                <div>
                  <div className="text-muted text-[13px]">{ta("duration")}</div>
                  <div className="mt-1 text-[17px]">{ta("twoHours")}</div>
                </div>
                <div>
                  <div className="text-muted text-[13px]">{ta("access")}</div>
                  <div className="mt-1 text-[17px]">{ta("fullAccessLogged")}</div>
                </div>
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-between gap-6">
                <p className="text-muted flex max-w-[420px] items-start gap-2.5 text-[15px] leading-6">
                  <AlertTriangle className="text-accent mt-1 size-5 shrink-0" strokeWidth={1.75} />
                  {ta("impersonateNote")}
                </p>
                <div className="flex items-center gap-6">
                  <Button variant="ghost" size="lg" onClick={() => setSelected(null)}>
                    {tc("cancel")}
                  </Button>
                  <Button size="lg" loading={busy} disabled={reason.trim().length < 3} onClick={start}>
                    <Eye className="size-5" strokeWidth={1.75} />
                    {ta("startImpersonation")}
                  </Button>
                </div>
              </div>
              <div className="text-muted mt-10 flex items-center justify-between text-[15px]">
                <span>{ta("bannerPreview")}</span>
                <span>{ta("sticky")}</span>
              </div>
              <div className="bg-accent text-accent-contrast mt-3 flex h-14 items-center justify-between px-6 text-[15px]">
                <span className="inline-flex items-center gap-3">
                  <Eye className="size-5" strokeWidth={1.75} />
                  {td("viewingAs", { salon: selected.name })} · {td("endsIn", { time: "1:59:59" })}
                </span>
                <span className="font-semibold underline underline-offset-4">{td("endSession")}</span>
              </div>
            </>
          ) : (
            <p className="text-muted text-[15px]">{ta("pickSalon")}</p>
          )}
        </div>
      </div>

      <section className="mt-14">
        <div className="flex items-end justify-between">
          <h2 className="text-[17px] font-semibold">{ta("recentSessions")}</h2>
          <Link
            href="/admin/settings#audit"
            className="text-accent hover:text-foreground text-[15px] font-medium"
          >
            {t("audit")}
          </Link>
        </div>
        <div className="mt-2 overflow-x-auto">
          <div className="min-w-[800px]">
            <div className="table-head grid-cols-[180px_200px_minmax(200px,1fr)_170px_100px_120px]">
              <span>{ta("admin")}</span>
              <span>{ta("target")}</span>
              <span>{ta("reason")}</span>
              <span>{ta("started")}</span>
              <span>{ta("length")}</span>
              <span>{ta("endedBy")}</span>
            </div>
            {sessions.map((s) => {
              const end = s.endedAt
                ? new Date(s.endedAt)
                : new Date(s.expiresAt) < new Date()
                  ? new Date(s.expiresAt)
                  : null;
              const mins = end
                ? Math.max(1, Math.round((end.getTime() - new Date(s.startedAt).getTime()) / 60000))
                : null;
              return (
                <div
                  key={s.id}
                  className="table-row h-16 grid-cols-[180px_200px_minmax(200px,1fr)_170px_100px_120px]"
                >
                  <span className="flex items-center gap-3 text-[15px]">
                    <Avatar name={s.adminName} size={32} />
                    {s.adminName}
                  </span>
                  <span className="truncate text-[15px]">{s.salonName}</span>
                  <span className="text-muted truncate">{s.reason ?? "–"}</span>
                  <span className="text-muted" dir="ltr">
                    {fmtDateTime(s.startedAt, locale)}
                  </span>
                  <span className="tabular-nums">{mins === null ? ta("live") : `${mins} min`}</span>
                  <span className="text-muted">
                    {s.endedAt ? ta("admin") : mins === null ? "–" : ta("timer")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
