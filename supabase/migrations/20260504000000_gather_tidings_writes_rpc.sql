-- Wave 7a: CRUD RPCs for cross-project Tidings user management
--
-- Adjustments from original spec (applied 2026-05-04):
-- * users.id had no DEFAULT and a FK to auth.users — dropped FK, added DEFAULT gen_random_uuid()
--   so super-admins in Steward/Glean/Knit can pre-provision access before a user signs up.
-- * users.updated_at does not exist in this project — removed from all DML.
-- * Added UNIQUE constraint on users.email (required for ON CONFLICT (email)).

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;
ALTER TABLE public.users ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.users ADD CONSTRAINT users_email_unique UNIQUE (email);

CREATE OR REPLACE FUNCTION public.gather_tidings_grant_user(
  p_email text,
  p_full_name text DEFAULT NULL,
  p_role text DEFAULT 'viewer',
  p_ward text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  IF p_role NOT IN ('admin','sender','viewer') THEN
    RAISE EXCEPTION 'gather_tidings_grant_user: role must be admin/sender/viewer (got %)', p_role;
  END IF;
  INSERT INTO public.users (email, full_name, role, ward)
  VALUES (lower(p_email), COALESCE(p_full_name, p_email), p_role, p_ward)
  ON CONFLICT (email) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name),
    role      = EXCLUDED.role,
    ward      = COALESCE(EXCLUDED.ward, public.users.ward)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.gather_tidings_grant_user(text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.gather_tidings_update_user(
  p_id uuid,
  p_role text DEFAULT NULL,
  p_ward text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_role IS NOT NULL AND p_role NOT IN ('admin','sender','viewer') THEN
    RAISE EXCEPTION 'gather_tidings_update_user: bad role %', p_role;
  END IF;
  UPDATE public.users SET
    role = COALESCE(p_role, role),
    ward = COALESCE(p_ward, ward)
  WHERE id = p_id;
  RETURN jsonb_build_object('updated', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.gather_tidings_update_user(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.gather_tidings_revoke_user(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.users WHERE id = p_id;
  RETURN jsonb_build_object('revoked', true);
END;
$$;
GRANT EXECUTE ON FUNCTION public.gather_tidings_revoke_user(uuid) TO authenticated;
