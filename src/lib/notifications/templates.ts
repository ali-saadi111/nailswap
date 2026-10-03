import type { Database } from "@/lib/supabase/database.types";

export type NotificationKind = Database["public"]["Enums"]["notification_kind"];
export type Locale = Database["public"]["Enums"]["app_locale"];

export interface TemplateVars {
  name: string;
  salon: string;
  date: string;
  time: string;
  service: string;
  link: string;
  design?: string;
  staff?: string;
}

/**
 * Default message bodies (used for SMS, WhatsApp free-form fallback, and email).
 * Salons can override per kind/locale in salon_notification_templates.
 * Placeholders: {name} {salon} {date} {time} {service} {link} {design} {staff}
 */
export const DEFAULT_TEMPLATES: Record<NotificationKind, Record<Locale, string>> = {
  booking_confirmation: {
    en: "Hi {name}! Your {service} at {salon} is confirmed for {date} at {time}. Manage your booking: {link}",
    ar: "مرحبًا {name}! تم تأكيد موعد {service} في {salon} يوم {date} عند {time}. إدارة الحجز: {link}",
    fr: "Bonjour {name} ! Votre {service} chez {salon} est confirmé le {date} à {time}. Gérer la réservation : {link}",
  },
  booking_pending: {
    en: "Hi {name}! We received your request for {service} at {salon} on {date} at {time}. We'll confirm shortly. Details: {link}",
    ar: "مرحبًا {name}! استلمنا طلبك لـ {service} في {salon} يوم {date} عند {time}. سنؤكد قريبًا. التفاصيل: {link}",
    fr: "Bonjour {name} ! Nous avons reçu votre demande de {service} chez {salon} le {date} à {time}. Confirmation à venir. Détails : {link}",
  },
  booking_approved: {
    en: "Good news {name}! {salon} confirmed your {service} on {date} at {time}. Manage: {link}",
    ar: "خبر جيد {name}! أكّد {salon} موعد {service} يوم {date} عند {time}. الإدارة: {link}",
    fr: "Bonne nouvelle {name} ! {salon} a confirmé votre {service} le {date} à {time}. Gérer : {link}",
  },
  booking_reminder_24h: {
    en: "Reminder: {name}, your {service} at {salon} is tomorrow, {date} at {time}. Need to change it? {link}",
    ar: "تذكير: {name}، موعد {service} في {salon} غدًا {date} عند {time}. لتغييره: {link}",
    fr: "Rappel : {name}, votre {service} chez {salon} est demain, {date} à {time}. Modifier : {link}",
  },
  booking_reminder_2h: {
    en: "See you soon {name}! Your {service} at {salon} starts at {time} today. {link}",
    ar: "نراك قريبًا {name}! موعد {service} في {salon} يبدأ اليوم عند {time}. {link}",
    fr: "À très vite {name} ! Votre {service} chez {salon} commence à {time} aujourd'hui. {link}",
  },
  booking_rescheduled: {
    en: "{name}, your {service} at {salon} was moved to {date} at {time}. Details: {link}",
    ar: "{name}، تم نقل موعد {service} في {salon} إلى {date} عند {time}. التفاصيل: {link}",
    fr: "{name}, votre {service} chez {salon} a été déplacé au {date} à {time}. Détails : {link}",
  },
  booking_cancelled: {
    en: "{name}, your {service} at {salon} on {date} at {time} has been cancelled. Book again: {link}",
    ar: "{name}، تم إلغاء موعد {service} في {salon} يوم {date} عند {time}. للحجز مجددًا: {link}",
    fr: "{name}, votre {service} chez {salon} le {date} à {time} a été annulé. Réserver à nouveau : {link}",
  },
  salon_new_booking: {
    en: "New booking: {name} — {service}{design} on {date} at {time} with {staff}. Open: {link}",
    ar: "حجز جديد: {name} — {service}{design} يوم {date} عند {time} مع {staff}. افتح: {link}",
    fr: "Nouvelle réservation : {name} — {service}{design} le {date} à {time} avec {staff}. Ouvrir : {link}",
  },
  salon_invoice: {
    en: "Your NailSwap invoice for {salon} is ready: {link}",
    ar: "فاتورة NailSwap لصالون {salon} جاهزة: {link}",
    fr: "Votre facture NailSwap pour {salon} est prête : {link}",
  },
  salon_quota_warning: {
    en: "{salon} has used most of this month's AI try-ons. Upgrade or top up: {link}",
    ar: "استهلك {salon} معظم تجارب الذكاء الاصطناعي لهذا الشهر. للترقية أو الشراء: {link}",
    fr: "{salon} a utilisé la majorité des essayages IA du mois. Changer d'offre ou recharger : {link}",
  },
};

