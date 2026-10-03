import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";
import * as Sentry from "@sentry/nextjs";
import { env } from "@/lib/env";
import { log, errorMessage } from "@/lib/logger";
import { RateLimitError } from "@/lib/rate-limit";
import { getClaims, createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLocale, routing, type Locale, LOCALE_COOKIE } from "@/i18n/routing";

/**
 * Shared plumbing for Route Handlers: typed errors, JSON helpers, auth guards and the
 * `handle()` wrapper that turns thrown errors into consistent `{ error: { code, message } }`
 * responses.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string,
    public readonly details?: unknown,
  ) {
    super(message ?? code);
    this.name = "ApiError";
  }
}

export const errors = {
  badRequest: (code = "bad_request", message?: string, details?: unknown) =>
    new ApiError(400, code, message, details),
  unauthorized: (message = "Sign in required") => new ApiError(401, "unauthorized", message),
  forbidden: (message = "Not allowed") => new ApiError(403, "forbidden", message),
  notFound: (what = "Resource") => new ApiError(404, "not_found", `${what} not found`),
  conflict: (code: string, message?: string) => new ApiError(409, code, message),
  unprocessable: (code: string, message?: string, details?: unknown) =>
    new ApiError(422, code, message, details),
  tooLarge: (message = "File too large") => new ApiError(413, "too_large", message),
  unavailable: (code = "unavailable", message?: string) => new ApiError(503, code, message),
};

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function noContent() {
  return new NextResponse(null, { status: 204 });
}

/** Postgres error codes raised by our RPCs → HTTP status + stable client code. */
const PG_CODES: Record<string, { status: number; code: string }> = {
  P0002: { status: 404, code: "not_found" },
  P0003: { status: 402, code: "subscription_inactive" },
  P0004: { status: 402, code: "quota_exhausted" },
  P0010: { status: 422, code: "slot_too_soon" },
  P0011: { status: 422, code: "slot_too_far" },
  P0012: { status: 409, code: "slot_unavailable" },
  P0013: { status: 409, code: "slot_taken" },
  P0020: { status: 409, code: "booking_not_changeable" },
  P0021: { status: 409, code: "cutoff_passed" },
  "23505": { status: 409, code: "already_exists" },
  "23503": { status: 422, code: "invalid_reference" },
  "23514": { status: 422, code: "check_violation" },
  "42501": { status: 403, code: "forbidden" },
  "22023": { status: 422, code: "invalid_argument" },
  PGRST116: { status: 404, code: "not_found" },
};

export interface PostgrestLikeError {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
}

function isPostgrestError(err: unknown): err is PostgrestLikeError {
  return typeof err === "object" && err !== null && "message" in err && ("code" in err || "details" in err);
}

/** Converts a Supabase/Postgres error into an ApiError (throw the result). */
export function fromDbError(err: PostgrestLikeError | null | undefined, fallback = "db_error"): ApiError {
  if (!err) return new ApiError(500, fallback);
  const mapped = err.code ? PG_CODES[err.code] : undefined;
  if (mapped) return new ApiError(mapped.status, mapped.code, err.message);
  return new ApiError(500, fallback, err.message);
}

/** Throws when a Supabase call returned an error; otherwise returns `data`. */
export function ok<T>(result: { data: T; error: PostgrestLikeError | null }, fallback?: string): T {
  if (result.error) throw fromDbError(result.error, fallback);
  return result.data;
}

/** Like ok() for RPCs that return a single row (or null): throws 404 when nothing came back. */
export function okOne<T>(
  result: { data: T; error: PostgrestLikeError | null },
  what = "Resource",
): NonNullable<T> {
  const data = ok(result);
  if (data === null || data === undefined) throw errors.notFound(what);
  return data as NonNullable<T>;
}

type Handler<Ctx> = (req: NextRequest, ctx: Ctx) => Promise<Response> | Response;

/**
 * Wraps a route handler with uniform error handling. Every route in `app/api` should use it.
 */
export function handle<Ctx = unknown>(fn: Handler<Ctx>): Handler<Ctx> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      return errorResponse(err, req);
    }
  };
}

