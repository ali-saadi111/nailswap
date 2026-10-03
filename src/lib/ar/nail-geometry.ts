/**
 * Pure geometry shared by the browser (AR, pre-upload validation) and the server (mask
 * rasterisation). Works on MediaPipe Hands 21-point landmarks in normalised image coordinates.
 *
 * Landmark indices: 0 wrist; thumb 1-4; index 5-8; middle 9-12; ring 13-16; pinky 17-20.
 * Each finger: [MCP, PIP, DIP, TIP] (thumb: [CMC, MCP, IP, TIP]).
 */
export interface Point {
  x: number;
  y: number;
  z?: number;
}

export type Landmarks = Point[]; // length 21
export type Polygon = Array<[number, number]>;

export type NailShape = "square" | "squoval" | "round" | "almond" | "coffin" | "stiletto";
export type NailLength = "short" | "medium" | "long";

export const FINGERS = [
  { name: "thumb", tip: 4, dip: 3, pip: 2 },
  { name: "index", tip: 8, dip: 7, pip: 6 },
  { name: "middle", tip: 12, dip: 11, pip: 10 },
  { name: "ring", tip: 16, dip: 15, pip: 14 },
  { name: "pinky", tip: 20, dip: 19, pip: 18 },
] as const;

export interface NailEstimate {
  finger: (typeof FINGERS)[number]["name"];
  /** Nail centre. */
  center: Point;
  /** Unit vector pointing from the knuckle toward the fingertip. */
  axis: Point;
  /** Half-width perpendicular to the axis. */
  halfWidth: number;
  /** Half-length along the axis. */
  halfLength: number;
  /** 0..1 confidence from geometry (finger extended & facing camera). */
  confidence: number;
  polygon: Polygon;
}

function sub(a: Point, b: Point): Point {
  return { x: a.x - b.x, y: a.y - b.y };
}
function add(a: Point, b: Point): Point {
  return { x: a.x + b.x, y: a.y + b.y };
}
function scale(a: Point, s: number): Point {
  return { x: a.x * s, y: a.y * s };
}
function len(a: Point) {
  return Math.hypot(a.x, a.y);
}
function norm(a: Point): Point {
  const l = len(a) || 1e-6;
  return { x: a.x / l, y: a.y / l };
}
function perp(a: Point): Point {
  return { x: -a.y, y: a.x };
}

/** Palm size proxy: wrist → middle-finger MCP distance. */
export function palmSize(lm: Landmarks) {
  return len(sub(lm[9], lm[0]));
}

/**
 * Returns true when the back of the hand faces the camera (nails visible). Uses the signed
 * area of the triangle wrist–index MCP–pinky MCP together with handedness.
 */
export function isBackOfHand(lm: Landmarks, handedness: "Left" | "Right" | string): boolean {
  const a = lm[0],
    b = lm[5],
    c = lm[17];
  const cross = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  // For a right hand seen from the back (camera image, y down) the cross product is positive.
  return handedness === "Right" ? cross > 0 : cross < 0;
}

const LENGTH_FACTOR: Record<NailLength, number> = { short: 1.0, medium: 1.35, long: 1.8 };

/**
 * Estimates each nail as an oriented rounded quad from the fingertip landmarks.
 * `lengthOverride` extends the mask toward (and beyond) the fingertip so the model can grow the nail.
 */
