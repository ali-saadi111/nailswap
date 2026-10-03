import { describe, expect, it } from "vitest";
import { buildEditInput, DEFAULT_EDIT_MODEL, estimateEditCost } from "./edit-input";

const req = {
  prompt: "Change nails only",
  handImage: "hand",
  referenceImage: "design",
  numImages: 1,
  seed: 42,
};

describe("fal edit contracts", () => {
  it("sends Seedream two ordered inputs without unsupported Gemini fields or extra images", () => {
    const input = buildEditInput("bytedance/seedream/v5/lite/edit", req);
    expect(input).toMatchObject({
      image_urls: ["hand", "design"],
      num_images: 1,
      max_images: 1,
      image_size: "auto_2K",
    });
    expect(input).not.toHaveProperty("resolution");
    expect(input).not.toHaveProperty("seed");
    expect(input).not.toHaveProperty("output_format");
  });
  it("supports text-only polish changes and keeps Gemini resolution explicit", () => {
    expect(
      buildEditInput("fal-ai/nano-banana-2/edit", { ...req, referenceImage: undefined }, "2K"),
    ).toMatchObject({ image_urls: ["hand"], resolution: "2K", limit_generations: true, seed: 42 });
  });
  it("does not send auto aspect ratio to Kontext, which only accepts fixed ratios", () => {
    const input = buildEditInput("fal-ai/flux-pro/kontext/multi", req);
    expect(input).not.toHaveProperty("aspect_ratio");
    expect(input).not.toHaveProperty("resolution");
  });
  it("rejects unknown schemas before a paid call", () => {
    expect(() => buildEditInput("unconfigured/model", req)).toThrow("Unsupported");
  });
  it("estimates costs using the actual model and resolution", () => {
    expect(estimateEditCost("bytedance/seedream/v5/lite/edit", "1K", 2, 0.15)).toBe(0.07);
    expect(estimateEditCost(DEFAULT_EDIT_MODEL, "1K", 1, 0.15)).toBe(0.08);
    expect(estimateEditCost("fal-ai/flux-pro/kontext/multi", "1K", 1, 0.15)).toBe(0.04);
    expect(estimateEditCost("fal-ai/nano-banana-2/edit", "2K", 1, 0.15)).toBe(0.12);
  });
});
