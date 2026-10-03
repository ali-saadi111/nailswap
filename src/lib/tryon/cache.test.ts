import { describe, it, expect, vi, afterEach } from "vitest";
import { buildCacheKey } from "./cache";

describe("buildCacheKey", () => {
  afterEach(() => vi.unstubAllEnvs());
  const base = {
    mode: "describe" as const,
    shape: "almond" as const,
    color: "#f5f1ec",
    art: "  Gold  tips ",
    variations: 2,
  };
  it("is stable across cosmetic differences", () => {
    const a = buildCacheKey("h1", "d1", base);
    const b = buildCacheKey("h1", "d1", { ...base, color: "#F5F1EC", art: "gold tips" });
    expect(a).toBe(b);
  });
  it("changes with image, design or params", () => {
    const a = buildCacheKey("h1", "d1", base);
    expect(buildCacheKey("h2", "d1", base)).not.toBe(a);
    expect(buildCacheKey("h1", "d2", base)).not.toBe(a);
    expect(buildCacheKey("h1", "d1", { ...base, variations: 3 })).not.toBe(a);
    expect(buildCacheKey("h1", "d1", { ...base, finish: "matte" })).not.toBe(a);
  });
  it("ignores used_topup bookkeeping", () => {
    expect(buildCacheKey("h1", null, base)).toBe(buildCacheKey("h1", null, { ...base, used_topup: true }));
  });
  it("does not serve another model or resolution's cached result", () => {
    vi.stubEnv("FAL_EDIT_MODEL", "bytedance/seedream/v5/lite/edit");
    const seedream = buildCacheKey("h1", null, base);
    vi.stubEnv("FAL_EDIT_MODEL", "fal-ai/nano-banana-2/edit");
    vi.stubEnv("FAL_EDIT_RESOLUTION", "1K");
    const nano1k = buildCacheKey("h1", null, base);
    expect(nano1k).not.toBe(seedream);
    vi.stubEnv("FAL_EDIT_RESOLUTION", "2K");
    expect(buildCacheKey("h1", null, base)).not.toBe(nano1k);
  });
});
