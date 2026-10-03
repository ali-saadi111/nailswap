"use client";

import * as THREE from "three";
import type { NailMaskFrame } from "./mask-smoother";

export type Finish = "glossy" | "matte" | "chrome" | "cat_eye" | "glitter" | "shimmer" | "french_tip";

const FINISH_ID: Record<Finish, number> = {
  glossy: 0,
  matte: 1,
  chrome: 2,
  cat_eye: 3,
  glitter: 4,
  shimmer: 5,
  french_tip: 6,
};

export interface PolishStyle {
  color: string; // #rrggbb
  finish: Finish;
  /** Secondary colour (french tip, cat-eye streak); defaults derived from `color`. */
  accent?: string;
  /** 0..1 coverage opacity (1 = opaque gel). */
  opacity?: number;
}

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D uVideo;
uniform sampler2D uMask;      // r: coverage, g: along-axis 0..1 (base→tip), b: across-axis 0..1
uniform vec2 uMaskTexel;
uniform vec3 uColor;
uniform vec3 uAccent;
uniform int uFinish;
uniform float uOpacity;
uniform vec3 uLightDir;
uniform float uLightIntensity;
uniform float uTime;
uniform float uMirror;        // 1 = mirror horizontally (front camera)

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

vec3 nailNormal(vec2 uv, float m) {
  // Surface normal from the coverage gradient: edges curve away from the camera like a real nail.
  float l = texture2D(uMask, uv - vec2(uMaskTexel.x, 0.0)).r;
  float r = texture2D(uMask, uv + vec2(uMaskTexel.x, 0.0)).r;
  float d = texture2D(uMask, uv - vec2(0.0, uMaskTexel.y)).r;
  float u = texture2D(uMask, uv + vec2(0.0, uMaskTexel.y)).r;
  vec2 grad = vec2(r - l, u - d);
  // Inside the nail the gradient is ~0 → flat, facing camera; add a gentle dome from the across axis.
  float across = texture2D(uMask, uv).b * 2.0 - 1.0;
  vec3 n = normalize(vec3(grad * 2.5 + vec2(across * 0.55, 0.0), 1.0));
  return n;
}

