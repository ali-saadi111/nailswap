# NailSwap design kit — 06 Nude Clinic (simplified)

The chosen visual direction for NailSwap: a warm nude palette with no cards, where type, whitespace and hairlines carry the hierarchy.

| File | What it is |
|---|---|
| `DESIGN.md` | The rulebook: principles, tokens, components, patterns, RTL and accessibility, plus how to migrate `src/components/ui/*`. Read it before any UI work. |
| `tokens.css` | Drop-in colour, shape and shadow tokens using the variable names `src/app/globals.css` already has, plus nail-shape classes. |
| `screens/png/` | 33 reference screens, one PNG per screen (phones at 2×, desktop at 2×). |
| `screens/*.html` | The same 8 boards as static HTML. Open one in a browser and inspect sizes and colours with dev tools. |
| `screens/index.html` | A gallery of all the screens. |

Design canvas (all 10 explored directions, with 06 on its own page): https://claude.ai/artifact/84hJeorTizHgPjbUNrCBwC

## Using it with Claude Code

`CLAUDE.md` points here, so Claude Code reads the rules before UI work. Example prompts:

- "Apply the 06 design to the codebase: do DESIGN.md §0 steps 1–3."
- "Build the booking slot picker page from design/nailswap-06/screens/png/booking-01-slot-picker.png, following DESIGN.md."
- "Build the salon dashboard shell and the Calendar page (salon-04-calendar.png) using the /api/dashboard routes."

These are mockups: sample names, prices and numbers in the PNGs are illustrative. Real data comes from the API and Supabase.
