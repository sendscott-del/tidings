---
name: stake-suite-design
description: Use this skill to generate well-branded interfaces and assets for the Stake Suite — a family of leadership tools for The Church of Jesus Christ of Latter-day Saints (Magnify, Steward, Tidings, and future apps). Contains the shared design foundations: colors, type, fonts, assets, bilingual EN/ES strings, accessibility rules for non-tech-savvy users, and one UI kit per app.
user-invocable: true
---

Read the `README.md` file in this skill first — it contains the full visual + content + iconography system, the suite roster (Magnify / Steward / Tidings / future), and the bilingual + accessibility guardrails.

Then explore:
- `colors_and_type.css` — every color and type CSS variable (load via `<link>`, then use the vars directly).
- `tailwind/tokens.css` — Tailwind v4 `@theme` block aliasing every token. Drop next to `globals.css` / `index.css` in any Tailwind app.
- `i18n/translations.sample.json` — bilingual EN/ES reference strings shared across the suite. Mirror this shape in any app's `translations.ts`.
- `assets/` — copy logo, favicon, splash, and the five product PNGs (`icon_ward`, `icon_stake`, `icon_mp`, `icon_sp_board`, `icon_hc_board`) into your output and reference them by relative path.
- `ui_kits/magnify/index.html` — interactive recreation of Magnify's core mobile screens. Lift components and patterns from here for any Magnify-specific work.
- `ui_kits/steward/index.html` — Steward's web surfaces (dashboard, weekly checklist grid, ward detail, modal). Lift for any Steward work.
- `ui_kits/tidings/index.html` — Tidings's web surfaces (dashboard, 4-step compose wizard, inbox with STOP handling). Lift for any Tidings work.
- `preview/*.html` — small reference cards for each token group (colors, type, spacing, components).

## The three apps and their stacks

| App | Stack | Primary action color | Uses |
|---|---|---|---|
| **Magnify** | React Native (Expo) | `--brand-primary` (`#1B3A6B`) | Calling administration |
| **Steward** | Next.js + Tailwind v4 | `--steward-primary` (`#2563EB`) | Recurring leader stewardships |
| **Tidings** | Vite + Tailwind v4 | `--tidings-primary` (`#F59E0B`) | Two-way SMS via Twilio |

All three share the navy/gold suite identity (logos, type, spacing, radii, shadow, neutrals, semantic colors, bilingual EN/ES). Each app keeps its own primary-action accent so the products stay visually distinguishable.

## When generating output

- **Always design bilingual.** Wire every visible string through a `t()` lookup and supply both EN and ES. Spanish needs ~30% extra horizontal space.
- **Optimize for non-tech-savvy users.** Big tap targets (≥44px), one primary action per screen, plain procedural verbs, never icon-only destructive actions, always show counts and units.
- **Stay on the canonical palette.** Deep navy `#1B3A6B` for chrome, warm gold `#C9A84C` for the gold-star moments, the 9-step stage palette for any kanban-like workflow. Use the per-app accent color for primary CTAs.
- **Use Ionicons for functional icons** (CDN: `https://cdn.jsdelivr.net/npm/ionicons@7/dist/ionicons/ionicons.esm.js`), the five product PNGs for type-of-record avatars, and never invent emoji.
- **Single shadow** (`0 2px 8px rgba(0,0,0,0.08)`), 10-radius cards, 9999-radius pills, 1.5px borders on inputs/outline buttons.

## How to deliver

- **Visual artifacts** (slides, mocks, throwaway prototypes) → static HTML files. Copy assets out of this skill, link `colors_and_type.css`, mock the screens.
- **Production code for Magnify** (React Native / Expo) → use the existing JS/JSX components in the `magnify` repo; the design tokens here mirror the values already living in `theme.js`.
- **Production code for Steward / Tidings** (Tailwind v4) → drop `tailwind/tokens.css` into the repo, then use `bg-brand-primary`, `text-steward-primary`, `rounded-md`, `shadow-md`, `font-sans`, etc. Tailwind v4 generates utilities from the `@theme` block automatically.
- **Reference screens** → start from the matching `ui_kits/<app>/index.html` and adapt.

If the user invokes this skill without other guidance, ask which app in the suite they're designing for, what surface (auth / list / detail / form / kanban / inbox / settings), the target language(s), and the audience-skill assumption — then act as an expert designer who outputs HTML artifacts or production code.