void main() {
  vec2 uv = vec2(uMirror > 0.5 ? 1.0 - vUv.x : vUv.x, vUv.y);
  vec3 video = texture2D(uVideo, uv).rgb;
  vec4 mk = texture2D(uMask, uv);
  float m = smoothstep(0.35, 0.65, mk.r) * uOpacity;
  if (m <= 0.002) { gl_FragColor = vec4(video, 1.0); return; }

  float lum = dot(video, vec3(0.299, 0.587, 0.114));
  vec3 n = nailNormal(uv, mk.r);
  vec3 L = normalize(uLightDir);
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 H = normalize(L + V);
  float ndl = max(dot(n, L), 0.0);
  float ndh = max(dot(n, H), 0.0);
  float along = mk.g;   // 0 base → 1 tip
  float across = mk.b;  // 0..1

  vec3 base = uColor;
  float rough = 0.25;
  float specStrength = 0.9;
  float metallic = 0.0;

  if (uFinish == 1) { rough = 0.85; specStrength = 0.12; }             // matte
  if (uFinish == 2) { rough = 0.08; specStrength = 1.4; metallic = 1.0; } // chrome
  if (uFinish == 5) { rough = 0.35; specStrength = 0.7; }              // shimmer
  if (uFinish == 6) {                                                  // french tip
    float tip = smoothstep(0.62, 0.70, along);
    base = mix(uColor, uAccent, tip);
  }

  // Keep the photo's shading: real shadows and ambient occlusion survive under the polish.
  float shade = 0.55 + 0.9 * lum;
  vec3 col = base * shade * mix(1.0, ndl * 0.6 + 0.6, 0.5);

  if (metallic > 0.5) {
    // Fake environment: vertical sky→ground gradient reflected by the normal, tinted by the colour.
    float env = clamp(0.5 + n.y * 0.9 + n.x * 0.3, 0.0, 1.0);
    vec3 envCol = mix(vec3(0.15), vec3(1.0), pow(env, 1.4));
    col = mix(col, base * envCol * 1.3, 0.85);
  }

  // Cat-eye: bright magnetic streak running along the nail axis, shifting with the light.
  if (uFinish == 3) {
    float streak = exp(-pow((across - 0.5 - L.x * 0.18) * 6.5, 2.0));
    col += uAccent * streak * 0.9 * uLightIntensity;
  }

  // Glitter / shimmer sparkle: hashed micro-facets that pop in and out as the hand moves.
  if (uFinish == 4 || uFinish == 5) {
    vec2 cell = floor(uv * (uFinish == 4 ? 900.0 : 1400.0));
    float h = hash(cell + floor(uTime * (uFinish == 4 ? 6.0 : 3.0)) * 0.01);
    float sparkle = step(uFinish == 4 ? 0.955 : 0.985, h) * pow(ndh, 8.0);
    col += vec3(1.0) * sparkle * (uFinish == 4 ? 1.6 : 0.9);
    if (uFinish == 4) col += base * 0.12 * hash(cell * 1.7);
  }

  // Specular highlight follows nail curvature (normal) and the estimated light.
  float spec = pow(ndh, mix(120.0, 6.0, rough)) * specStrength * uLightIntensity;
  // Highlight strip near the cuticle-side dome like on real gel nails
  float domeHi = exp(-pow((across - 0.38) * 5.0, 2.0)) * exp(-pow((along - 0.35) * 2.2, 2.0)) * (1.0 - rough) * 0.35;
  col += vec3(1.0) * (spec + domeHi);

  // Fresnel rim for gloss so edges read as a thick coat
  float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0) * (1.0 - rough) * 0.25;
  col += vec3(rim);

  gl_FragColor = vec4(mix(video, col, m), 1.0);
}`;

/**
 * Renders the camera frame with polish composited onto the nail masks using a single
 * full-screen pass. The mask texture is composed on the CPU at low resolution (fast) and the GPU
 * handles shading at display resolution.
 */
export class NailRenderer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private material: THREE.ShaderMaterial;
  private videoTex: THREE.VideoTexture | THREE.CanvasTexture | null = null;
  private maskCanvas: HTMLCanvasElement;
  private maskCtx: CanvasRenderingContext2D;
  private maskTex: THREE.CanvasTexture;
  private nailCanvas: HTMLCanvasElement;
  private nailCtx: CanvasRenderingContext2D;
  private start = performance.now();
  readonly maskWidth: number;
  readonly maskHeight: number;

  constructor(canvas: HTMLCanvasElement, opts: { maskResolution?: number } = {}) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const res = opts.maskResolution ?? 384;
    this.maskWidth = res;
    this.maskHeight = res;
    this.maskCanvas = document.createElement("canvas");
    this.maskCanvas.width = res;
    this.maskCanvas.height = res;
    this.maskCtx = this.maskCanvas.getContext("2d")!;
    this.nailCanvas = document.createElement("canvas");
    this.nailCtx = this.nailCanvas.getContext("2d")!;
    this.maskTex = new THREE.CanvasTexture(this.maskCanvas);
    this.maskTex.minFilter = THREE.LinearFilter;
    this.maskTex.magFilter = THREE.LinearFilter;
    this.maskTex.generateMipmaps = false;
    this.maskTex.colorSpace = THREE.NoColorSpace;

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uVideo: { value: null },
        uMask: { value: this.maskTex },
        uMaskTexel: { value: new THREE.Vector2(1 / res, 1 / res) },
        uColor: { value: new THREE.Color("#c2185b") },
        uAccent: { value: new THREE.Color("#ffffff") },
        uFinish: { value: 0 },
        uOpacity: { value: 1 },
        uLightDir: { value: new THREE.Vector3(-0.4, -0.7, 0.6) },
        uLightIntensity: { value: 1 },
        uTime: { value: 0 },
        uMirror: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.scene.add(quad);
  }

  setSource(video: HTMLVideoElement | HTMLCanvasElement) {
    this.videoTex?.dispose();
    this.videoTex =
      video instanceof HTMLVideoElement ? new THREE.VideoTexture(video) : new THREE.CanvasTexture(video);
    this.videoTex.colorSpace = THREE.SRGBColorSpace;
    this.videoTex.minFilter = THREE.LinearFilter;
    this.videoTex.magFilter = THREE.LinearFilter;
    this.videoTex.generateMipmaps = false;
    this.videoTex.flipY = true;
    this.material.uniforms.uVideo.value = this.videoTex;
  }

  setSize(width: number, height: number) {
    this.renderer.setSize(width, height, false);
  }

  setMirror(mirror: boolean) {
    this.material.uniforms.uMirror.value = mirror ? 1 : 0;
  }

  setStyle(style: PolishStyle) {
    const u = this.material.uniforms;
    (u.uColor.value as THREE.Color).set(style.color);
    const accent = style.accent ?? (style.finish === "french_tip" ? "#ffffff" : lighten(style.color, 0.55));
    (u.uAccent.value as THREE.Color).set(accent);
    u.uFinish.value = FINISH_ID[style.finish];
    u.uOpacity.value = style.opacity ?? 1;
  }

  setLight(direction: { x: number; y: number; z: number }, intensity: number) {
    (this.material.uniforms.uLightDir.value as THREE.Vector3).set(direction.x, -direction.y, direction.z);
    this.material.uniforms.uLightIntensity.value = intensity;
  }

  /** Composes per-nail low-res masks into the full-frame mask texture (r=cover, g=along, b=across). */
  updateMasks(frames: NailMaskFrame[]) {
    const W = this.maskWidth,
      H = this.maskHeight;
    const ctx = this.maskCtx;
    ctx.clearRect(0, 0, W, H);
    for (const f of frames) {
      if (this.nailCanvas.width !== f.w || this.nailCanvas.height !== f.h) {
        this.nailCanvas.width = f.w;
        this.nailCanvas.height = f.h;
      }
      const img = this.nailCtx.createImageData(f.w, f.h);
      const d = img.data;
      const ax = f.axis.x,
        ay = f.axis.y;
      // Project each crop pixel onto the nail axis to get along/across coordinates.
      const cx = 0.5,
        cy = 0.5;
      for (let y = 0; y < f.h; y++) {
        for (let x = 0; x < f.w; x++) {
          const i = y * f.w + x;
          const cover = f.data[i];
          const px = (x + 0.5) / f.w - cx;
          const py = (y + 0.5) / f.h - cy;
          // Video space is not square: scale by rect aspect so the axis projection is metric.
          const vx = px * f.rect.w,
            vy = py * f.rect.h;
          const along = (vx * ax + vy * ay) / (Math.hypot(f.rect.w * ax, f.rect.h * ay) || 1); // ≈ -0.5..0.5
          const across = (vx * -ay + vy * ax) / (Math.hypot(f.rect.w * -ay, f.rect.h * ax) || 1);
          const o = i * 4;
          d[o] = Math.round(cover * 255);
          d[o + 1] = Math.round(clamp01(along + 0.5) * 255);
          d[o + 2] = Math.round(clamp01(across + 0.5) * 255);
          d[o + 3] = 255;
        }
      }
      this.nailCtx.putImageData(img, 0, 0);
      // Draw with "lighter" so overlapping crops (adjacent fingers) don't erase each other's coverage.
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(this.nailCanvas, 0, 0, f.w, f.h, f.rect.x * W, f.rect.y * H, f.rect.w * W, f.rect.h * H);
    }
    ctx.globalCompositeOperation = "source-over";
    this.maskTex.needsUpdate = true;
  }

  render() {
    this.material.uniforms.uTime.value = (performance.now() - this.start) / 1000;
    if (this.videoTex instanceof THREE.CanvasTexture) this.videoTex.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }

  /** Captures the current composited frame as a Blob. */
  capture(type = "image/jpeg", quality = 0.92): Promise<Blob> {
    this.render();
    return new Promise((resolve, reject) => {
      this.renderer.domElement.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("capture failed"))),
        type,
        quality,
      );
    });
  }

  dispose() {
    this.videoTex?.dispose();
    this.maskTex.dispose();
    this.material.dispose();
    this.renderer.dispose();
  }
}

function clamp01(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function lighten(hex: string, amt: number) {
  const c = new THREE.Color(hex);
  c.lerp(new THREE.Color("#ffffff"), amt);
  return `#${c.getHexString()}`;
}
