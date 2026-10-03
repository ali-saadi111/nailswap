import "server-only";
import { formatInTimeZone } from "date-fns-tz";
import { ar, enUS, fr } from "date-fns/locale";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { log, errorMessage } from "@/lib/logger";
import type { Notification, NotificationChannel, NotificationKind, AppLocale } from "@/lib/supabase/types";
import type { Json } from "@/lib/supabase/database.types";
import {
  DEFAULT_TEMPLATES,
  EMAIL_SUBJECTS,
  WHATSAPP_TEMPLATE_KINDS,
  renderTemplate,
  whatsappTemplateParams,
  type TemplateVars,
} from "./templates";
import { WhatsAppError, sendTemplate, whatsappConfigured, whatsappLanguage } from "./whatsapp";
import { SmsError, sendSms, smsConfigured } from "./sms";
import { emailConfigured, emailLayout, sendEmail } from "./email";

/**
 * Notification dispatcher: WhatsApp template → SMS fallback → email, with retries.
 * Rows live in `notifications`; pg_cron calls /api/internal/notifications/dispatch every minute
 * and booking routes call `dispatchForBooking()` right after a change so confirmations go out
 * immediately.
 */
const MAX_ATTEMPTS = 5;
const DATE_LOCALES = { en: enUS, ar, fr } as const;

/** Paths the frontend must implement for links embedded in messages. */
export const LINKS = {
  manageBooking: (locale: AppLocale, token: string) => `/${locale}/b/${token}`,
  dashboardBooking: (locale: AppLocale, bookingId: string) => `/${locale}/dashboard/bookings/${bookingId}`,
  dashboardBilling: (locale: AppLocale) => `/${locale}/dashboard/billing`,
  salon: (locale: AppLocale, slug: string) => `/${locale}/s/${slug}`,
};

type Admin = ReturnType<typeof createAdminClient>;

interface Context {
  vars: TemplateVars;
  body: string;
  subject: string;
  clientEmail: string | null;
  salonEmail: string | null;
  brandColor: string;
  dir: "ltr" | "rtl";
}

async function buildContext(admin: Admin, n: Notification): Promise<Context | null> {
  const appUrl = env().NEXT_PUBLIC_APP_URL;
  // The app is English-only; ignore any legacy locale stored on the row.
  const locale: AppLocale = "en";
  const payload = (n.payload ?? {}) as Partial<TemplateVars> & { link?: string };
  let vars: TemplateVars;
  let clientEmail: string | null = null;
  let salonEmail: string | null = null;
  let brandColor = "#8B5E3C";

  if (n.booking_id) {
    const { data: b } = await admin
      .from("bookings")
      .select(
        "id, starts_at, manage_token, salons(name, slug, timezone, email, brand_color), clients(full_name, email), services(name), designs(name), staff(display_name)",
      )
      .eq("id", n.booking_id)
      .maybeSingle();
    if (!b) return null;
    const tz = b.salons?.timezone ?? "Asia/Beirut";
    const dateLocale = DATE_LOCALES[locale] ?? enUS;
    const isSalonKind = n.kind === "salon_new_booking";
    vars = {
      name: b.clients?.full_name ?? "",
      salon: b.salons?.name ?? "",
      date: formatInTimeZone(new Date(b.starts_at), tz, "EEE d MMM", { locale: dateLocale }),
      time: formatInTimeZone(new Date(b.starts_at), tz, "HH:mm"),
      service: b.services?.name ?? "",
      design: b.designs?.name ? ` + ${b.designs.name}` : "",
      staff: b.staff?.display_name ?? "",
      link: isSalonKind
        ? `${appUrl}${LINKS.dashboardBooking(locale, b.id)}`
        : `${appUrl}${LINKS.manageBooking(locale, b.manage_token)}`,
      ...payload,
    };
    clientEmail = b.clients?.email ?? null;
    salonEmail = b.salons?.email ?? null;
    brandColor = b.salons?.brand_color ?? brandColor;
  } else {
    let salonName = payload.salon ?? "";
    if (n.salon_id) {
      const { data: s } = await admin
        .from("salons")
        .select("name, email, brand_color")
        .eq("id", n.salon_id)
        .maybeSingle();
      salonName = s?.name ?? salonName;
      salonEmail = s?.email ?? null;
      brandColor = s?.brand_color ?? brandColor;
    }
    vars = {
      name: payload.name ?? "",
      salon: salonName,
      date: payload.date ?? "",
      time: payload.time ?? "",
      service: payload.service ?? "",
      link: payload.link ?? `${appUrl}${LINKS.dashboardBilling(locale)}`,
      design: payload.design,
      staff: payload.staff,
    };
  }

  let template = DEFAULT_TEMPLATES[n.kind]?.[locale] ?? DEFAULT_TEMPLATES[n.kind]?.en ?? "";
  if (n.salon_id) {
    const { data: override } = await admin
      .from("salon_notification_templates")
      .select("body")
      .eq("salon_id", n.salon_id)
      .eq("kind", n.kind)
      .eq("locale", locale)
      .maybeSingle();
    if (override?.body) template = override.body;
  }
  return {
    vars,
    body: renderTemplate(template, vars),
    subject: renderTemplate(
      EMAIL_SUBJECTS[n.kind]?.[locale] ?? EMAIL_SUBJECTS[n.kind]?.en ?? "NailSwap",
      vars,
    ),
    clientEmail,
    salonEmail,
    brandColor,
    dir: "ltr",
  };
}

