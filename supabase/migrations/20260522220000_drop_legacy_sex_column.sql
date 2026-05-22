-- v0.28.1 — drop the legacy `sex` text column from contacts.
-- The new `gender` column (M/F) added in v0.26.0 is the authoritative source;
-- `sex` has been unused by the new auto-list logic since then.
alter table public.contacts drop column if exists sex;
