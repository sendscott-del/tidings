export interface ChangelogEntry {
  version: string
  date: string
  changes: string[]
}

export const VERSION = '0.8.0'

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.8.0',
    date: '2026-05-02',
    changes: [
      'Ward-scoped lists: lists now have a ward_scope field. Ward auto-lists (Hyde Park 1st Ward, etc.) are scoped to that ward; org auto-lists (Relief Society, EQ, YW, AP, Primary, Melch, Households w/ Children) stay stake-wide. Non-admin senders only see lists where ward_scope IS NULL or matches their assigned ward — so a Hyde Park 1st sender no longer sees Westchester 2nd\'s ward list cluttering Compose.',
      'Lists page: new-list form now has a Visibility dropdown (admin / Stake users pick between stake-wide and ward-specific; ward senders see a note that the list will be scoped to their ward). List cards show a green ward tag when scoped.',
      'Admins and users in the "Stake" pool still see all lists; nothing is hidden from them.',
      'Schema: lists.ward_scope text (nullable) added; existing ward auto-lists backfilled by name match against ward_budgets. import-contacts edge fn updated to stamp ward_scope on every future ward auto-list rebuild.',
      'LLM message shortening: when a message is 2+ segments and would be sent to at least 1 recipient, Compose now shows a "✨ Suggest shorter" button with the projected dollar savings. Clicking calls Claude Haiku 4.5 (via a new shorten-message edge function) to rewrite the body, preserving names, dates, times, links, and signature handling. The suggestion is shown side-by-side with the original; users explicitly accept or keep their wording — never auto-applied.',
      'Cost analysis recap: a single shortening API call is roughly 800x cheaper than the segments saved on a 100-recipient broadcast and ~25,000x cheaper on a stake-wide blast. Suggestion only fires when there is real savings (≥2 segments + recipients > 0).',
      'Setup needed: shorten-message requires a Supabase Edge Function secret named ANTHROPIC_API_KEY. Until that secret is set, the button surfaces a clear "feature not configured" error and nothing else breaks.',
    ],
  },
  {
    version: '0.7.0',
    date: '2026-05-02',
    changes: [
      'Ward budgets: every ward (and a "Stake" pool) now has a quarterly SMS budget in dollars, set in Admin → Budgets. Usage is computed live from sent + failed message_logs (Twilio bills attempts) and resets automatically on Jan 1, Apr 1, Jul 1, and Oct 1 — no manual reset needed.',
      'Admin → Users: each user must now be assigned to a ward (the budget pool their sends draw from). Stake-level senders use the "Stake" pool. The user list shows ward; users with no ward are flagged amber.',
      'Admin → Budgets: new tab listing every ward with editable dollar cap, current quarter usage (with %), remaining, and quarter-end date. Initial caps seeded at $25/quarter for every ward and the Stake pool — adjust before relying on the system.',
      'Compose: budget pill at the top showing ward + remaining $ + reset date. Pill turns yellow at 80%, red at 95%. The Send button is hard-blocked when the projected cost would exceed remaining budget, with a clear message naming the shortfall and reset date. Cost projection now multiplies segments × recipients (was previously a flat per-recipient estimate).',
      'send-message edge function: rejects with HTTP 402 BUDGET_EXCEEDED before any Twilio call when the projected cost would push the ward past its cap. Also rejects with NO_WARD_ASSIGNED if the sender has no ward.',
      'Schema: new ward_budgets table (RLS: read for all authed users, write for admins) and ward column on users; SECURITY DEFINER RPCs get_ward_usage_cents and get_ward_budget_status compute current-quarter cents used and full status (budget/used/remaining/quarter window). Quarter boundaries use America/Chicago calendar quarters.',
    ],
  },
  {
    version: '0.6.0',
    date: '2026-05-02',
    changes: [
      'Signatures: each user now has an optional signature (e.g. "— Sent by Chicago Stake", "— Sent by the Bishopric") that is automatically appended to every outbound message they send. Set or edit it in Admin → Users → Edit; quick-pick presets are provided for stake, bishopric, EQ, RS, YM/YW, and Primary presidencies.',
      'Compose: shows the active signature in a callout above the iMessage-style preview, and the bubble + character counter + confirm preview now include the appended signature so what you see is exactly what each recipient will receive.',
      'Edge functions: send-message and create-user redeployed — send-message looks up the sender\'s signature and appends it to the body before posting to Twilio (and stores the final body in messages.body so History reflects what was actually sent).',
      'Note: the "Sent from your Twilio trial account" prefix that Twilio adds is a Twilio trial-account behavior. It can only be removed by upgrading the Twilio account out of trial mode in the Twilio console — no app change can suppress it.',
    ],
  },
  {
    version: '0.5.0',
    date: '2026-05-01',
    changes: [
      'Compose: "Schedule for later" checkbox now actually toggles the date/time picker (previous version was a no-op). The Review button stays disabled until you pick a future time, and the Send button label updates to "Schedule N messages" when scheduling.',
      'Compose: opt-out preview added to Step 2 (recipients) and Step 4 (confirm). You now see "12 opted out — they will be skipped (300 will receive)" before sending, instead of the count silently shrinking on the back end.',
      'Compose: Send button now shows a spinner while the request is in flight.',
      'Inbox: Reply button on the message detail opens Compose pre-filled to that person\'s phone (1:1 reply, not a broadcast). The send-message edge function gained a to_phones param to support direct sends.',
      'Inbox: search box (name / phone / message body) plus from/to date filter and "Unread only" toggle. Loaded message limit raised from 200 to 500.',
      'Lists: full custom list management — create new list, rename + edit description, delete, and add/remove individual members through a searchable contact picker. Auto-lists remain read-only.',
      'Community: per-building CSV bulk import (First Name, Last Name, Phone, Notes). Same full-sync behavior as the stake import — contacts in the building whose phone isn\'t in the CSV are removed.',
      'History: date range filter and "Export Failed CSV" button on the per-message detail panel for triaging delivery failures.',
      'Polish: shared toast notification system for success/error feedback (Compose send, list operations, community deletes, imports). Confirm dialog component now used for all destructive actions (delete list, delete building, delete community contact). Replaces silent no-confirm deletes from prior versions.',
    ],
  },
  {
    version: '0.4.1',
    date: '2026-05-01',
    changes: [
      'Fixed: Login page (and any page using max-w-sm / max-w-md / max-w-xl / max-w-2xl) was collapsing to a thin vertical strip. Root cause was in tokens.css — the shared design system defined named --spacing-sm / -md / -xl / -2xl tokens inside the Tailwind v4 @theme block. In v4 the spacing namespace also drives max-w-*, so max-w-sm was resolving to 8px instead of 24rem. Renamed the suite spacing scale to --space-* in :root so it stays available as raw CSS vars but no longer hijacks Tailwind utilities.',
    ],
  },
  {
    version: '0.4.0',
    date: '2026-04-29',
    changes: [
      'New Tidings logo — white "T" letterform with two gold "signal sweep" arcs off the upper-right of the crossbar (suggesting transmission). Replaces the generic sparkle on the Login hero and the Layout header. Tagline updated to "Two-Way SMS for Stakes"',
      'New favicon, apple-touch-icon, and high-resolution PNG icon for PWA install — all generated from the new SVG mark on the deep navy brand background',
    ],
  },
  {
    version: '0.3.0',
    date: '2026-04-29',
    changes: [
      'Login page redesigned to match the Stake Suite auth pattern: solid Tidings-chrome navy hero band at top with the logo + "Tidings" + "Stake Communications" tagline, and the white form card overlapping the bottom of the hero. Replaces the previous full-bleed gradient background',
      'Login page now has an English / Español language toggle directly inside the form card so users can switch language before signing in',
    ],
  },
  {
    version: '0.2.4',
    date: '2026-04-29',
    changes: [
      'Compose wizard now shows units on every count: list members ("12 members"), recipient totals on Step 2 ("312 unique recipients selected across 4 lists"), the Confirm row ("3 of 7 lists selected", "1 segment per recipient"), the character counter ("87 of 160 chars · 1 SMS segment"), and the Send button ("Send 312 messages"). Aligns with the design system rule that counts always carry their unit.',
    ],
  },
  {
    version: '0.2.3',
    date: '2026-04-29',
    changes: [
      'Spanish UI support — toggle EN / ES from the header. The chrome (sidebar nav, mobile bottom tabs, sign-out button) and the entire login page are translated; preference persists in localStorage and auto-detects from the browser on first load. Per-recipient outgoing-message language is a separate concern not included here.',
    ],
  },
  {
    version: '0.2.2',
    date: '2026-04-29',
    changes: [
      'Primary action buttons (Send, Save, Sign In, Continue) and chrome surfaces (header, modals, secondary buttons) now route through the Tidings tokens — bg-tidings-primary instead of bg-amber-500, bg-tidings-chrome instead of bg-slate-800. Same color, same hover, but the codebase now expresses brand intent so the design system can shift the accent in one place',
    ],
  },
  {
    version: '0.2.1',
    date: '2026-04-29',
    changes: [
      'Adopted the shared Stake Suite design tokens — Tailwind v4 now generates utilities for tidings-primary (amber CTAs), tidings-chrome, brand-primary, stage-*, plus the canonical type scale, spacing, radii, and shadow shared across Magnify, Steward, and Tidings',
    ],
  },
  {
    version: '0.2.0',
    date: '2026-04-22',
    changes: [
      'Fixed: Stake imports beyond 1000 contacts were silently truncated. Pagination now loads every record in the directory, browse table, lists, compose recipient counts, and the import preview.',
      'Fixed: send-message edge function dropped recipients when a list had more than 1000 members. Now pages through all members so every contact gets a message.',
      'Fixed: import-contacts edge function only saw 1000 existing contacts, causing duplicate inserts and incomplete auto-lists. Import now considers the full directory.',
      'Fixed: auto-lists (wards, Relief Society, Elders Quorum, etc.) are now rebuilt from the full contact list, not just the first 1000.',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-04-12',
    changes: [
      'Initial build: login, dashboard, stake directory with LCR CSV import, community contacts by building, lists, compose wizard, inbox, message history, admin panel.',
      'Edge functions deployed: import-contacts, send-message, twilio-inbound, create-user, create-admin.',
    ],
  },
]
