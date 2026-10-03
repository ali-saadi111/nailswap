import { describe, expect, it } from "vitest";
import { testingAccessAllowed } from "./testing-access";

const basic = (value: string) => `Basic ${Buffer.from(value).toString("base64")}`;

describe("private testing access", () => {
  it("allows normal deployments when the gate is unset", () => {
    expect(testingAccessAllowed("/api/tryon/upload", null)).toBe(true);
  });
  it("protects both pages and paid generation routes", () => {
    for (const path of ["/en/try", "/api/tryon/upload", "/api/health"]) {
      expect(testingAccessAllowed(path, null, "secret")).toBe(false);
      expect(testingAccessAllowed(path, basic("tester:wrong"), "secret")).toBe(false);
      expect(testingAccessAllowed(path, basic("another:secret"), "secret")).toBe(false);
      expect(testingAccessAllowed(path, basic("tester:secret"), "secret")).toBe(true);
    }
  });
  it("allows secret-protected cron endpoints without widening the worker exception", () => {
    expect(testingAccessAllowed("/api/internal/tryon/requeue", null, "secret")).toBe(true);
    expect(testingAccessAllowed("/api/tryon/worker", null, "secret")).toBe(true);
    expect(testingAccessAllowed("/api/tryon/worker-extra", null, "secret")).toBe(false);
    expect(testingAccessAllowed("/api/internal-extra", null, "secret")).toBe(false);
    expect(testingAccessAllowed("/en/try", "Basic !!!", "secret")).toBe(false);
  });
});
