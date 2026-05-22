-- v0.28.0 — add is_adult boolean for the 18+ Men/Women lists.
-- Computed at PARSE time from birth_year, then the year is discarded.
-- We don't store birth_year itself (privacy posture: only month+day are stored).

alter table public.contacts
  add column if not exists is_adult boolean default false;
