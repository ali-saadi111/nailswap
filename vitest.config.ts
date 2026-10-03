import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"],
    exclude: ["tests/e2e/**", "tests/rls/**", "node_modules/**"],
    coverage: { provider: "v8", reporter: ["text", "lcov"] },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
