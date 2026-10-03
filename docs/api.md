# NailSwap API contract (for the front end)

Every route lives under `src/app/api/**` and returns JSON. Errors always look like:

```json
{ "error": { "code": "slot_taken", "message": "Slot was just taken", "details": {} } }
```

| Status | Codes                                                                                                                         |
| ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| 400    | `validation` (with `details[]`), `invalid_json`, `invalid_form`, `bad_request`, `*_required`                                  |
| 401    | `unauthorized`                                                                                                                |
| 402    | `quota_exhausted`, `subscription_inactive`                                                                                    |
| 403    | `forbidden`                                                                                                                   |
| 404    | `not_found`                                                                                                                   |
| 409    | `slot_taken`, `slot_unavailable`, `booking_not_changeable`, `cutoff_passed`, `already_exists`, `seat_limit`, `job_not_ready`  |
| 413    | `too_large`                                                                                                                   |
| 422    | `slot_too_soon`, `slot_too_far`, `invalid_phone`, `invalid_code`, `not_hand`, `nails_not_visible`, `too_small`, `unsupported` |
| 429    | `rate_limited` (+ `retryAfter` seconds, `Retry-After` header)                                                                 |
| 503    | `card_unavailable`, `unavailable`                                                                                             |

Auth is cookie-based (Supabase session). Call the API with `credentials: "include"` from the
browser; Server Components can call the underlying `src/lib/**` functions directly instead of
going through HTTP. Phone numbers are accepted in any format and normalised to E.164 digits
without `+` (Lebanon default, e.g. `03 123 456` → `96103123456`). Locale comes from the
`NAILSWAP_LOCALE` cookie (set by next-intl) unless a `locale` field is sent.

Pages the front end must provide because links to them are generated server-side:

| Path                                  | Used by                                                                                |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| `/{locale}/b/{manageToken}`           | WhatsApp/SMS links to view, reschedule, cancel a booking                               |
| `/{locale}/dashboard/bookings/{id}`   | "New booking" email to the salon                                                       |
| `/{locale}/dashboard/billing`         | invoice emails, payment return (`?status=paid\|pending\|failed\|cancelled&paymentId=`) |
| `/{locale}/login?next=`               | proxy redirect for protected areas                                                     |
| `/{locale}/s/{slug}`, `/try`, `/book` | QR codes (`?utm_source=qr`), sitemap; subdomain `slug.nailswap.app` rewrites here      |

---

## Public

### `GET /api/health`

`{ ok, time, version, database, integrations: { ai, whatsapp, sms, email, card } }`

### `GET /api/salons?q&city&category&lat&lng&limit&offset`

Directory. `{ total, items: [{ id, slug, name, description, brandColor, logoUrl, coverUrl, city, area, lat, lng, languages, bookingMode, ratingAvg, ratingCount, plan, priority, distanceKm, designCount, categories, featuredCovers[] }] }`
Sorted by plan priority → distance (when `lat,lng`) → rating. Cached 60 s.

### `GET /api/salons/cities` → `{ cities: [{ city, count }] }`

### `GET /api/salons/{slug}`

Full public profile (RLS-filtered): `{ salon, hours[], holidays[], staff[], services[], designs[], polishes[], reviews[] }`.
`salon` includes `logoUrl`, `coverUrl`, `galleryUrls`, booking rules (`bookingMode`, `slot_interval_min`,
`min_lead_time_min`, `max_advance_days`, `deposit_*`, cutoffs) and `remove_branding`.
`designs[]`: `{ id, slug, name, nameI18n, category, tags, shape, length, priceAddon, durationAddonMin, coverUrl, images[], serviceIds[], polishIds[], isFeatured }`.
`polishes[]`: `{ id, brand, collection, shadeName, finish, hexColor, swatchUrl }`.

### `GET /api/salons/{slug}/reviews?limit&offset` → `{ total, reviews[] }`

### `GET /api/salons/{slug}/availability?serviceId&designId?&staffId?&from?&days=14`

`{ from, timezone, days: [{ date, count, firstStartsAt }] }` — calendar dots.

### `GET /api/salons/{slug}/slots?serviceId&designId?&staffId?&date=YYYY-MM-DD`

`{ date, timezone, durationMin, slots: [{ startsAt, endsAt, staffIds[] }] }` — ISO instants; render in `timezone`.

### `POST /api/salons/{slug}/leads` `{ phone, fullName?, designId?, tryonJobId?, notes? }`

