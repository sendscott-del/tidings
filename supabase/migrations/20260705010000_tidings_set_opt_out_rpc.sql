-- Durable manual opt-out. The UI toggles (Stake "Mark as Opted Out" and the
-- new community equivalent) previously only flipped the contact-row flag, so a
-- later CSV re-import could silently re-enable a manually opted-out person.
-- This RPC updates the contact flag AND the persistent tidings_opt_outs
-- suppression list in one call, exactly like the STOP-reply path in
-- twilio-inbound — making every opt-out durable regardless of how it happened.
-- SECURITY DEFINER because tidings_opt_outs has no write policy for
-- authenticated users; gated to admin/sender like the other opt-out RPC.
CREATE OR REPLACE FUNCTION public.tidings_set_opt_out(
  p_contact_id uuid,
  p_contact_type text,
  p_opted_out boolean
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_role  text;
  v_phone text;
  v_ts    timestamptz := now();
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
  IF v_role IS NULL OR v_role NOT IN ('admin','sender') THEN
    RAISE EXCEPTION 'not permitted' USING errcode = '42501';
  END IF;

  IF p_contact_type = 'stake' THEN
    UPDATE public.contacts
      SET opted_out = p_opted_out,
          opted_out_at = CASE WHEN p_opted_out THEN v_ts ELSE NULL END
      WHERE id = p_contact_id
      RETURNING phone INTO v_phone;
  ELSIF p_contact_type = 'community' THEN
    UPDATE public.community_contacts
      SET opted_out = p_opted_out,
          opted_out_at = CASE WHEN p_opted_out THEN v_ts ELSE NULL END
      WHERE id = p_contact_id
      RETURNING phone INTO v_phone;
  ELSE
    RAISE EXCEPTION 'invalid contact_type: %', p_contact_type USING errcode = '22023';
  END IF;

  -- Contact missing or has no phone: the flag update above is a no-op and there
  -- is nothing to suppress.
  IF v_phone IS NULL THEN
    RETURN;
  END IF;

  IF p_opted_out THEN
    INSERT INTO public.tidings_opt_outs (phone, opted_out_at)
    VALUES (v_phone, v_ts)
    ON CONFLICT (phone) DO UPDATE SET opted_out_at = EXCLUDED.opted_out_at;
  ELSE
    DELETE FROM public.tidings_opt_outs WHERE phone = v_phone;
  END IF;
END;
$$;

-- Lock execution to signed-in leaders. Supabase's default privileges grant
-- EXECUTE to anon/authenticated/service_role at creation, so revoke PUBLIC and
-- the explicit anon grant, then (re)grant authenticated.
REVOKE EXECUTE ON FUNCTION public.tidings_set_opt_out(uuid, text, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.tidings_set_opt_out(uuid, text, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.tidings_set_opt_out(uuid, text, boolean) TO authenticated;
