# Tidings — current state

> Read this before touching the app. Update it the MOMENT an infra fact changes (database, domain, auth) — don't wait for session end. Append an entry to docs/SESSIONS.md at the end of every working session. (This system exists because on 2026-07-14 a session wrote hours of content to the wrong Supabase project — the move was documented nowhere.)

## What this is

Tidings is the two-way SMS/MMS app for the Chicago Illinois Stake of The Church of Jesus Christ of Latter-day Saints — leaders compose and send texts to member lists via Twilio, with an inbox for replies, per-ward quarterly budgets, scheduled sends, and a community-contacts side (buildings, community events) alongside the member directory. Part of the Gathered suite. Lane: Church — member names, phone numbers, and message contents are confidential and must never appear in code, docs, commits, or logs.

## Infrastructure — VERIFY BEFORE ANY DB WRITE

- **Supabase: OWN dedicated project `jdlykebsqafcngpntxma` (us-east-1) — NOT the shared suite project** (verified in `.env`). Tables are unprefixed (`contacts`, `lists`, `messages`, `inbound_messages`, `community_contacts`, `buildings`, `ward_budgets`, `users`, …) because nothing else lives here. If you find yourself about to write to `isogetmvnpimcmouakeg`, stop — that's the other project; Tidings only reaches it through dedicated sync RPCs.
- **Twilio:** all SMS/MMS goes through Supabase Edge Functions (`send-message`, `twilio-inbound`, `dispatch-scheduled-messages`, `twilio-balance`, `refresh-twilio-rates`, `gather-send-invite-sms`, …). Twilio credentials live in this project's edge-function secrets, not the repo.
- **Cross-project bridges to the shared suite project:** `sync-roles-to-shared` edge function and `gather_tidings_*` service-role RPCs (contacts/users sync consumed by Gather and Glean). A Gather hub toggle RPC for community-events access spans this repo and gathered-admin.
- **Vercel / domain:** tidings.gatheredin.app (old glad-tidings.vercel.app 301s there via vercel.json). Deploys on push to main.
- **GitHub:** https://github.com/sendscott-del/tidings (origin, push to main).
- **Native:** Capacitor wrapper (`ios/`, `android/`) + fastlane.
- **Secrets:** env var NAMES only — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in `.env` (never committed).

## Architecture snapshot

- Vite + React 19 SPA (react-router), Tailwind v4, TypeScript; Capacitor for native shells. Not Next.js — no server; privileged work happens in Supabase Edge Functions.
- Key dirs: `src/` (app), `src/constants/changelog.ts`, `supabase/functions/` (11 edge functions), `supabase/migrations/`, `docs/` (USER_GUIDE.md, INVITE_EMAIL_TEMPLATE.md, SESSIONS.md), `fastlane/`.
- Access model: invite-based signup; user management is read-only in-app — access lives in the Gather hub. Community-only leaders use the `ward='Community'` sentinel + role/`can_text_community` (no stake membership), with audience-scoped budgets (ward budgets + Community Events budget, hard-block at 100%).
- Sending: background queue with live progress (v0.50-era rework); scheduled messages dispatched by a cron-driven edge function; imports accept CSV, Excel, Spanish headers, and header-optional files with content-based phone detection.

## Rules for this repo

- Version in `package.json` (0.51.x line); every user-facing change bumps it and appends `src/constants/changelog.ts`. Keep `docs/USER_GUIDE.md` current.
- Deploy = push to GitHub main → Vercel builds (`tsc -b && vite build`). Scott tests on Vercel, not local — push after every change.
- Session docs: append `docs/SESSIONS.md` every session; update this file the moment an infra fact changes.
- SQL changes go in `supabase/migrations/`; edge-function changes deploy to project `jdlykebsqafcngpntxma`.
- No secrets in committed files. Never commit real directory imports, phone numbers, or message content.

## Gotchas

- **PostgREST's 1000-row default cap has bitten this app repeatedly:** truncated stake directory silently dropping SMS recipients (2026-04-22), community building counts capped (2026-07-05), and the sync RPC returns jsonb specifically to sidestep it (v0.26.1). Any query over the full directory must page or use the jsonb RPCs.
- A `list_shares` FOR ALL RLS policy once caused infinite recursion on `lists` SELECT (v0.25.1) — test list queries after touching RLS there.
- Large community sends failed until the background queue landed (2026-07-08) — don't bypass the queue for bulk sends.
- Manual opt-outs are durable by design (2026-07-05); imports must not resurrect opted-out contacts.
- Budgets use a blended SMS/MMS rate from `tidings_rate_cache` (refreshed from Twilio); the Twilio balance display is admin-only.
