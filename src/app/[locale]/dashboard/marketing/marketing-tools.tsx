"use client";

import * as React from "react";
import { Bookmark, Copy, Download, Printer, Send, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { PageHeader } from "@/components/shell/dashboard-shell";
import { Avatar, Kpi, StatusDot, Tabs } from "@/components/ui/primitives";
import { Select } from "@/components/ui/input";
import { Nail, fillForDesign } from "@/components/nails/nail";
import { toast } from "@/components/ui/toaster";
import { fmtDateTime, num, pct, prettyPhone } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface Lead {
  id: string;
  name: string | null;
  phone: string | null;
  status: "new" | "contacted" | "converted" | "lost";
  notes: string | null;
  createdAt: string;
  fromTryon: boolean;
  design: { name: string; category: string; coverUrl: string | null; shape: string | null } | null;
}

export function MarketingTools({
  salon,
  locale,
  stats,
  leads,
  topDesigns,
}: {
  salon: { id: string; slug: string; name: string; host: string; pageUrl: string; tryUrl: string };
  locale: string;
  stats: { scans: number; tryons: number; bookings: number };
  leads: Lead[];
  topDesigns: { name: string; category: string; coverUrl: string | null; shape: string | null }[];
}) {
  const t = useTranslations("marketing");
  const td = useTranslations("ui.dash");
  const tl = useTranslations("bookingsPage.leadStatuses");
  const tc = useTranslations("common");
  const th = useTranslations("ui.home");
  const tbp = useTranslations("bookingsPage");
  const loc = useLocale();
  const router = useRouter();
  const [src, setSrc] = React.useState("window-oct");
  const [tab, setTab] = React.useState<"all" | "new" | "contacted">("all");
  const qrBase = `/api/dashboard/${salon.id}/qr?target=try&locale=${locale}`;
  const campaignUrl = `${salon.tryUrl}?utm_source=qr&src=${encodeURIComponent(src)}`;

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(tc("copied"));
    } catch {
      /* ignore */
    }
  }

  async function setStatus(l: Lead, status: Lead["status"]) {
    const { error } = await createClient().from("leads").update({ status }).eq("id", l.id);
    if (error) toast.error(tc("somethingWrong"));
    else router.refresh();
  }

  const filtered = leads.filter((l) => (tab === "all" ? true : l.status === tab));
  const counts = {
    all: leads.length,
    new: leads.filter((l) => l.status === "new").length,
    contacted: leads.filter((l) => l.status === "contacted").length,
  };
  const offerText = (l: Lead) =>
    encodeURIComponent(
      td("offerMessage", {
        name: l.name?.split(" ")[0] ?? "",
        salon: salon.name,
        design: l.design?.name ?? "",
        url: salon.tryUrl,
      }),
    );

  const leadTone = (s: Lead["status"]) =>
    s === "new" ? "pending" : s === "contacted" ? "hollow" : s === "converted" ? "success" : "muted";

  return (
    <>
      <PageHeader context={`${salon.name} · ${td("turnTryons")}`} title={t("title")} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)_300px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${qrBase}&format=png&size=640`}
          alt={t("qrTitle")}
          width={320}
          height={320}
          className="rounded-media bg-surface-2 w-full max-w-[320px]"
        />

        <div className="dashboard-card">
          <div className="text-muted text-[15px]" dir="ltr">
            {td("salonQr")} · {salon.host}
          </div>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-4">
            <h2 className="font-display text-[34px] leading-none">{td("scanToTry")}</h2>
            <div className="flex items-center gap-6">
              <a
                href={`${qrBase}&format=png&size=1024`}
                download={`${salon.slug}-qr.png`}
                className="text-accent hover:text-foreground inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium"
              >
                <Download className="size-5" strokeWidth={1.75} />
                {td("downloadPng")}
              </a>
              <a
                href={`${qrBase}&format=svg&size=1024`}
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:text-foreground inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium"
              >
                <Printer className="size-5" strokeWidth={1.75} />
                {td("printPoster")}
              </a>
            </div>
          </div>
          <p className="text-muted mt-2 text-[15px]">{td("qrOpens", { host: salon.host })}</p>

          <div className="mt-6 flex flex-wrap gap-x-12 gap-y-6">
            <Kpi value={num(stats.scans, loc)} label={td("qrScansMonth")} />
            <Kpi value={num(stats.tryons, loc)} label={td("tryonsLabel")} />
            <Kpi value={num(stats.bookings, loc)} label={td("bookingsLabel")} />
            <Kpi
              value={stats.tryons ? pct(stats.bookings / stats.tryons, loc, 1) : "–"}
              label={td("tryonToBooking")}
            />
          </div>

          <div className="mt-8">
            <div className="text-muted text-[13px]">{td("campaignLink")}</div>
            <div className="bg-background flex min-h-12 items-center gap-3 rounded-2xl px-4">
              <span className="min-w-0 flex-1 truncate text-base" dir="ltr">
                {salon.host}/try?src=<b className="text-accent font-medium">{src}</b>
              </span>
              <button
                type="button"
                aria-label={tc("copy")}
                onClick={() => copy(campaignUrl)}
                className="text-foreground hover:text-accent inline-flex size-11 items-center justify-center"
              >
                <Copy className="size-5" strokeWidth={1.75} />
              </button>
            </div>
            <div className="text-muted mt-2 flex flex-wrap items-center gap-x-2 text-[15px]">
              <span>{td("sourceTags")}</span>
              {["window-oct", "counter", "instagram-bio"].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSrc(s)}
                  className={cn(
                    "min-h-9 font-medium",
                    src === s ? "text-accent" : "text-muted hover:text-foreground",
                  )}
                >
                  {s}
                </button>
              ))}
              <input
                value={src}
                onChange={(e) => setSrc(e.target.value.replace(/[^a-z0-9-]/gi, "").toLowerCase())}
                className="field h-9 w-32 text-sm"
                aria-label={td("sourceTags")}
              />
            </div>
          </div>
        </div>

        <div>
          <div className="rounded-media bg-hero px-6 py-7 text-center">
            <div className="text-[13px] font-medium">
              NailSwap <span className="text-muted">×</span> {salon.name}
            </div>
            <div className="font-display mt-2 text-[22px] leading-tight">{th("title")}</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${qrBase}&format=png&size=320`}
              alt=""
              width={120}
              height={120}
              className="mx-auto mt-4 rounded-lg"
            />
            <div className="text-muted mt-2 text-[12px]" dir="ltr">
              {salon.host}
            </div>
            <div className="mt-2 flex justify-center gap-1.5">
              {topDesigns.map((d, i) => (
                <Nail key={i} shape={d.shape} fill={fillForDesign(d)} width={10} height={14} />
              ))}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[15px]">
            <span className="text-muted">{td("posterA4")}</span>
            <a
              href={`${qrBase}&format=svg&size=2048`}
              download={`${salon.slug}-poster.svg`}
              className="text-accent hover:text-foreground font-medium"
            >
              {tc("download")}
            </a>
          </div>
        </div>
      </div>

      <section className="dashboard-card mt-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-[28px] leading-none">{tbp("leadsTitle")}</h2>
            <p className="text-muted mt-2 text-[15px]">{td("leadsSub", { count: leads.length })}</p>
          </div>
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { value: "all", label: tc("all"), count: counts.all },
              { value: "new", label: tl("new"), count: counts.new },
              { value: "contacted", label: tl("contacted"), count: counts.contacted },
            ]}
          />
        </div>
        <div className="dashboard-table mt-4">
          <div className="min-w-[860px]">
            <div className="table-head grid-cols-[minmax(220px,1.4fr)_minmax(160px,1fr)_minmax(140px,1fr)_120px_120px_120px]">
              <span>{td("lead")}</span>
              <span>{td("design")}</span>
              <span>{td("activity")}</span>
              <span>{td("when")}</span>
              <span>{tc("status")}</span>
              <span />
            </div>
            {filtered.map((l) => (
              <div
                key={l.id}
                className="data-row h-[72px] grid-cols-[minmax(220px,1.4fr)_minmax(160px,1fr)_minmax(140px,1fr)_120px_120px_120px]"
              >
                <span className="flex items-center gap-3">
                  <Avatar name={l.name ?? l.phone ?? "?"} size={40} />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium">
                      {l.name ?? td("anonymous")}
                    </span>
                    <span className="text-muted block text-[13px]" dir="ltr">
                      {l.phone ? prettyPhone(l.phone) : ""}
                    </span>
                  </span>
                </span>
                <span className="inline-flex items-center gap-2 truncate text-[15px]">
                  {l.design ? (
                    <>
                      <Nail shape={l.design.shape} fill={fillForDesign(l.design)} width={10} height={14} />
                      {l.design.name}
                    </>
                  ) : (
                    <span className="text-muted">–</span>
                  )}
                </span>
                <span className="text-muted inline-flex items-center gap-1.5 text-[15px]">
                  {l.fromTryon ? (
                    <Sparkles className="size-4" strokeWidth={1.75} />
                  ) : (
                    <Bookmark className="size-4" strokeWidth={1.75} />
                  )}
                  {l.fromTryon ? td("aiPhoto") : td("savedLook")}
                </span>
                <span className="text-muted text-[15px]" dir="ltr">
                  {fmtDateTime(l.createdAt, loc)}
                </span>
                <span className="relative">
                  <StatusDot tone={leadTone(l.status)}>{tl(l.status)}</StatusDot>
                  <Select
                    value={l.status}
                    onChange={(e) => setStatus(l, e.target.value as Lead["status"])}
                    className="absolute inset-0 h-full opacity-0"
                    wrapperClassName="absolute inset-0"
                    aria-label={tc("status")}
                  >
                    {(["new", "contacted", "converted", "lost"] as const).map((s) => (
                      <option key={s} value={s}>
                        {tl(s)}
                      </option>
                    ))}
                  </Select>
                </span>
                <span className="text-end">
                  {l.phone && l.status !== "converted" && (
                    <a
                      href={`https://wa.me/${l.phone.replace(/\D/g, "")}?text=${offerText(l)}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => l.status === "new" && setStatus(l, "contacted")}
                      className="text-accent hover:text-foreground inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium"
                    >
                      <Send className="size-4" strokeWidth={1.75} />
                      {td("sendOffer")}
                    </a>
                  )}
                </span>
              </div>
            ))}
            {filtered.length === 0 && <div className="text-muted py-8 text-[15px]">{tbp("leadsHint")}</div>}
          </div>
        </div>
      </section>
    </>
  );
}
