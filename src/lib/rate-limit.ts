import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

export type LimitKind =
  | "otp_ip"
  | "otp_phone"
  | "upload_ip"
  | "tryon_ip"
  | "tryon_salon"
  | "booking_ip"
  | "booking_phone"
  | "api_ip";

/** Sliding-window limits: [requests, window]. */
const LIMITS: Record<LimitKind, [number, `${number} ${"s" | "m" | "h" | "d"}`]> = {
  otp_ip: [10, "1 h"],
  otp_phone: [5, "1 h"],
  upload_ip: [30, "1 h"],
  tryon_ip: [20, "1 h"],
  tryon_salon: [300, "1 h"],
  booking_ip: [15, "1 h"],
  booking_phone: [6, "1 d"],
  api_ip: [300, "1 m"],
};

interface Limiter {
  limit(key: string): Promise<{ success: boolean; remaining: number; reset: number }>;
}

/** In-memory fallback for local development / tests (single process only). */
function memoryLimiter(max: number, windowMs: number): Limiter {
  const hits = new Map<string, number[]>();
  return {
    async limit(key) {
      const now = Date.now();
      const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      arr.push(now);
      hits.set(key, arr);
      return { success: arr.length <= max, remaining: Math.max(0, max - arr.length), reset: now + windowMs };
    },
  };
}

function windowToMs(w: string) {
  const [n, unit] = w.split(" ");
  const mult = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit as "s" | "m" | "h" | "d"];
  return Number(n) * mult;
}

const limiters = new Map<LimitKind, Limiter>();

function getLimiter(kind: LimitKind): Limiter {
  const existing = limiters.get(kind);
  if (existing) return existing;
  const [max, window] = LIMITS[kind];
  const e = env();
  let limiter: Limiter;
  if (e.UPSTASH_REDIS_REST_URL && e.UPSTASH_REDIS_REST_TOKEN) {
    const redis = new Redis({ url: e.UPSTASH_REDIS_REST_URL, token: e.UPSTASH_REDIS_REST_TOKEN });
    const rl = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(max, window),
      prefix: `ns:rl:${kind}`,
    });
    limiter = {
      async limit(key) {
        const r = await rl.limit(key);
        return { success: r.success, remaining: r.remaining, reset: r.reset };
      },
    };
  } else {
    limiter = memoryLimiter(max, windowToMs(window));
  }
  limiters.set(kind, limiter);
  return limiter;
}

export class RateLimitError extends Error {
  constructor(
    public readonly kind: LimitKind,
    public readonly resetAt: number,
  ) {
    super(`Rate limit exceeded (${kind})`);
    this.name = "RateLimitError";
  }
}

/** Throws RateLimitError when the limit is exceeded. */
export async function enforceLimit(kind: LimitKind, key: string) {
  const r = await getLimiter(kind).limit(key);
  if (!r.success) throw new RateLimitError(kind, r.reset);
  return r;
}

export function clientIp(headers: Headers) {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}