export function estimateNails(
  lm: Landmarks,
  opts: { shape?: NailShape | null; length?: NailLength | null; aspect?: number } = {},
): NailEstimate[] {
  const aspect = opts.aspect ?? 1; // width/height of the image; corrects normalised coords
  const fix = (p: Point): Point => ({ x: p.x * aspect, y: p.y });
  const unfix = (p: Point): Point => ({ x: p.x / aspect, y: p.y });
  const palm = len(sub(fix(lm[9]), fix(lm[0])));
  const out: NailEstimate[] = [];

  for (const f of FINGERS) {
    const tip = fix(lm[f.tip]);
    const dip = fix(lm[f.dip]);
    const pip = fix(lm[f.pip]);
    const segment = sub(tip, dip);
    const segLen = len(segment);
    const axis = norm(segment);

    // Finger width ≈ 0.16 palm for index–ring, thinner for pinky, wider for thumb.
    const widthScale = f.name === "thumb" ? 0.2 : f.name === "pinky" ? 0.13 : 0.16;
    const halfWidth = palm * widthScale * 0.5;

    // Natural nail occupies roughly the distal 55% of the tip segment.
    const baseHalfLen = segLen * 0.55 * 0.5;
    const lengthFactor = opts.length ? LENGTH_FACTOR[opts.length] : 1.0;
    const halfLength = baseHalfLen * lengthFactor;

    // Nail centre sits just before the fingertip; with longer nails it moves past the tip.
    const naturalCenter = add(tip, scale(axis, -baseHalfLen * 0.9));
    const center = add(naturalCenter, scale(axis, halfLength - baseHalfLen));

    // Confidence: extended finger (tip further from pip than dip) and reasonable segment length.
    const extended = len(sub(tip, pip)) > len(sub(dip, pip)) * 1.2 ? 1 : 0.4;
    const sizeOk = segLen > palm * 0.12 ? 1 : 0.5;
    const confidence = Math.min(1, extended * sizeOk);

    const polygon = nailPolygon(center, axis, halfWidth, halfLength, opts.shape ?? "squoval").map(
      ([x, y]) => {
        const p = unfix({ x, y });
        return [p.x, p.y] as [number, number];
      },
    );

    out.push({ finger: f.name, center: unfix(center), axis, halfWidth, halfLength, confidence, polygon });
  }
  return out;
}

/**
 * Builds a nail outline for the requested shape. The base (cuticle side) is always a soft arc;
 * the free edge changes with the shape. Returned in the same coordinate space as `center`.
 */
export function nailPolygon(
  center: Point,
  axis: Point,
  hw: number,
  hl: number,
  shape: NailShape,
  steps = 10,
): Polygon {
  const side = perp(axis);
  const pts: Point[] = [];
  const at = (u: number, v: number) => add(center, add(scale(side, u * hw), scale(axis, v * hl)));

  // Cuticle arc (v from -1 at the base), from left to right
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; // 0..1
    const u = -1 + 2 * t;
    const v = -1 + 0.25 * (1 - u * u); // gentle arc
    pts.push(at(u, v));
  }
  // Free edge, from right to left, depends on shape
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - 2 * t; // 1..-1
    let v: number;
    let uu = u;
    switch (shape) {
      case "square":
        v = 1;
        break;
      case "squoval":
        v = 1 - 0.12 * Math.pow(Math.abs(u), 4);
        break;
      case "round":
        v = 1 - 0.35 * u * u;
        break;
      case "almond":
        v = 1 - 0.75 * u * u;
        uu = u * (0.55 + 0.45 * (1 - Math.abs(u)));
        break;
      case "coffin":
        v = 1;
        uu = u * 0.6; // narrow flat tip
        break;
      case "stiletto":
        v = 1 - 0.95 * Math.abs(u);
        uu = u * (0.2 + 0.8 * (1 - Math.abs(u)));
        break;
    }
    pts.push(at(uu, v));
  }
  return pts.map((p) => [p.x, p.y]);
}

/** Pre-upload validation: are nails clearly visible enough to attempt a try-on? */
export function validateHandForTryOn(
  hands: { landmarks: Landmarks; handedness: string; score: number }[],
  imageAspect: number,
):
  | { ok: true; nails: NailEstimate[] }
  | { ok: false; reason: "not_hand" | "nails_not_visible" | "too_small" } {
  if (!hands.length) return { ok: false, reason: "not_hand" };
  const best = hands.reduce((a, b) => (a.score > b.score ? a : b));
  if (best.score < 0.5) return { ok: false, reason: "not_hand" };
  const lm = best.landmarks;
  const xs = lm.map((p) => p.x),
    ys = lm.map((p) => p.y);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  if (Math.max(w, h) < 0.18) return { ok: false, reason: "too_small" };
  const nails = estimateNails(lm, { aspect: imageAspect });
  const confident = nails.filter((n) => n.confidence >= 0.6).length;
  const inFrame = nails.filter((n) =>
    n.polygon.every(([x, y]) => x > -0.02 && x < 1.02 && y > -0.02 && y < 1.02),
  ).length;
  if (confident < 3 || inFrame < 4) return { ok: false, reason: "nails_not_visible" };
  return { ok: true, nails };
}

/** Axis-aligned bounding box of a polygon, normalised coords. */
export function polygonBounds(poly: Polygon) {
  let minX = 1,
    minY = 1,
    maxX = 0,
    maxY = 0;
  for (const [x, y] of poly) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/** Polygon area (shoelace), normalised units. */
export function polygonArea(poly: Polygon) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}
