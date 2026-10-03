"use client";

/**
 * Estimates the dominant light direction and intensity from the video frame by finding the
 * luminance centroid of a tiny downsampled copy. Cheap (16×16 samples) and stable enough to
 * anchor specular highlights on the correct side of each nail.
 */
export class LightEstimator {
  private readonly canvas: OffscreenCanvas | HTMLCanvasElement;
  private readonly ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
  private dir = { x: -0.4, y: -0.7, z: 0.6 };
  private intensity = 1;
  private readonly N = 16;

  constructor() {
    this.canvas =
      typeof OffscreenCanvas !== "undefined"
        ? new OffscreenCanvas(this.N, this.N)
        : document.createElement("canvas");
    this.canvas.width = this.N;
    this.canvas.height = this.N;
    this.ctx = this.canvas.getContext("2d", {
      willReadFrequently: true,
    }) as OffscreenCanvasRenderingContext2D;
  }

  update(source: CanvasImageSource) {
    const N = this.N;
    this.ctx.drawImage(source, 0, 0, N, N);
    const px = this.ctx.getImageData(0, 0, N, N).data;
    let sum = 0,
      sx = 0,
      sy = 0,
      max = 0;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const i = (y * N + x) * 4;
        const l = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        const w = l * l; // emphasise bright regions
        sum += w;
        sx += (x / (N - 1) - 0.5) * w;
        sy += (y / (N - 1) - 0.5) * w;
        if (l > max) max = l;
      }
    }
    if (sum > 0) {
      const cx = sx / sum,
        cy = sy / sum; // -0.5..0.5, where light comes from
      // Light vector points from surface toward the light: use centroid offset, tilt toward camera.
      const tx = cx * 2,
        ty = cy * 2,
        tz = 0.75;
      const l = Math.hypot(tx, ty, tz) || 1;
      // Smooth to avoid jitter
      this.dir.x += (tx / l - this.dir.x) * 0.1;
      this.dir.y += (ty / l - this.dir.y) * 0.1;
      this.dir.z += (tz / l - this.dir.z) * 0.1;
      this.intensity += (Math.min(1.4, Math.max(0.6, max / 200)) - this.intensity) * 0.1;
    }
    return { direction: { ...this.dir }, intensity: this.intensity };
  }
}
