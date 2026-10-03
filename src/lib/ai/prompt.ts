import type { TryOnParams } from "./types";

const SHAPE_TEXT: Record<NonNullable<TryOnParams["shape"]>, string> = {
  square: "square shaped nails with straight edges",
  squoval: "squoval nails, square with softly rounded corners",
  round: "round shaped nails",
  almond: "almond shaped nails tapering to a soft point",
  coffin: "coffin (ballerina) shaped nails with a flat tip",
  stiletto: "stiletto nails tapering to a sharp point",
};

const LENGTH_TEXT: Record<NonNullable<TryOnParams["length"]>, string> = {
  short: "short natural length",
  medium: "medium length",
  long: "long length",
};

const FINISH_TEXT: Record<NonNullable<TryOnParams["finish"]>, string> = {
  glossy: "high-gloss gel finish with sharp specular highlights",
  matte: "velvety matte finish, no shine",
  chrome: "mirror chrome finish, highly reflective metallic surface",
  cat_eye: "cat-eye magnetic finish with a bright shifting light streak",
  glitter: "densely packed fine glitter finish that sparkles",
  shimmer: "soft pearlescent shimmer finish",
  french_tip: "classic french manicure with crisp white tips on a sheer nude base",
};

function colorName(hex: string) {
  // Convert to an approximate colour name so the model receives a robust description
  // alongside the exact hex (models handle names far better than hex codes).
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let hue = 0;
  if (d !== 0) {
    if (max === r) hue = ((g - b) / d) % 6;
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue = (hue * 60 + 360) % 360;
  }
  if (l > 0.93) return "milky white";
  if (l < 0.1) return "deep black";
  if (s < 0.12) return l > 0.6 ? "light grey" : l > 0.35 ? "grey" : "charcoal";
  const light = l > 0.72 ? "pale " : l < 0.3 ? "deep " : "";
  const names: [number, string][] = [
    [15, "red"],
    [40, "orange"],
    [65, "yellow"],
    [150, "green"],
    [200, "teal"],
    [255, "blue"],
    [290, "purple"],
    [350, "pink"],
    [360, "red"],
  ];
  const base = names.find(([limit]) => hue <= limit)?.[1] ?? "red";
  // Dark reds and dark pinks (wine, cherry, plum-red) read as burgundy.
  if ((base === "red" || base === "pink") && l < 0.35) return "burgundy";
  if (base === "pink" && l > 0.8) return "baby pink";
  if (base === "orange" && l > 0.6 && s < 0.5) return "nude beige";
  return `${light}${base}`;
}

/**
 * Builds the structured prompt for the inpainting model from the normalised params.
 * The mask restricts changes to the nails, so the prompt describes only the nails.
 */
export function buildPrompt(params: TryOnParams, designPrompt?: string | null) {
  const parts: string[] = ["photorealistic manicure"];
  if (params.shape) parts.push(SHAPE_TEXT[params.shape]);
  if (params.length) parts.push(LENGTH_TEXT[params.length]);
  if (params.color) parts.push(`${colorName(params.color)} (${params.color.toLowerCase()}) nail polish`);
  if (params.finish) parts.push(FINISH_TEXT[params.finish]);
  const art = (params.art ?? designPrompt ?? "").trim();
  if (art) parts.push(art);
  parts.push(
    "consistent design across all fingernails, nails follow the natural curvature of each fingertip, realistic lighting matching the photo, sharp focus, professional nail salon photography",
  );
  const prompt = parts.join(", ");
  const negativePrompt =
    "deformed nails, extra fingers, missing fingers, fused fingers, changed skin, changed skin tone, changed hand shape, polish on skin, blurry, low quality, watermark, text, cartoon, painting, jewelry changes, background changes";
  return { prompt, negativePrompt };
}

/**
 * Instruction for reference-guided edit models. Image 1 is the
 * client's hand; image 2 (optional) is the design photo, which shows someone else's hand — the
 * model must lift only the nail art from it. Everything except the nail plates stays untouched.
 */
