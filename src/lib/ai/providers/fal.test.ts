import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  env: () => ({
    FAL_KEY: "test-key",
    FAL_EDIT_RESOLUTION: "1K",
    AI_COST_FAL_EDIT_USD: 0.035,
    FAL_MODERATION_MODEL: "fal-ai/imageutils/nsfw",
  }),
}));
import { falProvider } from "./fal";

afterEach(() => vi.unstubAllGlobals());

function queuedResponse(output: unknown) {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({
        request_id: "request-1",
        status_url: "https://queue.fal.run/status",
        response_url: "https://queue.fal.run/result",
      }),
    )
    .mockResolvedValueOnce(Response.json({ status: "COMPLETED" }))
    .mockResolvedValueOnce(Response.json(output));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("fal provider", () => {
  it("submits Seedream once, polls, and returns its images and cost", async () => {
    const fetchMock = queuedResponse({ images: [{ url: "https://fal.media/result.png" }], seed: 24 });
    const result = await falProvider.edit!(
      { handImage: "hand", referenceImage: "reference", prompt: "manicure", numImages: 1 },
      "bytedance/seedream/v5/lite/edit",
      new AbortController().signal,
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      image_urls: ["hand", "reference"],
      max_images: 1,
      image_size: "auto_2K",
    });
    expect(result).toMatchObject({
      providerJobId: "request-1",
      seed: 24,
      costUsd: 0.035,
      imageUrls: ["https://fal.media/result.png"],
    });
  });
  it("reports authentication failures without disguising them as retryable errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Unauthorized", { status: 401 })));
    await expect(
      falProvider.edit!(
        { handImage: "hand", prompt: "manicure", numImages: 1 },
        "bytedance/seedream/v5/lite/edit",
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ retryable: false, status: 401 });
  });
  it("fails closed when moderation returns an invalid score", async () => {
    queuedResponse({});
    expect(await falProvider.moderate!("hand", new AbortController().signal)).toMatchObject({
      allowed: false,
      reason: "error",
    });
  });
});
