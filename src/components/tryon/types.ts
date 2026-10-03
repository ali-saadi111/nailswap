import type { JobView } from "@/lib/tryon/jobs";

export type { JobView };

export interface TryonDesign {
  id: string;
  name: string;
  category: string;
  shape: string | null;
  length: string | null;
  priceAddon: number;
  coverUrl: string | null;
  salonId: string;
  salonSlug: string;
  salonName: string;
  polishIds?: string[];
}

export interface TryonPolish {
  id: string;
  hexColor: string;
  finish: string;
  shadeName: string;
  brand: string;
}

export interface TryonSalon {
  id: string;
  slug: string;
  name: string;
  currency: string;
}

export type Shape = "square" | "squoval" | "round" | "almond" | "coffin" | "stiletto";
export type Length = "short" | "medium" | "long";
export type Finish = "glossy" | "matte" | "chrome" | "cat_eye" | "glitter" | "shimmer" | "french_tip";

export const SHAPES: Shape[] = ["almond", "oval" as Shape, "square", "coffin"].filter(
  (s) => s !== ("oval" as Shape),
) as Shape[];
export const ALL_SHAPES: Shape[] = ["almond", "round", "square", "squoval", "coffin", "stiletto"];
export const LENGTHS: Length[] = ["short", "medium", "long"];
export const FINISHES: Finish[] = [
  "glossy",
  "matte",
  "chrome",
  "cat_eye",
  "glitter",
  "shimmer",
  "french_tip",
];

/** What the user is trying on: a salon design, a salon polish, or a custom description. */
export interface Look {
  designId: string | null;
  polishId: string | null;
  shape: Shape;
  length: Length;
  color: string;
  finish: Finish;
  art: string;
}
