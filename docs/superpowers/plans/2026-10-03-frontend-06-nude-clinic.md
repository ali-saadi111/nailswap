# Front end — 06 Nude Clinic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build every page of NailSwap (`src/app/[locale]/**`) against the 33 reference screens in `design/nailswap-06/screens/png/`, following `design/nailswap-06/DESIGN.md`, on top of the finished API (`docs/api.md`).

**Architecture:** Server Components fetch through the existing `src/lib/**` helpers and the cookie-bound Supabase client; interactive pieces are small Client Components that call `/api/**` with `credentials: "include"`. One shared component kit (`src/components/ui`, `src/components/shell`, `src/components/nails`) implements the design once; pages compose it. Routing stays as `proxy.ts` already expects (`/[locale]`, `/s/[slug]`, `/b/[token]`, `/dashboard/*`, `/admin/*`, `/login`).

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, next-intl 4, Supabase SSR, lucide-react, date-fns, MediaPipe + Three.js (existing `src/lib/ar`).

**Spec:** `design/nailswap-06/DESIGN.md` (rules, tokens, components, patterns) + `docs/api.md` (data).

---

## Conventions (apply to every task)

- Ground only: no cards, no white surfaces, no shadows on the page. Hairlines (`border-border`) only between rows. One filled pill per view.
- Fonts: DM Sans (`--font-sans`), DM Serif Display (`--font-display`), IBM Plex Sans Arabic for `ar`.
- Logical properties only (`ps-`, `pe-`, `ms-`, `me-`, `border-s`, `start-`, `end-`); chevrons flip with `rtl:-scale-x-100`.
- Strings come from `messages/{en,ar,fr}.json`; new keys are added to all three files.
- Client fetches go through `src/lib/client/api.ts` (`api.get/post/patch/del`) which throws `ApiClientError { code, status, message }`.
- Verification per task: `pnpm typecheck` and `pnpm lint` pass; the page renders at phone width (390px) and desktop (1280px) against the local stack when it is up.

## File map

| Area       | Files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foundation | `src/app/globals.css`, `src/app/[locale]/layout.tsx`, `src/app/manifest.ts`, `src/components/ui/{button,input,primitives,toaster}.tsx`, `src/components/ui/{status-dot,tabs,filter-toggle,list-row,kpi,icon-button,switch}.tsx`, `src/components/nails/{nail,nail-group,fills}.tsx`, `src/components/shell/{wordmark,phone-header,tab-bar,consumer-shell,sidebar,dashboard-shell,page-header}.tsx`, `src/lib/client/api.ts`, `src/lib/client/use-me.ts`, `src/lib/format.ts`                                                                                               |
| i18n       | `messages/{en,ar,fr}.json` (new `ui` namespace; extend `home`, `explore`, `salon`, `tryon`, `booking`, `account`, `dashboard`, `admin`)                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Public     | `src/app/[locale]/(consumer)/layout.tsx`, `.../page.tsx` (home), `.../explore/page.tsx` + `explore-list.tsx`, `.../for-salons/page.tsx`, `.../legal/[doc]/page.tsx`, `src/app/[locale]/s/[slug]/page.tsx` + `salon-tabs.tsx`, `src/app/[locale]/not-found.tsx`, `src/app/[locale]/error.tsx`, `src/app/[locale]/loading.tsx`                                                                                                                                                                                                                                               |
| Auth       | `src/app/[locale]/login/page.tsx` + `login-form.tsx`, `src/app/[locale]/logout/page.tsx`, `src/components/auth/otp-input.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Try-on     | `src/app/[locale]/(consumer)/try/page.tsx`, `src/app/[locale]/s/[slug]/try/page.tsx`, `src/components/tryon/{tryon-screen,live-ar,ai-photo,job-progress,result,design-rail}.tsx`, `src/lib/client/tryon.ts`                                                                                                                                                                                                                                                                                                                                                                |
| Booking    | `src/app/[locale]/s/[slug]/book/page.tsx`, `src/components/booking/{booking-flow,slot-picker,otp-step,confirmation}.tsx`, `src/app/[locale]/b/[token]/page.tsx` + `manage-booking.tsx`, `src/app/[locale]/b/[token]/review/page.tsx` + `review-form.tsx`                                                                                                                                                                                                                                                                                                                   |
| Account    | `src/app/[locale]/(consumer)/account/page.tsx` + `profile.tsx`, `.../account/bookings/page.tsx`, `.../account/looks/page.tsx` + `looks-grid.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Dashboard  | `src/lib/dashboard/context.ts`, `src/app/[locale]/dashboard/layout.tsx`, `page.tsx` (redirect), `onboarding/page.tsx` + `wizard.tsx`, `calendar/page.tsx` + `calendar-view.tsx`, `bookings/page.tsx` + `bookings-table.tsx`, `bookings/[id]/page.tsx` + `booking-detail.tsx`, `clients/page.tsx` + `clients-view.tsx`, `analytics/page.tsx` + `charts.tsx`, `marketing/page.tsx` + `marketing-tools.tsx`, `settings/page.tsx` + `settings-form.tsx`, `billing/page.tsx` + `billing-view.tsx`, `catalog/page.tsx` + `catalog-view.tsx`, `staff/page.tsx` + `staff-view.tsx` |
| Admin      | `src/app/[locale]/admin/layout.tsx`, `page.tsx` (overview), `approvals/page.tsx` + `approvals-table.tsx`, `payments/page.tsx` + `payments-table.tsx`, `moderation/page.tsx` + `moderation-queue.tsx`, `impersonation/page.tsx` + `impersonation-form.tsx`, `salons/page.tsx`, `users/page.tsx`, `settings/page.tsx`                                                                                                                                                                                                                                                        |

