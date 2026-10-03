import { createHash, timingSafeEqual } from "node:crypto";

/** Optional password gate for a private, paid-AI testing deployment. */
export function testingAccessAllowed(path: string, authorization: string | null, password?: string) {
  if (!password) return true;
  // These routes independently require INTERNAL_API_SECRET (cron/worker callbacks).
  if (path.startsWith("/api/internal/") || path === "/api/tryon/worker") return true;
  if (!authorization?.startsWith("Basic ")) return false;
  const actual = Buffer.from(authorization.slice(6), "base64").toString("utf8");
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(actual), digest(`tester:${password}`));
}
