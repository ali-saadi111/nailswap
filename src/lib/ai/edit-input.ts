import type { EditRequest } from "./types";

export const DEFAULT_EDIT_MODEL = "fal-ai/nano-banana-2/edit";

/** Each endpoint has its own schema; unsupported fields can silently change the result. */
export function buildEditInput(model: string, req: EditRequest, resolution = "1K") {
  const common = {
    prompt: req.prompt,
    image_urls: req.referenceImage ? [req.handImage, req.referenceImage] : [req.handImage],
    num_images: req.numImages,
    output_format: "png",
    ...(req.seed !== undefined ? { seed: req.seed } : {}),
  };
  if (model === "bytedance/seedream/v5/lite/edit" || model === "fal-ai/bytedance/seedream/v5/lite/edit") {
    return {
      prompt: req.prompt,
      image_urls: common.image_urls,
      num_images: req.numImages,
      max_images: 1,
      image_size: "auto_2K",
      enable_safety_checker: true,
    };
  }
  if (model === "fal-ai/flux-pro/kontext/multi") {
    return { ...common, safety_tolerance: "2", enhance_prompt: false };
  }
  if (["fal-ai/nano-banana-pro/edit", "fal-ai/nano-banana-2/edit"].includes(model)) {
    return {
      ...common,
      aspect_ratio: "auto",
      resolution,
      safety_tolerance: "2",
      limit_generations: true,
    };
  }
  throw new Error(`Unsupported edit model: ${model}. Add its documented input schema first.`);
}

/** Estimates, not invoices. Keep resolution-dependent models out of the flat-rate setting. */
export function estimateEditCost(model: string, resolution: string, count: number, fallback: number) {
  const price = model.includes("seedream/v5/lite/edit")
    ? 0.035
    : model === "fal-ai/flux-pro/kontext/multi"
      ? 0.04
      : model === "fal-ai/nano-banana-2/edit"
        ? resolution === "4K"
          ? 0.16
          : resolution === "2K"
            ? 0.12
            : 0.08
        : fallback;
  return price * count;
}
