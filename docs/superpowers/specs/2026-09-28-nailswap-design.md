# NailSwap — Architecture & Design Decisions

Date: 2026-09-28 · Status: implemented alongside this document

The product requirements live in the original brief (AI nail try-on + booking platform for salons
in Lebanon). This document records the architectural decisions that the brief left open and how
the system is decomposed, so the codebase can be understood without reading every file.

## 1. Stack and hosting

| Concern          | Choice                                                                                                                                     | Why                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework        | Next.js 16 App Router, TypeScript, Tailwind v4                                                                                             | Brief. Next 16 uses `proxy.ts` (not middleware) and async `params`.                                                                             |
| Data             | Supabase (Postgres, Auth, Storage, Realtime, pg_cron, pg_net)                                                                              | Brief. All access through RLS; service role only in trusted server paths.                                                                       |
| Hosting          | Vercel (Fluid compute, Node runtime)                                                                                                       | Brief. Cron endpoints are triggered by pg_cron → pg_net → `/api/internal/*` with a shared secret.                                               |
| i18n             | `next-intl`, `/[locale]/…` routes (`en`, `ar`, `fr`), RTL via `<html dir>`                                                                 | Server-rendered per locale for SEO; full RTL through logical CSS properties.                                                                    |
| Salon subdomains | `proxy.ts` rewrites `slug.nailswap.app/*` → `/{locale}/s/{slug}/*`                                                                         | One deployment, wildcard domain on Vercel.                                                                                                      |
| AR               | MediaPipe Hands (landmarks) + ONNX Runtime Web nail segmentation (WebGPU → WASM fallback) + Three.js shader                                | Brief. When the segmentation model file is absent, a landmark-geometric estimator produces the per-nail masks so the pipeline works end-to-end. |
| AI               | `lib/ai/tryon.ts` façade → fal.ai (primary, Flux Fill) → Replicate (secondary)                                                             | Reference-guided mask inpainting; timeouts, retries, failover, cost logging.                                                                    |
| Messaging        | WhatsApp Cloud API (templates) → Twilio SMS fallback → Resend email                                                                        | Brief.                                                                                                                                          |
| Payments         | `CardPaymentProvider` interface; MPGS Hosted Checkout (Areeba/BLOM/Audi acquirers) + manual (cash/Whish/OMT/transfer marked paid by admin) | Only MPGS-family gateways reliably onboard Lebanese merchants.                                                                                  |
| Rate limiting    | Upstash Redis sliding windows, in-memory fallback in dev                                                                                   | Per IP / phone / salon.                                                                                                                         |
| Bot protection   | Cloudflare Turnstile on OTP + upload                                                                                                       | Brief.                                                                                                                                          |
| Observability    | Sentry (client, server, edge), structured JSON logs                                                                                        | Brief.                                                                                                                                          |

## 2. Roles and authorization

- **Client** — anonymous by default (`anon_id` cookie); optional phone-OTP account (Supabase Auth).
- **Salon member** — `salon_members(salon_id, user_id, role ∈ owner|manager|staff)`. Owner is always a member (trigger).
- **Platform admin** — `profiles.is_platform_admin`.
- JWT carries `is_platform_admin` and `salon_roles` (custom access token hook) so the proxy can gate `/dashboard`, `/admin` without a DB call. RLS re-checks membership from tables (never trusts client input).
- Staff can only update `status`/`staff_notes` on their own bookings (trigger `restrict_staff_booking_update`).

## 3. Data model (public schema)

Core: `profiles`, `plans`, `salons`, `salon_members`, `salon_hours`, `salon_holidays`, `staff`,
`staff_schedule_rules` (work/break intervals per weekday), `staff_time_off`, `services`,
`staff_services`, `polishes`, `designs`, `design_images`, `design_services`, `design_polishes`,
`clients` (per-salon CRM, unique on phone), `leads`, `salon_notification_templates`.

Try-on: `tryon_sessions` (AR + AI, analytics), `tryon_jobs` (AI queue; Realtime), `saved_looks`,
`ai_cost_log`, `quota_topups`, `analytics_events`.

Booking: `bookings` with **exclusion constraint** `(staff_id =, tstzrange(starts_at, ends_at) &&)`
on live statuses → double booking is impossible under concurrency. `booking_events` audit,
`notifications` outbox (scheduled reminders), `reviews` (only after `completed`, trigger-enforced).

