export interface ChangelogEntry {
  version: string
  date: string
  changes: string[]
}

export const VERSION = '0.18.0'

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.18.0',
    date: '2026-05-09',
    changes: [
      'MMS support: Compose now has an "Add image" button. Attach up to 3 JPG/PNG/GIF/WebP images (5 MB each) and Tidings sends them as MMS via Twilio. The cost preview switches to MMS pricing automatically (~2¢ per recipient flat, regardless of caption length), and the budget gate uses the MMS rate so the ward budget stays accurate. Image-only sends (no caption) are also supported.',
      'Inbound MMS: when a member replies with a photo, the image is now mirrored into our own storage bucket and shown as a thumbnail in the Inbox detail panel — tap to open full-size. Previously inbound photos were silently dropped. The list view shows a 📷 icon next to messages that have media attached.',
      'Database: added messages.media_urls and inbound_messages.media_urls/media_types columns; created a public tidings-mms storage bucket with RLS policies scoping outbound uploads to the sender\'s own folder.',
      'Edge functions: send-message and dispatch-scheduled-messages now accept media_urls and pass MediaUrl params to Twilio; twilio-inbound parses NumMedia/MediaUrlN and mirrors each attachment into the bucket so the Inbox can render without a Twilio auth round-trip.',
    ],
  },
  {
    version: '0.17.0',
    date: '2026-05-05',
    changes: [
      'Home-screen badge notifications: when an unread message lands in the inbox, a red number badge now appears on the Tidings icon on your phone home screen, even when the app is closed. Tap the new "Get a home-screen alert" banner on the Inbox page to enable. iOS only badges installed home-screen apps — add Tidings via Safari → Share → Add to Home Screen first.',
      'PWA basics: Tidings now ships a real web app manifest and service worker, so "Add to Home Screen" produces a proper installed app on iOS and Android with the right icon, name, and standalone display.',
    ],
  },
  {
    version: '0.16.1',
    date: '2026-05-04',
    changes: [
      'Gathered switcher: Tidings URL corrected from tidings.vercel.app to glad-tidings.vercel.app (the previous URL pointed at someone else\'s project).',
    ],
  },
  {
    version: '0.16.0',
    date: '2026-05-04',
    changes: [
      'Per-app brand stripe: a 3px tidings-primary amber strip now sits between the Gathered jump bar and the slate chrome, picking up the same amber used in the switcher\'s "T" chip. The brand identity now follows you into the app instead of stopping at the chip.',
    ],
  },
  {
    version: '0.15.3',
    date: '2026-05-04',
    changes: [
      'Gathered switcher: use canonical short URLs for Magnify (magnify-eta.vercel.app) and Tidings (tidings.vercel.app) instead of the team-scoped URLs.',
    ],
  },
  {
    version: '0.15.2',
    date: '2026-05-04',
    changes: [
      'Visual consistency (Wave 6): login/forgot/reset inputs now use 1.5px borders and min-h-[44px] tap targets. Auth cards and primary buttons use the canonical 10px radius (rounded-md). AppSwitcher chrome color moved to --color-switcher-chrome CSS token.',
    ],
  },
  {
    version: '0.15.1',
    date: '2026-05-03',
    changes: [
      'Gathered switcher: same-tab navigation instead of opening a new browser tab on each app switch. Less tab clutter.',
    ],
  },
  {
    version: '0.15.0',
    date: '2026-05-03',
    changes: [
      'i18n: forgot-password and reset-password pages are now wired through translations.ts t() lookup with full English and Spanish coverage. Spanish-locale users get fully translated pages instead of inline English fallbacks.',
      'A11y: every input and primary button on the new auth pages now meets the design system\'s 44×44 minimum tap target.',
    ],
  },
  {
    version: '0.14.0',
    date: '2026-05-03',
    changes: [
      'Compose is now demo-safe: in demo mode, hitting Send no longer calls the send-message edge function (which talks to Twilio + records to messages). Instead the UI fakes a successful response so the trainer can walk through the post-send screen without spending real SMS credit or contacting real recipients.',
    ],
  },
  {
    version: '0.13.0',
    date: '2026-05-03',
    changes: [
      'Demo mode now actually shows demo data: turning the banner on swaps the Dashboard counts (1,284 stake contacts, 7 unread, 23 opted out, 84 messages sent), the recent-messages list, the Inbox (with two unread fixtures including a STOP example), the Message History page (8 messages over the last 22 days), the per-message delivery log drill-down, and the inbox-unread badge in the nav. Marking an inbound message as read in demo mode updates in-memory state only — nothing writes to inbound_messages, so demo and real coexist on the same device.',
      'New /lib/demoData.ts holds all the fixtures so swapping in additional fake content for Compose / Stake / Lists later is a one-file edit.',
    ],
  },
  {
    version: '0.12.0',
    date: '2026-05-03',
    changes: [
      'Cross-app user-access link: a new "GATHER" button in the header (admins only) opens the canonical /admin/gather screen in Steward in a new tab. Tidings runs on its own Supabase project, so it can\'t host that screen directly — pointing super-admins at the version in Steward keeps everyone managing access from one place.',
    ],
  },
  {
    version: '0.11.0',
    date: '2026-05-03',
    changes: [
      'Forgot password: new /forgot-password and /reset-password pages (bilingual EN/ES). The Login page links to forgot-password inline, Supabase sends the reset email, and the link drops the user on /reset-password to choose a new one.',
      'Cross-project Gather access lookup: Tidings now calls the SECURITY DEFINER RPC gather_apps_for_email on the shared "Scott\'s Apps" Supabase project to find out which apps the signed-in user has access to. The Gathered switcher uses that result to filter the catalog, matching how the other four apps work. Set VITE_GATHER_SHARED_SUPABASE_URL + VITE_GATHER_SHARED_SUPABASE_ANON_KEY in Vercel; if missing, the switcher falls back to showing the full catalog.',
      'Demo mode: a striped amber banner appears at the top of every Tidings screen when demo mode is on, with a role picker (Stake President, Stake Clerk, admin, sender, viewer, member) so trainers can walk through each role without exposing real recipient data. New "DEMO" button in the header toggles it; flag persists in localStorage so demo and real mode coexist on the same device.',
    ],
  },
  {
    version: '0.10.0',
    date: '2026-05-03',
    changes: [
      'Gather suite unification: a navy "Gathered" jump bar at the very top of every Tidings page lets you hop between the five sibling apps — Magnify, Steward, Glean, Tidings, Knit. Each app shows as a brand-colored letter chip with a one-line description.',
      'Note: Tidings runs on its own Supabase project (the others share one), so for now the switcher in Tidings shows the full app catalog rather than gating on per-user access. The other four apps (Magnify, Steward, Glean, Knit) read live from the shared user_apps table and only show apps you can actually open. Cross-project gating in Tidings will come in a follow-up via a SECURITY DEFINER RPC on the shared project.',
    ],
  },
  {
    version: '0.9.1',
    date: '2026-05-02',
    changes: [
      'Scheduled delivery: dropped the dashboard-cron-setup step. pg_cron + pg_net are now enabled and the dispatcher cron is scheduled automatically (* * * * *) calling the dispatch-scheduled-messages edge function. The function was hardened to be safely callable without auth (idempotent + atomically locks queued → sending) so no service-role-key juggling is needed in the cron job definition.',
    ],
  },
  {
    version: '0.9.0',
    date: '2026-05-02',
    changes: [
      'Scheduled message delivery: a new dispatch-scheduled-messages edge function picks up queued messages whose scheduled_at has arrived, locks them (queued → sending), re-resolves recipients (so opt-out changes since scheduling are honored), re-checks the ward budget at fire time, then dispatches via Twilio. Up to 5 messages processed per run. Set up the cron from the Supabase dashboard (Database → Cron Jobs) calling this edge fn every minute — see user guide for the exact settings.',
      'Schema: messages.to_phones text[], messages.dispatch_attempts int, messages.last_dispatch_error text. send-message edge fn now persists to_phones for scheduled direct sends so the worker can re-deliver them. Indexed (scheduled_at) WHERE status = \'queued\' for cheap worker scans.',
      'Per-ward usage history: Admin → Budgets now has a click-to-expand triangle on each ward row showing the last 4 quarters as a small bar chart with dollar values. Uses a new SECURITY DEFINER RPC get_ward_usage_history(ward, n_quarters_back) that walks calendar quarters in America/Chicago and joins through message_logs → messages → users.ward.',
      'Inbox unread badge: red pill on the Inbox nav item (sidebar + mobile bottom nav) showing count of inbound_messages with read_at IS NULL. Polls every 30 seconds and refreshes on window focus. Mobile bottom nav extended from 5 to 6 items so Inbox is reachable + visible on phones.',
      'Note: the badge is in-app only — to get OS-level notifications when Tidings is closed, browser push (PWA + service worker) would need to be added separately. Captured to backlog.',
    ],
  },
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
