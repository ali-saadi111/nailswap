"use client";

import { useTranslations } from "next-intl";
import { Nail, fillForDesign, fillForPolish } from "@/components/nails/nail";
import { cn } from "@/lib/utils";
import type { TryonDesign, TryonPolish } from "./types";

/** Row of nails with a small cocoa dot under the selected one (DESIGN.md §6 Try-on). */
export function DesignRail({
  designs,
  polishes,
  selectedDesignId,
  selectedPolishId,
  shape,
  onSelectDesign,
  onSelectPolish,
  className,
}: {
  designs: TryonDesign[];
  polishes?: TryonPolish[];
  selectedDesignId: string | null;
  selectedPolishId?: string | null;
  shape: string;
  onSelectDesign: (d: TryonDesign) => void;
  onSelectPolish?: (p: TryonPolish) => void;
  className?: string;
}) {
  const t = useTranslations("ui.tryon");
  return (
    <div
      role="listbox"
      aria-label={t("designs")}
      className={cn("no-scrollbar -mx-2.5 flex items-start gap-1 overflow-x-auto px-1", className)}
    >
      {designs.map((d) => {
        const selected = d.id === selectedDesignId;
        return (
          <button
            key={d.id}
            type="button"
            role="option"
            aria-selected={selected}
            aria-label={d.name}
            title={d.name}
            onClick={() => onSelectDesign(d)}
            className="flex h-[52px] w-11 shrink-0 flex-col items-center justify-start gap-[9px] bg-transparent"
          >
            <Nail shape={d.shape ?? shape} fill={fillForDesign(d)} width={24} height={35} />
            <span
              aria-hidden
              className={cn("size-[5px] rounded-full", selected ? "bg-accent" : "bg-transparent")}
            />
          </button>
        );
      })}
      {polishes?.map((p) => {
        const selected = p.id === selectedPolishId;
        return (
          <button
            key={p.id}
            type="button"
            role="option"
            aria-selected={selected}
            aria-label={`${p.brand} ${p.shadeName}`}
            title={`${p.brand} ${p.shadeName}`}
            onClick={() => onSelectPolish?.(p)}
            className="flex h-[52px] w-11 shrink-0 flex-col items-center justify-start gap-[9px] bg-transparent"
          >
            <Nail shape={shape} fill={fillForPolish(p)} width={24} height={35} />
            <span
              aria-hidden
              className={cn("size-[5px] rounded-full", selected ? "bg-accent" : "bg-transparent")}
            />
          </button>
        );
      })}
    </div>
  );
}
