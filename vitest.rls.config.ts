import { defineConfig } from "vitest/config";
import path from "node:path";

/** RLS policy tests run against a live local Supabase (`pnpm supabase start`). */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/rls/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
