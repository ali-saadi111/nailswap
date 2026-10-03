import { test, expect } from "@playwright/test";
import sharp from "sharp";

/**
 * AI try-on upload pipeline through the HTTP API: normalise → validate hand → rasterise mask →
 * create job → (worker) → status → owner delete. The worker fails with `ai_not_configured` when
 * no provider key is set, which is the expected outcome in CI.
 */
function syntheticHand() {
  const lm = new Array(21).fill(null).map(() => ({ x: 0, y: 0, z: 0 }));
  lm[0] = { x: 0.5, y: 0.9, z: 0 };
  const fingers: [number[], number, number][] = [
    [[1, 2, 3, 4], 0.3, 0.72],
    [[5, 6, 7, 8], 0.4, 0.6],
    [[9, 10, 11, 12], 0.5, 0.58],
    [[13, 14, 15, 16], 0.6, 0.6],
    [[17, 18, 19, 20], 0.7, 0.64],
  ];
  for (const [idx, x, baseY] of fingers) {
    idx.forEach((i, k) => {
      lm[i] = { x: x + (i <= 4 ? -k * 0.03 : 0), y: baseY - k * 0.1, z: 0 };
    });
  }
  return lm;
}

async function photo() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200"><rect width="900" height="1200" fill="#e9d5c5"/><rect x="200" y="500" width="500" height="700" rx="200" fill="#d9b99b"/></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer();
}

test.describe("AI try-on upload", () => {
  test("creates a job, exposes its status to the anonymous owner, and lets them delete it", async ({
    request,
  }) => {
    const salons = await (await request.get("/api/salons/glow-beirut")).json();
    const design = salons.designs[0];

    const res = await request.post("/api/tryon/upload", {
      multipart: {
        file: { name: "hand.jpg", mimeType: "image/jpeg", buffer: await photo() },
        hands: JSON.stringify([{ landmarks: syntheticHand(), handedness: "Right", score: 0.95 }]),
        params: JSON.stringify({ mode: "catalog", variations: 2 }),
        designId: design.id,
        consent: "true",
      },
    });
    expect(res.status(), await res.text()).toBe(201);
    const job = await res.json();
    expect(job.salonId).toBe(salons.salon.id);
    expect(job.designId).toBe(design.id);
    expect(job.params.shape).toBe(design.shape);
    expect(job.inputUrl).toContain("/storage/v1/object/sign/tryon/");
    expect(["queued", "moderating", "generating", "failed"]).toContain(job.status);

    // Status is readable by the anonymous owner (cookie) …
    const status = await (await request.get(`/api/tryon/jobs/${job.id}`)).json();
    expect(status.id).toBe(job.id);
    expect(["queued", "moderating", "generating", "failed", "succeeded"]).toContain(status.status);
    if (status.status === "failed") expect(status.errorCode).toBe("ai_not_configured");

    // … but not by another visitor.
    const stranger = await request.get(`/api/tryon/jobs/${job.id}`, { headers: { Cookie: "" } });
    expect(stranger.status()).toBe(403);

    // Saving needs an account.
    expect((await request.post(`/api/tryon/jobs/${job.id}/save`, { data: { index: 0 } })).status()).toBe(401);

    // Owner deletes the photo immediately.
    expect((await request.delete(`/api/tryon/jobs/${job.id}`)).status()).toBe(204);
    expect((await request.get(`/api/tryon/jobs/${job.id}`)).status()).toBe(404);
  });

  test("rejects photos without a usable hand and missing consent", async ({ request }) => {
    const tiny = syntheticHand().map((p) => ({
      x: 0.5 + (p.x - 0.5) * 0.1,
      y: 0.5 + (p.y - 0.5) * 0.1,
      z: 0,
    }));
    const res = await request.post("/api/tryon/upload", {
      multipart: {
        file: { name: "hand.jpg", mimeType: "image/jpeg", buffer: await photo() },
        hands: JSON.stringify([{ landmarks: tiny, handedness: "Right", score: 0.9 }]),
        params: JSON.stringify({ mode: "describe", art: "short square matte red" }),
        consent: "true",
      },
    });
    expect(res.status()).toBe(422);
    expect((await res.json()).error.code).toBe("too_small");

    const noConsent = await request.post("/api/tryon/upload", {
      multipart: {
        file: { name: "hand.jpg", mimeType: "image/jpeg", buffer: await photo() },
        hands: JSON.stringify([{ landmarks: syntheticHand(), handedness: "Right", score: 0.9 }]),
        params: JSON.stringify({ mode: "describe", art: "almond milky white" }),
      },
    });
    expect(noConsent.status()).toBe(400);
  });
});
