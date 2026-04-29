# Stake Suite Design System

A shared design system for a **suite of apps that help stake leadership of The Church of Jesus Christ of Latter-day Saints work more effectively together**. The suite is named for the lead app, **Magnify**, but the foundation here is intended for every app in the family.

| App | What it does | Repo |
|---|---|---|
| **Magnify** | Tracks calling administration — from "idea" through approval, sustaining, setting apart, and recording. | `sendscott-del/magnify` |
| **Steward** | Tracks leader standard work — recurring duties and stewardships for ward & stake leaders. | `sendscott-del/steward` |
| **Tidings** | Two-way SMS to members and community contacts via Twilio + LCR import. | `sendscott-del/tidings` |
| **(future)** | Additional leader-collaboration apps. | — |

The visual + content foundations live here. Each app gets its own `ui_kits/<app>/` folder mirroring its actual product UI. All three are live: `ui_kits/magnify/` (mobile, React Native), `ui_kits/steward/` (web, Next.js + Tailwind v4), and `ui_kits/tidings/` (web, Vite + Tailwind v4).

**Per-app primary-action accents.** All three apps share the navy/gold suite chrome but each keeps its own accent color so the products stay visually distinguishable in screenshots and in the wild:

| App | Primary action color | Stack |
|---|---|---|
| Magnify | `--brand-primary` `#1B3A6B` (deep navy) | React Native / Expo |
| Steward | `--steward-primary` `#2563EB` (blue) | Next.js + Tailwind v4 |
| Tidings | `--tidings-primary` `#F59E0B` (amber) | Vite + Tailwind v4 |

For the two Tailwind apps, drop `tailwind/tokens.css` next to `globals.css` / `index.css` and Tailwind v4 generates utilities (`bg-brand-primary`, `text-steward-primary`, `rounded-md`, `shadow-md`, …) from the `@theme` block automatically.

> **Disclaimer.** None of these apps are official products of The Church of Jesus Christ of Latter-day Saints. This system documents independent third-party tools built for stake leadership.

---

## Audience & accessibility

The primary users of every app in the suite are **stake leaders, many of whom are not technically inclined**. That is the single biggest design constraint. Every decision in this system optimizes for that user:

- **Big tap targets** (44×44 minimum, 48×48 preferred), generous padding, never tightly packed UI.
- **Plain procedural verbs** for buttons (`Submit for Approval`, not `Continue` or `→`).
- **One primary action per screen.** Secondary actions are visually demoted (`outline` / `ghost` button variants).
- **Confirm destructive actions in plain language** — never icon-only delete buttons.
- **Always show counts and units.** "312 unique recipients" not "312". "Approved 3/3" not "3 ✓".
- **Avoid jargon outside Church-handbook terms.** `Sustain` and `Set Apart` are familiar to the audience; `Provision` and `Bootstrap` are not.
- **Stay on the platform's visual conventions.** No novel UI patterns — kanban looks like kanban, lists look like lists, settings look like settings.

### Bilingual EN/ES — mandatory

**Every app in this suite must ship in both English and Spanish.** Treat this as a hard requirement, not a feature.

- Each app has a `LanguageContext` (or equivalent) and a `translations.ts` keyed by `'es' | 'en'`.
- All user-visible strings are looked up via `t('namespace.key')`. Hard-coded English strings are bugs.
- Allow ~30% extra horizontal space for Spanish — labels are typically longer (`Sign In` → `Iniciar Sesión`, `Settings` → `Configuración`).
- Numbers, dates, and times use the locale formatter (`Intl.NumberFormat`, `Intl.DateTimeFormat`).
- **Church terms in Spanish** follow the official Spanish handbook: `barrio` (ward), `estaca` (stake), `obispado` (bishopric), `Sumo Sacerdote` (High Priest), `Sacerdocio de Melquisedec` (Melchizedek Priesthood), `Alto Consejo` / `CH` (High Council), `Presidencia de Estaca` / `PE` (Stake Presidency), `Élder` (Elder), `sostener` (sustain), `apartar` (set apart), `relevar` (release), `llamamiento` (calling).

A reference set of `t()` keys is mirrored in `i18n/translations.sample.json` covering every common phrase across the suite (auth, nav, common buttons, validation, status, confirmations).

## Magnify — workflow at a glance

A calling moves through stages (left to right):

`Ideas → For Approval → Stake Approved → HC Approval → Extend → Sustain → Set Apart → Record → Complete`

