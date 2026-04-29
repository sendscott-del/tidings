# Magnify UI Kit

A high-fidelity click-thru recreation of the **Magnify** mobile app — the calling-administration app in the suite.

**Source:** `sendscott-del/magnify` (`screens/main/*`, `components/ui/*`, `components/kanban/*`, `constants/theme.ts`).

This kit covers the core screens stake leadership use day-to-day:

1. **Login** — the auth surface (navy hero + white card).
2. **SP Board** — kanban with Ideas / For Approval / Stake Approved columns.
3. **HC Board** — kanban with HC Approval through Record.
4. **New Calling** — the form for creating a new entry.
5. **Calling Detail** — the deep view with approvals, tasks, activity log.

The interactive `index.html` strings these together as a click-thru phone-frame demo. Components are kept simple and mostly cosmetic — they replicate the visual language exactly, but state is faked.
