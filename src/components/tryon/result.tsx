"use client";

import * as React from "react";
import { ArrowRight, Bookmark, ChevronsLeftRight, Download, Share } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter, usePathname } from "@/i18n/navigation";
import { Button, IconButton } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { FilterToggle, Notice } from "@/components/ui/primitives";
import { toast } from "@/components/ui/toaster";
import { api, isApiError, track } from "@/lib/client/api";
import { useMe } from "@/lib/client/use-me";
import type { JobView, TryonDesign, TryonSalon } from "./types";

/** Before/after slider over the one media area, then name + Save look pill (DESIGN.md §6). */
export function Result({
  job,
  design,
  salon,
  designLabel,
  onTryAnother,
}: {
  job: JobView;
  design: TryonDesign | null;
  salon: TryonSalon | null;
  designLabel: string;
  onTryAnother: () => void;
}) {
  const t = useTranslations("ui.tryon");
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useMe();
  const rtl = useLocale() === "ar";
  const [index, setIndex] = React.useState(0);
  const [split, setSplit] = React.useState(50);
  const [title, setTitle] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(job.isSaved);
  const [error, setError] = React.useState<string | null>(null);
  const dragging = React.useRef(false);
  const areaRef = React.useRef<HTMLDivElement>(null);

  const after = job.results[index];
  const before = job.inputUrl;
  const bookSlug = salon?.slug ?? design?.salonSlug ?? null;
  const bookHref = bookSlug
    ? `/s/${bookSlug}/book?tryonJobId=${job.id}${design ? `&designId=${design.id}` : ""}`
    : null;

  function setFromPointer(clientX: number) {
    const el = areaRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const isRtl = getComputedStyle(el).direction === "rtl";
    const x = (clientX - r.left) / r.width;
    const v = Math.round(Math.max(4, Math.min(96, (isRtl ? 1 - x : x) * 100)));
    setSplit(v);
  }

  async function save() {
    if (!user) {
      try {
        sessionStorage.setItem("ns_pending_save", JSON.stringify({ jobId: job.id, index, title }));
      } catch {
        /* ignore */
      }
      router.push(`/login?next=${encodeURIComponent(`${pathname}?jobId=${job.id}`)}`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post(`/api/tryon/jobs/${job.id}/save`, { index, title: title.trim() || undefined });
      setSaved(true);
      toast.success(t("saved"));
    } catch (err) {
      if (isApiError(err, "unauthorized")) {
        router.push(`/login?next=${encodeURIComponent(`${pathname}?jobId=${job.id}`)}`);
        return;
      }
      setError(t("generic"));
    } finally {
      setSaving(false);
    }
  }

  async function share() {
    track("share", { salonId: job.salonId, designId: job.designId });
    try {
      if (navigator.share && after) {
        const res = await fetch(after);
        const blob = await res.blob();
        const file = new File([blob], "nailswap-look.jpg", { type: blob.type || "image/jpeg" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: designLabel });
          return;
        }
        await navigator.share({ title: designLabel, url: window.location.href });
        return;
      }
    } catch {
      return;
    }
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success(t("share"));
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <div className="flex h-11 items-center justify-end gap-2">
        {after && (
          <a
            href={after}
            download="nailswap-look.jpg"
            className="bg-surface text-foreground hover:text-accent inline-flex size-11 items-center justify-center rounded-full shadow-sm"
            aria-label={t("download")}
          >
            <Download className="size-5" strokeWidth={1.75} />
          </a>
        )}
        <IconButton aria-label={t("share")} tone="surface" onClick={share}>
          <Share />
        </IconButton>
      </div>

      <div
        ref={areaRef}
        className="rounded-media bg-latte relative -mx-3 mt-2 h-[52dvh] min-h-[340px] touch-none overflow-hidden select-none"
        onPointerDown={(e) => {
          dragging.current = true;
          setFromPointer(e.clientX);
        }}
        onPointerMove={(e) => dragging.current && setFromPointer(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
        onPointerLeave={() => (dragging.current = false)}
      >
        {after && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={after}
            alt={t("resultAlt", { design: designLabel })}
            className="absolute inset-0 size-full object-cover"
            draggable={false}
          />
        )}
        {before && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={before}
            alt={t("beforeAlt")}
            className="absolute inset-0 size-full object-cover"
            style={{ clipPath: rtl ? `inset(0 0 0 ${100 - split}%)` : `inset(0 ${100 - split}% 0 0)` }}
            draggable={false}
          />
        )}
        {before && (
          <>
            <div
              aria-hidden
              className="absolute inset-y-0 w-0.5 bg-[#fff8f5]"
              style={{ insetInlineStart: `calc(${split}% - 1px)` }}
            />
            <button
              type="button"
              aria-label={t("compare")}
              className="text-accent absolute top-1/2 inline-flex size-11 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full bg-[#fff8f5] shadow-lg"
              style={{ insetInlineStart: `calc(${split}% - 22px)` }}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") setSplit((s) => Math.max(4, s - 4));
                if (e.key === "ArrowRight") setSplit((s) => Math.min(96, s + 4));
              }}
            >
              <ChevronsLeftRight className="size-5" strokeWidth={2} />
            </button>
          </>
        )}
      </div>
      <div className="mt-2.5 flex justify-between gap-3 text-[13px] font-bold">
        <span className="bg-surface rounded-full px-3 py-1">{t("before")}</span>
        <span className="bg-foreground text-background truncate rounded-full px-3 py-1">
          {t("after", { design: designLabel })}
        </span>
      </div>

      {job.results.length > 1 && (
        <div className="mt-1 flex gap-4" role="radiogroup" aria-label={t("variation", { n: "" })}>
          {job.results.map((_, i) => (
            <FilterToggle key={i} role="radio" pressed={i === index} onClick={() => setIndex(i)}>
              {t("variation", { n: i + 1 })}
            </FilterToggle>
          ))}
        </div>
      )}

      <h1 className="font-display mt-5 text-[30px] leading-[1.1]">{t("ready")}</h1>
      <p className="text-muted mt-1 text-sm font-semibold">{designLabel}</p>

      <div className="mt-5">
        <Label htmlFor="look-title">{t("lookName")}</Label>
        <Input
          id="look-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("lookNamePlaceholder")}
          maxLength={80}
        />
      </div>

      {error && (
        <Notice tone="danger" className="mt-3">
          {error}
        </Notice>
      )}
      {!user && <Notice className="mt-3">{t("signInToSave")}</Notice>}

      <div className="sticky bottom-0 z-30 -mx-3 mt-auto pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="glass rounded-[28px] p-2.5 shadow-lg">
          <div className="mb-1.5 flex items-center justify-between px-2">
            {bookHref ? (
              <Link
                href={bookHref}
                onClick={() => track("book_click", { salonId: job.salonId, designId: job.designId })}
                className="text-accent hover:text-foreground inline-flex min-h-11 items-center gap-1.5 text-[15px] font-bold"
              >
                {t("bookAt", { salon: salon?.name ?? design?.salonName ?? "" })}
                <ArrowRight className="size-5 rtl:-scale-x-100" strokeWidth={1.75} />
              </Link>
            ) : (
              <Link
                href="/explore"
                className="text-accent hover:text-foreground inline-flex min-h-11 items-center gap-1.5 text-[15px] font-bold"
              >
                {t("chooseSalon")}
                <ArrowRight className="size-5 rtl:-scale-x-100" strokeWidth={1.75} />
              </Link>
            )}
            <button
              type="button"
              onClick={onTryAnother}
              className="text-foreground hover:text-accent min-h-11 text-[15px] font-bold"
            >
              {t("tryAnother")}
            </button>
          </div>
          <Button size="lg" className="w-full" onClick={save} loading={saving} disabled={saved}>
            <Bookmark className="size-5" strokeWidth={1.75} />
            {saved ? t("saved") : t("saveLook")}
          </Button>
        </div>
      </div>
    </>
  );
}
