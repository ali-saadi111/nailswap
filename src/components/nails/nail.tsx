import * as React from "react";
import { cn } from "@/lib/utils";

export type NailShape = "almond" | "oval" | "round" | "square" | "squoval" | "coffin" | "stiletto";

/** Hand-painted gradient fills per design category; used when a design has no cover image. */
export const CATEGORY_FILLS: Record<string, string> = {
  chrome: "linear-gradient(135deg,#f4f4f6 0%,#b9bcc6 35%,#ffffff 50%,#9da1ad 70%,#e9eaee 100%)",
  french: "linear-gradient(to bottom,#ffffff 0 24%,#f6dcd4 24% 100%)",
  ombre: "linear-gradient(to bottom,#e3c9a8 0%,#f5f1ec 100%)",
  art_3d: "radial-gradient(circle at 50% 55%,#ff8fb1 0%,#f7d6e3 55%,#fbeef3 100%)",
  minimal: "linear-gradient(160deg,#fbfaf8,#f1ebe4)",
  bridal: "linear-gradient(to bottom,#d4af37 0 22%,#f2e6dc 22% 100%)",
  seasonal: "linear-gradient(160deg,#8e0f24,#4a0612)",
  velvet: "linear-gradient(100deg,#1a1030 0%,#5b3fa0 45%,#c9b6ff 52%,#5b3fa0 60%,#1a1030 100%)",
};

export const SAMPLE_FILLS = [
  CATEGORY_FILLS.chrome,
  CATEGORY_FILLS.french,
  CATEGORY_FILLS.seasonal,
  CATEGORY_FILLS.art_3d,
  CATEGORY_FILLS.velvet,
];

/** CSS background for a design: its cover photo when available, otherwise a category gradient. */
export function fillForDesign(d: {
  category?: string | null;
  coverUrl?: string | null;
  hex?: string | null;
}): string {
  if (d.coverUrl)
    return `url("${d.coverUrl}") center/cover no-repeat, ${CATEGORY_FILLS[d.category ?? ""] ?? "#e7cdbe"}`;
  if (d.hex) return d.hex;
  return CATEGORY_FILLS[d.category ?? ""] ?? "#e7cdbe";
}

/** Polish fills by finish (live AR rail, polish inventory). */
export function fillForPolish(p: { hexColor: string; finish?: string | null }) {
  const c = p.hexColor;
  switch (p.finish) {
    case "chrome":
      return `linear-gradient(135deg,#ffffff 0%,${c} 40%,#ffffff 52%,${c} 65%,#ffffff 100%)`;
    case "cat_eye":
      return `linear-gradient(100deg,${c} 0%,color-mix(in oklab,${c} 60%,#fff) 48%,${c} 56%)`;
    case "glitter":
    case "shimmer":
      return `radial-gradient(circle at 30% 30%,rgba(255,255,255,.7) 0 6%,transparent 7%),radial-gradient(circle at 70% 65%,rgba(255,255,255,.6) 0 5%,transparent 6%),${c}`;
    case "french_tip":
      return `linear-gradient(to bottom,#ffffff 0 24%,${c} 24% 100%)`;
    default:
      return c;
  }
}

export function Nail({
  shape = "almond",
  fill,
  width = 16,
  height,
  className,
  style,
}: {
  shape?: NailShape | string | null;
  fill?: string;
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const h = height ?? Math.round(width / 0.68);
  const s = (shape && `nail-${shape}`) || "nail-almond";
  return (
    <span
      aria-hidden
      className={cn("nail", s, className)}
      style={{ width, height: h, background: fill ?? "var(--nude)", ...style }}
    />
  );
}

const HEIGHT_RATIOS = [1.3, 1.5, 1.42, 1.25, 1.1];

/** 3–5 nails in a row with slightly varied heights, like a hand. */
export function NailGroup({
  shape = "almond",
  fill,
  count = 3,
  size = 16,
  gap = 4,
  className,
  fills,
}: {
  shape?: NailShape | string | null;
  fill?: string;
  fills?: string[];
  count?: number;
  size?: number;
  gap?: number;
  className?: string;
}) {
  const n = Math.min(5, Math.max(1, count));
  // Centre the tallest nail for 3 and 5, mirror ratios so it reads as a hand.
  const ratios = n === 3 ? [1.3, 1.5, 1.25] : n === 4 ? [1.25, 1.5, 1.45, 1.2] : HEIGHT_RATIOS.slice(0, n);
  return (
    <span aria-hidden className={cn("inline-flex shrink-0 items-end", className)} style={{ gap }}>
      {ratios.map((r, i) => (
        <Nail key={i} shape={shape} fill={fills?.[i] ?? fill} width={size} height={Math.round(size * r)} />
      ))}
    </span>
  );
}

/** The hero row of five different nails used on the home and auth screens. */
export function NailHeroRow({
  size = 46,
  className,
  gap = 8,
}: {
  size?: number;
  className?: string;
  gap?: number;
}) {
  const shapes: NailShape[] = ["almond", "oval", "coffin", "almond", "square"];
  const ratios = [1.15, 1.35, 1.48, 1.39, 1.11];
  return (
    <span aria-hidden className={cn("flex items-end justify-between", className)} style={{ gap }}>
      {SAMPLE_FILLS.map((f, i) => (
        <Nail key={i} shape={shapes[i]} fill={f} width={size} height={Math.round(size * ratios[i])} />
      ))}
    </span>
  );
}
