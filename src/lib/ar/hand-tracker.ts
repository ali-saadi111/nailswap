"use client";

import type { HandLandmarker, HandLandmarkerResult } from "@mediapipe/tasks-vision";
import type { Landmarks } from "./nail-geometry";

export interface DetectedHand {
  landmarks: Landmarks;
  handedness: "Left" | "Right";
  score: number;
}

export interface HandTrackerOptions {
  mode: "VIDEO" | "IMAGE";
  numHands?: number;
  /** Prefer the GPU delegate (falls back to CPU automatically). */
  gpu?: boolean;
}

const WASM_PATH = "/models/mediapipe";
const MODEL_PATH = "/models/hand_landmarker.task";

let visionModule: typeof import("@mediapipe/tasks-vision") | null = null;

async function loadVision() {
  if (!visionModule) visionModule = await import("@mediapipe/tasks-vision");
  return visionModule;
}

function toHands(result: HandLandmarkerResult): DetectedHand[] {
  return result.landmarks.map((lm, i) => {
    const cat = result.handedness[i]?.[0];
    return {
      landmarks: lm.map((p) => ({ x: p.x, y: p.y, z: p.z })),
      handedness: (cat?.categoryName === "Left" ? "Left" : "Right") as "Left" | "Right",
      score: cat?.score ?? 0,
    };
  });
}

/**
 * Thin wrapper around MediaPipe HandLandmarker. Assets are served same-origin from /models
 * (see scripts/download-models.ts).
 */
export class HandTracker {
  private landmarker: HandLandmarker | null = null;
  private lastTs = -1;
  readonly delegate: "GPU" | "CPU";

  private constructor(landmarker: HandLandmarker, delegate: "GPU" | "CPU") {
    this.landmarker = landmarker;
    this.delegate = delegate;
  }

  static async create(opts: HandTrackerOptions): Promise<HandTracker> {
    const { FilesetResolver, HandLandmarker } = await loadVision();
    const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
    const base = {
      runningMode: opts.mode,
      numHands: opts.numHands ?? 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    } as const;
    if (opts.gpu !== false) {
      try {
        const lm = await HandLandmarker.createFromOptions(fileset, {
          ...base,
          baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" },
        });
        return new HandTracker(lm, "GPU");
      } catch {
        // fall through to CPU
      }
    }
    const lm = await HandLandmarker.createFromOptions(fileset, {
      ...base,
      baseOptions: { modelAssetPath: MODEL_PATH, delegate: "CPU" },
    });
    return new HandTracker(lm, "CPU");
  }

  detectVideo(video: HTMLVideoElement, timestampMs: number): DetectedHand[] {
    if (!this.landmarker) return [];
    // MediaPipe requires strictly increasing timestamps.
    const ts = timestampMs <= this.lastTs ? this.lastTs + 1 : timestampMs;
    this.lastTs = ts;
    return toHands(this.landmarker.detectForVideo(video, ts));
  }

  detectImage(image: HTMLImageElement | HTMLCanvasElement | ImageBitmap): DetectedHand[] {
    if (!this.landmarker) return [];
    return toHands(this.landmarker.detect(image));
  }

  close() {
    this.landmarker?.close();
    this.landmarker = null;
  }
}

/** Quick capability probe: camera + WebGL2 + enough cores. Used to decide AR vs photo fallback. */
export function arSupported(): { ok: boolean; reason?: string } {
  if (typeof window === "undefined") return { ok: false, reason: "ssr" };
  if (!navigator.mediaDevices?.getUserMedia) return { ok: false, reason: "no_camera_api" };
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2");
  if (!gl) return { ok: false, reason: "no_webgl2" };
  if (typeof WebAssembly === "undefined") return { ok: false, reason: "no_wasm" };
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (cores < 2 || (mem !== undefined && mem < 2)) return { ok: false, reason: "low_end_device" };
  return { ok: true };
}
