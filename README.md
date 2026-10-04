# NailSwap

Map-first salon discovery and booking, with photo-based AI nail try-on. Clients select a salon on the map, browse its photo feed, try a look on their own hand photo, and book. The camera provides a hand-positioning outline; it does not apply live AR effects.

Merchants land on bookings and manage their feed, services, salon description, map location, opening hours and staff. The local app runs at `http://localhost:3000/en`; the merchant area is `/en/dashboard`.

Architecture and design decisions: [`docs/superpowers/specs/2026-09-28-nailswap-design.md`](docs/superpowers/specs/2026-09-28-nailswap-design.md).
API contract for the front end: [`docs/api.md`](docs/api.md).

## Server setup and Vercel

Download `NailSwap-Server-Setup.tar.gz` from the [GitHub releases](https://github.com/ali-saadi111/nailswap/releases), upload it to your Ubuntu/Debian server, and run:

```bash
tar -xzf NailSwap-Server-Setup.tar.gz
cd NailSwap-Server-Setup
sudo bash setup.sh
```

The installer provisions Docker, self-hosted Supabase, HTTPS and a test catalog, then deploys the app to the existing NailSwap Vercel project. It prompts for a Vercel token and public server IP; no deployment credentials are included. AI testing uses Nano Banana 2 at 1K and a generated testing password.

Read the [full server setup guide](scripts/server/README.txt) for requirements and troubleshooting. The installer targets the original NailSwap Vercel project; forks must update `PROJECT`, `TEAM` and `SITE` in `scripts/server/installer.py` before use.

To build a fresh archive from a clone with Python 3:

```bash
python scripts/server/build_bundle.py --output-dir ../NailSwap-Server-Setup
```

The output directory must be empty. Local demo users and OTPs are for development only; the server installer does not install them.

## Status

| Layer                                                                      | State                                           |
| -------------------------------------------------------------------------- | ----------------------------------------------- |
| Database (schema, RLS, RPCs, cron)                                         | Done — 10 migrations, RLS tests                 |
| Server libraries (AI, AR maths, booking, notifications, payments, billing) | Done                                            |
| API routes (`src/app/api/**`)                                              | Done — see `docs/api.md`                        |
| Seed data, unit / RLS / API smoke tests, CI                                | Done                                            |
| Pages and UI components (`src/app/[locale]/**`)                            | **Not started** — only the locale layout exists |

## Stack

Next.js 16 (App Router, `proxy.ts`), React 19, TypeScript, Tailwind v4, next-intl (en / ar / fr, RTL),
Supabase (Postgres, Auth phone OTP, Storage, Realtime, pg_cron), MediaPipe Hands + ONNX Runtime Web +
guided hand-photo capture, fal.ai Nano Banana 2 at 1K for AI photo try-on (Seedream Lite and Kontext Pro available for comparison), WhatsApp Cloud API → Twilio SMS → Resend email,
MPGS hosted checkout (Areeba / BLOM / Audi) + manual payments, Upstash rate limiting, Cloudflare
Turnstile, Sentry, Vercel.

## Local development

Requirements: Node 24, pnpm 11, Docker Desktop (for Supabase).

```bash
pnpm install
pnpm db:start            # supabase start — applies migrations + supabase/seed.sql
pnpm exec supabase status -o env   # copy ANON_KEY / SERVICE_ROLE_KEY into .env.local
cp .env.example .env.local         # then fill the Supabase keys (see below)
pnpm db:seed             # 3 demo salons, staff, designs, bookings, admin user
pnpm models:download     # MediaPipe + ONNX assets into public/models (needed for AR)
pnpm dev                 # http://localhost:3000
```

Minimum `.env.local` for the API to run:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY from supabase status>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY from supabase status>
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
INTERNAL_API_SECRET=local-dev-internal-secret-change-me   # must match app_config.internal_secret (supabase/seed.sql)
CRON_SECRET=local-cron-secret
PAYMENT_CARD_PROVIDER=none
```

Everything else in `.env.example` is optional locally: without AI keys try-on jobs fail with
`ai_not_configured`; without WhatsApp/SMS/email keys notifications are logged and marked `sent`
(`provider_ref = noop:dev`).

### AI photo try-on

Keep `FAL_KEY` in the git-ignored `.env.local` (server only). The default is
`fal-ai/nano-banana-2/edit`, with `FAL_EDIT_RESOLUTION=1K` and no automatic
fallback model. Restart the app after changing provider settings. A single generation
is estimated at $0.08, plus the existing moderation call; multiple variations cost more.

Supported comparison options:

| Model | `FAL_EDIT_MODEL` | Estimated generation cost |
| --- | --- | --- |
| Seedream 5.0 Lite | `bytedance/seedream/v5/lite/edit` | $0.035/image |
| FLUX Kontext Pro, multi-reference | `fal-ai/flux-pro/kontext/multi` | $0.04/image |
| Nano Banana 2 (default, 1K) | `fal-ai/nano-banana-2/edit` | $0.08 at 1K; $0.12 at 2K |

`FAL_EDIT_RESOLUTION=1K` controls Nano Banana only. Seedream has its own output-size
setting. Costs are estimates, not invoices; verify actual charges in fal. Pricing was
checked on October 3, 2026 using fal's pricing API and
[Nano Banana resolution pricing](https://fal.ai/learn/tools/how-to-use-nano-banana-2).

Run a paid, one-image test independently of the database:

```bash
pnpm tryon:eval --hand ./my-hand.jpg --reference ./design.jpg
pnpm tryon:eval --hand ./my-hand.jpg --art "burgundy glossy polish, preserve nail shape"
pnpm tryon:eval --hand ./my-hand.jpg --design pink-blossoms --models "bytedance/seedream/v5/lite/edit,fal-ai/flux-pro/kontext/multi"
pnpm tryon:eval --hand ./my-hand.jpg --reference ./design.jpg --models fal-ai/nano-banana-2/edit --resolution 1K
```

Each model explicitly listed is billed. The evaluator saves original/reference images,
lossless results, prompts, queue receipts, timings and estimates under git-ignored
`tryon-eval/`. It exits with an error if any model fails, and never retries a paid request.
Inspect the saved queue receipt in fal before rerunning a timed-out evaluation.

Judge cuticle edges, all visible nails, reference pattern fidelity, skin/ring preservation,
and background changes at full zoom. Start with a sharp, evenly lit hand photo with the
nails facing the camera. These models regenerate the image; prompts do not guarantee
pixel-identical skin or background. Do not treat one successful sample as a quality benchmark.
Existing sample-photo attribution is in `scripts/assets/designs/credits.json`.

### Demo accounts (local OTP is always `123456`)

| Role           | Phone          | Notes                                   |
| -------------- | -------------- | --------------------------------------- |
| Platform admin | +961 70 000009 |                                         |
| Owner          | +961 70 000001 | Glow Nails Beirut (`glow-beirut`, Pro)  |
| Owner          | +961 70 000002 | The Nail Bar Jounieh (Basic)            |
| Owner          | +961 70 000003 | Studio Rosé (trial, approval booking)   |
| Staff          | +961 70 000011 | Rita @ Glow (manager)                   |
| Client         | +961 70 000021 | Has bookings, a saved look and a review |

Test numbers are listed in `supabase/config.toml → [auth.sms.test_otp]`. Salon subdomains work
locally as `glow-beirut.localhost:3000` (or `lvh.me`).

### Known local quirk

`public.ecr.aws/supabase/storage-api:v1.77.0` (pinned by Supabase CLI 2.118) ships with an
empty `package.json` and fails to start. Until the CLI moves on, tag a working image over it:

```bash
docker pull public.ecr.aws/supabase/storage-api:v1.72.1
docker tag public.ecr.aws/supabase/storage-api:v1.72.1 public.ecr.aws/supabase/storage-api:v1.77.0
```

## Scripts

| Script                                       | What it does                                                         |
| -------------------------------------------- | -------------------------------------------------------------------- |
| `pnpm dev / build / start`                   | Next.js                                                              |
| `pnpm typecheck`, `pnpm lint`, `pnpm format` | tsc, ESLint, Prettier                                                |
| `pnpm test`                                  | Vitest unit tests (`src/**/*.test.ts`)                               |
| `pnpm test:rls`                              | RLS + booking-engine tests against local Supabase (`tests/rls`)      |
| `pnpm test:e2e`                              | Playwright (`tests/e2e`; builds and starts the app, needs seed data) |
| `pnpm db:start / db:stop / db:reset`         | Local Supabase                                                       |
| `pnpm db:types`                              | Regenerate `src/lib/supabase/database.types.ts` (CI checks drift)    |
| `pnpm db:lint`                               | plpgsql lint                                                         |
| `pnpm db:seed`                               | Demo dataset (`scripts/seed.ts`)                                     |
| `pnpm models:download`                       | Browser ML assets into `public/models`                               |

## Project layout

```
src/app/[locale]/layout.tsx    root layout (fonts, i18n, RTL) — pages go under here
src/app/api/**                 route handlers (see docs/api.md)
src/app/robots.ts, sitemap.ts  SEO
src/proxy.ts                   next-intl routing, salon subdomain rewrite, auth gating
src/lib/api.ts                 route plumbing: errors, guards, parsing
src/lib/ai/*                   fal / Replicate providers, prompt builder
src/lib/ar/*                   MediaPipe wrapper, nail geometry, mask smoothing, Three.js renderer (browser)
src/lib/tryon/*                upload → mask → cache → worker pipeline
src/lib/booking/*              slot engine (pure), booking serialisers
src/lib/salons/*               public profile, directory search, availability
src/lib/notifications/*        templates, WhatsApp / SMS / email, dispatcher
src/lib/billing/*              checkout, settlement, invoice PDF, lifecycle
src/lib/payments/*             MPGS provider + manual methods
src/lib/supabase/*             clients (browser / server / admin / proxy), generated types
supabase/migrations/*          schema, RLS, RPCs, cron
scripts/seed.ts                demo data
tests/rls, tests/e2e           policy tests, API smoke tests
messages/{en,ar,fr}.json       UI strings (26 namespaces, already translated)
```

## Background jobs

pg_cron (see `supabase/migrations/20260901000800_cron.sql`) calls the app through pg_net with
`Authorization: Bearer <app_config.internal_secret>`:

| Schedule     | Endpoint                                                                 | Purpose                                                 |
| ------------ | ------------------------------------------------------------------------ | ------------------------------------------------------- |
| every minute | `POST /api/internal/notifications/dispatch`                              | WhatsApp → SMS → email, reminders, retries              |
| every 5 min  | `POST /api/internal/tryon/requeue`                                       | recover stuck AI jobs, drain the queue                  |
| hourly       | `POST /api/internal/tryon/purge`                                         | delete hand photos after 30 days (unless saved)         |
| daily 02:00  | `run_billing_lifecycle()` + `POST /api/internal/billing/after-lifecycle` | grace/downgrade, invoices, PDFs, emails, quota warnings |

On production set `app_config.app_url` and `app_config.internal_secret` (or use Vercel Cron with
`CRON_SECRET` against the same endpoints — `/api/internal/billing/lifecycle` runs the whole daily pass).

## WhatsApp templates

Create these templates in Meta Business Manager (category _Utility_, languages en/ar/fr) and put
their names in `WHATSAPP_TEMPLATE_*`. Every template uses six body parameters in this order:
`{{1}}` client name, `{{2}}` salon, `{{3}}` service, `{{4}}` date, `{{5}}` time, `{{6}}` link.
Default wording lives in `src/lib/notifications/templates.ts`; salons can override the text per
kind and language (`salon_notification_templates`).

## Deployment

Vercel (Node runtime, wildcard domain `*.nailswap.app` → the same project) + hosted Supabase.
Set every variable from `.env.example`, run migrations with `supabase db push`, insert the two
`app_config` rows, and configure the WhatsApp webhook (`/api/webhooks/whatsapp`) and MPGS
notification URL (`/api/webhooks/mpgs`). CI (`.github/workflows/ci.yml`) runs typecheck, lint,
unit tests, migrations + drift check, generated-types check, RLS tests and Playwright.