export function errorResponse(err: unknown, req?: NextRequest) {
  if (err instanceof ApiError) {
    if (err.status >= 500) {
      log.error("api_error", { code: err.code, message: err.message, path: req?.nextUrl.pathname });
      Sentry.captureException(err);
    }
    return json(
      { error: { code: err.code, message: err.message, details: err.details ?? undefined } },
      { status: err.status },
    );
  }
  if (err instanceof RateLimitError) {
    const retryAfter = Math.max(1, Math.ceil((err.resetAt - Date.now()) / 1000));
    return json(
      { error: { code: "rate_limited", message: "Too many requests. Please try again later.", retryAfter } },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }
  if (err instanceof ZodError) {
    return json(
      {
        error: {
          code: "validation",
          message: "Invalid request",
          details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
      },
      { status: 400 },
    );
  }
  if (isPostgrestError(err)) {
    const api = fromDbError(err);
    if (api.status >= 500) {
      log.error("db_error", { message: err.message, code: err.code, path: req?.nextUrl.pathname });
      Sentry.captureException(err);
    }
    return json({ error: { code: api.code, message: api.message } }, { status: api.status });
  }
  log.error("unhandled_api_error", { message: errorMessage(err), path: req?.nextUrl.pathname });
  Sentry.captureException(err);
  return json({ error: { code: "internal", message: "Something went wrong" } }, { status: 500 });
}

/** Parses and validates a JSON body. */
export async function parseJson<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw errors.badRequest("invalid_json", "Body must be valid JSON");
  }
  return schema.parse(body);
}

/** Parses and validates URL search params. */
export function parseQuery<T>(req: NextRequest, schema: ZodType<T>): T {
  return schema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
}

/** Reads a multipart form; throws a clear error when the body is not multipart. */
export async function parseForm(req: NextRequest): Promise<FormData> {
  try {
    return await req.formData();
  } catch {
    throw errors.badRequest("invalid_form", "Body must be multipart/form-data");
  }
}

/** Bearer-token check for cron / pg_net calls to /api/internal/*. */
export function requireInternal(req: NextRequest) {
  const e = env();
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || (token !== e.INTERNAL_API_SECRET && token !== e.CRON_SECRET)) {
    throw errors.unauthorized("Invalid internal token");
  }
}

export interface AuthContext {
  userId: string;
  phone: string | null;
  isPlatformAdmin: boolean;
  salonRoles: Record<string, "owner" | "manager" | "staff">;
}

/** Current signed-in user (from the Supabase session cookie) or 401. */
export async function requireUser(): Promise<AuthContext> {
  const claims = await getClaims();
  if (!claims.userId) throw errors.unauthorized();
  return {
    userId: claims.userId,
    phone: claims.phone,
    isPlatformAdmin: claims.isPlatformAdmin,
    salonRoles: claims.salonRoles,
  };
}

export async function requireAdmin(): Promise<AuthContext> {
  const auth = await requireUser();
  if (!auth.isPlatformAdmin) throw errors.forbidden("Platform admin only");
  return auth;
}

export type SalonRole = "owner" | "manager" | "staff";
const ROLE_RANK: Record<SalonRole, number> = { staff: 1, manager: 2, owner: 3 };

/**
 * Ensures the current user is a member of the salon with at least `minRole`
 * (platform admins always pass). Membership is re-checked against the database when the JWT
 * claim is missing (e.g. right after joining a salon, before the token refreshed).
 */
export async function requireSalonRole(
  salonId: string,
  minRole: SalonRole = "staff",
): Promise<AuthContext & { role: SalonRole | "admin" }> {
  const auth = await requireUser();
  if (auth.isPlatformAdmin) return { ...auth, role: "admin" };
  let role: SalonRole | undefined = auth.salonRoles[salonId];
  if (!role) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("salon_members")
      .select("role")
      .eq("salon_id", salonId)
      .eq("user_id", auth.userId)
      .maybeSingle();
    role = data?.role ?? undefined;
  }
  if (!role) throw errors.forbidden("Not a member of this salon");
  if (ROLE_RANK[role] < ROLE_RANK[minRole]) throw errors.forbidden(`Requires ${minRole} role`);
  return { ...auth, role };
}

/** Locale for a request: explicit value → cookie → Accept-Language → default. */
export function requestLocale(req: NextRequest, explicit?: string | null): Locale {
  if (isLocale(explicit)) return explicit;
  const cookie = req.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;
  const accept = req.headers.get("accept-language") ?? "";
  for (const part of accept.split(",")) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (isLocale(code)) return code;
  }
  return routing.defaultLocale;
}

/** Supabase client bound to the caller's session (RLS applies). */
export const userClient = createClient;

/** Absolute URL on the public origin. */
export function absoluteUrl(path: string) {
  return `${env().NEXT_PUBLIC_APP_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Salon public URL: subdomain in production, path-based locally. */
export function salonUrl(slug: string, locale: Locale, path = "") {
  const e = env();
  const root = e.NEXT_PUBLIC_ROOT_DOMAIN;
  const appUrl = new URL(e.NEXT_PUBLIC_APP_URL);
  if (appUrl.hostname === root || appUrl.hostname.endsWith(`.${root}`)) {
    return `${appUrl.protocol}//${slug}.${root}/${locale}${path}`;
  }
  return `${e.NEXT_PUBLIC_APP_URL}/${locale}/s/${slug}${path}`;
}
