import { z } from "zod";

/**
 * Server-side environment. Import only from server code.
 * Validated lazily so that `next build` on CI without secrets still succeeds; every consumer
 * calls `env()` at request time.
 */
const serverSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_ROOT_DOMAIN: z.string().default("nailswap.app"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  INTERNAL_API_SECRET: z.string().min(16),
  CRON_SECRET: z.string().min(1).default("change-me"),

  FAL_KEY: z.string().optional(),
  REPLICATE_API_TOKEN: z.string().optional(),
  FAL_INPAINT_MODEL: z.string().default("fal-ai/flux-pro/v1/fill"),
  FAL_MODERATION_MODEL: z.string().default("fal-ai/imageutils/nsfw"),
  /** Reference-guided edit models (hand photo + design photo, no mask). Tried in order. */
  FAL_EDIT_MODEL: z.string().default("fal-ai/nano-banana-2/edit"),
  FAL_EDIT_FALLBACK_MODEL: z.string().default(""),
  FAL_EDIT_RESOLUTION: z.enum(["1K", "2K", "4K"]).default("1K"),
  /** Set to "inpaint" to force the legacy mask + Flux Fill pipeline. */
  AI_TRYON_PIPELINE: z.enum(["edit", "inpaint"]).default("edit"),
  REPLICATE_INPAINT_MODEL: z.string().default("black-forest-labs/flux-fill-pro"),
  AI_PROVIDER_TIMEOUT_MS: z.coerce.number().int().positive().default(45_000),
  AI_PROVIDER_RETRIES: z.coerce.number().int().min(0).max(3).default(0),
  /** Edit models "think" before rendering; give them longer than inpainting. */
  AI_EDIT_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
  AI_COST_FAL_USD: z.coerce.number().nonnegative().default(0.05),
  AI_COST_FAL_EDIT_USD: z.coerce.number().nonnegative().default(0.08),
  AI_COST_REPLICATE_USD: z.coerce.number().nonnegative().default(0.05),

  TURNSTILE_SECRET_KEY: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional().or(z.literal("")),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().default("change-me"),
  WHATSAPP_APP_SECRET: z.string().optional(),
  WHATSAPP_TEMPLATE_CONFIRMATION: z.string().default("booking_confirmation"),
  WHATSAPP_TEMPLATE_REMINDER_24H: z.string().default("booking_reminder_24h"),
  WHATSAPP_TEMPLATE_REMINDER_2H: z.string().default("booking_reminder_2h"),
  WHATSAPP_TEMPLATE_PENDING: z.string().default("booking_pending"),
  WHATSAPP_TEMPLATE_CANCELLED: z.string().default("booking_cancelled"),

  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("NailSwap <no-reply@nailswap.app>"),

  PAYMENT_CARD_PROVIDER: z.enum(["mpgs", "none"]).default("none"),
  MPGS_MERCHANT_ID: z.string().optional(),
  MPGS_API_PASSWORD: z.string().optional(),
  MPGS_API_BASE_URL: z.string().url().default("https://ap-gateway.mastercard.com/api/rest/version/100"),
  MPGS_WEBHOOK_SECRET: z.string().optional(),

  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function env(): ServerEnv {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid server environment:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Public (browser-safe) values. Inlined by Next at build time. */
export const publicEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  rootDomain: process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "nailswap.app",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "",
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "",
  sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? "",
  defaultLocale: (process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? "en") as "ar" | "en" | "fr",
} as const;
