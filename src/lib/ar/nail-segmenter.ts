"use client";

import type { InferenceSession, Tensor } from "onnxruntime-web";
import { estimateNails, polygonBounds, type NailShape, type NailLength, type Polygon } from "./nail-geometry";
import type { DetectedHand } from "./hand-tracker";
import type { NailMaskFrame } from "./mask-smoother";

export type SegmenterBackend = "webgpu" | "wasm" | "geometric";

export interface SegmenterOptions {
  /** Crop resolution fed to the model (square). 96 keeps 5 nails/frame under ~6ms on WebGPU. */
  cropSize?: number;
  /** Model URL; when unreachable the geometric estimator is used. */
  modelUrl?: string;
  /** Padding around the estimated nail polygon when cropping (fraction of nail size). */
  pad?: number;
}

/**
 * Produces one low-res mask per nail per frame.
 *  1. Geometric prior from landmarks (always available) → crop rectangle per nail.
 *  2. If the ONNX model loaded, refine each crop with the segmentation network (WebGPU → WASM).
 *  3. Otherwise rasterise the prior polygon with soft edges.
 */
export class NailSegmenter {
  readonly backend: SegmenterBackend;
  private readonly session: InferenceSession | null;
  private readonly ort: typeof import("onnxruntime-web") | null;
  private readonly size: number;
  private readonly pad: number;
  private readonly cropCanvas: OffscreenCanvas | HTMLCanvasElement;
  private readonly cropCtx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  private inputName = "input";
  private outputName = "output";

  private constructor(
    backend: SegmenterBackend,
    session: InferenceSession | null,
    ort: typeof import("onnxruntime-web") | null,
    opts: Required<Pick<SegmenterOptions, "cropSize" | "pad">>,
  ) {
    this.backend = backend;
    this.session = session;
    this.ort = ort;
    this.size = opts.cropSize;
    this.pad = opts.pad;
    this.cropCanvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(this.size, this.size)
        : document.createElement("canvas");
    this.cropCanvas.width = this.size;
    this.cropCanvas.height = this.size;
    this.cropCtx = this.cropCanvas.getContext("2d", {
      willReadFrequently: true,
    }) as OffscreenCanvasRenderingContext2D;
    if (session) {
      this.inputName = session.inputNames[0] ?? "input";
      this.outputName = session.outputNames[0] ?? "output";
    }
  }

  static async create(opts: SegmenterOptions = {}): Promise<NailSegmenter> {
    const size = opts.cropSize ?? 96;
    const pad = opts.pad ?? 0.35;
    const modelUrl = opts.modelUrl ?? "/models/nail-seg.onnx";

    // Probe the model file before pulling ORT (~1MB) into the page.
    let available = false;
    try {
      const head = await fetch(modelUrl, { method: "HEAD" });
      available = head.ok && (head.headers.get("content-type") ?? "").includes("octet");
    } catch {
      available = false;
    }
    if (!available) return new NailSegmenter("geometric", null, null, { cropSize: size, pad });

    try {
      const hasWebGPU = typeof navigator !== "undefined" && "gpu" in navigator;
      const ort = hasWebGPU ? await import("onnxruntime-web/webgpu") : await import("onnxruntime-web");
      ort.env.wasm.wasmPaths = "/models/ort/";
      ort.env.wasm.numThreads = Math.min(4, navigator.hardwareConcurrency ?? 2);
      const providers: string[] = hasWebGPU ? ["webgpu", "wasm"] : ["wasm"];
      let session: InferenceSession | null = null;
      let backend: SegmenterBackend = "wasm";
      for (const ep of providers) {
        try {
          session = await ort.InferenceSession.create(modelUrl, {
            executionProviders: [ep],
            graphOptimizationLevel: "all",
          });
          backend = ep as SegmenterBackend;
          break;
        } catch {
          session = null;
        }
      }
      if (!session) return new NailSegmenter("geometric", null, null, { cropSize: size, pad });
      return new NailSegmenter(backend, session, ort as typeof import("onnxruntime-web"), {
        cropSize: size,
        pad,
      });
    } catch {
      return new NailSegmenter("geometric", null, null, { cropSize: size, pad });
    }
  }

  /**
   * @param source current video frame (or image)
   * @param hands MediaPipe detections for this frame
   * @param aspect source width / height
   */
  async segment(
    source: CanvasImageSource & { width?: number; height?: number },
    hands: DetectedHand[],
    aspect: number,
    style: { shape?: NailShape | null; length?: NailLength | null } = {},
  ): Promise<NailMaskFrame[]> {
    const frames: NailMaskFrame[] = [];
    const crops: { frame: NailMaskFrame; polygon: Polygon }[] = [];

    for (const hand of hands) {
      const nails = estimateNails(hand.landmarks, { ...style, aspect });
      for (const n of nails) {
        if (n.confidence < 0.4) continue;
        const b = polygonBounds(n.polygon);
        const padX = b.width * this.pad,
          padY = b.height * this.pad;
        const rect = {
          x: Math.max(0, b.minX - padX),
          y: Math.max(0, b.minY - padY),
          w: Math.min(1, b.maxX + padX) - Math.max(0, b.minX - padX),
          h: Math.min(1, b.maxY + padY) - Math.max(0, b.minY - padY),
        };
        if (rect.w <= 0 || rect.h <= 0) continue;
        const frame: NailMaskFrame = {
          id: `${hand.handedness}:${n.finger}`,
          data: new Float32Array(this.size * this.size),
          w: this.size,
          h: this.size,
          rect,
          axis: n.axis,
        };
        crops.push({ frame, polygon: n.polygon });
        frames.push(frame);
      }
    }

    if (!crops.length) return frames;

    if (this.session && this.ort) {
      await this.runModel(source, crops);
    } else {
      for (const c of crops) rasterizePrior(c.frame, c.polygon);
    }
    return frames;
  }