## Tasks

### Task 1: Tokens, fonts, manifest (DESIGN.md §0.1–0.2)

- [ ] Replace the `:root` / dark blocks in `src/app/globals.css` with `design/nailswap-06/tokens.css`; merge `@theme inline` additions; add `.nail-*` to `@layer components`; delete `.card`.
- [ ] Swap fonts in `src/app/[locale]/layout.tsx` to `DM_Sans` + `DM_Serif_Display`; theme colours `#f7f3ef` / `#1b1613`; same in `manifest.ts`.
- [ ] `pnpm typecheck`.

### Task 2: UI kit (DESIGN.md §4–5)

- [ ] Restyle `button.tsx` (pill / text-link variants), `input.tsx` (underline field), `primitives.tsx` (StatusDot replaces Badge, Section replaces Card, Kpi replaces Stat, Tabs as text tabs, EmptyState without box, Dialog/Toast on `bg-overlay`), `toaster.tsx`.
- [ ] Add `filter-toggle`, `list-row`, `icon-button`, `switch`; nails kit (`Nail`, `NailGroup`, `fillForDesign`).
- [ ] Shell: `Wordmark`, `PhoneHeader`, `TabBar`, `ConsumerShell` (phone column centred, tab bar), `Sidebar` + `DashboardShell` (240px sidebar, no background), `PageHeader`.
- [ ] `src/lib/client/api.ts`, `use-me.ts`, `src/lib/format.ts` (money, time ranges, initials).
- [ ] `pnpm typecheck && pnpm lint`.

### Task 3: i18n keys

- [ ] Add every new string used by Tasks 4–10 to `messages/en.json`.

### Task 4: Public pages (public-01…04)

- [ ] Consumer layout with tab bar; home; explore (list + filters from `searchSalons`); salon page (`getPublicSalon`, text tabs, designs grid, services rows, sticky pill, runtime `--accent` from `brand_color`); legal; for-salons; not-found; error; loading.

### Task 5: Auth (auth-01…02)

- [ ] `/login?next=` phone + OTP (`/api/auth/otp/*`), redirect to `next`; `/logout` calls `POST /api/auth/logout` then shows the signed-out screen.

### Task 6: Try-on (try-on-01…04)

- [ ] Live AR screen on `src/lib/ar/*` (HandTracker → NailSegmenter → MaskSmoother → NailRenderer), design rail, shape/length toggles, shutter → capture; AI photo step (upload + consent → `/api/tryon/upload`), job progress (poll `/api/tryon/jobs/{id}` every 2 s), result with before/after and Save look (`/save`, sign-in prompt on 401).

### Task 7: Booking (booking-01…05)

- [ ] `/s/[slug]/book?serviceId&designId&staffId`: slot picker (availability + slots APIs), OTP step, `POST /api/bookings`, confirmation; `/b/[token]`: manage (reschedule / cancel); `/b/[token]/review`.

### Task 8: Account (account-01…03)

- [ ] Profile (me + PATCH), bookings (upcoming / past), saved looks grid (delete, book).

### Task 9: Dashboard (salon-01…10)

- [ ] `src/lib/dashboard/context.ts` resolves salon (impersonation → `ns_salon` cookie → first membership), role, plan, quota.
- [ ] Layout + sidebar; onboarding wizard; calendar (day/week grid from `bookings`); bookings table + detail (PATCH status/notes); clients (list + import/export); analytics (KPIs + bar charts + funnel); marketing (QR, share links); settings (sections, Save pill); billing (usage meter, plans, invoices, checkout); catalog (designs / services / polishes CRUD via Supabase + media upload); staff (list, schedule, invite).

### Task 10: Admin (admin-01…05)

- [ ] Layout + admin nav + impersonation strip; overview KPIs; approvals (status/plan POSTs); payments (mark paid); moderation (approve/reject); impersonation (start/end); salons, users, settings lists.

### Task 11: Verification

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm build`; browser pass on every route at 390px and 1280px, LTR and `ar` RTL.
