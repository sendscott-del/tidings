# Tidings — session log

Append-only, newest first. Every working session adds one entry at the TOP: date, what changed, any infra facts touched (database, domain, auth, secrets). Infra changes also go into `CLAUDE.md` immediately, not just here.

## 2026-07-15 — Doc system initialized (history reconstructed from git)

- 2026-04-12: entire v0 app built in phases 1–11 in one arc — Supabase schema + auth, stake CSV import with auto-lists, Lists/Compose/Inbox/Community/History/Admin.
- 2026-04-22: fixed the 1000-row query cap that truncated the stake directory and silently dropped SMS recipients — the first of several 1000-row-cap incidents.
- 2026-04-29 → 05-10: stake-suite design tokens, EN/ES i18n, per-ward quarterly budgets with hard-block, scheduled-message worker, custom lists + LLM message shortening, push badges for unread inbox, MMS in/out, invite-based signup.
- 2026-05-22: Gathered suite foundation week — role-scoped RLS, list sharing, PDF directory import, service-role sync RPCs to the shared project (jsonb to sidestep the row cap), `gather-send-invite-sms` cross-app dispatch; also the `list_shares` RLS infinite-recursion hotfix.
- 2026-06-08 → 06-09: migrated to tidings.gatheredin.app; Capacitor wrappers + signed Android AAB + branded trumpet icon; contacts restricted to leaders + App Review demo account; LDS disclaimer.
- 2026-06-10 → 06-15: in-app user management made read-only (access moved to Gather), demo-mode mock recipients, amber re-skin, security hardening (v0.37.0), "Try the demo" (v0.39.0).
- 2026-07-05 → 07-06: community-events wave — Community list visibility, community-only leaders + Gather hub toggle, Community Events budget with blended SMS rate, durable manual opt-outs, building edit + append-vs-replace CSV import, /install.html.
- 2026-07-08 → 07-12: background sending queue with live progress, Excel + Spanish-header + header-optional community imports with content-based phone detection (v0.51.0), live Twilio balance for admins.
- State at initialization: v0.51.0, 113 commits, live at tidings.gatheredin.app on its OWN Supabase project `jdlykebsqafcngpntxma`, clean working tree.
