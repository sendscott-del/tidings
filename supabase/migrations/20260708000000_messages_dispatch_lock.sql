-- Lease lock so overlapping dispatcher runs (cron fires every minute; a big send
-- takes several) can't both grab the same message and double-text recipients.
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS dispatch_lock_at timestamptz;
