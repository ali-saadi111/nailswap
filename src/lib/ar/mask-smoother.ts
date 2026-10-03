/**
 * Temporal smoothing for per-nail masks so polish does not flicker frame to frame.
 * Works on low-resolution float masks (0..1) per nail; runs on the CPU in a few microseconds
 * per nail at 64×64.
 */
export interface NailMaskFrame {
  /** Stable id per finger (thumb…pinky) per hand. */
  id: string;
  /** Row-major float mask 0..1 of size w*h in the nail's crop space. */
  data: Float32Array;
  w: number;
  h: number;
  /** Crop rectangle in normalised video coords. */
  rect: { x: number; y: number; w: number; h: number };
  /** Nail axis (unit vector) in video space for lighting. */
  axis: { x: number; y: number };
}

export interface SmootherOptions {
  /** EMA weight for the new frame (0..1). Lower = smoother, laggier. */
  alpha?: number;
  /** Frames a nail may be missing before it is dropped. */
  holdFrames?: number;
  /** Max normalised rect movement per frame before we snap instead of interpolating. */
  snapDistance?: number;
}

interface State {
  frame: NailMaskFrame;
  missing: number;
}

export class MaskSmoother {
  private readonly alpha: number;
  private readonly hold: number;
  private readonly snap: number;
  private state = new Map<string, State>();

  constructor(opts: SmootherOptions = {}) {
    this.alpha = opts.alpha ?? 0.45;
    this.hold = opts.holdFrames ?? 3;
    this.snap = opts.snapDistance ?? 0.08;
  }

  reset() {
    this.state.clear();
  }

  /** Feeds a new set of detections and returns the smoothed set (including held nails). */
  update(frames: NailMaskFrame[]): NailMaskFrame[] {
    const seen = new Set<string>();
    for (const f of frames) {
      seen.add(f.id);
      const prev = this.state.get(f.id);
      if (!prev || prev.frame.w !== f.w || prev.frame.h !== f.h) {
        this.state.set(f.id, { frame: cloneFrame(f), missing: 0 });
        continue;
      }
      const p = prev.frame;
      const moved = Math.hypot(p.rect.x - f.rect.x, p.rect.y - f.rect.y);
      const a = moved > this.snap ? 1 : this.alpha;
      // Interpolate rect + axis
      p.rect = {
        x: lerp(p.rect.x, f.rect.x, a),
        y: lerp(p.rect.y, f.rect.y, a),
        w: lerp(p.rect.w, f.rect.w, a),
        h: lerp(p.rect.h, f.rect.h, a),
      };
      const ax = lerp(p.axis.x, f.axis.x, a);
      const ay = lerp(p.axis.y, f.axis.y, a);
      const l = Math.hypot(ax, ay) || 1;
      p.axis = { x: ax / l, y: ay / l };
      // EMA on mask values, then a soft threshold with hysteresis to kill speckle
      const d = p.data;
      const n = f.data;
      for (let i = 0; i < d.length; i++) {
        const v = d[i] + (n[i] - d[i]) * a;
        d[i] = v < 0.15 ? 0 : v > 0.85 ? 1 : v;
      }
      prev.missing = 0;
    }
    // Age out nails that vanished
    for (const [id, st] of this.state) {
      if (!seen.has(id)) {
        st.missing++;
        if (st.missing > this.hold) this.state.delete(id);
        else fade(st.frame.data, 0.75);
      }
    }
    return [...this.state.values()].map((s) => s.frame);
  }
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function fade(d: Float32Array, k: number) {
  for (let i = 0; i < d.length; i++) d[i] *= k;
}
function cloneFrame(f: NailMaskFrame): NailMaskFrame {
  return { ...f, rect: { ...f.rect }, axis: { ...f.axis }, data: new Float32Array(f.data) };
}