type Outcome =
  | { status: "sent"; providerRef: string }
  | { status: "retry"; error: string }
  | { status: "failed"; error: string }
  | { status: "fallback"; channel: NotificationChannel; recipient: string; error: string };

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function devNoop(n: Notification, body: string): Outcome {
  if (process.env.NODE_ENV === "production") return { status: "failed", error: "channel_not_configured" };
  log.info("notification (noop, no channel configured)", {
    id: n.id,
    kind: n.kind,
    channel: n.channel,
    to: n.recipient,
    body,
  });
  return { status: "sent", providerRef: "noop:dev" };
}

function fallbackFor(n: Notification, ctx: Context, error: string): Outcome {
  // whatsapp → sms → email (client) ; email has no fallback
  if (n.channel === "whatsapp") {
    if (smsConfigured()) return { status: "fallback", channel: "sms", recipient: n.recipient, error };
    if (ctx.clientEmail && emailConfigured())
      return { status: "fallback", channel: "email", recipient: ctx.clientEmail, error };
  }
  if (n.channel === "sms" && ctx.clientEmail && emailConfigured()) {
    return { status: "fallback", channel: "email", recipient: ctx.clientEmail, error };
  }
  if (!whatsappConfigured() && !smsConfigured() && !emailConfigured()) return devNoop(n, ctx.body);
  return { status: "failed", error };
}

async function deliver(n: Notification, ctx: Context): Promise<Outcome> {
  const e = env();
  try {
    if (n.channel === "whatsapp") {
      const templateKey = WHATSAPP_TEMPLATE_KINDS[n.kind as NotificationKind];
      if (!whatsappConfigured() || !templateKey)
        return fallbackFor(n, ctx, whatsappConfigured() ? "no_template" : "whatsapp_not_configured");
      const res = await sendTemplate(
        n.recipient.replace(/\D/g, ""),
        e[templateKey],
        whatsappLanguage("en"),
        whatsappTemplateParams(ctx.vars),
      );
      return { status: "sent", providerRef: res.id };
    }
    if (n.channel === "sms") {
      if (!smsConfigured()) return fallbackFor(n, ctx, "sms_not_configured");
      const res = await sendSms(n.recipient.replace(/\D/g, ""), ctx.body);
      return { status: "sent", providerRef: res.id };
    }
    // email
    if (!isEmail(n.recipient)) return { status: "failed", error: "invalid_email" };
    if (!emailConfigured()) return devNoop(n, ctx.body);
    const html = emailLayout({
      title: ctx.subject,
      body: ctx.body.replace(ctx.vars.link, "").trim(),
      ctaLabel: ctx.vars.link ? "Open" : undefined,
      ctaUrl: ctx.vars.link || undefined,
      dir: ctx.dir,
      accent: ctx.brandColor,
    });
    const res = await sendEmail({ to: n.recipient, subject: ctx.subject, html, text: ctx.body });
    return { status: "sent", providerRef: res.id };
  } catch (err) {
    if (err instanceof WhatsAppError)
      return err.retryable ? { status: "retry", error: err.message } : fallbackFor(n, ctx, err.message);
    if (err instanceof SmsError)
      return err.retryable ? { status: "retry", error: err.message } : fallbackFor(n, ctx, err.message);
    return { status: "retry", error: errorMessage(err) };
  }
}