"Send me this look" without booking. `201 { ok, lead }`.

### `POST /api/analytics` `{ kind, salonId?, designId?, polishId?, payload? }` → `204`

`kind ∈ page_view | tryon_ar_start | tryon_ar_capture | book_click | share | qr_scan | whatsapp_click`.
Fire-and-forget (`navigator.sendBeacon` works: send JSON with `Content-Type: application/json`).

---

## Auth (phone OTP)

### `POST /api/auth/otp/send` `{ phone, turnstileToken?, locale? }` → `{ ok, phone }`

Rate limits: 10/h per IP, 5/h per phone. Turnstile is enforced only when `TURNSTILE_SECRET_KEY` is set.

### `POST /api/auth/otp/verify` `{ phone, code, fullName?, locale? }`

Sets the session cookies. `{ ok, user: { id, phone, fullName, isPlatformAdmin }, isNew, salons: [{ id, slug, name, role }] }`.
`isNew` → ask for the name (send it back via `PATCH /api/auth/me` or on the next verify).

### `POST /api/auth/logout` → `{ ok }`

### `GET /api/auth/me`

`{ user: null }` for visitors, otherwise `{ user: { id, phone, email, fullName, avatarUrl, preferredLocale, isPlatformAdmin }, salons: [{ id, slug, name, status, logoUrl, onboardingComplete, role }] }`.

### `PATCH /api/auth/me` `{ fullName?, email?, preferredLocale?, avatarPath? }` → `{ ok, profile }`

---

## Try-on

AR try-on runs entirely in the browser (`src/lib/ar/*`); only `POST /api/tryon/session` (analytics)
and optional `POST /api/analytics` `tryon_ar_capture` touch the server.

### `POST /api/tryon/session` `{ mode: "ar"|"ai", salonId?, designId?, polishId?, device? }` → `201 { sessionId }`

### `POST /api/tryon/upload` — `multipart/form-data`

| field                                              | value                                                                                                                             |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `file`                                             | photo (jpeg/png/webp/heic, ≤ 12 MB)                                                                                               |
| `hands`                                            | JSON array from `HandTracker.detectImage()` on the same photo: `[{ landmarks: [{x,y,z}×21], handedness, score }]`                 |
| `params`                                           | JSON `{ mode: "catalog"\|"describe"\|"shape_length"\|"polish", shape?, length?, color?, finish?, art?, variations?: 1-4, seed? }` |
| `salonId?`, `designId?`, `polishId?`, `sessionId?` | context — `designId` implies the salon and fills shape/length/colour defaults                                                     |
| `consent`                                          | `"true"` (privacy checkbox)                                                                                                       |
| `turnstileToken?`, `locale?`                       |                                                                                                                                   |

The client must run MediaPipe on the still image first (`validateHandForTryOn` in
`src/lib/ar/nail-geometry.ts` gives the same `not_hand` / `nails_not_visible` / `too_small` reasons
before uploading). Server: EXIF/GPS stripped, ≤ 1536 px, mask rasterised, cache check, job queued
and processed immediately. Response `201` = **Job**:

```json
{ "id", "salonId", "status", "progress", "designId", "polishId", "params", "variations",
  "provider", "cached", "errorCode", "results": ["signed url", …], "inputUrl", "expiresAt",
  "isSaved", "createdAt", "updatedAt" }
```

`status ∈ queued | moderating | validating | masking | generating | succeeded | failed | rejected`
(translations in `messages/*.json → tryon.status`). Subscribe with Supabase Realtime:
`supabase.channel("job").on("postgres_changes", { event: "UPDATE", schema: "public", table: "tryon_jobs", filter: "id=eq.<id>" }, …)`
then re-fetch `GET /api/tryon/jobs/{id}` for signed URLs — or just poll it every 2 s.
`errorCode`: `inappropriate`, `quota_exhausted` (show upgrade prompt), `subscription_inactive`,
`ai_not_configured`, `generation_failed`, `timeout`.

### `GET /api/tryon/jobs/{id}` → Job (owner via cookie/anon id, salon members, admins)

### `DELETE /api/tryon/jobs/{id}` → `204` (owner deletes the photo now)

### `POST /api/tryon/jobs/{id}/save` `{ index?: 0-3, title? }` → `201` saved look (requires sign-in; claims anonymous jobs)

### `GET /api/account/looks` → `{ looks: [{ id, title, imageUrl, createdAt, jobId, salon, design, polish }] }`

### `DELETE /api/account/looks/{id}` → `204`

