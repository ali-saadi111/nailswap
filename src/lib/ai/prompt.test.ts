import { describe, it, expect } from "vitest";
import { buildEditPrompt, buildPrompt, parseDescription } from "./prompt";

describe("buildPrompt", () => {
  it("includes shape, length, colour name + hex, finish and art", () => {
    const { prompt, negativePrompt } = buildPrompt({
      mode: "describe",
      shape: "almond",
      length: "medium",
      color: "#F5F1EC",
      finish: "chrome",
      art: "gold chrome tips",
      variations: 1,
    });
    expect(prompt).toContain("almond");
    expect(prompt).toContain("medium length");
    expect(prompt).toContain("milky white");
    expect(prompt).toContain("#f5f1ec");
    expect(prompt).toContain("mirror chrome");
    expect(prompt).toContain("gold chrome tips");
    expect(negativePrompt).toContain("changed skin");
  });

  it("falls back to the design prompt when no art is given", () => {
    const { prompt } = buildPrompt({ mode: "catalog", variations: 2 }, "hand painted daisies on sheer pink");
    expect(prompt).toContain("hand painted daisies");
  });

  it("names colours sensibly", () => {
    expect(buildPrompt({ mode: "polish", color: "#111111", variations: 1 }).prompt).toContain("deep black");
    expect(buildPrompt({ mode: "polish", color: "#6E1423", variations: 1 }).prompt).toContain("burgundy");
    expect(buildPrompt({ mode: "polish", color: "#F8C8D4", variations: 1 }).prompt).toContain("baby pink");
  });
});

describe("parseDescription", () => {
  it("extracts shape, length, finish and colour", () => {
    const p = parseDescription("Long almond, milky white with gold chrome tips");
    expect(p.shape).toBe("almond");
    expect(p.length).toBe("long");
    expect(p.finish).toBe("chrome");
    expect(p.color).toBe("#F5F1EC");
    expect(p.art).toBe("Long almond, milky white with gold chrome tips");
  });
  it("prefers explicit hex codes", () => {
    expect(parseDescription("short square matte #ab12cd").color).toBe("#AB12CD");
    expect(parseDescription("short square matte #ab12cd").finish).toBe("matte");
  });
  it("maps ballerina to coffin and cat eye finish", () => {
    const p = parseDescription("ballerina cat-eye emerald");
    expect(p.shape).toBe("coffin");
    expect(p.finish).toBe("cat_eye");
    expect(p.color).toBe("#0F7B5F");
  });
});

describe("buildEditPrompt", () => {
  it("references the design photo and forbids copying its hand", () => {
    const p = buildEditPrompt(
      { mode: "catalog", shape: "almond", variations: 1 },
      "pink floral stamping",
      true,
    );
    expect(p).toContain("Image 2 is a reference photo");
    expect(p).toContain("do not copy its hand");
    expect(p).toContain("Design: pink floral stamping.");
    expect(p).toContain("almond shaped nails");
    expect(p).toContain("Do not change anything else in image 1");
  });

  it("falls back to the text description without a reference photo", () => {
    const p = buildEditPrompt(
      { mode: "polish", color: "#9B111E", finish: "glossy", variations: 1 },
      null,
      false,
    );
    expect(p).not.toContain("Image 2");
    expect(p).toContain("burgundy (#9b111e) polish");
    expect(p).toContain("high-gloss gel finish");
  });
});