export const EMAIL_SUBJECTS: Record<NotificationKind, Record<Locale, string>> = {
  booking_confirmation: {
    en: "Booking confirmed — {salon}",
    ar: "تم تأكيد الحجز — {salon}",
    fr: "Réservation confirmée — {salon}",
  },
  booking_pending: {
    en: "Booking request received — {salon}",
    ar: "تم استلام طلب الحجز — {salon}",
    fr: "Demande de réservation reçue — {salon}",
  },
  booking_approved: {
    en: "Booking approved — {salon}",
    ar: "تمت الموافقة على الحجز — {salon}",
    fr: "Réservation acceptée — {salon}",
  },
  booking_reminder_24h: {
    en: "Reminder: tomorrow at {salon}",
    ar: "تذكير: غدًا في {salon}",
    fr: "Rappel : demain chez {salon}",
  },
  booking_reminder_2h: {
    en: "See you soon at {salon}",
    ar: "نراك قريبًا في {salon}",
    fr: "À très vite chez {salon}",
  },
  booking_rescheduled: {
    en: "Booking moved — {salon}",
    ar: "تم نقل الحجز — {salon}",
    fr: "Réservation déplacée — {salon}",
  },
  booking_cancelled: {
    en: "Booking cancelled — {salon}",
    ar: "تم إلغاء الحجز — {salon}",
    fr: "Réservation annulée — {salon}",
  },
  salon_new_booking: {
    en: "New booking: {name} on {date}",
    ar: "حجز جديد: {name} يوم {date}",
    fr: "Nouvelle réservation : {name} le {date}",
  },
  salon_invoice: { en: "Your NailSwap invoice", ar: "فاتورة NailSwap", fr: "Votre facture NailSwap" },
  salon_quota_warning: {
    en: "AI try-on quota almost used",
    ar: "حصة التجارب شبه مستهلكة",
    fr: "Quota d'essayages IA presque épuisé",
  },
};

/** Maps a notification kind to its approved WhatsApp template env variable. */
export const WHATSAPP_TEMPLATE_KINDS: Partial<
  Record<
    NotificationKind,
    | "WHATSAPP_TEMPLATE_CONFIRMATION"
    | "WHATSAPP_TEMPLATE_REMINDER_24H"
    | "WHATSAPP_TEMPLATE_REMINDER_2H"
    | "WHATSAPP_TEMPLATE_PENDING"
    | "WHATSAPP_TEMPLATE_CANCELLED"
  >
> = {
  booking_confirmation: "WHATSAPP_TEMPLATE_CONFIRMATION",
  booking_approved: "WHATSAPP_TEMPLATE_CONFIRMATION",
  booking_rescheduled: "WHATSAPP_TEMPLATE_CONFIRMATION",
  booking_reminder_24h: "WHATSAPP_TEMPLATE_REMINDER_24H",
  booking_reminder_2h: "WHATSAPP_TEMPLATE_REMINDER_2H",
  booking_pending: "WHATSAPP_TEMPLATE_PENDING",
  booking_cancelled: "WHATSAPP_TEMPLATE_CANCELLED",
};

/**
 * Body parameter order for the approved WhatsApp templates (see README → WhatsApp templates).
 * Every template uses: {{1}} name, {{2}} salon, {{3}} service, {{4}} date, {{5}} time, {{6}} link
 */
export function whatsappTemplateParams(vars: TemplateVars): string[] {
  return [vars.name, vars.salon, vars.service, vars.date, vars.time, vars.link];
}

export function renderTemplate(body: string, vars: TemplateVars) {
  return body.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = (vars as unknown as Record<string, string | undefined>)[key];
    return v ?? "";
  });
}
