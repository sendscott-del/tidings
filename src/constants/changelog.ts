export interface ChangelogEntry {
  version: string
  date: string
  changes: string[]
}

export const VERSION = '0.5.0'

export const CHANGELOG: ChangelogEntry[] = [
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