Billing/admin: `subscriptions` (trial → active → grace → downgrade/expire, `run_billing_lifecycle()`),
`invoices`, `payments`, `feature_flags`, `announcements`, `admin_audit_log`,
`impersonation_sessions`, `moderation_queue`.

RPCs: `create_salon`, `book_slot` (server-side after OTP), `staff_is_available`,
`booking_by_token` / `cancel_booking_by_token` / `reschedule_booking_by_token` (links in messages),
`reserve_ai_credit` (advisory-locked quota check), `salon_ai_quota`, `admin_change_plan`,
`admin_set_salon_status`, `run_billing_lifecycle`.

## 4. AI photo try-on pipeline

`POST /api/tryon/upload` → normalise (EXIF/GPS stripped, ≤1536px JPEG, sha256) → `tryon` bucket →
`tryon_jobs` row (`queued`) → worker (`/api/tryon/worker`, invoked immediately and by cron requeue):

1. **moderate** — provider NSFW check (fal) before any paid generation.
2. **validate** — MediaPipe Hands on the server image (sharp → landmarks) rejects photos without
   a visible hand / nails.
3. **mask** — per-nail polygons from landmarks (extended toward fingertips for shape/length),
   rasterised to a feathered PNG mask.
4. **generate** — `inpaint()` façade with primary/secondary failover; results copied into our bucket.
5. **cache** — `cache_key = sha256(input_hash | design_id | params)`; a hit copies the result at zero cost.
6. Status/progress pushed by Postgres → Realtime; the UI subscribes to its job row.

Quota: `reserve_ai_credit()` before the paid call; hard stop with upgrade prompt at zero remaining.
AR try-ons are unlimited and never touch the server (only an analytics event).

## 5. Live AR try-on

`HandTracker` (MediaPipe, VIDEO mode) → `NailSegmenter` (ONNX WebGPU/WASM at 192×192 crops per
hand, or geometric fallback) → `MaskSmoother` (EMA per nail + temporal hysteresis) →
`NailRenderer` (Three.js full-screen quad: video texture + mask texture + polish shader: base
color, finish presets glossy/matte/chrome/cat-eye/glitter/shimmer/french, specular follows nail
curvature from the mask gradient, light direction estimated from frame luminance). Target 24fps on
mid-range phones: inference every frame at low resolution, render at display resolution.
Capture → PNG → optional hand-off to the AI pipeline.

## 6. Booking engine

Slots are computed by a pure function (`lib/booking/slots.ts`, unit-tested): salon hours ∩ staff
work rules − breaks − time off − live bookings, stepping by `slot_interval_min`, honouring lead
time and advance window. The database is the source of truth for conflicts (exclusion constraint);
`book_slot()` converts the violation into a clear "slot just taken" error.

Notifications are rows in `notifications`; pg_cron dispatches every minute via
`/api/internal/notifications/dispatch`: WhatsApp template → on non-WhatsApp user, SMS → email for
salon owners. Reminders (24h/2h) are scheduled on confirmation and cancelled on status change.

## 7. Billing

Plans in `plans` (trial 14d / basic / pro). `run_billing_lifecycle()` (daily) moves lapsed periods
to `grace`, issues invoices, then downgrades (Pro→Basic) or expires. Payments settle invoices via
the `on_payment_paid` trigger (activates subscription, grants top-up credits). PDFs via
`@react-pdf/renderer` stored in `private-docs`.

## 8. Security & privacy

RLS on every table (tested in `tests/rls`). Private images only via signed URLs. Hand photos
expire after 30 days unless saved (`tryon_jobs.expires_at`, hourly purge). Consent checkbox before
upload. Turnstile on OTP/upload. Rate limits per IP/phone/salon. Security headers in
`next.config.ts`; COOP/COEP on try-on routes for WASM threads.

## 9. Testing & delivery

- Unit (Vitest): slot calculation, quota/pricing helpers, prompt builder, mask utilities.
- RLS (Vitest against local Supabase): anon/client/staff/manager/admin matrices.
- E2E (Playwright, fake camera): try-on → booking; onboarding → first booking; admin plan change.
- CI (GitHub Actions): typecheck, lint, unit, migrations apply + drift check + generated types
  check, RLS tests, E2E.
- `scripts/seed.ts` creates 3 demo salons with designs, polishes, staff, services, bookings.
