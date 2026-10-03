/**
 * Fetches / copies the browser ML assets into public/ so they are served same-origin
 * (required for cross-origin isolation + WebGPU/WASM threads):
 *   - MediaPipe Hand Landmarker task + WASM runtime
 *   - ONNX Runtime Web WASM/JSEP binaries
 *   - Nail segmentation ONNX model (NAIL_SEG_MODEL_URL) — optional; when absent the AR pipeline
 *     uses the landmark-geometric nail estimator (see src/lib/ar/nail-geometry.ts).
 * Run: pnpm models:download
 */
import { mkdir, copyFile, readdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";

const pub = path.resolve("public");
// Resolved directly: both packages restrict `exports`, so require.resolve("<pkg>/package.json") throws.
const nodeModules = path.resolve("node_modules");

const HAND_LANDMARKER_URL =
  process.env.HAND_LANDMARKER_URL ??
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const NAIL_SEG_MODEL_URL = process.env.NAIL_SEG_MODEL_URL;

async function exists(p: string) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function download(url: string, dest: string) {
  if (await exists(dest)) {
    console.log("exists ", path.relative(pub, dest));
    return;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  console.log("fetched", path.relative(pub, dest));
}

async function copyDir(from: string, to: string, filter: (f: string) => boolean) {
  await mkdir(to, { recursive: true });
  for (const f of await readdir(from)) {
    if (!filter(f)) continue;
    await copyFile(path.join(from, f), path.join(to, f));
  }
}

async function main() {
  await mkdir(path.join(pub, "models"), { recursive: true });

  await download(HAND_LANDMARKER_URL, path.join(pub, "models", "hand_landmarker.task"));

  const mpWasm = path.join(nodeModules, "@mediapipe", "tasks-vision", "wasm");
  await copyDir(mpWasm, path.join(pub, "models", "mediapipe"), (f) => /\.(wasm|js)$/.test(f));
  console.log("copied MediaPipe wasm runtime");

  const ortDist = path.join(nodeModules, "onnxruntime-web", "dist");
  await copyDir(ortDist, path.join(pub, "models", "ort"), (f) => /^ort-wasm.*\.(wasm|mjs)$/.test(f));
  console.log("copied ONNX Runtime Web binaries");

  if (NAIL_SEG_MODEL_URL) {
    await download(NAIL_SEG_MODEL_URL, path.join(pub, "models", "nail-seg.onnx"));
  } else if (!(await exists(path.join(pub, "models", "nail-seg.onnx")))) {
    console.log(
      "note: NAIL_SEG_MODEL_URL not set — public/models/nail-seg.onnx absent; AR uses the landmark-geometric estimator.",
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
