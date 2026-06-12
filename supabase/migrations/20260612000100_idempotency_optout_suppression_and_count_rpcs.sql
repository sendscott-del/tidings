-- (2026-06-12 code review) supporting objects for send idempotency, durable
-- opt-out compliance, and efficient list-member counts.

-- 1. Idempotency key on messages — lets send-message dedupe ambiguous retries
--    so a timed-out send isn't blasted to the whole list twice.
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS client_token text;
CREATE UNIQUE INDEX IF NOT EXISTS messages_client_token_key
  ON public.messages (client_token) WHERE client_token IS NOT NULL;

-- 2. Durable opt-out suppression list. The contact-row opted_out flag is wiped
--    by a full CSV re-import; this table persists across imports so STOP is
--    honored permanently. send-message checks it as the authoritative gate.
CREATE TABLE IF NOT EXISTS public.tidings_opt_outs (
  phone text PRIMARY KEY,
  opted_out_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tidings_opt_outs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin or sender can read opt-outs" ON public.tidings_opt_outs
  FOR SELECT TO authenticated
  USING (get_user_role() = ANY (ARRAY['admin', 'sender']));

-- Backfill from any contact currently flagged opted_out.
INSERT INTO public.tidings_opt_outs (phone, opted_out_at)
SELECT phone, COALESCE(opted_out_at, now()) FROM public.contacts
  WHERE opted_out = true AND phone IS NOT NULL
ON CONFLICT (phone) DO NOTHING;
INSERT INTO public.tidings_opt_outs (phone, opted_out_at)
SELECT phone, COALESCE(opted_out_at, now()) FROM public.community_contacts
  WHERE opted_out = true AND phone IS NOT NULL
ON CONFLICT (phone) DO NOTHING;

-- 3. Re-apply opt-out flags after an import wipes them. Called by the client
--    import flow; gated to admin/sender even though SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.tidings_apply_opt_out_flags()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_n integer; v_role text;
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('admin','sender') THEN
    RAISE EXCEPTION 'not permitted' USING errcode = '42501';
  END IF;
  UPDATE public.contacts c SET opted_out = true
    FROM public.tidings_opt_outs o WHERE c.phone = o.phone AND c.opted_out = false;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  UPDATE public.community_contacts c SET opted_out = true
    FROM public.tidings_opt_outs o WHERE c.phone = o.phone AND c.opted_out = false;
  RETURN v_n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.tidings_apply_opt_out_flags() FROM anon;
GRANT EXECUTE ON FUNCTION public.tidings_apply_opt_out_flags() TO authenticated;

-- 4. Efficient per-list member counts (SECURITY INVOKER so list_members RLS
--    scopes the result), replacing a full-table download in the client.
CREATE OR REPLACE FUNCTION public.tidings_list_member_counts()
RETURNS TABLE(list_id uuid, member_count bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO 'public'
AS $$
  SELECT list_id, count(*) FROM public.list_members GROUP BY list_id;
$$;
REVOKE EXECUTE ON FUNCTION public.tidings_list_member_counts() FROM anon;
GRANT EXECUTE ON FUNCTION public.tidings_list_member_counts() TO authenticated;
