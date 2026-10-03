import { describe, it, expect } from "vitest";
import { MaskSmoother, type NailMaskFrame } from "./mask-smoother";

function frame(id: string, value: number, x = 0.5): NailMaskFrame {
  return {
    id,
    data: new Float32Array(16).fill(value),
    w: 4,
    h: 4,
    rect: { x, y: 0.5, w: 0.1, h: 0.1 },
    axis: { x: 0, y: -1 },
  };
}

describe("MaskSmoother", () => {
  it("blends mask values over time instead of jumping", () => {
    const s = new MaskSmoother({ alpha: 0.5 });
    s.update([frame("a", 0)]);
    const out = s.update([frame("a", 1)]);
    expect(out[0].data[0]).toBeCloseTo(0.5, 5);
    const out2 = s.update([frame("a", 1)]);
    expect(out2[0].data[0]).toBeCloseTo(0.75, 5);
  });

  it("applies hysteresis to kill speckle", () => {
    const s = new MaskSmoother({ alpha: 0.5 });
    s.update([frame("a", 0)]);
    const out = s.update([frame("a", 0.2)]);
    expect(out[0].data[0]).toBe(0); // 0.1 < 0.15 → clamped to 0
  });

  it("holds a nail for a few frames when detection drops, then removes it", () => {
    const s = new MaskSmoother({ holdFrames: 2 });
    s.update([frame("a", 1)]);
    expect(s.update([])).toHaveLength(1);
    expect(s.update([])).toHaveLength(1);
    expect(s.update([])).toHaveLength(0);
  });

  it("snaps on large movement instead of interpolating", () => {
    const s = new MaskSmoother({ alpha: 0.2, snapDistance: 0.05 });
    s.update([frame("a", 1, 0.1)]);
    const out = s.update([frame("a", 1, 0.9)]);
    expect(out[0].rect.x).toBeCloseTo(0.9, 5);
  });
});
