import { describe, it, expect } from "vitest";
import {
  estimateNails,
  nailPolygon,
  polygonArea,
  polygonBounds,
  validateHandForTryOn,
  isBackOfHand,
  type Landmarks,
} from "./nail-geometry";

/** Synthetic open right hand, back facing camera, fingers pointing up (y decreasing). */
function syntheticHand(): Landmarks {
  const lm: Landmarks = new Array(21).fill(null).map(() => ({ x: 0, y: 0 }));
  lm[0] = { x: 0.5, y: 0.9 }; // wrist
  const fingers: [number[], number, number][] = [
    [[1, 2, 3, 4], 0.3, 0.72], // thumb
    [[5, 6, 7, 8], 0.4, 0.6],
    [[9, 10, 11, 12], 0.5, 0.58],
    [[13, 14, 15, 16], 0.6, 0.6],
    [[17, 18, 19, 20], 0.7, 0.64],
  ];
  for (const [idx, x, baseY] of fingers) {
    idx.forEach((i, k) => {
      lm[i] = { x: x + (i <= 4 ? -k * 0.03 : 0), y: baseY - k * 0.1 };
    });
  }
  return lm;
}

describe("estimateNails", () => {
  it("returns five nails near the fingertips with sensible sizes", () => {
    const hand = syntheticHand();
    const nails = estimateNails(hand, { aspect: 1 });
    expect(nails).toHaveLength(5);
    for (const n of nails) {
      expect(n.polygon.length).toBeGreaterThan(10);
      expect(n.halfWidth).toBeGreaterThan(0);
      expect(n.halfLength).toBeGreaterThan(0);
      const tipIdx = { thumb: 4, index: 8, middle: 12, ring: 16, pinky: 20 }[n.finger];
      const tip = hand[tipIdx];
      expect(Math.hypot(n.center.x - tip.x, n.center.y - tip.y)).toBeLessThan(0.08);
    }
  });

  it("extends masks toward the fingertip for longer nails", () => {
    const lm = syntheticHand();
    const short = estimateNails(lm, { length: "short" })[1];
    const long = estimateNails(lm, { length: "long" })[1];
    expect(long.halfLength).toBeGreaterThan(short.halfLength);
    expect(long.center.y).toBeLessThan(short.center.y);
    expect(polygonArea(long.polygon)).toBeGreaterThan(polygonArea(short.polygon));
  });

  it("shapes change the free edge but keep the tip extent", () => {
    const c = { x: 0.5, y: 0.5 };
    const axis = { x: 0, y: -1 };
    const square = nailPolygon(c, axis, 0.05, 0.08, "square");
    const stiletto = nailPolygon(c, axis, 0.05, 0.08, "stiletto");
    const almond = nailPolygon(c, axis, 0.05, 0.08, "almond");
    expect(polygonArea(square)).toBeGreaterThan(polygonArea(almond));
    expect(polygonArea(almond)).toBeGreaterThan(polygonArea(stiletto));
    expect(polygonBounds(square).minY).toBeCloseTo(polygonBounds(stiletto).minY, 3);
  });

  it("detects back of hand by orientation", () => {
    const lm = syntheticHand();
    expect(isBackOfHand(lm, "Right")).toBe(true);
    expect(isBackOfHand(lm, "Left")).toBe(false);
  });
});

describe("validateHandForTryOn", () => {
  it("rejects when there is no hand", () => {
    expect(validateHandForTryOn([], 1)).toEqual({ ok: false, reason: "not_hand" });
  });
  it("rejects tiny hands", () => {
    const lm = syntheticHand().map((p) => ({ x: 0.5 + (p.x - 0.5) * 0.1, y: 0.5 + (p.y - 0.5) * 0.1 }));
    expect(validateHandForTryOn([{ landmarks: lm, handedness: "Right", score: 0.9 }], 1)).toEqual({
      ok: false,
      reason: "too_small",
    });
  });
  it("accepts a clear open hand", () => {
    const res = validateHandForTryOn([{ landmarks: syntheticHand(), handedness: "Right", score: 0.95 }], 1);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.nails).toHaveLength(5);
  });
});