---

## Booking (client)

### `POST /api/bookings` — requires a signed-in user (OTP)

`{ salonId, serviceId, staffId?, designId?, tryonJobId?, startsAt (ISO), clientName, notes?, locale? }`
Phone comes from the session. `201` **Booking**:

```json
{ "id", "status": "confirmed"|"new", "source", "startsAt", "endsAt", "locale", "servicePrice", "designPrice",
  "totalPrice", "currency", "depositAmount", "clientNotes", "tryonImageUrl", "manageToken",
  "salon": { "id","slug","name","address","city","phone","whatsappNumber","timezone","logoUrl","brandColor","cancelCutoffHours","rescheduleCutoffHours" },
  "service": { "id","name","durationMin" }, "staff": { "id","displayName","avatarUrl" }, "design": { "id","name","coverUrl" } | null }
```

`status` is `new` when the salon uses approval mode (show "request received"). Confirmation
WhatsApp/SMS goes out immediately; reminders 24 h / 2 h before.

### `GET /api/account/bookings` → `{ upcoming[], past[] }` each with `manageToken`, `canReview`, `reviewId`, salon/service/staff/design summaries.

### `GET /api/bookings/manage/{token}` → Booking + `canCancel`, `canReschedule`

### `POST /api/bookings/manage/{token}/cancel` `{ reason? }` → Booking

### `POST /api/bookings/manage/{token}/reschedule` `{ startsAt }` → Booking (same technician/duration)

### `GET /api/bookings/manage/{token}/slots?date=` or `?days=14` → same shapes as the salon slot routes

### `POST /api/reviews` `{ bookingId, rating 1-5, body? }` → `201 { review, pendingModeration }`

### `POST /api/reviews/{id}/reply` `{ reply }` (salon manager) → `{ review }`

---

## Dashboard (salon members)

Roles: `owner` > `manager` > `staff`; platform admins pass everywhere. Most CRUD (services,
designs, polishes, staff, schedules, hours, holidays, clients, templates, salon settings) is done
directly with the Supabase browser/server client — RLS enforces the same roles (see
`supabase/migrations/20260901000600_rls.sql`). The routes below exist where server logic is needed.

### `GET /api/dashboard/salons` → `{ salons: [{ id, slug, name, status, logoUrl, onboarding_step, onboarding_completed_at, directory_approved, city, role }] }`

### `POST /api/dashboard/salons` `{ name, slug?, city?, defaultLocale?, brandColor? }` → `201 { salon }`

Creates the salon (pending), default hours, 14-day trial, refreshes the session (JWT gets `salon_roles`).
Onboarding progress: update `salons.onboarding_step` / `onboarding_completed_at` directly.

### `POST /api/dashboard/{salonId}/media` — multipart `{ file, kind: logo|cover|gallery|design|polish|staff }`

→ `201 { path, url, hex? }`. Store `path` on the row (`logo_path`, `cover_path`, `design_images.path`,
`polishes.swatch_path`, `staff.avatar_path`); `hex` is the auto-detected polish colour.

### `DELETE /api/dashboard/{salonId}/media` `{ path }` → `204`

### `GET /api/dashboard/{salonId}/quota`

`{ planCode, subscriptionStatus, quota, used, topupCredits, remaining, usedPct, warning, exhausted, periodStart, periodEnd, packs[] }`

### `GET /api/dashboard/{salonId}/analytics?from&to` (ISO, default 30 days)

`{ range, events{}, daily[{date,page_views,tryons,bookings}], bookings{total,by_status,by_source,revenue,no_show_rate}, clients{new,returning,total}, tryon{ar_sessions,ai_jobs,ai_succeeded,ai_cached,ai_cost_usd}, top_designs[], top_polishes[], funnel{pageViews,tryons,bookClicks,bookings,tryonToBookingRate} }`

### Bookings

- `POST /api/dashboard/{salonId}/bookings` `{ serviceId, staffId?, designId?, startsAt, clientName, clientPhone, notes?, locale?, silent? }` → `201` Booking (walk-in / phone).
- `GET /api/dashboard/{salonId}/bookings/{id}` → Booking + `staffNotes`, `client`, `events[]`.
- `PATCH /api/dashboard/{salonId}/bookings/{id}` `{ status?: confirmed|cancelled|completed|no_show, staffNotes?, cancelReason?, startsAt?, staffId? }` → Booking.
  Staff may only change status/notes on their own bookings; moving needs manager. Approvals and cancellations notify the client.
