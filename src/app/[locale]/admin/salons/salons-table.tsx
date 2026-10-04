"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/shell/dashboard-shell";
import { Dialog, FilterToggle, StatusDot, salonTone } from "@/components/ui/primitives";
import { fmtDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SalonActions } from "../salon-actions";

interface Row {
  id: string;
  slug: string;
  name: string;
  area: string | null;
  status: "pending" | "active" | "suspended";
  directoryApproved: boolean;
  createdAt: string;
  rating: number;
  ratingCount: number;
  owner: string | null;
  plan: "trial" | "basic" | "pro";
  subStatus: string | null;
  bookings30: number;
}

export function SalonsTable({ rows }: { rows: Row[] }) {
  const t = useTranslations("admin");
  const ta = useTranslations("ui.admin");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<"all" | Row["status"]>("all");
  const [open, setOpen] = React.useState<Row | null>(null);
  const list = rows.filter(
    (r) =>
      (status === "all" || r.status === status) &&
      (!q || `${r.name} ${r.slug} ${r.area ?? ""} ${r.owner ?? ""}`.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <>
      <PageHeader
        context={ta("salonsTotal", { count: rows.length })}
        title={t("salons")}
        actions={
          <label className="relative inline-flex items-center">
            <Search className="text-muted pointer-events-none absolute start-3.5 size-5" strokeWidth={1.75} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={ta("searchSalonsUsers")}
              className="field h-11 w-72 ps-10 text-base"
              aria-label={tc("search")}
            />
          </label>
        }
      />
      <div className="flex flex-wrap gap-2">
        {(["all", "active", "pending", "suspended"] as const).map((s) => (
          <FilterToggle key={s} pressed={status === s} onClick={() => setStatus(s)}>
            {s === "all" ? tc("all") : ta(`status_${s}` as never)}
            <span className="text-muted font-normal">
              {" "}
              · {s === "all" ? rows.length : rows.filter((r) => r.status === s).length}
            </span>
          </FilterToggle>
        ))}
      </div>
      <div className="dashboard-table mt-2">
        <div className="min-w-[960px]">
          <div className="table-head grid-cols-[minmax(220px,1.6fr)_minmax(140px,1fr)_90px_110px_110px_90px_130px]">
            <span>{ta("salon")}</span>
            <span>{ta("owner")}</span>
            <span>{ta("plan")}</span>
            <span>{ta("bookings30")}</span>
            <span>{ta("rating")}</span>
            <span>{ta("joined")}</span>
            <span>{tc("status")}</span>
          </div>
          {list.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setOpen(r)}
              className="data-row h-auto min-h-16 w-full grid-cols-[minmax(220px,1.6fr)_minmax(140px,1fr)_90px_110px_110px_90px_130px] py-2 text-start"
            >
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-medium">{r.name}</span>
                <span className="text-muted block truncate text-[13px]" dir="ltr">
                  {r.slug}
                  {r.area ? ` · ${r.area}` : ""}
                </span>
              </span>
              <span className="truncate">{r.owner ?? "–"}</span>
              <span className="capitalize">
                {r.plan}
                {r.subStatus && r.subStatus !== "active" && (
                  <span className="text-muted"> · {r.subStatus}</span>
                )}
              </span>
              <span className="tabular-nums">{r.bookings30}</span>
              <span className="tabular-nums">
                {r.ratingCount ? `${r.rating.toFixed(1)} (${r.ratingCount})` : "–"}
              </span>
              <span className="text-muted" dir="ltr">
                {fmtDay(r.createdAt, locale, undefined, { day: "numeric", month: "short", year: "2-digit" })}
              </span>
              <StatusDot tone={salonTone(r.status)}>
                {ta(`status_${r.status}` as never)}
                {r.status === "active" && !r.directoryApproved ? (
                  <span className={cn("text-muted font-normal")}> · {ta("notLive")}</span>
                ) : null}
              </StatusDot>
            </button>
          ))}
        </div>
      </div>

      <Dialog
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open?.name ?? ""}
        description={open ? `${open.slug}.nailswap.app` : undefined}
        size="md"
      >
        {open && (
          <SalonActions
            salon={{
              id: open.id,
              slug: open.slug,
              name: open.name,
              status: open.status,
              directoryApproved: open.directoryApproved,
              plan: open.plan,
            }}
            onDone={() => setOpen(null)}
          />
        )}
      </Dialog>
    </>
  );
}
