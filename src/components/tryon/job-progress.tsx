"use client";

import * as React from "react";
import { Check, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dot, StatusDot } from "@/components/ui/primitives";
import type { JobView } from "./types";

const STEPS = ["uploaded", "detecting", "applying", "finishing"] as const;

function stepIndex(job: JobView) {
  switch (job.status) {
    case "queued":
      return 1;
    case "moderating":
    case "validating":
      return 1;
    case "masking":
      return 2;
    case "generating":
      return job.progress >= 90 ? 3 : 2;
    default:
      return 4;
  }
}

function mmss(s: number) {
  return `${Math.floor(s / 60)}:${String(Math.max(0, Math.round(s % 60))).padStart(2, "0")}`;
}

/** Vertical step list with dots, one 2px progress line and a percent (DESIGN.md §6 Try-on). */
export function JobProgress({
  job,
  photoUrl,
  designName,
  onCancel,
}: {
  job: JobView;
  photoUrl: string | null;
  designName: string;
  onCancel: () => void;
}) {
  const t = useTranslations("ui.tryon");
  const [elapsed, setElapsed] = React.useState(0);
  React.useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => setElapsed((Date.now() - start) / 1000), 500);
    return () => clearInterval(id);
  }, []);

  const pct = Math.max(2, Math.min(99, job.progress || (job.status === "queued" ? 5 : 15)));
  const current = stepIndex(job);
  const left = elapsed > 2 ? Math.max(1, (elapsed / pct) * (100 - pct)) : null;
  const labels = [
    t("stUploaded"),
    t("stDetecting"),
    t("stApplying", { design: designName }),
    t("stFinishing"),
  ];

  return (
    <>
      <div className="flex h-11 items-center justify-end">
        <span className="text-muted inline-flex items-center gap-1.5 text-[13px]">
          <Lock className="size-[15px]" strokeWidth={1.75} />
          {t("processedPrivately")}
        </span>
      </div>
      <div className="rounded-media bg-surface-2 relative mt-2 h-[200px] overflow-hidden">
        {photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" className="size-full object-cover" />
        )}
        <div
          aria-hidden
          className="absolute inset-x-0 h-0.5 bg-[rgb(255_255_255/0.85)]"
          style={{ top: `${20 + (pct / 100) * 60}%`, transition: "top 1s linear" }}
        />
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h1 className="font-display text-[30px] leading-[1.1]">{t("creating")}</h1>
        <StatusDot tone="success" live>
          {t("live")}
        </StatusDot>
      </div>
      <div className="mt-3.5 flex items-baseline justify-between">
        <span className="font-display text-[44px] leading-none tabular-nums">{pct}%</span>
        <span className="text-muted text-[13px] tabular-nums">
          {left !== null
            ? t("elapsed", { elapsed: mmss(elapsed), left: mmss(left) })
            : t("elapsedOnly", { elapsed: mmss(elapsed) })}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={t("creating")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="bg-border relative mt-3.5 h-[3px] rounded-full"
      >
        <span
          className="bg-accent absolute inset-y-0 start-0 rounded-full transition-[width] duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>

      <ol aria-label="Progress steps" className="mt-3.5">
        {STEPS.map((key, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={key} className="flex h-[42px] items-center gap-3.5">
              <span className="flex w-[18px] shrink-0 justify-center">
                {done ? (
                  <Check className="text-success size-[18px]" strokeWidth={2.2} />
                ) : active ? (
                  <span className="bg-accent size-[9px] rounded-full shadow-[0_0_0_4px_rgb(107_63_42/0.16)]" />
                ) : (
                  <Dot tone="hollow" className="size-[9px]" />
                )}
              </span>
              <span
                className={
                  active
                    ? "text-accent flex-1 text-[15px] font-semibold"
                    : done
                      ? "flex-1 text-[15px]"
                      : "text-muted flex-1 text-[15px]"
                }
              >
                {labels[i]}
              </span>
              <span className="text-muted text-[13px]">
                {done ? "" : active ? t("inProgress") : t("next")}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="text-muted mt-1.5 text-[12px] tracking-wide" dir="ltr">
        {t("jobRef", { id: job.id.slice(0, 8) })} · {designName}
      </div>

      <div className="bg-background sticky bottom-0 -mx-6 mt-auto flex justify-center px-6 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <Button variant="ghost" size="lg" onClick={onCancel}>
          {t("cancel")}
        </Button>
      </div>
    </>
  );
}
