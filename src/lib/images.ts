import "server-only";
import sharp from "sharp";
import { createHash } from "node:crypto";

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export interface NormalisedImage {
  buffer: Buffer;
  width: number;
  height: number;
  /** sha256 of the normalised pixels — stable cache key regardless of original metadata. */
  hash: string;
  mime: "image/jpeg";
}

/**
 * Normalises a client upload for the AI pipeline:
 * - applies EXIF orientation, then strips ALL metadata (EXIF, GPS, ICC, XMP)
 * - converts to sRGB JPEG, max 1536px on the long edge (models perform best at ~1MP)
 */
export async function normaliseUpload(input: Buffer): Promise<NormalisedImage> {
  const img = sharp(input, { failOn: "none", limitInputPixels: 40_000_000 }).rotate();
  const meta = await img.metadata();
  if (!meta.width || !meta.height) throw new Error("Unreadable image");
  const buffer = await img
    .resize({ width: 1536, height: 1536, fit: "inside", withoutEnlargement: true })
    .toColorspace("srgb")
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();
  const out = await sharp(buffer).metadata();
  return {
    buffer,
    width: out.width ?? meta.width,
    height: out.height ?? meta.height,
    hash: createHash("sha256").update(buffer).digest("hex"),
    mime: "image/jpeg",
  };
}

/** Prepares a public catalog image: strip metadata, cap at 2048px, encode WebP. */
export async function prepareCatalogImage(input: Buffer, maxEdge = 2048) {
  return sharp(input, { failOn: "none" })
    .rotate()
    .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 86 })
    .toBuffer();
}

/**
 * Extracts the dominant polish color from a swatch photo.
 * Strategy: ignore the border (usually background/bottle), quantise the centre region and take
 * the most saturated frequent bin. Returns #RRGGBB.
 */
export async function extractSwatchColor(input: Buffer): Promise<string> {
  const size = 64;
  const { data } = await sharp(input, { failOn: "none" })
    .rotate()
    .resize(size, size, { fit: "cover" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const bins = new Map<string, { n: number; r: number; g: number; b: number; sat: number }>();
  const margin = Math.floor(size * 0.2);
  for (let y = margin; y < size - margin; y++) {
    for (let x = margin; x < size - margin; x++) {
      const i = (y * size + x) * 3;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      const max = Math.max(r, g, b),
        min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
      const bin = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0, sat: 0 };
      bin.n++;
      bin.r += r;
      bin.g += g;
      bin.b += b;
      bin.sat += sat;
      bins.set(key, bin);
    }
  }
  let best: { score: number; hex: string } | null = null;
  for (const bin of bins.values()) {
    const avgSat = bin.sat / bin.n;
    // Frequency dominates; saturation breaks ties so a white background loses to the polish.
    const score = bin.n * (0.6 + avgSat);
    if (!best || score > best.score) {
      const r = Math.round(bin.r / bin.n),
        g = Math.round(bin.g / bin.n),
        b = Math.round(bin.b / bin.n);
      best = {
        score,
        hex: `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`.toUpperCase(),
      };
    }
  }
  return best?.hex ?? "#CCCCCC";
}

/** Builds a white-on-black PNG mask from polygons (normalised 0..1 coordinates). */
export async function rasterizeMask(
  width: number,
  height: number,
  polygons: Array<Array<[number, number]>>,
  featherPx = 2,
) {
  const paths = polygons
    .map(
      (poly) =>
        `<path d="M${poly.map(([x, y]) => `${(x * width).toFixed(1)} ${(y * height).toFixed(1)}`).join(" L")} Z" fill="white"/>`,
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="black"/>${paths}</svg>`;
  let img = sharp(Buffer.from(svg)).grayscale();
  if (featherPx > 0) img = img.blur(featherPx);
  return img.png().toBuffer();
}

export function sha256(buf: Buffer | string) {
  return createHash("sha256").update(buf).digest("hex");
}
