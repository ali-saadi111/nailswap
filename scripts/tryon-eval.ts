/**
 * Side-by-side quality check for the AI photo try-on models, using the same prompt the worker sends.
 *
 *   pnpm tryon:eval --hand ./my-hand.jpg --design classic-french
 *   pnpm tryon:eval --hand ./my-hand.jpg --design treasure-map --models fal-ai/nano-banana-pro/edit
 *
 * --design is a slug from scripts/assets/designs (its first photo is the reference image).
 * --reference accepts a local design photo. --resolution selects Nano Banana's 1K/2K/4K tier.
 * Defaults to one Nano Banana 2 image at 1K. Results land in tryon-eval/<timestamp>/ with PNGs,
 * input photos, prompt, queue receipts, estimated costs and timings.json.
 * Needs FAL_KEY in .env.local. Each image is billed by fal.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import sharp from "sharp";
import { buildEditPrompt } from "../src/lib/ai/prompt";
import { buildEditInput, DEFAULT_EDIT_MODEL, estimateEditCost } from "../src/lib/ai/edit-input";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

const DEFAULT_MODELS = [DEFAULT_EDIT_MODEL];
const resolution = process.argv.includes("--resolution")
  ? process.argv[process.argv.indexOf("--resolution") + 1]
  : (process.env.FAL_EDIT_RESOLUTION ?? "1K");

function arg(name: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function dataUri(file: string, maxSide: number) {
  const jpeg = await sharp(readFileSync(file))
    .rotate()
    .resize(maxSide, maxSide, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
}

async function fal<T>(url: string, init: RequestInit = {}, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    ...init,
    signal,
    headers: { Authorization: `Key ${process.env.FAL_KEY}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`fal ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}

async function run(model: string, input: Record<string, unknown>, outputDir: string) {
  const signal = AbortSignal.timeout(180_000);
  const submit = await fal<{ status_url: string; response_url: string }>(
    `https://queue.fal.run/${model}`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    signal,
  );
  // Save the receipt immediately so a timeout can be inspected without paying for a rerun.
  writeFileSync(
    path.join(outputDir, `${model.replaceAll("/", "_")}-receipt.json`),
    JSON.stringify(submit, null, 2),
  );
  for (;;) {
    const st = await fal<{ status: string }>(submit.status_url, {}, signal);
    if (st.status === "COMPLETED") break;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return fal<{ images: { url: string }[]; seed?: number }>(submit.response_url, {}, signal);
}

async function main() {
  if (!process.env.FAL_KEY) throw new Error("Set FAL_KEY in .env.local");
  const hand = arg("hand");
  if (!hand || !existsSync(hand)) throw new Error("Pass --hand <path to a hand photo>");
  const slug = arg("design");
  const models = arg("models")?.split(",") ?? DEFAULT_MODELS;
  if (!["1K", "2K", "4K"].includes(resolution)) throw new Error("Resolution must be 1K, 2K or 4K");

  let referenceImage: string | undefined;
  if (arg("reference")) referenceImage = await dataUri(arg("reference")!, 1536);
  if (slug) {
    const dir = path.join("scripts", "assets", "designs");
    const credits = JSON.parse(readFileSync(path.join(dir, "credits.json"), "utf8")) as Record<
      string,
      { file: string }[]
    >;
    const file = credits[slug]?.[0]?.file;
    if (!file) throw new Error(`No photo for design "${slug}" — run pnpm designs:fetch`);
    referenceImage = await dataUri(path.join(dir, file), 1536);
  }

  const prompt = buildEditPrompt(
    { mode: "catalog", variations: 1, art: arg("art") },
    null,
    Boolean(referenceImage),
  );
  const handImage = await dataUri(hand, 2048);
  if (!referenceImage && !arg("art"))
    throw new Error("Pass --design, --reference or --art to specify the manicure");
  // Validate every model before making any paid call.
  const inputs = models.map((model) =>
    buildEditInput(model, { prompt, handImage, referenceImage, numImages: 1, seed: 42 }, resolution),
  );
  const out = path.join("tryon-eval", new Date().toISOString().replace(/[:.]/g, "-"));
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, "prompt.txt"), prompt + "\n");
  writeFileSync(path.join(out, "original.jpg"), Buffer.from(handImage.split(",")[1], "base64"));
  if (referenceImage)
    writeFileSync(path.join(out, "reference.jpg"), Buffer.from(referenceImage.split(",")[1], "base64"));
  const estimates = Object.fromEntries(
    models.map((model) => [
      model,
      estimateEditCost(model, resolution, 1, Number(process.env.AI_COST_FAL_EDIT_USD ?? 0.08)),
    ]),
  );
  writeFileSync(
    path.join(out, "estimates.json"),
    JSON.stringify(
      { resolution, estimates, note: "Estimates only; check fal billing for actual charges." },
      null,
      2,
    ),
  );
  console.log("Estimated generation cost (USD):", estimates);

  const timings: Record<string, number | string> = {};
  await Promise.all(
    models.map(async (model, index) => {
      const started = Date.now();
      try {
        const res = await run(model, inputs[index], out);
        if (!res.images?.length) throw new Error("Provider returned no images");
        const downloaded = await fetch(res.images[0].url, { signal: AbortSignal.timeout(30_000) });
        if (!downloaded.ok) throw new Error(`Image download failed: ${downloaded.status}`);
        const img = await sharp(Buffer.from(await downloaded.arrayBuffer()))
          .png()
          .toBuffer();
        writeFileSync(path.join(out, `${model.replace(/[/]/g, "_")}.png`), img);
        timings[model] = Date.now() - started;
        console.log(`✓ ${model} — ${((Date.now() - started) / 1000).toFixed(1)}s`);
      } catch (err) {
        process.exitCode = 1;
        timings[model] = String(err);
        console.log(`✗ ${model} — ${err}`);
      }
    }),
  );
  writeFileSync(path.join(out, "timings.json"), JSON.stringify(timings, null, 2) + "\n");
  console.log(`Results in ${out}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
