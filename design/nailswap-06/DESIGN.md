# NailSwap UI — 06 Nude Clinic (simplified)

The rulebook for every NailSwap screen and component. Read this before building or changing UI.
Visual references for all 33 screens: `screens/png/` (open `screens/index.html` for a gallery).
Tokens: `tokens.css`. The design canvas the references come from: see `README.md`.

**The idea in one line:** one warm ground, no cards — hierarchy comes from type, whitespace and a few hairlines. Calm, editorial, trustworthy.

---

## 0. Applying 06 to the codebase (one-time)

Do these once, then follow §1–§8 for every screen.

1. **Tokens** — in `src/app/globals.css`, replace the `:root`, dark-mode `:root…` and `:root[data-theme="dark"]` blocks with the ones in `tokens.css`; merge its `@theme inline` additions into the existing `@theme inline` block; add the `.nail-*` classes to `@layer components`. Delete the `.card` utility (or leave it unused — §3 bans cards).
2. **Fonts** — in `src/app/[locale]/layout.tsx` replace `Inter` → `DM_Sans` (`variable: "--font-sans"`, subsets latin + latin-ext) and `Fraunces` → `DM_Serif_Display` (`weight: "400"`, `variable: "--font-display"`). Keep `IBM_Plex_Sans_Arabic` as `--font-arabic`. Update `themeColor` to `#f7f3ef` / `#1b1613`. (This repo's Next.js differs from older versions — check `node_modules/next/dist/docs/` for `next/font` before editing.)
3. **Components** — restyle `src/components/ui/*` per the migration table in §5. Keep their props/APIs where possible so call sites don't break.
4. Then build screens against `screens/png/*` using §4 and §6.

---

## 1. Principles

1. **One ground.** Every screen sits on `--background` (#F7F3EF). No white cards, no raised panels, no sidebar or top-bar backgrounds. `--surface` equals the ground on purpose.
2. **Type does the hierarchy.** DM Serif Display for screen titles, salon names and big numbers; DM Sans for everything else. Size and weight, not boxes, say what matters.
3. **Whitespace first, hairline second.** Group with space (8 / 16 / 24 / 32 / 48). Use a 1px `--border` hairline only between rows of a list or table, and at most one vertical hairline to split a list from its detail pane. Never more than one line between two things.
4. **One filled button per view.** The primary action is a cocoa pill. Everything else is a text link.
5. **The product is the picture.** Nail swatches sit directly on the ground (no tile behind them). People and salons are circles with initials or photos.
6. **Show less.** If a screen feels busy, show fewer items or move detail one tap deeper — don't add containers.

---

## 2. Tokens (see `tokens.css` for values)

| Token | Light | Use |
|---|---|---|
| `--background` / `--surface` | #F7F3EF | The ground. Everything. |
| `--surface-2` | #EFE8E1 | Quiet fill: skeletons, hovered table rows, calendar off-hours, media placeholder |
| `--overlay` | #FBF8F5 | Only dialogs, bottom sheets, menus, toasts |
| `--foreground` | #2B211C | Text, active tab underline |
| `--muted` | #6F6259 | Labels, meta, secondary text, inactive nav/tabs |
| `--muted-2` | #8A7C72 | Placeholders, disabled — never body text (3.7:1) |
| `--border` | #E9E0D7 | Row hairlines |
| `--border-strong` | #D9CEC4 | Field underline, switch off-track |
| `--accent` | #6B3F2A cocoa | Primary pill, links, selected state, active nav dot. Salon pages may override at runtime (keep ≥ 4.5:1 with `--accent-contrast`) |
| `--accent-hover` | #58321F | Pill hover |
| `--nude` / `--accent-soft` | #E7CDBE | Avatars, placeholder art |
| `--success` | #4F6D4C sage | Confirmed / paid / healthy |
| `--pending` | #C49A74 | Dot only for new / pending (not text) |
| `--warning` / `--danger` / `--info` | #8C5A24 / #A33A2C / #3F5F7A | Text-safe status colours |
| `--success-soft` / `--pending-soft` | #DDE7DA / #EFE3DA | Calendar block tints |

Dark-mode values in `tokens.css` are **derived, not designed yet** — review before shipping dark mode.

**Type scale** (DM Serif Display = *serif*, DM Sans = *sans*)

| Role | Phone | Desktop |
|---|---|---|
| Screen title | serif 32–36 / 1.1 | serif 38 / 1.1 |
| Section heading | sans 16 / 600 | serif 24 or sans 16 / 600 |
| Big number (KPI, time, price) | serif 32–40 | serif 40 |
| Body | sans 15–16 / 1.5 | sans 14–15 / 1.5 |
| Label / meta | sans 13 / muted | sans 13 / muted |
| Caption / table header | sans 12 / 500 / muted | sans 12 / 500 / muted |
| Buttons, links, tabs | sans 15 / 500 | sans 14–15 / 500 |

Arabic (`dir="rtl"`): DM fonts have no Arabic — body uses IBM Plex Sans Arabic; serif titles fall back to Plex Arabic 600 at the same size.

**Spacing** 4 · 8 · 12 · 16 · 24 · 32 · 48 · 56. Phone side padding 24px. Desktop content padding 48px (24px next to the sidebar). Touch targets ≥ 44px.

---

## 3. The rectangle budget

**Allowed shapes — and only these:**
- One filled primary pill per view (a sticky bottom action counts as that one).
- Selection marks: filled cocoa circle (selected day), filled cocoa pill (selected time slot), switch, native checkbox/radio (`accent-color: var(--accent)`).
- Nail swatches, avatar circles, the QR code.
- Media that *is* the content: try-on camera, before/after, uploaded photo, poster preview, map — `rounded-media`, no border, no shadow.
- Calendar appointment blocks (soft tint, no border, `rounded-block`) and chart bars.
- Overlays: dialog, bottom sheet, menu, toast — `bg-overlay shadow-lg`, no border.
- One full-width thin strip: the admin impersonation banner (40px).

**Banned:**
- Cards of any kind, white surfaces, shadows on the page, `.card`, `<Card>`.
- Outlined or tinted secondary buttons → text links.
- Bordered or filled inputs → underline fields.
- Chips / pills for filters, tags, badges or statuses → text toggles or dot + label.
- Segmented controls → text tabs with an underline.
- Icon buttons with rings or backgrounds → bare icons with a 44px hit area.
- Info banners with backgrounds → one muted line with an icon.
- KPI tiles, chart containers, table outer borders, zebra stripes, dashed empty-state boxes.
- Decorative blobs, pattern fills, avatar stacks, floating cards over images, nested containers.

If you're about to add a box, use space or a hairline instead.

---

## 4. Components (Tailwind v4, using this repo's token utilities)

**Primary button (pill)** — max one per view.
`inline-flex h-13 items-center justify-center gap-2 rounded-full bg-accent px-7 text-[15px] font-medium text-accent-contrast hover:bg-accent-hover disabled:opacity-60`
Desktop / compact: `h-11 px-5.5 text-sm`. Full-width on phones for flow steps (Continue, Verify, Save look).

**Text link (all secondary actions)**
`inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium text-accent hover:text-foreground`
Neutral variant: `text-foreground hover:text-accent`. Destructive: `text-danger`. Trailing chevron for "go somewhere" links (flip in RTL).

**Icon button** — `inline-flex size-11 items-center justify-center text-foreground hover:text-accent` + `aria-label`. No background, no ring. Icons: lucide, 20px, stroke 1.75.

**Field** — label above, underline input.
- Label: `text-[13px] text-muted mb-1`
- Input / select / textarea: `h-12 w-full border-0 border-b border-border-strong bg-transparent px-0 text-base text-foreground placeholder:text-muted-2 focus:border-b-2 focus:border-accent focus-visible:outline-none`
- Error: border-b `--danger` + `text-danger text-[13px] mt-1.5` message (`role="alert"`).
- 24px between fields. Search = leading icon + underline field.
- OTP: six digits, each over its own 40px underline; focused one cocoa 2px.

**Tabs** — `flex gap-6`; tab `h-11 border-b-2 border-transparent text-[15px] font-medium text-muted aria-selected:border-foreground aria-selected:text-foreground`. Counts as plain muted text after the label ("Upcoming 2").

**Filter toggle** — text button `h-11 text-sm font-medium text-muted`, pressed = `text-accent` with a 6px cocoa dot before the label (`aria-pressed`). A row of these replaces filter chips. Dropdown filters add a small chevron.

**Status** — `inline-flex items-center gap-1.5 text-[13px] font-medium` + 7px dot. Always dot + word.

| Value (DB enum) | Dot | Label |
|---|---|---|
| booking `new` | `--pending` | New |
| booking `confirmed` | `--success` | Confirmed |
| booking `completed` | `--accent` | Completed |
| booking `no_show` | `--danger` | No-show |
| booking `cancelled` | hollow (1px `--muted` ring) | Cancelled |
| payment `paid` / `pending` / `failed` / `refunded` | success / pending / danger / hollow | — |
| salon `pending` / `active` / `suspended` | pending / success / danger | — |

**Switch** — 44×26 pill; off `bg-border-strong`, on `bg-accent`; thumb `bg-background`, no shadow; mirror direction in RTL.

**List row** — `flex min-h-14 items-center gap-3.5 border-b border-border`. Leading 40–48px avatar circle (`bg-nude text-accent`, initials) · title sans 16/600 · meta 13 muted · trailing value or chevron. No border on the last row is fine either way.

**Avatar** — circle, `bg-nude text-accent text-[13px] font-medium`, initials; photo when available.

**Nail swatch** — `.nail .nail-almond` (or oval/square/coffin/stiletto) sized ~0.68 width:height, background = the design's fill. Show 3–5 in a row with slightly varied heights. Design name below in 13px. Never a tile behind them.

**Media** — `rounded-media bg-surface-2 overflow-hidden`, no border/shadow.

**Overlay (Dialog, BottomSheet, Menu, Toast)** — `bg-overlay shadow-lg rounded-2xl` (sheet: `rounded-t-3xl` + 36×4 grabber), no border; content inside follows the same open rules (no cards inside).

**Empty state** — centered: serif 24 title, one muted line, one action (pill or link). No dashed box, no illustration box.

**Skeleton** — `bg-surface-2` text-line bars and avatar circles only; never card-shaped placeholders.

---

## 5. Migrating the existing `src/components/ui/*`

| Today | 06 change |
|---|---|
| `Button` `primary` | rounded-full pill, `h-13` (lg) / `h-11` (md), no shadow, hover `bg-accent-hover` |
| `Button` `secondary` / `outline` / `ghost` | render as text links (§4). Keep the variant names so call sites compile |
| `Button` `icon` | bare icon, `size-11`, no background |
| `Button` `danger` | text link in `text-danger`; a filled danger pill only as the confirm inside a dialog |
| `Input`, `Textarea`, `Select` (`inputClasses`) | underline field (§4) |
| `Label`, `Field` | label `text-[13px] text-muted`, 24px rhythm |
| `Switch` | colours per §4, no thumb shadow |
| `Tabs` | text tabs with underline — no pill track, no white active pill |
| `Badge` | replace with a `StatusDot` (dot + label); don't use tinted pills |
| `Card`, `CardHeader` | replace with a plain `Section` (heading + content, spacing only) |
| `Stat` | `Kpi`: serif 40 number + 13 muted label + optional delta line; no box |
| `EmptyState` | drop the dashed border |
| `Dialog`, `Toaster` | `bg-overlay`, `shadow-lg`, no border |
| `.card` utility | remove |

---

## 6. Patterns

**Phone screen** — header row 44px: back/menu `IconButton` · wordmark (small cocoa almond nail + "NailSwap" serif 22) or a step label · action link. Then serif title + one muted line. Content in 24px columns. Primary action pinned bottom (`absolute inset-x-6 bottom-[max(1.5rem,env(safe-area-inset-bottom))]`), optional one-line summary above it, no bar background.

**Consumer tab bar** — Discover · Try on · Bookings · Profile; icon 24 + label 11/500; active `text-accent`; no top border, same ground.

**Lists & directories** — list rows (§4). Next free times as cocoa text links ("Today 16:30 · 17:15 · Sun 11:00"). AR-ready = small sparkle icon + "AR-ready" in sage text.

**Salon page** (`/[locale]/s/[slug]`, served on `slug.nailswap.app`) — `lumiere.nailswap.app` as small muted text with a lock icon in the header, circle salon avatar instead of a cover box, serif name, rating · area line, open-now as status dot, text tabs (Designs · Services · Reviews · About), designs as nail groups on the ground, services as list rows with duration + price, sticky "Book an appointment" pill.

**Try-on** — camera view is the one big media area (top ~60%, `rounded-media` or full-bleed). Controls sit below on the ground: mode tabs (Live AR | AI photo), shape filter toggles, design row of nails with a dot under the selected one, round shutter, "Save look" link + "Book this" pill. Job progress = vertical step list with dots + one 2px progress line + percent; a small "Live" status dot for the Realtime channel.

**Booking** — slot picker: staff as filter toggles, week as day numbers (selected = filled cocoa circle), times in a grid by Morning / Afternoon / Evening (selected = filled cocoa pill, unavailable = struck-through `text-muted-2`). Confirmation / manage-by-token (`/b/[token]`): label/value rows with hairlines, one pill, cancel as a `text-danger` link with the policy line above it.

**Forms & settings** — sections separated by 48px with a serif 24 heading; fields are underline fields; toggles as list rows with a trailing switch; one Save pill per section or page.

**Dashboard shell** (`/dashboard/*`, and `/admin/*` with admin nav)
- Sidebar 240px, *no background, no border*: wordmark → salon switcher as a text link with chevron ("Lumière Nail Bar ⌄") + muted "Pro · lumiere.nailswap.app" → nav groups with small muted labels (Operations: Calendar, Bookings, Clients · Business: Analytics, Marketing, Billing · Setup: Catalog, Staff, Settings). Nav item: sans 15/500 muted, active = foreground with a 6px cocoa dot before it. No icons. Counts as muted numbers at the end.
- Admin: wordmark + muted "Admin", nav = Overview, Approvals, Payments, Moderation, Impersonation, Salons, Users, Settings. While impersonating, a 40px strip at the very top: "Viewing as Lumière Nail Bar · ends in 14:59 · End session".
- Main: page header = muted context line + serif 38 title on the left; text links + one pill on the right. 32px below, content.

**KPIs** — a row of 3–4: serif 40 number, 13 muted label, optional 13 delta line (sage/danger text). 56px gaps. No tiles, no dividers.

**Tables** — CSS-grid rows (not `<table>` styling): header `h-9 text-xs font-medium text-muted border-b border-border`; rows `h-13 text-sm border-b border-border` with the same `grid-template-columns`; hovered row `bg-surface-2`. Status cells use dot + label. Row actions as text links or a bare kebab icon. Pagination as text ("1–10 of 214 · Next").

**Detail pane** — right side, `border-s border-border ps-8`, same ground, underline fields for edits.

**Charts** — bars only: `--accent` (current) and `--nude` (comparison), 4px top radius, one baseline hairline, a few muted axis labels, no frame or grid. Funnel = three serif numbers with a thin proportional line under each.

**Calendar** — staff columns headed by avatar + name + "6 bookings · 6.5 h"; hour labels in the gutter; horizontal hour hairlines only; blocks tinted by status (`--pending-soft` new, `--success-soft` confirmed, `--surface-2` completed) with client (600) + service · design + time; 1px cocoa now-line with the time in the gutter.

**Billing usage** — a sentence ("640 of 1,000 AI try-ons used this cycle") over a 4px line meter (`bg-border` track, `bg-accent` fill). Plans as three text columns; current plan marked with a dot + "Current plan", not a card.

**Auth** (`/[locale]/login?next=…`, logout) — one centered column (max 380px) on the ground: nail row, serif "Sign in", muted line "Sign in to continue to /dashboard/calendar" (path in cocoa, from `next`), underline fields, one pill, text links (Email me a link · Continue with Google · Apply to join). Logged out: serif "You're signed out", one muted line, "Sign in again" pill, "Go to nailswap.app" link.

---

## 7. RTL, accessibility, content

- Logical properties only (`ps-/pe-/ms-/me-/start-/end-`, `border-s`). Mirror chevrons and back arrows with `rtl:-scale-x-100`. Keep phone numbers, booking refs, times and prices `dir="ltr"`.
- Contrast: body text ≥ 4.5:1 — use `--muted` (5.3:1), never `--muted-2`, for readable secondary text. Cocoa on ground 8.0:1, white on cocoa 8.9:1.
- Status, selection and errors never rely on colour alone (dot + word, filled vs plain, message text).
- Real elements: `<button>`, `<a href>`, `<input>` + `<label>`, `aria-label` on icon buttons, `aria-pressed` on toggles, `aria-selected` on tabs, `role="switch"` on switches.
- Focus: underline fields show focus with the 2px cocoa underline; other controls keep the global `:focus-visible` outline.
- Copy is short and warm ("See it on your hand before you book."). Sentence case everywhere; no all-caps labels.

---

## 8. Reference screens

| Area | Files in `screens/png/` | Route |
|---|---|---|
| Public | `public-01-home` · `public-02-explore` · `public-03-salon-page` · `public-04-legal` | `/[locale]`, `/explore`, `/s/[slug]` (subdomain), `/legal/*` |
| Try-on | `try-on-01-live-ar` · `try-on-02-ai-photo` · `try-on-03-job-progress` · `try-on-04-result-and-save-look` | try-on flow |
| Booking | `booking-01-slot-picker` · `booking-02-otp-sign-in` · `booking-03-confirmation` · `booking-04-manage-token` · `booking-05-review` | booking flow, `/b/[token]` |
| Account | `account-01-profile` · `account-02-bookings` · `account-03-saved-looks` | `/account/*` |
| Salon dashboard | `salon-01-onboarding-wizard` … `salon-10-billing` | `/dashboard/*` |
| Admin | `admin-01-overview` … `admin-05-impersonation` | `/admin/*` |
| Auth | `auth-01-login` · `auth-02-logged-out` | `/login`, logout |

Route column is a suggestion — follow the app's actual routing. Sample data in the mockups (salon names, prices, counts) is illustrative; real data comes from Supabase. Mockup labels for booking sources ("Try-on", "Salon page", "QR") map to the `booking_source` enum (`tryon`, `direct`, `rebook`, `dashboard`).

`screens/*.html` are the same boards as static HTML (open in a browser, inspect exact spacing and sizes with dev tools). They are references, not production code.