MP Ordinations skip directly from creation to **HC Approval**.

### User roles

Stake President · 1st/2nd Counselor · High Councilor · Stake Clerk · Executive Secretary

---

## Index — what's in this folder

| File / folder | What it contains |
|---|---|
| `README.md` | This file — context, content rules, visual foundations, iconography, suite + i18n guidance. |
| `SKILL.md` | Cross-compatible skill file for invoking this design system. |
| `colors_and_type.css` | All color and type CSS variables (brand, neutrals, semantic, stage, type scale, semantic h1/h2/etc.). |
| `i18n/translations.sample.json` | Bilingual (EN/ES) reference strings shared across the suite. |
| `assets/` | Magnify logo, favicon, splash, and the five product icons (ward, stake, MP, SP board, HC board). |
| `tailwind/tokens.css` | Tailwind v4 `@theme` block aliasing every token — drop into Steward & Tidings (or any future Tailwind app). |
| `preview/` | Small HTML cards used to populate the Design System tab. |
| `ui_kits/magnify/` | UI kit — interactive `index.html` recreating Magnify's core mobile screens (auth, kanban, calling card, sustaining script). |
| `ui_kits/steward/` | UI kit — Steward's dashboard, weekly checklist grid, ward detail view, and entry modal. |
| `ui_kits/tidings/` | UI kit — Tidings's dashboard, 4-step compose wizard (audience → message → review → send), and inbox with STOP-keyword handling. |
| `claude_code_handoff/` | Drop-in package for Claude Code: per-repo install guides + the artifact bundle to copy into each app. Open `INDEX.html` for a landing page. |

---

## CONTENT FUNDAMENTALS

Magnify's voice is **plain, reverent, and procedural**. It mirrors the language of *General Handbook 30.3* (the Church handbook section on sustaining callings) without being preachy or marketing-y. Copy is short, instructional, and second-person.

### Voice & tone

- **You / your**, not "we" or "the user." `Sign out of Magnify?` · `You'll be able to log in once approved.`
- **Direct and procedural.** `Add to Ideas` · `Submit for Approval` · `Mark as released`. Every button is a verb phrase the user understands without context.
- **Reverent, not religious.** The app is a workflow tool — it never lectures or quotes scripture. It uses Church-correct terminology (stake, ward, calling, sustain, set apart, ordain) but stays operational.
- **No exclamation marks**, except in confirmations of completed actions: `Copied!`, `Entry created!`, `Saved!`. Never in instructions.
- **No emoji.** The interface uses Ionicons and small product PNGs; emoji never appear in UI copy. (The literal exception: a `✓` glyph is used inline once or twice — `Stake President approved ✓`.)

### Casing

- **Title Case** for screen titles, primary buttons, section headers, role names: `Stake Presidency`, `Manage Users`, `Submit for Approval`, `High Councilor`.
- **Sentence case** for subtitles, body, hints, helper text: `Add a calling or ordination`, `Used to @ mention this member in Slack notifications.`
- **UPPER CASE** is reserved for: (a) the `NEW` chip on cards, (b) divider rows in the sustaining script (`─── RELEASES ─────`), (c) the `DECLINED` banner. Never for general headers.

### Concrete examples

| Surface | Copy |
|---|---|
| Primary CTA | `Sign In` · `Submit for Approval` · `Send to High Council` · `Mark Approved` |
| Empty state | `Nothing here` · `No completed callings` · `No pending users` |
| Confirm | `Are you sure you want to delete this entry for [name]? This cannot be undone.` |
| Error | `Please fill in all fields.` · `Passwords do not match.` |
| Success | `Entry created!` · `Saved!` · `Test message sent! Check your Slack channel.` |
| Status | `Awaiting approval` · `All approved ✓` · `Threshold met ✓` · `SP Override applied — HC threshold bypassed` |
| About | `Magnify is a stake callings workflow management tool... It tracks callings from initial consideration through final recording, ensuring the right people take action at each stage.` |

### Terminology rules

- Use Church-handbook terms exactly: **stake**, **ward**, **bishopric**, **calling**, **ordination**, **sustain**, **set apart**, **extend** (a calling), **release** (someone from a calling), **High Council** / **HC**, **Stake Presidency** / **SP**, **Melchizedek Priesthood** / **MP**.
- Abbreviations are explicit: `SP Board`, `HC Board`, `MP Ordination`. Always spelled out at first encounter in screen titles.
- Wards are referenced by their abbreviation on cards (`HP1`, `WC2`) and full name in pickers (`Hyde Park 1st`).