/** Dispatches one queued notification. Returns the final status written to the row. */
export async function dispatchOne(n: Notification, depth = 0): Promise<Notification["status"]> {
  const admin = createAdminClient();
  // Optimistic claim so two dispatchers never send the same row.
  const { data: claimed } = await admin
    .from("notifications")
    .update({ attempts: n.attempts + 1 })
    .eq("id", n.id)
    .eq("status", "queued")
    .eq("attempts", n.attempts)
    .select("id")
    .maybeSingle();
  if (!claimed) return n.status;

  const ctx = await buildContext(admin, n);
  if (!ctx) {
    await admin.from("notifications").update({ status: "failed", error: "context_missing" }).eq("id", n.id);
    return "failed";
  }

  const outcome = await deliver(n, ctx);
  const attempts = n.attempts + 1;

  if (outcome.status === "sent") {
    await admin
      .from("notifications")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        provider_ref: outcome.providerRef,
        error: null,
      })
      .eq("id", n.id);
    if (n.booking_id && n.kind === "booking_reminder_24h") {
      await admin
        .from("bookings")
        .update({ reminder_24h_sent_at: new Date().toISOString() })
        .eq("id", n.booking_id);
    } else if (n.booking_id && n.kind === "booking_reminder_2h") {
      await admin
        .from("bookings")
        .update({ reminder_2h_sent_at: new Date().toISOString() })
        .eq("id", n.booking_id);
    }
    return "sent";
  }

  if (outcome.status === "retry" && attempts < MAX_ATTEMPTS) {
    const delayMin = Math.min(60, 2 ** attempts);
    await admin
      .from("notifications")
      .update({ error: outcome.error, scheduled_for: new Date(Date.now() + delayMin * 60_000).toISOString() })
      .eq("id", n.id);
    return "queued";
  }

  if (outcome.status === "fallback" && depth < 2) {
    const { data: next } = await admin
      .from("notifications")
      .insert({
        salon_id: n.salon_id,
        booking_id: n.booking_id,
        kind: n.kind,
        channel: outcome.channel,
        recipient: outcome.recipient,
        locale: "en",
        payload: n.payload,
        scheduled_for: new Date().toISOString(),
      })
      .select("*")
      .single();
    await admin
      .from("notifications")
      .update({ status: "failed", error: `fallback:${outcome.channel} (${outcome.error})` })
      .eq("id", n.id);
    if (next) await dispatchOne(next, depth + 1);
    return "failed";
  }

  await admin.from("notifications").update({ status: "failed", error: outcome.error }).eq("id", n.id);
  return "failed";
}

/** Sends every due notification (called by the cron endpoint). */
export async function dispatchDue(limit = 50) {
  const admin = createAdminClient();
  const { data: due, error } = await admin
    .from("notifications")
    .select("*")
    .eq("status", "queued")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  const summary: Record<string, number> = {};
  for (const n of due ?? []) {
    const status = await dispatchOne(n);
    summary[status] = (summary[status] ?? 0) + 1;
  }
  return { considered: due?.length ?? 0, ...summary };
}

/** Sends the notifications already due for one booking (used right after create/status change). */
export async function dispatchForBooking(bookingId: string) {
  const admin = createAdminClient();
  const { data: due } = await admin
    .from("notifications")
    .select("*")
    .eq("booking_id", bookingId)
    .eq("status", "queued")
    .lte("scheduled_for", new Date().toISOString());
  for (const n of due ?? []) {
    try {
      await dispatchOne(n);
    } catch (err) {
      log.error("dispatchForBooking failed", { bookingId, id: n.id, error: errorMessage(err) });
    }
  }
}

/** Queues a notification row (server only). */
export async function queueNotification(input: {
  salonId: string | null;
  bookingId?: string | null;
  kind: NotificationKind;
  channel: NotificationChannel;
  recipient: string;
  locale: AppLocale;
  payload?: Record<string, unknown>;
  scheduledFor?: Date;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("notifications")
    .insert({
      salon_id: input.salonId,
      booking_id: input.bookingId ?? null,
      kind: input.kind,
      channel: input.channel,
      recipient: input.recipient,
      locale: "en",
      payload: (input.payload ?? {}) as NonNullable<Json>,
      scheduled_for: (input.scheduledFor ?? new Date()).toISOString(),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}
