-- NailSwap: extensions and enum types
create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "btree_gist" with schema extensions;
create extension if not exists "pg_net" with schema extensions;
create extension if not exists "pg_cron";
create extension if not exists "unaccent" with schema extensions;

-- ── Enums ────────────────────────────────────────────────────────────────────
create type public.app_locale as enum ('ar', 'en', 'fr');
create type public.salon_status as enum ('pending', 'active', 'suspended');
create type public.salon_member_role as enum ('owner', 'manager', 'staff');
create type public.booking_mode as enum ('instant', 'approval');
create type public.booking_status as enum ('new', 'confirmed', 'completed', 'no_show', 'cancelled');
create type public.booking_source as enum ('tryon', 'direct', 'rebook', 'dashboard');
create type public.service_category as enum (
  'gel', 'acrylic', 'biab', 'extensions', 'removal', 'manicure', 'pedicure', 'nail_art', 'other'
);
create type public.design_category as enum (
  'french', 'chrome', 'ombre', 'art_3d', 'minimal', 'bridal', 'seasonal'
);
create type public.polish_finish as enum (
  'glossy', 'matte', 'chrome', 'cat_eye', 'glitter', 'shimmer', 'french_tip'
);
create type public.nail_shape as enum ('square', 'squoval', 'round', 'almond', 'coffin', 'stiletto');
create type public.nail_length as enum ('short', 'medium', 'long');
create type public.tryon_mode as enum ('ar', 'ai');
create type public.tryon_job_status as enum (
  'queued', 'moderating', 'validating', 'masking', 'generating', 'succeeded', 'failed', 'rejected'
);
create type public.ai_provider as enum ('fal', 'replicate', 'cache');
create type public.plan_code as enum ('trial', 'basic', 'pro');
create type public.subscription_status as enum (
  'trialing', 'active', 'past_due', 'grace', 'cancelled', 'expired'
);
create type public.invoice_status as enum ('draft', 'open', 'paid', 'void', 'uncollectible');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded');
create type public.payment_method as enum ('card', 'cash', 'whish', 'omt', 'bank_transfer');
create type public.payment_purpose as enum ('subscription', 'topup', 'deposit');
create type public.notification_channel as enum ('whatsapp', 'sms', 'email');
create type public.notification_status as enum ('queued', 'sent', 'delivered', 'failed', 'cancelled');
create type public.notification_kind as enum (
  'booking_confirmation', 'booking_pending', 'booking_approved', 'booking_reminder_24h',
  'booking_reminder_2h', 'booking_rescheduled', 'booking_cancelled', 'salon_new_booking',
  'salon_invoice', 'salon_quota_warning'
);
create type public.moderation_status as enum ('pending', 'approved', 'rejected');
create type public.moderation_kind as enum ('review', 'upload', 'design');
create type public.lead_status as enum ('new', 'contacted', 'converted', 'lost');
create type public.schedule_rule_kind as enum ('work', 'break');
create type public.analytics_event_kind as enum (
  'page_view', 'tryon_ar_start', 'tryon_ar_capture', 'tryon_ai_request', 'tryon_ai_success',
  'tryon_ai_failed', 'book_click', 'booking_created', 'share', 'qr_scan', 'whatsapp_click'
);

-- ── Utility: updated_at trigger ──────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ── Utility: slugify ─────────────────────────────────────────────────────────
create or replace function public.slugify(input text)
returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(extensions.unaccent(coalesce(input, ''))), '[^a-z0-9]+', '-', 'g'));
$$;
