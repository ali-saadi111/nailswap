"use client";

import * as React from "react";
import { Check, ExternalLink, Flag, Star, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { PageHeader } from "@/components/shell/dashboard-shell";
import { Button } from "@/components/ui/button";
import { FilterToggle, Notice, StatusDot, Tabs } from "@/components/ui/primitives";
import { Label, Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toaster";
import { api } from "@/lib/client/api";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ModerationItem {
  id: string;
  kind: "review" | "upload" | "design";
  status: "pending" | "approved" | "rejected";
  reason: string | null;
  createdAt: string;
  salon: { name: string; slug: string; area: string | null; url: string } | null;
  title: string;
  review: { rating: number; body: string | null; author: string | null; flagged: string | null } | null;
  design: { shape: string | null; category: string; tryons: number; bookings: number } | null;
  imageUrl: string | null;
}

export function ModerationQueue({ items }: { items: ModerationItem[] }) {
  const t = useTranslations("admin");
  const ta = useTranslations("ui.admin");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [tab, setTab] = React.useState<"open" | "resolved">("open");
  const [kind, setKind] = React.useState<"all" | ModerationItem["kind"]>("all");
  const open = items.filter((i) => i.status === "pending");
  const list = (tab === "open" ? open : items.filter((i) => i.status !== "pending")).filter(
    (i) => kind === "all" || i.kind === kind,
  );
  const [selectedId, setSelectedId] = React.useState<string | null>(list[0]?.id ?? null);
  const selected = items.find((i) => i.id === selectedId) ?? list[0] ?? null;
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function act(action: "approve" | "reject") {
    if (!selected) return;
    setBusy(true);
    try {
      await api.post(`/api/admin/moderation/${selected.id}`, { action, note: note.trim() || undefined });
      toast.success(action === "approve" ? ta("kept") : ta("removed"));
      setNote("");
      router.refresh();
    } catch {
      toast.error(tc("somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  const kindLabel = (k: ModerationItem["kind"]) =>
    k === "review" ? ta("kindReview") : k === "design" ? ta("kindDesign") : ta("kindUpload");
  const counts = {
    review: open.filter((i) => i.kind === "review").length,
    design: open.filter((i) => i.kind === "design").length,
    upload: open.filter((i) => i.kind === "upload").length,
  };

  return (
    <>
      <PageHeader context={ta("moderationSub")} title={t("moderation")} />
      <div
        className={cn("grid grid-cols-1 gap-12", selected && "xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]")}
      >
        <div className="min-w-0">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { value: "open", label: ta("open"), count: open.length },
              { value: "resolved", label: ta("resolved") },
            ]}
          />
          <div className="mt-2 flex flex-wrap gap-x-6">
            <FilterToggle pressed={kind === "all"} onClick={() => setKind("all")}>
              {tc("all")}
            </FilterToggle>
            {(["review", "design", "upload"] as const).map((k) => (
              <FilterToggle key={k} pressed={kind === k} onClick={() => setKind(k)}>
                {kindLabel(k)}
                {counts[k] ? <span className="text-muted font-normal"> · {counts[k]}</span> : null}
              </FilterToggle>
            ))}
          </div>
          <ul className="mt-2">
            {list.map((i) => {
              const active = i.id === selected?.id;
              return (
                <li key={i.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(i.id)}
                    className={cn(
                      "border-border flex min-h-[88px] w-full items-start gap-4 border-b py-4 text-start",
                      active && "bg-surface-2",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-2 size-1.5 shrink-0 rounded-full",
                        active ? "bg-accent" : "bg-transparent",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="text-muted block text-[13px]">
                        {kindLabel(i.kind)} · {i.salon?.name ?? "–"} · {fmtDateTime(i.createdAt, locale)}
                      </span>
                      <span
                        className={cn(
                          "mt-1 block truncate text-[17px]",
                          active ? "text-accent font-medium" : "font-medium",
                        )}
                      >
                        {i.title}
                      </span>
                    </span>
                    <span className="shrink-0 text-end">
                      <span className="block text-[15px]">{i.reason ?? i.review?.flagged ?? "–"}</span>
                      {i.status !== "pending" && (
                        <StatusDot tone={i.status === "approved" ? "success" : "danger"} className="mt-1">
                          {i.status === "approved" ? ta("kept") : ta("removed")}
                        </StatusDot>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
            {list.length === 0 && <li className="text-muted py-8 text-[15px]">{ta("queueEmpty")}</li>}
          </ul>
        </div>

        {selected && (
          <aside className="border-border xl:border-s xl:ps-12">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted inline-flex items-center gap-3 text-[15px]">
                {kindLabel(selected.kind)}
                <StatusDot tone="pending" className="text-[15px]">
                  {selected.reason ?? selected.review?.flagged ?? ta("reported")}
                </StatusDot>
              </span>
              {selected.salon && (
                <a
                  href={selected.salon.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:text-foreground inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium"
                >
                  <ExternalLink className="size-5" strokeWidth={1.75} />
                  {ta("viewOnSalonPage")}
                </a>
              )}
            </div>
            <h2 className="font-display mt-2 text-[32px] leading-tight">
              {selected.kind === "review"
                ? ta("reviewBy", { name: selected.review?.author ?? "–" })
                : selected.title}
            </h2>
            <p className="text-muted mt-1 text-[15px]">
              {selected.salon?.name}
              {selected.salon?.area ? ` · ${selected.salon.area}` : ""} ·{" "}
              {fmtDateTime(selected.createdAt, locale)}
            </p>

            {selected.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selected.imageUrl}
                alt=""
                className="rounded-media bg-surface-2 mt-6 max-h-80 w-auto"
              />
            )}
            {selected.review && (
              <div className="mt-6">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={cn(
                        "text-accent size-4",
                        n <= selected.review!.rating ? "fill-current" : "fill-transparent",
                      )}
                      strokeWidth={1.5}
                    />
                  ))}
                </div>
                <p className="mt-3 text-[17px] leading-7">{selected.review.body}</p>
              </div>
            )}
            {selected.design && (
              <p className="text-muted mt-4 text-[15px]">
                <Flag className="me-1.5 inline size-4" strokeWidth={1.75} />
                {ta("designStats", { tryons: selected.design.tryons, bookings: selected.design.bookings })}
              </p>
            )}

            {selected.status === "pending" ? (
              <>
                <div className="mt-8">
                  <Label htmlFor="mod-note">{ta("noteToSalon")}</Label>
                  <Textarea
                    id="mod-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    maxLength={300}
                    className="min-h-14"
                  />
                </div>
                <div className="mt-8 flex items-center justify-between">
                  <Button variant="ghost" size="lg" disabled={busy} onClick={() => act("approve")}>
                    <Check className="size-5" strokeWidth={2} />
                    {ta("keep")}
                  </Button>
                  <Button
                    size="lg"
                    loading={busy}
                    onClick={() => act("reject")}
                    className="bg-danger hover:bg-danger"
                  >
                    <X className="size-5" strokeWidth={2} />
                    {selected.kind === "review" ? ta("removeReview") : ta("removeImage")}
                  </Button>
                </div>
              </>
            ) : (
              <Notice className="mt-8">{selected.status === "approved" ? ta("kept") : ta("removed")}</Notice>
            )}
          </aside>
        )}
      </div>
    </>
  );
}
