/**
 * Generates PWA icons and the OG fallback image from an SVG mark using sharp.
 * Run: pnpm icons
 */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const out = path.resolve("public/icons");

function markSvg(size: number, padding: number, bg: string) {
  // A nail silhouette with a highlight — simple, recognisable at 48px.
  const inner = size - padding * 2;
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="${bg}"/>
  <g transform="translate(${padding} ${padding})">
    <path d="M${inner * 0.5} ${inner * 0.06}
      C${inner * 0.78} ${inner * 0.06} ${inner * 0.84} ${inner * 0.3} ${inner * 0.84} ${inner * 0.52}
      C${inner * 0.84} ${inner * 0.8} ${inner * 0.7} ${inner * 0.94} ${inner * 0.5} ${inner * 0.94}
      C${inner * 0.3} ${inner * 0.94} ${inner * 0.16} ${inner * 0.8} ${inner * 0.16} ${inner * 0.52}
      C${inner * 0.16} ${inner * 0.3} ${inner * 0.22} ${inner * 0.06} ${inner * 0.5} ${inner * 0.06} Z"
      fill="#8B5E3C"/>
    <path d="M${inner * 0.5} ${inner * 0.06}
      C${inner * 0.78} ${inner * 0.06} ${inner * 0.84} ${inner * 0.3} ${inner * 0.84} ${inner * 0.52}
      L${inner * 0.16} ${inner * 0.52}
      C${inner * 0.16} ${inner * 0.3} ${inner * 0.22} ${inner * 0.06} ${inner * 0.5} ${inner * 0.06} Z"
      fill="#F3E6DA"/>
    <ellipse cx="${inner * 0.36}" cy="${inner * 0.68}" rx="${inner * 0.07}" ry="${inner * 0.14}" fill="#ffffff" opacity="0.55" transform="rotate(-18 ${inner * 0.36} ${inner * 0.68})"/>
  </g>
</svg>`;
}

async function main() {
  await mkdir(out, { recursive: true });
  const specs: { name: string; size: number; padding: number; bg: string }[] = [
    { name: "icon-192.png", size: 192, padding: 24, bg: "#faf8f5" },
    { name: "icon-512.png", size: 512, padding: 64, bg: "#faf8f5" },
    { name: "icon-maskable-512.png", size: 512, padding: 112, bg: "#faf8f5" },
    { name: "apple-touch-icon.png", size: 180, padding: 24, bg: "#faf8f5" },
  ];
  for (const s of specs) {
    await sharp(Buffer.from(markSvg(s.size, s.padding, s.bg)))
      .png()
      .toFile(path.join(out, s.name));
  }
  await sharp(Buffer.from(markSvg(64, 8, "#faf8f5")))
    .png()
    .toFile(path.resolve("src/app/icon.png"));
  await writeFile(path.join(out, "mark.svg"), markSvg(256, 32, "transparent"));
  console.log("icons written to", out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
