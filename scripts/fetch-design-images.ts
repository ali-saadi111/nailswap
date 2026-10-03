/**
 * Downloads openly licensed nail-art photos from Openverse (https://openverse.org — no API key)
 * for the demo designs in scripts/seed.ts, and stores them with attribution.
 *
 *   pnpm designs:fetch            (then `pnpm db:seed` picks them up)
 *   pnpm designs:fetch --force    (re-download everything)
 *
 * Output: scripts/assets/designs/<slug>-<n>.webp + credits.json. Only licences that allow
 * commercial use and modification are accepted (CC0, Public Domain Mark, CC BY, CC BY-SA);
 * BY / BY-SA require the attribution line stored in credits.json to be shown with the image.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const OUT_DIR = path.join(process.cwd(), "scripts", "assets", "designs");
const CREDITS_FILE = path.join(OUT_DIR, "credits.json");
const API = "https://api.openverse.org/v1/images/";
const LICENSES = "cc0,pdm,by,by-sa";
const PER_DESIGN = 3;
const UA = "NailSwap-seed/1.0 (demo data; https://openverse.org)";

/** Search terms per demo design slug, best first. Keep in sync with DESIGNS in seed.ts. */
const QUERIES: Record<string, string[]> = {
  "classic-french": ["french manicure", "french tip nails"],
  "retro-robot": ["robot nail art", "metallic nail art", "silver nail art", "glitter nail art"],
  "watermelon-pop": ["watermelon nail art", "fruit nail art", "summer nail art"],
  "pink-blossoms": ["flower nail art", "floral nails", "nail stamping", "nail art"],
  "candy-chevron": ["chevron nail art", "striped nail art", "red manicure"],
  "bridal-french": ["bridal nails", "wedding nails", "white nail art", "glitter nails"],
  "treasure-map": ["map nail art", "hand painted nail art", "nail art"],
  "gilded-cherry": ["red manicure", "gold nail art", "red nails"],
};

/** Openverse matches tags loosely, so the title must actually be about nails. */
const REQUIRE =
  /nail art|manicure|mani|nail polish|fingernail|shellac|gel nails|nail extensions|(bridal|chrome|ombre|ombré|french|red|white|nude|wedding|pink|flower|glitter|acrylic) nails/i;
/** Titles that are usually product shots or unrelated, not finished nails on a hand. */
const REJECT =
  /bottle|swatch|lacquer collection|haul|review|packag|toenail|pedicure|foot|feet|tool|kit|clipper|display case|salon sign|eyeshadow|nail file|clous|screw|removing|selection|art deco|scissors|set, manicure|lantern|cuticle/i;

export type Credit = {
  file: string;
  title: string;
  creator: string | null;
  license: string;
  licenseVersion: string | null;
  licenseUrl: string | null;
  sourceUrl: string;
  attribution: string;
};

type OpenverseImage = {
  id: string;
  title: string | null;
  url: string;
  creator: string | null;
  license: string;
  license_version: string | null;
  license_url: string | null;
  foreign_landing_url: string;
  attribution: string | null;
  width: number | null;
  height: number | null;
  mature: boolean;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function search(q: string): Promise<OpenverseImage[]> {
  const params = new URLSearchParams({
    q,
    license: LICENSES,
    page_size: "20",
    mature: "false",
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${API}?${params}`, { headers: { "User-Agent": UA } });
    if (res.status === 429) {
      await sleep(5000 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`Openverse ${res.status} for "${q}"`);
    return ((await res.json()) as { results: OpenverseImage[] }).results;
  }
  throw new Error(`Openverse rate limit for "${q}"`);
}

async function download(src: string): Promise<Buffer | null> {
  try {
    const res = await fetch(src, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function main() {
  const force = process.argv.includes("--force");
  if (force && existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true });
  mkdirSync(OUT_DIR, { recursive: true });

  const credits: Record<string, Credit[]> = existsSync(CREDITS_FILE)
    ? JSON.parse(readFileSync(CREDITS_FILE, "utf8"))
    : {};
  const used = new Set(Object.values(credits).flatMap((list) => list.map((c) => c.sourceUrl)));

  for (const [slug, queries] of Object.entries(QUERIES)) {
    const have = (credits[slug] ?? []).filter((c) => existsSync(path.join(OUT_DIR, c.file)));
    if (have.length >= PER_DESIGN) {
      console.log(`• ${slug}: cached (${have.length})`);
      continue;
    }
    const list = [...have];
    for (const q of queries) {
      if (list.length >= PER_DESIGN) break;
      const results = await search(q);
      await sleep(1500); // stay well under the anonymous rate limit
      for (const r of results) {
        if (list.length >= PER_DESIGN) break;
        if (used.has(r.foreign_landing_url) || r.mature) continue;
        if (list.some((c) => c.title === r.title)) continue; // same shoot, near-identical photo
        if (!REQUIRE.test(r.title ?? "") || REJECT.test(r.title ?? "")) continue;
        if ((r.width ?? 0) && (r.width ?? 0) < 640) continue;
        const raw = await download(r.url);
        if (!raw) continue;
        let webp: Buffer;
        try {
          const meta = await sharp(raw).metadata();
          if ((meta.width ?? 0) < 640 || (meta.height ?? 0) < 480) continue;
          webp = await sharp(raw)
            .rotate()
            .resize(1200, 900, { fit: "cover", position: "attention" })
            .webp({ quality: 82 })
            .toBuffer();
        } catch {
          continue;
        }
        const file = `${slug}-${list.length + 1}.webp`;
        writeFileSync(path.join(OUT_DIR, file), webp);
        used.add(r.foreign_landing_url);
        list.push({
          file,
          title: r.title ?? "Untitled",
          creator: r.creator,
          license: r.license,
          licenseVersion: r.license_version,
          licenseUrl: r.license_url,
          sourceUrl: r.foreign_landing_url,
          attribution:
            r.attribution ??
            `"${r.title ?? "Untitled"}" by ${r.creator ?? "unknown"} (${r.license.toUpperCase()})`,
        });
      }
    }
    credits[slug] = list;
    console.log(`• ${slug}: ${list.length} photo(s)`);
    writeFileSync(CREDITS_FILE, JSON.stringify(credits, null, 2) + "\n");
  }

  const missing = Object.keys(QUERIES).filter((s) => !credits[s]?.length);
  console.log(
    missing.length
      ? `Done. No photos for: ${missing.join(", ")} (seed falls back to generated covers).`
      : `Done. Saved to ${path.relative(process.cwd(), OUT_DIR)}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