- Calendar/list views: query `bookings` directly (RLS) with `starts_at` ranges; subscribe to Realtime on `bookings` for live updates.

### Clients

- `GET /api/dashboard/{salonId}/clients/export` → CSV download.
- `POST /api/dashboard/{salonId}/clients/import` multipart `{ file }` (columns `full_name|name, phone, email?, notes?, locale?`) → `{ imported, skipped, errors[] }`.

### Team

- `GET /api/dashboard/{salonId}/members` → `{ members: [{ userId, role, fullName, phone, email, staff, joinedAt }] }`
- `POST /api/dashboard/{salonId}/members` `{ phone, fullName?, role: manager|staff, staffId? }` → `201` (owner; plan seat limit → `409 seat_limit`)
- `PATCH /api/dashboard/{salonId}/members/{userId}` `{ role }`, `DELETE …/members/{userId}` (owner)

### Marketing

- `GET /api/dashboard/{salonId}/qr?format=png|svg&size=1024&target=home|try|book&locale=` → image.
- Share links: `salonUrl(slug, locale)` = `https://{slug}.nailswap.app/{locale}` in production.

### Billing

- `GET /api/dashboard/{salonId}/billing` → `{ subscription (+plans), plans[], quota, invoices[] (+pdfUrl), payments[], options: { card, manualMethods[], topupPacks[] } }`
- `POST /api/dashboard/{salonId}/billing/checkout` (owner)
  `{ purpose: "subscription", plan: "basic"|"pro", method, referenceNote? }` or `{ purpose: "topup", packId: "pack_50"|"pack_200"|"pack_500", method, referenceNote? }`
  `method ∈ card | cash | whish | omt | bank_transfer` →
  `{ kind: "redirect", redirectUrl, paymentId, invoiceId }` (send the browser there) or
  `{ kind: "manual", paymentId, invoiceId, invoiceNumber, amount, currency, method, instructions }` (an admin confirms it).
- `GET /api/dashboard/{salonId}/invoices/{id}/pdf` → 302 to a signed PDF.

---

## Admin (platform admins)

- `GET /api/admin/overview` → KPIs `{ salons{pending,active,suspended}, subscriptions{trialing,active,grace}, bookingsLast7Days, aiJobsThisMonth, aiCostThisMonthUsd, revenueThisMonthUsd, queues{moderation,manualPayments} }`
- `POST /api/admin/salons/{id}/status` `{ status: pending|active|suspended, directoryApproved?, reason? }`
- `POST /api/admin/salons/{id}/plan` `{ plan: trial|basic|pro, reason? }`
- `POST /api/admin/payments/{id}` `{ status: paid|failed|refunded, referenceNote? }` — confirms manual payments (activates plan / grants credits)
- `POST /api/admin/impersonation` `{ salonId, reason }` → sets the `ns_impersonate` cookie (2 h); `GET` shows it; `DELETE` ends it.
  Dashboard pages: `getImpersonatedSalonId()` in `src/lib/admin/impersonation.ts`.
- `POST /api/admin/moderation/{id}` `{ action: approve|reject, note? }`
- Lists (salons, subscriptions, payments, moderation queue, audit log, feature flags, announcements): query the tables directly — admins pass RLS.

---

## Internal / webhooks (no UI)

- `POST /api/internal/notifications/dispatch`, `/api/internal/tryon/requeue`, `/api/internal/tryon/purge`, `/api/internal/billing/after-lifecycle`, `/api/internal/billing/lifecycle` — `Authorization: Bearer <INTERNAL_API_SECRET | CRON_SECRET>`.
- `POST /api/tryon/worker` `{ jobId? , limit? }` — same auth.
- `GET|POST /api/webhooks/whatsapp` (Meta), `POST /api/webhooks/mpgs` (gateway), `GET /api/payments/return?paymentId=` (redirect target).

## Realtime channels worth subscribing to

| Table           | Filter                | Use                            |
| --------------- | --------------------- | ------------------------------ |
| `tryon_jobs`    | `id=eq.<jobId>`       | AI try-on progress             |
| `bookings`      | `salon_id=eq.<salon>` | live calendar in the dashboard |
| `notifications` | `salon_id=eq.<salon>` | delivery status badges         |

RLS applies to Realtime: anonymous clients cannot subscribe to `tryon_jobs` rows they do not own
by JWT, so anonymous try-ons should poll `GET /api/tryon/jobs/{id}`.
