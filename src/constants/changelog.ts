export interface ChangelogEntry {
  version: string
  date: string
  changes: string[]
}

export const VERSION = '0.2.3'

export const CHANGELOG: ChangelogEntry[] = [
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
