"use client";

import * as React from "react";
import { Download, Globe, MoreHorizontal, QrCode, Search, Sparkles, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { PageHeader } from "@/components/shell/dashboard-shell";
import { ButtonLink } from "@/components/ui/button";
import { Dialog, StatusDot, Tabs, bookingTone } from "@/components/ui/primitives";
import { Select } from "@/components/ui/input";
import { Nail, fillForDesign } from "@/components/nails/nail";
import { toast } from "@/components/ui/toaster";
import { api } from "@/lib/client/api";
import { csvEscape, downloadText } from "@/lib/client/dashboard";
import { fmtDay, fmtTimeRange, money, nowMs, shortRef } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface DashBooking {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "new" | "confirmed" | "completed" | "no_show" | "cancelled";
  source: string;
  staffId: string;
  staffName: string;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  design: { name: string; category: string; coverUrl: string | null; shape: string | null } | null;
  totalPrice: number;
  currency: string;
  createdAt: string;
}

const PAGE = 25;
const COLS = "grid-cols-[96px_minmax(140px,1.2fr)_minmax(160px,1.4fr)_110px_130px_120px_120px_80px_44px]";

export function BookingsTable({
  salon,
  rows,
  staff,
  initialTab,
  range,
  canEdit,
}: {
  salon: { id: string; name: string; timezone: string; currency: string };
  rows: DashBooking[];
  staff: { id: string; name: string }[];
  initialTab: string;
  range: { from: string; to: string | null };
  canEdit: boolean;
}) {
  const t = useTranslations("bookingsPage");
  const tb = useTranslations("ui.booking");
  const td = useTranslations("ui.dash");
  const tc = useTranslations("common");
  const tcal = useTranslations("calendar");
  const tdash = useTranslations("dashboard");
  const tacc = useTranslations("account");
  const locale = useLocale();
  const router = useRouter();
  const tz = salon.timezone;
  const [tab, setTab] = React.useState(
    ["all", "upcoming", "pending", "cancelled"].includes(initialTab) ? initialTab : "all",
  );
  const [search, setSearch] = React.useState("");
  const [staffId, setStaffId] = React.useState("");
  const [source, setSource] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [menu, setMenu] = React.useState<DashBooking | null>(null);
  const [busy, setBusy] = React.useState(false);
  const now = nowMs();

  const counts = {
    all: rows.length,
    upcoming: rows.filter(
      (b) => new Date(b.startsAt).getTime() > now && (b.status === "new" || b.status === "confirmed"),
    ).length,
    pending: rows.filter((b) => b.status === "new").length,
    cancelled: rows.filter((b) => b.status === "cancelled").length,
  };

  const filtered = rows.filter((b) => {
    if (
      tab === "upcoming" &&
      !(new Date(b.startsAt).getTime() > now && (b.status === "new" || b.status === "confirmed"))
    )
      return false;
    if (tab === "pending" && b.status !== "new") return false;
    if (tab === "cancelled" && b.status !== "cancelled") return false;
    if (staffId && b.staffId !== staffId) return false;
    if (source && b.source !== source) return false;
    if (search) {
      const needle = search.toLowerCase();
      if (
        !`${b.clientName} ${b.clientPhone} ${shortRef(b.id)} ${b.serviceName}`.toLowerCase().includes(needle)
      )
        return false;
    }
    return true;
  });
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const visible = filtered.slice((page - 1) * PAGE, page * PAGE);

  function statusLabel(s: DashBooking["status"]) {
    return s === "new"
      ? tb("awaitingSalon")
      : s === "confirmed"
        ? tb("confirmed")
        : s === "completed"
          ? tb("completed")
          : s === "no_show"
            ? tb("noShow")
            : tb("cancelledStatus");
  }
  function sourceLabel(s: string) {
    return s === "tryon"
      ? td("sourceTryon")
      : s === "direct"
        ? td("sourceDirect")
        : s === "rebook"
          ? td("sourceRebook")
          : td("sourceDashboard");
  }

  async function setStatus(b: DashBooking, status: "confirmed" | "cancelled" | "completed" | "no_show") {
    setBusy(true);
    try {
      await api.patch(`/api/dashboard/${salon.id}/bookings/${b.id}`, { status });
      toast.success(statusLabel(status));
      setMenu(null);
      router.refresh();
    } catch {
      toast.error(tc("somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    const head = [
      "ref",
      "client",
      "phone",
      "service",
      "design",
      "staff",
      "starts_at",
      "ends_at",
      "source",
      "status",
      "amount",
      "currency",
    ];
    const lines = filtered.map((b) =>
      [
        shortRef(b.id),
        b.clientName,
        b.clientPhone,
        b.serviceName,
        b.design?.name ?? "",
        b.staffName,
        b.startsAt,
        b.endsAt,
        b.source,
        b.status,
        b.totalPrice,
        b.currency,
      ]
        .map(csvEscape)
        .join(","),
    );
    downloadText(`bookings-${range.from}.csv`, [head.join(","), ...lines].join("\n"));
  }

  return (
    <>
      <PageHeader
        context={`${salon.name} · ${td("inLast30", { count: rows.length })}`}
        title={t("title")}
        actions={
          <>
            <button
              type="button"
              onClick={exportCsv}
              className="text-accent hover:text-foreground inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium"
            >
              <Download className="size-5" strokeWidth={1.75} />
              {tc("export")}
            </button>
            {canEdit && (
              <ButtonLink href="/dashboard/calendar?new=1">
                <Plus className="size-5" strokeWidth={1.75} />
                {tcal("newBooking")}
              </ButtonLink>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <Tabs
          value={tab}
          onChange={(v) => {
            setTab(v);
            setPage(1);
          }}
          items={[
            { value: "all", label: tc("all"), count: counts.all },
            { value: "upcoming", label: td("upcoming"), count: counts.upcoming },
            { value: "pending", label: td("pending"), count: counts.pending },
            { value: "cancelled", label: tb("cancelledStatus"), count: counts.cancelled },
          ]}
        />
        <label className="relative inline-flex items-center">
          <Search className="text-muted pointer-events-none absolute start-3.5 size-5" strokeWidth={1.75} />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={t("search")}
            className="field h-11 w-64 ps-10 text-sm"
            aria-label={t("search")}
          />
        </label>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-8 gap-y-1 text-sm">
        <label className="inline-flex min-h-11 items-center gap-2">
          <span className="text-muted">{tdash("staff")}</span>
          <Select
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            className="h-9 w-auto border-transparent pe-6 text-sm font-medium"
            wrapperClassName="inline-block"
          >
            <option value="">{tcal("allStaff")}</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="inline-flex min-h-11 items-center gap-2">
          <span className="text-muted">{td("source")}</span>
          <Select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="h-9 w-auto border-transparent pe-6 text-sm font-medium"
            wrapperClassName="inline-block"
          >
            <option value="">{td("allSources")}</option>
            {["tryon", "direct", "rebook", "dashboard"].map((s) => (
              <option key={s} value={s}>
                {sourceLabel(s)}
              </option>
            ))}
          </Select>
        </label>
        {(staffId || source || search) && (
          <button
            type="button"
            onClick={() => {
              setStaffId("");
              setSource("");
              setSearch("");
            }}
            className="text-accent hover:text-foreground font-medium"
          >
            {td("clearFilters")}
          </button>
        )}
        <span className="text-muted ms-auto">{td("newestFirst")}</span>
      </div>

      <div className="dashboard-table mt-4">
        <div className="min-w-[980px]">
          <div className={cn("table-head", COLS)}>
            <span>{td("ref")}</span>
            <span>{td("client")}</span>
            <span>{td("serviceDesign")}</span>
            <span>{tdash("staff")}</span>
            <span>{td("dateTime")}</span>
            <span>{td("source")}</span>
            <span>{tc("status")}</span>
            <span className="text-end">{td("amount")}</span>
            <span />
          </div>
          {visible.map((b) => (
            <div key={b.id} className={cn("data-row h-auto min-h-[72px] py-2", COLS)}>
              <Link
                href={`/dashboard/bookings/${b.id}`}
                className="text-muted hover:text-accent text-sm tracking-wide"
                dir="ltr"
              >
                {shortRef(b.id)}
              </Link>
              <Link
                href={`/dashboard/bookings/${b.id}`}
                className="hover:text-accent truncate text-[15px] font-medium"
              >
                {b.clientName}
              </Link>
              <div className="min-w-0">
                <div className="truncate text-[15px]">{b.serviceName}</div>
                {b.design && (
                  <div className="text-muted mt-0.5 flex items-center gap-1.5 truncate text-[13px]">
                    <Nail shape={b.design.shape} fill={fillForDesign(b.design)} width={9} height={13} />
                    {b.design.name}
                  </div>
                )}
              </div>
              <span className="truncate text-[15px]">{b.staffName}</span>
              <div dir="ltr" className="text-start">
                <div className="text-[15px]">{fmtDay(b.startsAt, locale, tz)}</div>
                <div className="text-muted text-[13px] tabular-nums">
                  {fmtTimeRange(b.startsAt, b.endsAt, locale, tz)}
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[15px]">
                {b.source === "tryon" ? (
                  <Sparkles className="text-accent size-4" strokeWidth={1.75} />
                ) : b.source === "dashboard" ? (
                  <QrCode className="text-accent size-4" strokeWidth={1.75} />
                ) : (
                  <Globe className="text-accent size-4" strokeWidth={1.75} />
                )}
                {sourceLabel(b.source)}
              </span>
              <StatusDot tone={bookingTone(b.status)}>{statusLabel(b.status)}</StatusDot>
              <span
                className={cn(
                  "text-end text-[15px] font-medium tabular-nums",
                  b.status === "cancelled" && "text-muted line-through",
                )}
              >
                {money(b.totalPrice, b.currency, locale)}
              </span>
              {canEdit ? (
                <button
                  type="button"
                  aria-label={tc("actions")}
                  onClick={() => setMenu(b)}
                  className="text-foreground hover:text-accent inline-flex size-11 items-center justify-center"
                >
                  <MoreHorizontal className="size-5" />
                </button>
              ) : (
                <span />
              )}
            </div>
          ))}
          {visible.length === 0 && (
            <div className="text-muted py-10 text-center text-[15px]">{tacc("noBookings")}</div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-muted">
          {td("showing", {
            from: filtered.length ? (page - 1) * PAGE + 1 : 0,
            to: Math.min(page * PAGE, filtered.length),
            total: filtered.length,
          })}
        </span>
        {pages > 1 && (
          <div className="flex items-center gap-1">
            {Array.from({ length: pages }, (_, i) => i + 1)
              .filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1)
              .map((n, i, arr) => (
                <React.Fragment key={n}>
                  {i > 0 && arr[i - 1] !== n - 1 && <span className="text-muted px-1">…</span>}
                  <button
                    type="button"
                    onClick={() => setPage(n)}
                    aria-current={n === page ? "page" : undefined}
                    className={cn("tab-link h-10 px-2", n === page && "border-foreground text-foreground")}
                  >
                    {n}
                  </button>
                </React.Fragment>
              ))}
          </div>
        )}
      </div>

      <Dialog
        open={menu !== null}
        onClose={() => setMenu(null)}
        title={menu ? `${menu.clientName} · ${shortRef(menu.id)}` : ""}
        size="sm"
      >
        {menu && (
          <div className="flex flex-col items-start gap-1">
            <Link
              href={`/dashboard/bookings/${menu.id}`}
              className="text-foreground hover:text-accent min-h-11 text-[15px] leading-[44px] font-medium"
            >
              {td("openBooking")}
            </Link>
            {menu.status === "new" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setStatus(menu, "confirmed")}
                className="text-accent hover:text-foreground min-h-11 text-[15px] font-medium"
              >
                {t("approve")}
              </button>
            )}
            {menu.status === "new" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setStatus(menu, "cancelled")}
                className="text-danger hover:text-foreground min-h-11 text-[15px] font-medium"
              >
                {t("decline")}
              </button>
            )}
            {menu.status === "confirmed" && (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setStatus(menu, "completed")}
                  className="text-accent hover:text-foreground min-h-11 text-[15px] font-medium"
                >
                  {t("markCompleted")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setStatus(menu, "no_show")}
                  className="text-foreground hover:text-accent min-h-11 text-[15px] font-medium"
                >
                  {t("markNoShow")}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setStatus(menu, "cancelled")}
                  className="text-danger hover:text-foreground min-h-11 text-[15px] font-medium"
                >
                  {t("cancelBooking")}
                </button>
              </>
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}
