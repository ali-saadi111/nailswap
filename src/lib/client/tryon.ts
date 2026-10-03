"use client";

import type { DetectedHand } from "@/lib/ar/hand-tracker";
import type { PolishStyle } from "@/lib/ar/renderer";
import { api } from "./api";
import type { JobView, Look, TryonDesign, TryonPolish } from "@/components/tryon/types";

let imageTracker: Promise<import("@/lib/ar/hand-tracker").HandTracker> | null = null;

/** Lazily creates one IMAGE-mode HandLandmarker for photo validation. */
export function getImageTracker() {
  if (!imageTracker) {
    imageTracker = import("@/lib/ar/hand-tracker").then((m) =>
      m.HandTracker.create({ mode: "IMAGE", numHands: 2 }),
    );
    imageTracker.catch(() => {
      imageTracker = null;
    });
  }
  return imageTracker;
}

export function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image_load_failed"));
    img.src = url;
  });
}

/** Detects hands on a still image and runs the same validation the server applies. */
export async function checkPhoto(img: HTMLImageElement) {
  const [tracker, geometry] = await Promise.all([getImageTracker(), import("@/lib/ar/nail-geometry")]);
  // Downscale very large photos before inference to keep this under ~300 ms on phones.
  let source: HTMLImageElement | HTMLCanvasElement = img;
  const max = 1024;
  if (img.naturalWidth > max || img.naturalHeight > max) {
    const s = max / Math.max(img.naturalWidth, img.naturalHeight);
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * s);
    c.height = Math.round(img.naturalHeight * s);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    source = c;
  }
  const hands = tracker.detectImage(source);
  const result = geometry.validateHandForTryOn(hands, img.naturalWidth / img.naturalHeight);
  return { hands, result };
}

export interface UploadInput {
  file: Blob;
  fileName?: string;
  hands: DetectedHand[];
  look: Look;
  salonId?: string | null;
  sessionId?: string | null;
  locale: string;
  variations?: number;
}

function paramsFor(look: Look, variations: number) {
  const base = { shape: look.shape, length: look.length, variations };
  if (look.designId) return { mode: "catalog", ...base };
  if (look.art.trim())
    return { mode: "describe", ...base, color: look.color, finish: look.finish, art: look.art.trim() };
  if (look.polishId || look.color) return { mode: "polish", ...base, color: look.color, finish: look.finish };
  return { mode: "shape_length", ...base };
}

export async function uploadTryOn(input: UploadInput): Promise<JobView> {
  // Phone photos can exceed Vercel's 4.5 MB function request limit. Resize before sending;
  // normalized landmarks keep the same coordinates because the aspect ratio is preserved.
  const uploadUrl = URL.createObjectURL(input.file);
  let photo: Blob;
  try {
    const img = await loadImage(uploadUrl);
    const scale = Math.min(1, 1536 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not prepare your photo. Please try another image.");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    photo = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not prepare your photo."))),
        "image/jpeg",
        0.92,
      ),
    );
    if (photo.size > 4_000_000) throw new Error("Please choose a smaller photo.");
  } finally {
    URL.revokeObjectURL(uploadUrl);
  }
  const fd = new FormData();
  fd.append("file", photo, "hand.jpg");
  fd.append("hands", JSON.stringify(input.hands));
  fd.append("params", JSON.stringify(paramsFor(input.look, input.variations ?? 1)));
  if (input.salonId) fd.append("salonId", input.salonId);
  if (input.look.designId) fd.append("designId", input.look.designId);
  if (input.look.polishId) fd.append("polishId", input.look.polishId);
  if (input.sessionId) fd.append("sessionId", input.sessionId);
  fd.append("consent", "true");
  fd.append("locale", input.locale);
  return api.post<JobView>("/api/tryon/upload", fd);
}

export function fetchJob(id: string) {
  return api.get<JobView>(`/api/tryon/jobs/${id}`);
}

export async function startSession(body: {
  mode: "ar" | "ai";
  salonId?: string | null;
  designId?: string | null;
  polishId?: string | null;
}) {
  try {
    const device = typeof navigator !== "undefined" ? { ua: navigator.userAgent.slice(0, 120) } : undefined;
    const r = await api.post<{ sessionId: string }>("/api/tryon/session", { ...body, device });
    return r.sessionId;
  } catch {
    return null;
  }
}

/** Approximate polish colour/finish per design category for the live preview. */
const CATEGORY_STYLE: Record<string, { color: string; finish: PolishStyle["finish"] }> = {
  chrome: { color: "#c9ccd4", finish: "chrome" },
  french: { color: "#f6dcd4", finish: "french_tip" },
  ombre: { color: "#e3c9a8", finish: "glossy" },
  art_3d: { color: "#f3b7c8", finish: "glitter" },
  minimal: { color: "#f5f1ec", finish: "glossy" },
  bridal: { color: "#f2e6dc", finish: "shimmer" },
  seasonal: { color: "#8e0f24", finish: "glossy" },
};

export function styleForLook(look: Look, design: TryonDesign | null, polishes: TryonPolish[]): PolishStyle {
  if (design) {
    const linked = design.polishIds?.map((id) => polishes.find((p) => p.id === id)).find(Boolean);
    if (linked) return { color: linked.hexColor, finish: linked.finish as PolishStyle["finish"] };
    return CATEGORY_STYLE[design.category] ?? { color: "#c2185b", finish: "glossy" };
  }
  return { color: look.color, finish: look.finish };
}

export function defaultLookFor(design: TryonDesign | null, polish?: TryonPolish | null): Look {
  return {
    designId: design?.id ?? null,
    polishId: polish?.id ?? null,
    shape: ((design?.shape as Look["shape"]) ?? "almond") || "almond",
    length: ((design?.length as Look["length"]) ?? "medium") || "medium",
    color: polish?.hexColor ?? "#c2185b",
    finish: (polish?.finish as Look["finish"]) ?? "glossy",
    art: "",
  };
}