---

## VISUAL FOUNDATIONS

### Color philosophy

A **single deep navy** (`#1B3A6B`) carries the brand — it reads as quiet, institutional authority without leaning toward any one cultural palette. **Warm gold** (`#C9A84C`) is the only accent; it appears sparingly (logo star, small highlights) and never as a button fill. Everything else is a **9-step neutral gray scale** plus four **semantic colors** (success/warning/error/info).

**Stage colors** are the system's most distinctive use of color: each of the 9 workflow stages has a dedicated hue used in `Badge` chips and column rules. They progress roughly cool→warm→success: gray (Ideas) → amber (For Approval) → blue (Stake Approved) → purple (HC Approval) → pink (Extend) → teal (Sustain) → green (Set Apart) → orange (Record) → emerald (Complete). This gives the kanban board a built-in legend.

### Type

- **System sans only.** No webfonts ship with the app — it uses the platform default (`-apple-system, BlinkMacSystemFont, system-ui, Roboto, …`). On web this is San Francisco / Segoe UI / Roboto. **No font substitution needed; no font files to import.**
- **Tight numeric scale** in pixel units: 11 / 13 / 15 / 17 / 20 / 24 / 30. This is RN-native sizing — small by web standards but appropriate for phone screens.
- **Weight vocabulary:** 400 (body) · 600 (labels, secondary buttons, ward chips) · 700 (titles, names on cards) · 800 (badges, the `NEW` chip, count pills, the `DECLINED` banner). 500 is unused.
- **Letter-spacing** is only applied to all-caps eyebrows and badges (`+0.5px` to `+1px`).

### Spacing & rhythm

Six-step scale in 4-px increments: **4 / 8 / 16 / 24 / 32 / 48**. The dominant gaps are `8` (inside cards) and `16` (between cards / page padding). `24` is the screen-edge padding on auth screens. There are no half-steps; everything snaps to the scale.

### Backgrounds

- **Solid white card surfaces on a `#F9FAFB` page background.** No imagery, no full-bleed photography, no gradients in the app chrome.
- **Auth screens** (Login, Register) use the deep navy `--brand-primary` as a top hero, with the white card sitting on top.
- **Tinted "fade" backgrounds** (`--brand-primary-fade` `#E8EEF8`) for the secondary button variant and selected pill states.
- **Stage badges** use a 13% tint of the stage color (`stageColor + '22'` hex alpha) with a 1px solid border in the full color, and the text in the full color. This is the canonical "soft pill" recipe: `bg = color + '22', border = color, text = color`.
- **No textures, patterns, or hand-drawn illustrations.** The product icons (church, presidency, chapel) are flat illustrations contained inside green rounded squircles — they are decorative only, never used as iconography for actions.

### Borders

- Card border: **1px** solid `--gray-200`.
- Input border: **1.5px** solid `--gray-200`, becoming `--error` red on validation failure.
- Outline button border: **1.5px** `--brand-primary`.
- Column header rule: **3px** top border in the column's stage color (kanban headers).
- Decline state: **1px** `--error` border at 70% opacity on the card.

### Shadows

A single canonical shadow: `0 2px 8px rgba(0,0,0,0.08)` (the `Shadow` constant). Used on every elevated surface — cards, header bar, nav bar. There is **no shadow scale** beyond this one. For modals and sheets a slightly deeper variant (`0 8px 24px rgba(0,0,0,0.12)`) is acceptable.

No inner shadows. No drop shadows on text. No glow effects.

### Corner radii

Five sizes — `6 / 10 / 16 / 24 / 9999`. Practically:

- **Inputs and buttons → 10** (`--radius-md`)
- **Cards → 10** as well; calling cards in particular are 10
- **Image type-icons → 7** (slightly tighter than the card)
- **Modals / sheets → 16**
- **Pills, badges, count chips → 9999** (full-round)

The combination of 10-radius cards and 9999-radius pills inside them is the signature "Magnify" card silhouette.

### Animation & motion

