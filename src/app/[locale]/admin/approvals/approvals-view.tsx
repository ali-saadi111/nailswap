"use client";

import * as React from "react";
import { Check, ExternalLink, Search, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/shell/dashboard-shell";
import { Avatar, StatusDot, Tabs, salonTone } from "@/components/ui/primitives";
import { fmtDay, prettyPhone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SalonActions } from "../salon-actions";

export interface Application {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  area: string | null;
  status: "pending" | "active" | "suspended";
  directoryApproved: boolean;
  createdAt: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
  description: string | null;
  owner: { name: string | null; phone: string | null; email: string | null } | null;
  plan: "trial" | "basic" | "pro";
  counts: { staff: number; services: number; designs: number };
  previewUrl: string;
}

export function ApprovalsView({
  apps,
  initialId,
  planChanges,
}: {
  apps: Application[];
  initialId: string | null;
  planChanges: {
    salonId: string;
    salonName: string;
    plan: string;
    status: string;
    graceEndsAt: string | null;
    downgradeTo: string;
  }[];
}) {
  const ta = useTranslations("ui.admin");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [tab, setTab] = React.useState<"apps" | "plans">("apps");
  const [search, setSearch] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(initialId ?? apps[0]?.id ?? null);
  const pending = apps.filter((a) => a.status === "pending");
  const list = apps.filter(
    (a) =>
      !search ||
      `${a.name} ${a.city ?? ""} ${a.owner?.name ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );
  const selected = apps.find((a) => a.id === selectedId) ?? null;

  const checks = (a: Application) => [
    {
      label: ta("checkOwner"),
      ok: Boolean(a.owner?.phone),
      detail: a.owner?.phone ? prettyPhone(a.owner.phone) : ta("missing"),
    },
    {
      label: ta("checkContact"),
      ok: Boolean(a.phone || a.whatsapp),
      detail: a.whatsapp ? prettyPhone(a.whatsapp) : a.phone ? prettyPhone(a.phone) : ta("missing"),
    },
    { label: ta("checkServices"), ok: a.counts.services > 0, detail: String(a.counts.services) },
    { label: ta("checkStaff"), ok: a.counts.staff > 0, detail: String(a.counts.staff) },
    { label: ta("checkDesigns"), ok: a.counts.designs > 0, detail: String(a.counts.designs) },
  ];

  return (
    <>
      <PageHeader
        context={ta("queuesWaiting", { count: pending.length + planChanges.length })}
        title={ta("approvals")}
        actions={
          <label className="relative inline-flex items-center">
            <Search className="text-muted pointer-events-none absolute start-0 size-5" strokeWidth={1.75} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={ta("searchApplications")}
              className="field h-11 w-72 ps-7 text-base"
              aria-label={tc("search")}
            />
          </label>
        }
      />
      <div className={cn("grid grid-cols-1 gap-12", selected && "xl:grid-cols-[minmax(0,1fr)_420px]")}>
        <div className="min-w-0">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { value: "apps", label: ta("salonApplications"), count: pending.length },
              { value: "plans", label: ta("planChanges"), count: planChanges.length },
            ]}
          />
          {tab === "apps" && (
            <div className="mt-4 overflow-x-auto">
              <div className="table-head grid-cols-[minmax(200px,1.6fr)_110px_90px_80px_140px]">
                <span>{ta("salon")}</span>
                <span>{ta("submitted")}</span>
                <span>{ta("checks")}</span>
                <span>{ta("plan")}</span>
                <span>{tc("status")}</span>
              </div>
              {list.map((a) => {
                const ok = checks(a).filter((c) => c.ok).length;
                const active = a.id === selectedId;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelectedId(a.id)}
                    className={cn(
                      "table-row h-auto min-h-[80px] w-full grid-cols-[minmax(200px,1.6fr)_110px_90px_80px_140px] py-2 text-start",
                      active && "bg-surface-2",
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className={cn("size-1.5 rounded-full", active ? "bg-accent" : "bg-transparent")}
                      />
                      <span className="min-w-0">
                        <span
                          className={cn("block truncate text-[15px] font-medium", active && "text-accent")}
                        >
                          {a.name}
                        </span>
                        <span className="text-muted block truncate text-[13px]">
                          {[a.area ?? a.city, a.owner?.name].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </span>
                    <span className="text-[15px]" dir="ltr">
                      {fmtDay(a.createdAt, locale, undefined, { day: "numeric", month: "short" })}
                    </span>
                    <span className="tabular-nums">{ok}/5</span>
                    <span className="capitalize">{a.plan}</span>
                    <StatusDot
                      tone={
                        a.status === "suspended"
                          ? "danger"
                          : ok === 5
                            ? "success"
                            : ok >= 3
                              ? "pending"
                              : "hollow"
                      }
                    >
                      {a.status === "suspended"
                        ? ta("suspended")
                        : ok === 5
                          ? ta("ready")
                          : ok >= 3
                            ? ta("inReview")
                            : ta("missingInfo")}
                    </StatusDot>
                  </button>
                );
              })}
              {list.length === 0 && <div className="text-muted py-8 text-[15px]">{ta("queueEmpty")}</div>}
            </div>
          )}
          {tab === "plans" && (
            <div className="mt-4">
              {planChanges.map((p) => (
                <div
                  key={p.salonId}
                  className="border-border flex min-h-[72px] items-center gap-6 border-b text-[15px]"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{p.salonName}</span>
                  <span>
                    <span className="capitalize">{p.plan}</span> →{" "}
                    <span className="text-accent capitalize">{p.downgradeTo}</span>
                  </span>
                  <span className="text-muted text-sm">
                    {ta(`sub_${p.status}` as never)}
                    {p.graceEndsAt ? ` · ${fmtDay(p.graceEndsAt, locale)}` : ""}
                  </span>
                </div>
              ))}
              {planChanges.length === 0 && (
                <div className="text-muted py-8 text-[15px]">{ta("queueEmpty")}</div>
              )}
            </div>
          )}
        </div>

        {selected && (
          <aside className="border-border xl:border-s xl:ps-10">
            <div className="text-muted text-[15px]">
              {ta("appliedOn", {
                date: fmtDay(selected.createdAt, locale, undefined, { day: "numeric", month: "short" }),
              })}
            </div>
            <h2 className="font-display mt-1 text-[32px] leading-tight">
              {selected.name}
              {selected.area || selected.city ? (
                <span className="text-muted"> — {selected.area ?? selected.city}</span>
              ) : null}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 text-[15px]">
              <StatusDot tone={salonTone(selected.status)} className="text-[15px]">
                {selected.status === "pending" ? ta("inReview") : selected.status}
              </StatusDot>
              <span className="text-muted">
                {ta("chairs", { count: selected.counts.staff })} · {ta("wantsPlan", { plan: selected.plan })}{" "}
                · {selected.directoryApproved ? ta("listed") : ta("notLive")}
              </span>
            </div>
            {selected.owner && (
              <div className="mt-6 flex items-center gap-4">
                <Avatar name={selected.owner.name ?? "?"} size={56} />
                <div className="min-w-0">
                  <div className="text-[17px] font-medium">
                    {selected.owner.name ?? "–"}{" "}
                    <span className="text-muted font-normal">· {ta("owner")}</span>
                  </div>
                  <div className="text-muted truncate text-[15px]" dir="ltr">
                    {[selected.owner.phone ? prettyPhone(selected.owner.phone) : null, selected.owner.email]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
              </div>
            )}
            <div className="text-muted mt-6 text-[15px]">
              {ta("checksOf", { ok: checks(selected).filter((c) => c.ok).length })}
            </div>
            <ul className="mt-1">
              {checks(selected).map((c) => (
                <li key={c.label} className="flex h-12 items-center gap-3 text-[15px]">
                  {c.ok ? (
                    <Check className="text-success size-4" strokeWidth={2.2} />
                  ) : (
                    <X className="text-danger size-4" strokeWidth={2.2} />
                  )}
                  <span className={cn("flex-1", !c.ok && "text-danger")}>{c.label}</span>
                  <span className="text-muted text-sm" dir="ltr">
                    {c.detail}
                  </span>
                </li>
              ))}
            </ul>
            <a
              href={selected.previewUrl}
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:text-foreground mt-4 inline-flex min-h-11 items-center gap-2 text-[15px] font-medium"
            >
              <ExternalLink className="size-5" strokeWidth={1.75} />
              {ta("previewPage")}{" "}
              <span className="text-muted font-normal" dir="ltr">
                {selected.slug}
              </span>
            </a>
            {selected.description && (
              <p className="text-muted mt-4 text-[15px] leading-6">{selected.description}</p>
            )}
            <div className="mt-8">
              <SalonActions
                salon={{
                  id: selected.id,
                  slug: selected.slug,
                  name: selected.name,
                  status: selected.status,
                  directoryApproved: selected.directoryApproved,
                  plan: selected.plan,
                }}
              />
            </div>
          </aside>
        )}
      </div>
    </>
  );
}
