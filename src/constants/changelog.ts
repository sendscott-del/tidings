export interface ChangelogEntry {
  version: string
  date: string
  changes: string[]
}

export const VERSION = '0.35.1'

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.35.1',
    date: '2026-06-10',
    changes: [
      'Demo mode now fully mocks the recipient lists in Compose (real list names and member counts no longer appear for demo users).',
    ],
  },
  {
    version: '0.35.0',
    date: '2026-06-10',
    changes: [
      'User access is now managed in one place — the Gather hub. The in-app Users tab is read-only; invites, roles, and removals happen in Gather (invite links continue to work as before).',
    ],
  },
  {
    version: '0.34.1',
    date: '2026-06-09',
    changes: [
      'Security: updated dependencies to patched versions (React Router advisories). No feature changes.',
    ],
  },
  {
    version: '0.34.0',
    date: '2026-06-09',
    changes: [
      'Added the required disclaimer that Tidings is not an official product of, and is not endorsed by, The Church of Jesus Christ of Latter-day Saints, to the sign-in screen.',
    ],
  },
  {
    version: '0.33.0',
    date: '2026-06-09',
    changes: [
      '**Contact privacy hardened.** The member contact list (names and phone numbers) is now restricted to leaders who send messages — Admins and Senders. Previously any signed-in account could read the full contact list; now non-sending accounts cannot. This is a behind-the-scenes security tightening with no change for existing admins and senders.',
      'Added a read-only demo account for the App Store / Google Play review process. It is automatically locked into Demo Mode and, as a non-sending account, cannot see any real contacts or messages — reviewers approve the app against sample data only.',
    ],
  },
  {
    version: '0.32.0',
    date: '2026-06-08',
    changes: [
      '**New home: https://tidings.gatheredin.app.** Tidings moved to the new Gathered suite domain. The old glad-tidings.vercel.app URL keeps working and 301-redirects here (root and every path), so existing links and shortcuts still work. SMS continues to flow through the Supabase Edge Functions and Twilio exactly as before — the domain move does not touch messaging.',
      'The App Switcher now links to the *.gatheredin.app addresses for all five Gathered apps. Sign-in and password-reset links build on the current origin and the Tidings auth allow-list was updated to permit the new domain.',
    ],
  },
  {
    version: '0.31.0',
    date: '2026-05-30',
    changes: [
      '**Twilio rate validation, end-to-end.** SMS and MMS per-unit rates now live in one source of truth — the new `tidings_rate_cache` table — that the Compose preview, the pre-send budget block, and the ward-budget ledger all read from. No more drift between what the UI estimates and what the ledger actually deducts.',
      '**MMS billing bug fix (retroactive).** The ledger RPCs (`get_ward_usage_cents`, `get_ward_usage_history`) previously charged every message at the per-segment SMS rate regardless of whether it was an MMS. Now they detect MMS via `messages.media_urls` and apply the flat MMS rate. Past quarters recompute under the corrected formula, so historical ward usage numbers will tick up to match what Twilio actually billed.',
      '**Blended rates from real invoices.** New Edge Function `refresh-twilio-rates` calls Twilio\'s Usage Records API for the trailing 30 days of outbound SMS and MMS, computes a cents-per-message blended rate per channel (which captures 10DLC carrier pass-through fees that the published Pricing API does not surface), and upserts a fresh row to `tidings_rate_cache`. Runs daily at 02:17 America/Chicago via pg_cron + pg_net.',
      '**Admin → Settings rate panel.** New card shows current SMS and MMS rates with source (`twilio_usage_blended` vs `manual`), sample size, and last-updated timestamp. A "Refresh now" button kicks the edge function on demand using the admin user\'s JWT — no shared secret needed in the browser.',
      'One-time setup required on the Tidings Supabase project so the daily cron can authenticate: `ALTER DATABASE postgres SET app.tidings_internal_fn_secret = \'<INTERNAL_FN_SECRET>\';` (same value as the existing edge-function env var). Without it the cron is harmless (401 in `cron.job_run_details`) and the Admin button still works.',
    ],
  },
  {
    version: '0.30.1',
    date: '2026-05-25',
    changes: [
      'Mobile tab bar active color realigned to `text-tidings-primary` (was `text-tidings-primary-dark`) — matches the suite token map and the active color used by the rest of the Phase 6 apps.',
      'Inbox unread rows drop the amber background tint. The amber avatar ring + amber trailing dot already mark unread; the tint was a third signal that violated the spec\'s "one indicator per row" rule and made the unread state read as urgent rather than just unread.',
    ],
  },
  {
    version: '0.30.0',
    date: '2026-05-24',
    changes: [
      '**Mobile + web optimization (Phase 6).** The mobile chrome now matches the rest of the Gathered suite. Bottom tab bar is pared down to five primary tabs — **Dashboard · Compose · Inbox · History · More** — with full labels, 44-px tap targets, an unread badge on Inbox, and proper `env(safe-area-inset-bottom)` padding so it no longer sits under the iPhone home indicator. Stake / Community / Lists / Admin / Profile / User guide / Release notes / Suggest-an-enhancement / Sign out all moved into a new bottom-sheet "More" menu (`src/components/MoreSheet.tsx`).',
      '**Compose wizard is now one-step-per-view on mobile** with a sticky progress stepper at the top and a sticky Back/Next CTA (count + estimated cost) pinned above the tab bar. Desktop layout is unchanged. Textareas/inputs are 16-px on mobile so iOS Safari no longer auto-zooms on focus.',
      '**Inbox redesign.** 64-px conversation rows, amber-ring avatar on unread, two-line preview, chat-style relative timestamps ("2m", "1h", "Yesterday"), and a horizontally-scrolling filter row (All · Unread · Stake · Community). `STOP` messages stay visible under every filter — compliance signal is never hidden. Polling now pauses while the tab is backgrounded, saving battery and Supabase quota.',
      '**Suggestion FAB** is hidden on mobile (used to float over the Compose CTA and the last Inbox row); on mobile the modal opens from the "Suggest an enhancement" row in the More sheet. Desktop FAB shrinks from 12 → 10 and sits in the corner.',
      'Scripture sub-bar is sticky on mobile so the EN/ES switcher stays reachable on long pages. `<main>` now drives its bottom padding from `env(safe-area-inset-bottom)` instead of a guessed pixel value (new `.safe-pb-tabbar` utility in `src/index.css`).',
      'New Spanish keys: `Más · Directorios · Espacio · Ayuda · Sugerir mejora · Guía del usuario · Notas de la versión`.',
    ],
  },
  {
    version: '0.29.0',
    date: '2026-05-23',
    changes: [
      "GATHER header button now opens https://gathered-admin-neon.vercel.app/gather — the new standalone Gather deployment. Replaces yesterday's pointer at Glean's copy. Same shared gather_user_roles / user_apps / gather_super_admins tables; just one canonical UI across every Gathered app.",
    ],
  },
  {
    version: '0.28.3',
    date: '2026-05-22',
    changes: [
      'GATHER header button now points at the canonical Gather page in Glean (https://glean-blue.vercel.app/admin/gather) instead of the old Steward copy. The Gather page consolidated into a single host today so there\'s one place to manage user access across every app; Steward and Knit now redirect there too.',
    ],
  },
  {
    version: '0.28.2',
    date: '2026-05-22',
    changes: [
      'Search is now **token-based and accent-insensitive** everywhere. Typing "Devin Pope" finds "Devin Garrett Pope" (each token only needs to appear *somewhere* in the row, not as a contiguous substring), and typing "cruz" finds "Crúz". Applied to: Church Directory browse, Lists name search, the Add Members picker on a custom list, the recipient picker on Compose, and the Inbox search. New shared helper `src/lib/search.ts` (`matchesAllTokens`) so all five surfaces behave identically.',
    ],
  },
  {
    version: '0.28.1',
    date: '2026-05-22',
    changes: [
      'Cleanup — dropped the legacy `sex` text column from `contacts`. The new `gender` column (M/F) added in v0.26.0 is the authoritative source; `sex` had been unused by the new auto-list logic since then. Parsers (CSV and PDF) no longer write to it. The ClassAssignment-derived per-ward lists and the Attending Seminary list — both previously flagged as "deferred" — are officially out of scope and will not be built.',
    ],
  },
  {
    version: '0.28.0',
    date: '2026-05-22',
    changes: [
      '**Auto-list overhaul.** Added a `Stake — High Councilors` list covering the stake presidency, stake clerk, stake executive secretary, and high councilors (excluding any "Assistant" clerks/secretaries). Added per-ward `<Ward> — Bishops` (just the bishop) and `<Ward> — Bishopric` (bishop + counselors + ward clerk + ward exec sec, no assistants). Extended every presidency list (Stake — Elders Quorum / Relief Society / Primary / Sunday School / Young Women Presidencies) to also include the org\'s Secretary and Assistant Secretary — Ministering Secretary is intentionally excluded since it\'s a different role. `Stake — Bishoprics` now also includes ward clerks and ward exec secretaries across all wards.',
      'Men/Women lists are now **18+ only** at both stake and ward scope. Added an `is_adult` boolean to the contacts schema; it\'s computed at parse time from the birth year and the year itself is still not stored anywhere (privacy posture preserved).',
      '**Opted-out contacts are excluded from auto-lists entirely** — they\'re no longer just filtered at send time. If someone re-opts-in, they\'ll reappear on the next import.',
      '**Removed legacy stake-wide lists** (Relief Society, Elders Quorum, Young Women, Primary, Households with Children). These weren\'t in your spec and the per-ward equivalents cover the use case. If you want any of them back, let me know.',
      '**Lists page UX**: search box for filtering by list name; the All/Stake/Community toggle becomes a two-option **Stake / Ward** vs **Community** toggle (church-directory lists live under Stake/Ward); the ward dropdown gains a **Stake-wide only** option; auto-generated lists are now marked with a sparkle ✦ icon and custom lists with a pencil icon, so the two are visually distinct at a glance.',
      '**Compose page recipient picker** got the same search + ward filter as the Lists page, so you can find one of ~115 lists without scrolling.',
      'Renamed the sidebar **Stake → Church Directory** and **Community → Community Directory**.',
    ],
  },
  {
    version: '0.27.0',
    date: '2026-05-22',
    changes: [
      "New edge function `gather-send-invite-sms` lets other Gathered apps fire ad-hoc SMS via Tidings' Twilio account. Accepts POST `{ phone, body, audit_tag? }` with `Bearer <INTERNAL_FN_SECRET>` (cross-app shared secret — no per-user JWT needed). Skips ward-budget enforcement and message_logs writes (these are infrequent one-offs from the missionary sheet pull cycle, not stake-wide broadcasts). Powered by the same TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER env vars the existing send-message endpoint uses. Knit's v0.33.0 invite flow calls this for phone-only contacts.",
    ],
  },
  {
    version: '0.26.2',
    date: '2026-05-22',
    changes: [
      'Critical fix — the previous v0.26.1 PDF import only updated ~100 of ~3,300 contacts. The diff/upsert logic in the `import-contacts` edge function used **phone alone** as the contact identity key, but 229 phone-duplicate groups exist in the stake directory (household members share phones — bishop and wife, parents and kids). With that many duplicates, every batch that contained a household triggered a PostgreSQL `ON CONFLICT DO UPDATE command cannot affect row a second time` error, which the edge function silently swallowed. Switched the matching key to `last_name|first_name|phone` (a composite that uniquely identifies each person even when they share a phone), and made the function surface upsert errors in the response body instead of swallowing them. Also: existing legacy duplicate rows in the DB now get collapsed automatically — the first occurrence per composite key is kept and updated, the rest are deleted.',
      'Lists page now has a ward filter — stake leaders (Admin or "Stake" pool) can pick a ward from the dropdown next to the Stake/Community toggle to narrow the ~115 auto-lists down to just that ward\'s lists. Choosing a ward also hides stake-wide lists so the view is purely a single-ward roster of lists.',
    ],
  },
  {
    version: '0.26.1',
    date: '2026-05-22',
    changes: [
      'PDF import hotfix — the v0.26.0 PDF parser was returning 0 rows because each contact in the LCR landscape report renders across 3-5 visual lines (~5pt apart) and the parser treated each visual line as a separate row, splitting the BirthDate cell ("4 May" on one line, "2000" on the next) so the date-anchor regex never matched. Plus the column x-bounds were guesses that didn\'t match the actual layout. Rewrote the parser to cluster items by vertical proximity (line gaps ≤9pt = same record, larger = new record) and re-bucket text into columns using the actual measured x-coordinates from the report.',
      'gather_tidings_contacts_for_sync RPC switched from RETURNS TABLE to RETURNS jsonb (returning a single jsonb_agg array). PostgREST silently caps SETOF/TABLE-returning RPCs at db-max-rows (default 1000), which was truncating the cross-app member sync to 1000 of the ~3,244 contacts. A jsonb return value isn\'t a result set, so the cap doesn\'t apply. Edge function consumers (Glean and Knit syncs) don\'t need code changes — the response body shape is identical. After the fix the weekly Glean sync correctly inserted all 3,244 contacts into `glean_members`.',
    ],
  },
  {
    version: '0.26.0',
    date: '2026-05-22',
    changes: [
      'Stake directory import now accepts the LCR 12-column landscape PDF in addition to CSV — drop the PDF on the Stake → Import tab and Tidings parses it client-side via pdfjs-dist (Mozilla\'s PDF.js, coordinate-based column extraction). The downstream preview/confirm/import flow is unchanged; CSV imports still work exactly as before.',
      'Auto-list catalog significantly expanded. Every contact import now (re)builds, in addition to the 7 existing stake-wide lists and per-ward catch-alls: **7 new stake-wide leadership lists** (Bishoprics, Elders Quorum Presidencies, Relief Society Presidencies, Primary Presidencies, Sunday School Presidencies, Ward Mission Leaders, Young Women Presidencies), **2 new stake-wide gender lists** (Men, Women), and **10 new per-ward lists** (Primary Teachers, Parents, Endowed Members, Returned Missionaries, Single Members, Men, Women, Aaronic Priesthood, Melchizedek Priesthood, Birthdays This Month). New lists are named with prefixes — `Stake — <Name>` for stake-wide, `<Ward> — <Name>` for ward-scoped. Existing flat-named lists keep their names.',
      'Birthday lists rotate automatically on the 1st of each month via a new `pg_cron` schedule (`tidings-birthday-rotation`, 06:01 UTC) that re-runs the per-ward "Birthdays This Month" rebuild based on `birth_month`. The list also refreshes on every import.',
      'Schema: added `birth_month`, `birth_day`, `class_assignment text[]`, `is_endowed`, `is_returned_missionary`, `is_single`, `priesthood` (Aaronic/Melchizedek/Unordained), and `gender` (M/F) columns to `contacts`. Birth year is intentionally not stored — only month and day, so the rolling lists work but DOB-level data stays out of the database.',
      'Deferred for a follow-up: a `ClassAssignment`-derived per-ward list family (would create ~100 additional lists; held until the new lists prove out in real use) and an Attending Seminary list (column not yet in the LCR report).',
    ],
  },
  {
    version: '0.25.3',
    date: '2026-05-22',
    changes: [
      'New service-role RPC `gather_tidings_contacts_for_sync()` exposes the contacts directory (id, full_name, phone, email, unit_name, callings, opted_out + the org-presence booleans) for Glean and Knit to ingest. EXECUTE is GRANTed only to `service_role`, so it can\'t be invoked from a browser session. Glean\'s new "Sync from Tidings" admin button calls it; Knit will too in a coming release.',
    ],
  },
  {
    version: '0.25.2',
    date: '2026-05-22',
    changes: [
      'Role grants made in Tidings now sync to the shared `gather_user_roles` table automatically. Mechanism: a Postgres trigger on `tidings_user_roles` fires the new `sync-roles-to-shared` edge function on every INSERT / UPDATE / DELETE, which uses the shared project\'s service-role key to call `gather_grant_role_service` / `gather_revoke_role_service`. The result is that a role you assign in Tidings\' Edit User screen lights up in Glean\'s `/admin/roles` (and every other Gathered app that reads `gather_user_roles`) within seconds. The v0.24.1 caveat about local-only writes is now retired. **One-time setup needed**: set the `SHARED_SUPABASE_SERVICE_ROLE_KEY` secret on the Tidings Supabase project (it\'s the service-role JWT for `isogetmvnpimcmouakeg`). Until that\'s set, the trigger fires but the edge function returns 503 and the sync is a no-op.',
    ],
  },
  {
    version: '0.25.1',
    date: '2026-05-22',
    changes: [
      'Hotfix — Lists page was returning zero results (even the auto-lists like Relief Society, Elders Quorum, all ward rosters disappeared) because the list_shares RLS write policy was declared FOR ALL. FOR ALL applies to SELECT too, and its USING clause did EXISTS on lists, which triggered the lists SELECT policy → which does EXISTS on list_shares → loop. Postgres threw "infinite recursion detected in policy for relation lists" and the client silently returned []. Split the write policy into per-command INSERT and DELETE so SELECT on list_shares only hits the simple read-all policy. No data was lost; lists were intact in the database the whole time. The custom lists from before v0.24.0 (Test, Bishops, High Council, Devin Pope, Stake Council) also had their created_by backfilled to Scott so they\'re no longer orphaned.',
    ],
  },
  {
    version: '0.25.0',
    date: '2026-05-22',
    changes: [
      'Custom lists can now be shared. A new Share button (the share-arrow icon next to the pencil) appears on any non-auto list for the list creator and admins. The Share dialog shows everyone the list is currently shared with and lets you add new shares two ways: (1) "By role" — pick from the 19-role catalog (Bishop, Ward Council, Stake Council, etc.) and anyone who holds that role gets access; (2) "By user" — pick a specific Tidings user. Removing a share takes effect immediately. Shares feed the same RLS the previous release wired up, so adding a role-share to a list also opens up the messages sent to that list. Custom lists you create are now stamped with your user id, so you (and only you) see them by default until you share them out.',
    ],
  },
  {
    version: '0.24.1',
    date: '2026-05-22',
    changes: [
      'Admin → Edit User now has a "Suite roles" section. Admins can assign any of the 19 Gathered suite roles to a user — Stake President, Stake Clerk, the two SP counselors, Stake Executive Secretary, six High Council variants, Community Events Leader, Stake Council, Bishop, the two bishopric counselors, Ward Clerk, Ward Executive Secretary, Ward Council, Ward Organization Presidency, Ward Mission Leader, and Ward Member. A single person can hold multiple roles (the spreadsheet pattern). Stake-scoped roles cover the whole stake; ward-scoped roles inherit the user\'s assigned ward (set in the same form) — a small ⚠ flags when you tick a ward role for a user without a ward set. Assignments write to `tidings_user_roles` and immediately feed the new role-scoped RLS — i.e., a Bishop now sees lists shared to `bishop`, a Stake Council member sees lists shared to `stake_council`, etc. The user table on /admin also renders each user\'s current roles as a small badge row under their name so you can scan the roster at a glance.',
      'NOTE — this release writes role assignments only to Tidings. A follow-up will sync `tidings_user_roles` up to the shared `gather_user_roles` table so Glean / Knit / Magnify / Steward consume the same source of truth. Until then, assigning Scott as "Bishop" in Tidings does not (yet) propagate to the other apps.',
    ],
  },
  {
    version: '0.24.0',
    date: '2026-05-22',
    changes: [
      'Gathered suite foundation (DB-only this release; UI lands in 0.24.1). New `contacts.callings text[]` column lets the suite record which callings a contact holds, so Glean can auto-grant access to anyone serving in a Bishopric / EQ Presidency / RS Presidency / Welfare Specialist. New `lists.created_by` column makes custom lists private to their creator unless explicitly shared. New `list_shares` table records per-list share grants (by individual user OR by role). New local mirror `tidings_user_roles` reflects the shared `gather_user_roles` assignments for fast RLS without cross-project lookups. Lists / list_members / messages / inbound_messages RLS rewritten: you can only see a list (and the messages sent to it) if you created it, you\'re admin, you\'re explicitly shared on it, or you hold a role it was shared with. Auto-lists (the per-ward and per-organization rosters) stay visible to all signed-in users.',
    ],
  },
  {
    version: '0.23.1',
    date: '2026-05-20',
    changes: [
      'Suggestion FAB copy trimmed — removed the "Goes straight to Scott." line under the prompt so the modal stays focused on the question itself.',
    ],
  },
  {
    version: '0.23.0',
    date: '2026-05-20',
    changes: [
      'Suggestion FAB added — an amber lightbulb in the bottom-right corner of every signed-in screen (above the mobile tab bar). Tap it to send a free-form idea or friction note. Submissions POST to a shared `submit-suggestion` edge function on the Gathered Supabase project (Tidings lives on its own project, but this call deliberately crosses over so all of the suite — Tidings, Glean, Steward, Knit, Magnify — feeds one inbox). The submitter\'s name, email, user id, and current page URL are captured automatically when signed in. Each submission writes a row to `public.app_suggestions` for triage (open → in_progress → implemented / declined) and emails Scott via Resend.',
    ],
  },
  {
    version: '0.22.12',
    date: '2026-05-19',
    changes: [
      'Cache-busted favicon links in index.html (added ?v=2 query strings). Chrome maintains a separate favicon cache that ignores normal page refreshes, so users were still seeing the pre-trumpet icon in their bookmark bar even after v0.22.11 redeployed the correct favicon.png. The ?v=2 makes Chrome treat it as a new file and fetch fresh.',
    ],
  },
  {
    version: '0.22.11',
    date: '2026-05-19',
    changes: [
      'Favicon (browser tab + Chrome bookmark bar) now matches the trumpet home-screen icon. The old favicon.svg still rendered the navy / white-T design from before the icon refresh; since Chrome prefers SVG favicons, the bookmark bar kept showing that stale glyph. Deleted favicon.svg and updated index.html to reference the regenerated favicon.png (the 64px version of the trumpet artwork).',
    ],
  },
  {
    version: '0.22.10',
    date: '2026-05-19',
    changes: [
      'Tidings icon replaced with the user-supplied trumpet artwork: amber rounded square with a white herald trumpet (bell upper-right, vertical pill loop in the middle, mouthpiece lower-left). After ~8 hand-coded SVG iterations couldn\'t match the organic curves of the reference, the actual reference PNG is now the source of truth. Stored at public/icon-source.png (1600x1600) and resized into icon-192, icon-512, apple-touch-icon, and favicon. The in-app TidingsLogo component now renders the same PNG via <img> so the header / login / sidebar mark matches the home-screen icon exactly.',
    ],
  },
  {
    version: '0.22.9',
    date: '2026-05-19',
    changes: [
      'Tidings glyph redesigned to match the user\'s reference: a coiled trumpet with a pill / stadium loop in the middle (the trumpet\'s coiled tubing), a smooth lead pipe curving up to a flared bell at the upper-right, and a small mouthpiece bowl on the left of the loop. All smooth curves, white on amber. Updated in PWA icons (icon-192, icon-512, apple-touch-icon, favicon, public/icon.svg) and the in-app TidingsLogo SVG.',
    ],
  },
  {
    version: '0.22.8',
    date: '2026-05-19',
    changes: [
      'Tidings glyph redesigned as a herald / fanfare trumpet: long straight tube, a J-hook at the mouthpiece end, and a bold flared bell. No valves, no banner. The trumpet is mirrored so the bell points up-LEFT and the mouthpiece sits on the lower-right. White on amber. Updated in PWA icons (icon-192, icon-512, apple-touch-icon, favicon, public/icon.svg) and the in-app TidingsLogo SVG.',
    ],
  },
  {
    version: '0.22.7',
    date: '2026-05-19',
    changes: [
      'Tidings glyph swapped to the trumpet-with-valves design (option C from the preview round). v0.22.6 was the no-valve bugle, which read as a plunger silhouette. The new version adds three valve casings on top of the body so the icon is unambiguously a trumpet. Tilted up-right at ~20° to keep the fanfare feel. Updated in PWA icons (icon-192, icon-512, apple-touch-icon, favicon, public/icon.svg) and the in-app TidingsLogo SVG.',
    ],
  },
  {
    version: '0.22.6',
    date: '2026-05-19',
    changes: [
      'Tidings glyph redesigned as a fanfare bugle pointing up-right at ~20°. Mouthpiece on the lower-left, body, flared bell on the upper-right — reads as "declare glad tidings of great joy" (D&C 31:3). Updated everywhere: home-screen / PWA icons (icon-192, icon-512, apple-touch-icon, favicon, public/icon.svg) and the in-app TidingsLogo SVG used in headers, login card, and the sidebar.',
    ],
  },
  {
    version: '0.22.5',
    date: '2026-05-19',
    changes: [
      'Tidings glyph redrawn as real sound waves. The previous version used three full half-circle arcs that read as nested-target rings instead of sound. The new version uses three quadratic-Bezier curves that fan outward — each apex progressively further right (220, 320, 420 in viewBox coords) so the curves clearly emanate from a virtual source on the left. Stroke is thicker; arcs are bigger; clear visual gap between them.',
      'Manifest icons drop "purpose": "any maskable" — that flag was telling iOS "do not transform this icon," which is why Tidings stayed full-color in Tinted (sleep) mode while the other four Gathered apps were rendering as black-and-white. Tidings should now match the suite in Tinted mode after iOS re-caches the icon (remove + re-add to home screen to force).',
    ],
  },
  {
    version: '0.22.4',
    date: '2026-05-19',
    changes: [
      'Tidings glyph simplified: the speaker cone is gone. The icon is now just the three concentric sound-wave arcs in white on amber — both on the home-screen / PWA icon (icon-192, icon-512, apple-touch-icon, favicon, public/icon.svg) and in the in-app TidingsLogo SVG.',
    ],
  },
  {
    version: '0.22.3',
    date: '2026-05-19',
    changes: [
      'Tidings glyph returns to the original speaker-with-sound-waves design. The amber background is unchanged; the speech-bubble-with-three-dots is replaced everywhere — the home-screen / PWA icon (icon-192, icon-512, apple-touch-icon, favicon, public/icon.svg) and the in-app TidingsLogo SVG component used in headers, login, and the sidebar.',
    ],
  },
  {
    version: '0.22.2',
    date: '2026-05-19',
    changes: [
      'In-app TidingsLogo updated to match the v0.21.1 home-screen icon. The rounded square is now Tidings amber (#F59E0B) instead of navy, and the white-"T" letterform has been replaced by a white speech-bubble-with-three-dots glyph. The "Tidings" wordmark continues to appear as adjacent text wherever the logo renders, so brand recognition isn\'t lost.',
    ],
  },
  {
    version: '0.22.1',
    date: '2026-05-19',
    changes: [
      'Mobile-reachability fix for History, Settings, User Guide, and Release Notes. These pages live in the sidebar bottom rail, which is hidden on phones — so mobile users had no link to reach them after the v0.21.0 layout refactor. Added: a "More" section on /profile (mobile-only) that links to all four; the profile link in the top sub-bar is now visible at every breakpoint (was hidden below sm:) so /profile itself is reachable on phones.',
    ],
  },
  {
    version: '0.22.0',
    date: '2026-05-18',
    changes: [
      'Mobile polish pass across Tidings\' core pages — the deeper rebuild flagged in the v0.21.0 release notes. Cards and slide-over sheets that were always p-6 now drop to p-4 at <640px so content fields and tap targets actually fit a phone-width column. Touched: Compose (five card sections), Admin Settings (demo toggle row + Twilio card), Lists (list detail header / member-picker header / picker body / sticky footer), Community (CSV import sheet header + body), History (delivery-details sheet header + body).',
      'Compose segment-warning row ("This message is N segments per recipient · Suggest shorter") now stacks vertically on mobile instead of cramming the suggest button next to the explanatory text.',
      'Admin → Settings → Demo mode toggle row now stacks vertically on narrow screens so the description and the Enable / Exit button each get full width.',
      'Mobile-friendly inputs that already had responsive treatment (Dashboard stat grid, Inbox filter row, Community contacts table) were verified — no further changes needed.',
    ],
  },
  {
    version: '0.21.1',
    date: '2026-05-18',
    changes: [
      'Home-screen / PWA icon redesigned: amber background (matching the Gathered "T" chip) with a white speech-bubble-and-three-dots glyph replacing the dark-on-black "T" letter. The speech bubble reads as "two-way SMS" at a glance. Part of the cross-app icon refresh — each app\'s icon is now its brand color + its glyph.',
      'icon-192.png, icon-512.png, apple-touch-icon.png, and favicon.png regenerated from a single public/icon.svg.',
    ],
  },
  {
    version: '0.21.0',
    date: '2026-05-18',
    changes: [
      'Suite consistency pass (5/5): the "Tidings" wordmark is now in the sidebar only — the duplicate wordmark in the old navy top bar is gone. The top sub-bar above the content has been re-purposed for the scripture banner and the EN/ES toggle, which now follow you onto every screen.',
      'Scripture banner: "Your tongue shall be loosed, and you shall declare glad tidings of great joy." — D&C 31:3.',
      'Tab title and PWA install label are now just "Tidings" (the <title> was "Tidings — Stake Communications").',
      'PWA manifest theme_color, background_color, and index.html theme-color meta changed from navy (#1B3A6B) to Tidings amber (#F59E0B) so the home-screen browser chrome and PWA install background match the Gathered "T" chip.',
      '"Admin" renamed to "Settings" in the sidebar (EN: Settings, ES: Configuración). The internal Users / Budgets / Settings sub-tabs are unchanged.',
      'Demo mode is no longer a top-bar button. The toggle was moved into Settings → Settings sub-tab — matches the suite-wide rule that demo lives behind Settings.',
      'New User Guide route (/guide) — structured prose covering what Tidings does, roles, where to start, and language behavior. Linked from the sidebar bottom rail.',
      'New Release Notes route (/release-notes) — version-by-version changelog reader. Linked from the sidebar bottom rail.',
      'Mobile pass: bottom nav rows tightened, content padding lifted on mobile (`p-4` → `sm:p-6`). The deep mobile rebuild flagged for Tidings is still to come; this is a first polish pass.',
    ],
  },
  {
    version: '0.20.2',
    date: '2026-05-18',
    changes: [
      'List delete path is now an explicit SECURITY DEFINER RPC (public.delete_list) instead of a direct DELETE. The RPC returns a row count so the client can distinguish "deleted" / "not found" / "not permitted" instead of treating "policy declined" the same as "successful delete of a row that was already gone." Permission semantics match the existing row-level policy (role in admin/sender). Migration applied live to the Tidings Supabase project.',
      'Honesty note on v0.20.1: the original "deletes silently blocked on empty lists" diagnosis was wrong. Empirically the row-level policy is permissive for admins regardless of member count; an end-to-end test under the user\'s RLS context deleted an empty list successfully. The RPC path is still worth keeping because it gives the client a real row count to act on, but the misleading "blocked by row-level policy" fallback toast has been softened to a neutral "Delete returned no rows. The list may already be gone — refresh to confirm."',
    ],
  },
  {
    version: '0.20.1',
    date: '2026-05-18',
    changes: [
      'Replaced direct list-delete with a SECURITY DEFINER RPC (delete_list) and a frontend fallback path. Initially shipped to fix what was believed to be a silent RLS failure on empty lists — see 0.20.2 for the corrected post-mortem.',
    ],
  },
  {
    version: '0.20.0',
    date: '2026-05-18',
    changes: [
      'Lists member picker: search now uses token matching instead of one-big-substring matching. Typing "Miguel Hernandez" matches "Miguel A. Hernandez" (middle names/initials no longer break the search), and you can append a ward name like "Miguel Hernandez Hyde Park" to scope the result. Search is also accent-insensitive now, so "garcia" finds "García".',
      'Lists member picker: clicking a checkbox clears the search bar and refocuses the input so you can immediately type the next name. Multi-select still works — the checked count stays visible at the top, and "Add X contacts" inserts all of them at once. Unchecking does NOT clear the search (so you can correct a mis-click without losing your place).',
    ],
  },
  {
    version: '0.19.3',
    date: '2026-05-10',
    changes: [
      'Fixed: every slide-over panel (Lists members, Lists member picker, Inbox detail, History delivery details, Community CSV import, Stake contact detail) had a z-index lower than the Gathered AppSwitcher bar, so the panel header — including the close X button — was rendered behind the top app-switcher chrome. Found via end-to-end browser QA. Bumped all slide-overs to z-[110], the nested Lists picker to z-[115], and the ConfirmDialog to z-[120] so destructive confirms always appear above any slide-over that triggered them.',
    ],
  },
  {
    version: '0.19.2',
    date: '2026-05-10',
    changes: [
      'QA pass: standardized the inbox unread badge to use read_by IS NULL everywhere (Layout polling now matches Dashboard + Inbox). Both columns are set together by markAsRead so this was never wrong in practice, but standardizing avoids drift if anyone touches a row outside the app.',
      'QA pass: i18n the Profile tooltip in the header so Spanish-locale users see "Mi perfil" instead of "My profile" when hovering the user-name link.',
      'QA pass: Compose now resets the sending flag on success too (was only reset on demo-mode success and on error). No user-visible bug today because the post-send result panel takes over the UI, but defensive cleanup so the next compose starts in a clean state.',
    ],
  },
  {
    version: '0.19.1',
    date: '2026-05-10',
    changes: [
      'Branded invite emails: invite-create and invite-resend now pass app: "Tidings" in user_metadata when calling Supabase\'s inviteUserByEmail. The shared Left Field Labs invite email template (paste-in instructions live in docs/INVITE_EMAIL_TEMPLATE.md) reads {{ .Data.app }} to put "Tidings" in the subject and body, so invitees see "You\'ve been invited to Tidings" instead of Supabase\'s generic default. The same template works for the other Gathered apps (Magnify, Steward, Knit, Glean) once they add their own invite flows — each just passes its own app name in user_metadata.',
    ],
  },
  {
    version: '0.19.0',
    date: '2026-05-09',
    changes: [
      'Invite-based signup: Admin → Users now opens a "Send Invite" form instead of forcing the admin to set a password. The invitee gets an email with a one-time link, lands on a /invite/<token> page already authenticated via the magic link, and chooses their own password. Role, ward, and permissions are pre-staged on the invite row so the invitee can\'t tamper with them. Links expire in 7 days.',
      'Pending Invites table: a new section above the Users list shows every outstanding invite with one-click Resend (rotates the token and emails a new link, invalidating the old one) and Revoke (kills the link and tears down the unconfirmed auth user so the email can be invited again later).',
      'My Profile page (top-right name link): every signed-in user can now edit their own display name and signature, change their email (Supabase sends a confirmation link to the new address), and change their password — all without bothering an admin. Role and ward stay admin-only.',
      'Email change auto-syncs: a new auth.users → public.users trigger keeps the in-app email column in sync after a self-service email change confirms.',
      'Database: added tidings_invites table with admin-only RLS, plus a get_invite_preview RPC that returns the email/role/ward for a pending token (used by /invite/<token> to show "you\'re being invited as Sender in Hyde Park 1st Ward" before the user sets their password).',
      'Edge functions: invite-create, invite-accept, invite-resend, invite-revoke, and profile-update.',
      'Setup note for admins: the Supabase Auth → URL Configuration → Redirect URLs allow-list must include https://glad-tidings.vercel.app/invite/* (and your custom domain when added) for invite links to resolve. The Site URL stays at the canonical Tidings URL.',
    ],
  },
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
