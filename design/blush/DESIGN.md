# NailSwap UI — Blush Immersive

The rulebook for every NailSwap screen and component. It replaces `design/nailswap-06` (kept for reference).
Tokens live in `src/app/globals.css`. Reference mockups: the "NailSwap · Mobile redesign" design canvas, row **3 · Blush Immersive**.

**The idea in one line:** try-on first. The hand (or the salon's photo) goes full-bleed; facts and actions float on frosted glass; everything else sits on soft blush surfaces with generous, pillowy corners.

---

## 1. Principles

1. **The product is the picture.** Heroes, try-on and results are full-bleed media (`bg-hero` / `bg-latte` behind photos, `rounded-media` or a rounded-bottom hero). Nail swatches and photos carry the colour.
2. **Glass over imagery.** Anything that sits on a photo or camera (salon facts, step chips, the capture bar, sticky actions) uses `.glass` (light) or `.glass-dark` (over dark camera feeds).
3. **Soft surfaces, no borders.** Group content on `bg-surface` cards (`rounded-[24px]`–`rounded-[28px]`). Lists live inside one surface card with hairline separators (`border-b last:border-b-0`). No outlined cards.
4. **One rose action per view.** The primary action is the `bg-accent` pill. Paired actions use the `secondary` surface pill or the ink pill (`bg-foreground text-background`).
5. **Try-on is always one tap away.** Phones: the raised rose button in the middle of the floating tab bar. Salon page: "Try on" next to "Book".
6. **Heavy, friendly type.** Urbanist only. Titles 800 (`font-display`), labels 700, body 500–600.

## 2. Tokens

| Token | Light | Use |
|---|---|---|
| `--background` | #F6EAE6 | Blush ground |
| `--surface` | #FFF8F5 | Cards, fields, chips, the tab bar |
| `--surface-2` | #EFDCD6 | Quiet fill: skeletons, placeholders |
| `--overlay` | #FFF8F5 | Dialogs, sheets, menus, toasts |
| `--hero` / `--latte` | #E7C7BC / #DDBBA8 | Full-bleed hero and media backdrops |
| `--glass` / `--glass-dark` | rgba(255,248,245,.74) / rgba(51,33,31,.4) | Frosted panels (`.glass`, `.glass-dark`) |
| `--foreground` | #33211F | Text, ink pills, selected chips |
| `--muted` | #765D58 | Secondary text (4.9:1 on ground) |
| `--muted-2` | #9C8580 | Placeholders and disabled only |
| `--accent` | #9E5A55 | Primary pill, links, selected time, FAB (5.2:1 with white). Salon pages may override it. |
| `--accent-soft` / `--nude` | #EFCFC8 | Avatars, soft chips, icon wells |
| Status | sage / pending / danger … | Unchanged from 06: always dot + word |

Radii: `--radius` 1.25rem, `--radius-media` 2rem. Pills are `rounded-full`. Shadows only on floating things (`shadow-lg` nav, sticky bars, overlays; `shadow-sm` on surface chips).

Dark mode values are derived (rose-espresso) and not yet designed. Review before shipping dark mode.

## 3. Components

- **Button** (`ui/button.tsx`): `primary` rose pill · `secondary` surface pill · `outline` ink-outlined pill · `ghost`/`link`/`danger` stay text buttons (dense dashboard screens). Sizes: `lg` = 56px.
- **IconButton**: `tone="surface"` (round surface chip, used by headers) or `tone="glass"` over imagery; default stays bare.
- **Field** (`ui/input.tsx`, `.field`): filled `bg-surface`, `rounded-2xl`, 48px, rose border on focus. Icons inside fields sit at `start-3.5` with `ps-10`.
- **Chips / Tabs / FilterToggle**: surface pill with a 1px inset border; selected = ink pill (`bg-foreground text-background`).
- **Tab bar** (`shell/tab-bar.tsx`): floating `bg-surface rounded-[26px] shadow-lg` bar, 5 slots: Salons · Looks · **Try on (raised rose FAB)** · Bookings · Profile. It hides on `/try` so the camera stays full-screen.
- **StickyAction** (`shell/consumer-shell.tsx`): frosted floating panel (`glass rounded-[28px] p-2.5`) holding an optional summary row and the pills.
- **Dialog / sheet**: `rounded-t-[32px]` sheet with a 40×5 grabber; inside sheets use `bg-background` tiles (surface = overlay).
- **Day picker**: 76px pill columns, selected = ink. **Times**: surface chips in a 4-column grid, selected = rose.
- **Status**: dot + word (unchanged).

## 4. Screen patterns

- **Home**: hero (`bg-hero`, rounded bottom 36px) with nail swatches and a glass card holding the headline and "Try on a design" → search pill with a locate button → chips → rounded map → salon cards.
- **Salon**: cover photo full-bleed (or nail swatches on `bg-hero`), round header buttons, glass fact card (name, rating, open state, hours); "Try designs on" ink pill + "Book" surface pill; pill tabs; surface cards for designs, services, reviews, hours; glass sticky bar with Try on + Book.
- **Try-on**: tall rounded media (`h-[48dvh]`), camera/upload empty state on `bg-hero` with a big rose camera button; design summary on a surface card; glass sticky bar with the generate pill.
- **Result**: tall before/after slider on `bg-latte`; before/after chips; glass sticky bar (book link + save pill).
- **Booking**: surface card summary of the look; services inside one surface card; pill day columns + chip times; glass sticky summary + Continue.
- **Account**: profile card with a ringed avatar; settings rows grouped in one surface card; upcoming bookings as surface cards with a rose date block.