  private async runModel(source: CanvasImageSource, crops: { frame: NailMaskFrame; polygon: Polygon }[]) {
    const ort = this.ort!;
    const S = this.size;
    const sw = (source as HTMLVideoElement).videoWidth ?? (source as HTMLCanvasElement).width ?? 1;
    const sh = (source as HTMLVideoElement).videoHeight ?? (source as HTMLCanvasElement).height ?? 1;
    const batch = new Float32Array(crops.length * 3 * S * S);

    crops.forEach(({ frame }, bi) => {
      const r = frame.rect;
      this.cropCtx.drawImage(source, r.x * sw, r.y * sh, r.w * sw, r.h * sh, 0, 0, S, S);
      const px = this.cropCtx.getImageData(0, 0, S, S).data;
      const off = bi * 3 * S * S;
      for (let i = 0; i < S * S; i++) {
        batch[off + i] = (px[i * 4] / 255 - 0.485) / 0.229;
        batch[off + S * S + i] = (px[i * 4 + 1] / 255 - 0.456) / 0.224;
        batch[off + 2 * S * S + i] = (px[i * 4 + 2] / 255 - 0.406) / 0.225;
      }
    });

    let output: Tensor;
    try {
      const input = new ort.Tensor("float32", batch, [crops.length, 3, S, S]);
      const result = await this.session!.run({ [this.inputName]: input });
      output = result[this.outputName];
    } catch {
      // Model may not support dynamic batch: run one by one.
      for (let bi = 0; bi < crops.length; bi++) {
        const single = batch.subarray(bi * 3 * S * S, (bi + 1) * 3 * S * S);
        const input = new ort.Tensor("float32", single, [1, 3, S, S]);
        const result = await this.session!.run({ [this.inputName]: input });
        writeMask(crops[bi], result[this.outputName].data as Float32Array, 0, S);
      }
      return;
    }
    const data = output.data as Float32Array;
    crops.forEach((c, bi) => writeMask(c, data, bi * S * S, S));
  }

  dispose() {
    void this.session?.release();
  }
}

/** Writes sigmoid(logits) ∧ prior polygon (dilated) so predictions never bleed onto skin far from the nail. */
function writeMask(
  crop: { frame: NailMaskFrame; polygon: Polygon },
  data: Float32Array,
  offset: number,
  S: number,
) {
  const { frame, polygon } = crop;
  const prior = new Float32Array(S * S);
  rasterizePolygon(prior, S, polygon, frame.rect, 0.25);
  for (let i = 0; i < S * S; i++) {
    const v = data[offset + i];
    const p = v > 1 || v < 0 ? 1 / (1 + Math.exp(-v)) : v; // accept logits or probabilities
    frame.data[i] = p * Math.min(1, prior[i] * 1.6);
  }
}

/** Fallback: soft-edged rasterisation of the geometric prior. */
function rasterizePrior(frame: NailMaskFrame, polygon: Polygon) {
  rasterizePolygon(frame.data, frame.w, polygon, frame.rect, 0.08);
}

/**
 * Scanline point-in-polygon with a soft edge. `feather` is the edge softness as a fraction of
 * the crop size. Coordinates: polygon in normalised video space, rect defines the crop.
 */
function rasterizePolygon(
  out: Float32Array,
  S: number,
  polygon: Polygon,
  rect: NailMaskFrame["rect"],
  feather: number,
) {
  // Convert polygon into crop pixel space
  const pts = polygon.map(
    ([x, y]) => [((x - rect.x) / rect.w) * S, ((y - rect.y) / rect.h) * S] as [number, number],
  );
  const f = Math.max(0.5, feather * S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const px = x + 0.5,
        py = y + 0.5;
      const d = signedDistance(pts, px, py); // negative inside
      out[y * S + x] = clamp01(0.5 - d / f);
    }
  }
}

function signedDistance(poly: [number, number][], px: number, py: number) {
  let inside = false;
  let minD = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i],
      [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    // distance to segment
    const dx = xj - xi,
      dy = yj - yi;
    const t = clamp01(((px - xi) * dx + (py - yi) * dy) / (dx * dx + dy * dy || 1));
    const ex = xi + t * dx - px,
      ey = yi + t * dy - py;
    const d = Math.hypot(ex, ey);
    if (d < minD) minD = d;
  }
  return inside ? -minD : minD;
}

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