- The native app uses **`activeOpacity={0.8}`** on every `TouchableOpacity` — that's the entire press-state vocabulary: a tap drops the element to 80% opacity for the duration of the touch.
- **No spring physics, no bounce, no elaborate transitions.** Lists fade and screens push via the navigation library's defaults (iOS slide / Android Material).
- **Idle Timeout Guard** uses a counted-down number with no other animation.
- Hover state on web (the rare case): subtle shift to `--brand-primary-light` for primary buttons, `--gray-100` background for ghost buttons. Never opacity changes on hover; that's reserved for press.

### Press / disabled / focus

- **Press** = `opacity: 0.8` (tap feedback).
- **Disabled** = `opacity: 0.5` plus `pointer-events: none`.
- **Focus** is system-default — the app does not customize keyboard focus rings on web; on mobile the platform manages it.

### Transparency, blur

- Used **rarely**. The transparent `ScreenHeader` variant sits on top of the navy primary, with `rgba(255,255,255,0.7)` for the subtitle.
- Stage-tint backgrounds use `+'22'` (≈13% alpha) on the stage color. This is the only systemic alpha trick.
- **No backdrop-filter blur** anywhere.

### Layout rules

- **Phone-first.** Every screen is a single vertical column. Kanban boards scroll horizontally between fixed-width 280px columns.
- **Header is sticky / fixed at the top of each screen** with the Shadow constant.
- **Bottom tab bar** has 5 items: New, SP Board, HC Board, Completed, Settings. Tab bar is white with a 1px top border, icons in `--gray-500`, active in `--brand-primary`.
- **Forms** use stacked labels (label above input), with full-width primary CTA at the bottom. No inline labels.
- **Cards never sit on white** directly — they always sit on `--bg-2` (`#F9FAFB`) so the 1px border + shadow combination reads.

### Imagery vibe

The five product icons (`icon_ward`, `icon_stake`, `icon_mp`, `icon_sp_board`, `icon_hc_board`) are **flat-illustrated PNGs** with consistent treatment: rounded green border, sky background, friendly stylized buildings or figures. They feel like a children's-book illustration of a Sunday-morning chapel — warm, daylight, no shadows. **Cool primary, warm accent, friendly imagery** is the brand vibe in one phrase.

---

## ICONOGRAPHY

Magnify is a **two-tier icon system**:

### Tier 1 — Functional icons (Ionicons)

Every interactive icon in the UI is an [**Ionicons**](https://ionic.io/ionicons) glyph from `@expo/vector-icons`. Examples actually used in the codebase: `chevron-back`, `eye` / `eye-off` (password toggle), `list-outline` (empty state). Use Ionicons for any new icon.

- **Stroke style:** outline by default; filled variants only for active tab-bar states.
- **Sizes:** 18 (inside inputs), 20 (tab bar inactive), 22 (small actions), 24 (back chevron, headers).
- **Colors:** `--gray-400` for input glyphs, `--gray-500` for inactive icons, `--gray-800` for header chevrons, `--brand-primary` for active tab.

For HTML mocks where Ionicons isn't loaded, link the **Ionicons CDN web component**: `<script type="module" src="https://cdn.jsdelivr.net/npm/ionicons@7/dist/ionicons/ionicons.esm.js"></script>` then `<ion-icon name="chevron-back"></ion-icon>`. **No substitution needed** — this is the same set as `@expo/vector-icons`.

### Tier 2 — Product PNG icons (5 total)

Five flat illustrations live in `assets/`:

| File | Purpose |
|---|---|
| `icon_ward.png` | Card avatar for **Ward Calling** type |
| `icon_stake.png` | Card avatar for **Stake Calling** type |
| `icon_mp.png` | Card avatar for **MP Ordination** type |
| `icon_sp_board.png` | Tab/board icon for **SP Board** |
| `icon_hc_board.png` | Tab/board icon for **HC Board** |

Used at **30 × 30 px with `border-radius: 7px`** on calling cards. Never tinted, never recolored.

### Logos

- `assets/icon.png` — the full Magnify logo with wordmark (gold star + ascending blue arrow).
- `assets/favicon.png` — small square mark.
- `assets/splash-icon.png` — splash screen (same composition as `icon.png`).

### Emoji & unicode

- **Emoji are never used** in copy or UI.
- **Unicode glyphs** appear in two specific places: `✓` (check-mark) inside approval status copy (`All approved ✓`), and box-drawing `─` to build dividers in the plain-text sustaining script (`─── RELEASES ──────`). That's the entire unicode vocabulary.
- The `@` character is used as the icon for "Add Slack User ID" — typeset in the body font, not as an icon glyph.