export function buildEditPrompt(
  params: TryOnParams,
  designPrompt: string | null | undefined,
  hasReference: boolean,
) {
  const look: string[] = [];
  if (params.shape) look.push(SHAPE_TEXT[params.shape]);
  if (params.length) look.push(LENGTH_TEXT[params.length]);
  if (params.color) look.push(`${colorName(params.color)} (${params.color.toLowerCase()}) polish`);
  if (params.finish) look.push(FINISH_TEXT[params.finish]);
  const art = (params.art ?? designPrompt ?? "").trim();

  const lines: string[] = [
    "Image 1 is a real photo of a client's hand.",
    hasReference ? "Image 2 is a reference photo of a nail design worn by someone else." : "",
    "Edit image 1 so the client is wearing a fresh, professionally done salon manicure.",
    hasReference
      ? "Recreate the nail design from image 2 on every fingernail of image 1: match its colours, pattern, art details, decorations and finish as closely as possible. Use image 2 only as the design reference — do not copy its hand, skin, pose, background or jewellery."
      : "",
    art ? `Design: ${art}.` : "",
    look.length ? `Nails: ${look.join(", ")}.` : "",
    "Paint only the nail plates. Keep clean cuticle lines and natural free edges, follow the curvature and perspective of each nail, and keep the design consistent across all visible nails.",
    "Remove the old polish and old nail art completely before applying the requested design. Preserve intentional accent nails from the reference rather than repeating one motif on every finger. Do not invent hidden nails or paint skin. Scale the art to each nail without stretching it.",
    params.shape || params.length
      ? "Change only the nail free edges as needed for the requested shape and length; preserve the nail beds and fingertip anatomy."
      : "Preserve the original nail length and silhouette exactly.",
    "Match the photo's lighting: realistic reflections and highlights on the polish, correct shadows, same white balance, same grain and sharpness as the original.",
    "Do not change anything else in image 1: same hand, finger count and positions, skin tone and texture, rings and jewellery, background, framing, crop and camera angle.",
    "Output a single photorealistic photo, not an illustration, with no text or watermark.",
  ];
  return lines.filter(Boolean).join(" ");
}

/** Parses a free-text description like "almond, milky white with gold chrome tips" into params. */
export function parseDescription(text: string): Partial<TryOnParams> {
  const t = text.toLowerCase();
  const out: Partial<TryOnParams> = { art: text.trim() };
  const shapes: TryOnParams["shape"][] = ["square", "squoval", "round", "almond", "coffin", "stiletto"];
  for (const s of shapes) if (s && t.includes(s)) out.shape = s;
  if (t.includes("ballerina")) out.shape = "coffin";
  if (/\bshort\b/.test(t)) out.length = "short";
  else if (/\bmedium\b/.test(t)) out.length = "medium";
  else if (/\blong\b|\bextra long\b|\bxl\b/.test(t)) out.length = "long";
  if (t.includes("matte")) out.finish = "matte";
  else if (t.includes("cat eye") || t.includes("cat-eye") || t.includes("cateye")) out.finish = "cat_eye";
  else if (t.includes("glitter")) out.finish = "glitter";
  else if (t.includes("shimmer") || t.includes("pearl")) out.finish = "shimmer";
  else if (t.includes("french")) out.finish = "french_tip";
  else if (t.includes("chrome") || t.includes("mirror") || t.includes("metallic")) out.finish = "chrome";
  else if (t.includes("gloss")) out.finish = "glossy";
  const namedColors: Record<string, string> = {
    "milky white": "#F5F1EC",
    white: "#FFFFFF",
    black: "#111111",
    red: "#C1272D",
    burgundy: "#6E1423",
    nude: "#D9B99B",
    beige: "#E3C9A8",
    pink: "#F4A6B8",
    "baby pink": "#F8C8D4",
    "hot pink": "#FF2E93",
    coral: "#FF7F50",
    peach: "#FFCBA4",
    lavender: "#C8B6E2",
    lilac: "#C8A2C8",
    purple: "#7B4B94",
    blue: "#3A6EA5",
    navy: "#1D2B53",
    "baby blue": "#A7C7E7",
    teal: "#2A9D8F",
    green: "#3C8D5A",
    sage: "#9CAF88",
    emerald: "#0F7B5F",
    olive: "#708238",
    yellow: "#F2C14E",
    mustard: "#D4A017",
    orange: "#F28C28",
    brown: "#7A4A2B",
    chocolate: "#5A3825",
    gold: "#D4AF37",
    silver: "#C0C0C0",
    grey: "#9E9E9E",
    gray: "#9E9E9E",
    cherry: "#9B111E",
    wine: "#722F37",
    mauve: "#B784A7",
  };
  let bestKey = "";
  for (const key of Object.keys(namedColors)) {
    if (t.includes(key) && key.length > bestKey.length) bestKey = key;
  }
  if (bestKey) out.color = namedColors[bestKey];
  const hex = t.match(/#([0-9a-f]{6})\b/);
  if (hex) out.color = `#${hex[1].toUpperCase()}`;
  return out;
}
