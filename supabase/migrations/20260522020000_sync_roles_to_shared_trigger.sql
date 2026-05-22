-- 20260522020000_sync_roles_to_shared_trigger.sql
-- Postgres trigger that mirrors tidings_user_roles changes up to the shared
-- gather_user_roles table via the sync-roles-to-shared edge function.
--
-- Prerequisites (set out-of-band, not in this migration):
--   * Vault secret tidings_sync_roles_function_url
--     = https://jdlykebsqafcngpntxma.supabase.co/functions/v1/sync-roles-to-shared
--   * Vault secret tidings_push_internal_secret (already present — reused)
--   * Edge function secret SHARED_SUPABASE_SERVICE_ROLE_KEY (set with
--     `supabase secrets set` on the Tidings project)
--
-- If any of those is missing, the sync becomes a no-op — the DB write succeeds
-- locally; only the cross-project replication is skipped.

CREATE OR REPLACE FUNCTION public.tidings_sync_role_to_shared()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public','net','vault'
AS $fn$
DECLARE
  fn_url TEXT;
  fn_secret TEXT;
  payload jsonb;
BEGIN
  SELECT decrypted_secret INTO fn_url
    FROM vault.decrypted_secrets WHERE name = 'tidings_sync_roles_function_url';
  SELECT decrypted_secret INTO fn_secret
    FROM vault.decrypted_secrets WHERE name = 'tidings_push_internal_secret';

  IF fn_url IS NULL OR fn_secret IS NULL THEN
    RAISE WARNING 'tidings_sync_role_to_shared: missing vault secrets, skipping';
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    payload := jsonb_build_object(
      'op', 'grant',
      'user_id', NEW.user_id,
      'role_key', NEW.role_key,
      'ward', NEW.ward
    );
  ELSIF TG_OP = 'DELETE' THEN
    payload := jsonb_build_object(
      'op', 'revoke',
      'user_id', OLD.user_id,
      'role_key', OLD.role_key,
      'ward', OLD.ward
    );
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM net.http_post(
      url := fn_url,
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||fn_secret),
      body := jsonb_build_object('op','revoke','user_id',OLD.user_id,'role_key',OLD.role_key,'ward',OLD.ward)
    );
    payload := jsonb_build_object(
      'op','grant',
      'user_id', NEW.user_id,
      'role_key', NEW.role_key,
      'ward', NEW.ward
    );
  END IF;

  PERFORM net.http_post(
    url := fn_url,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||fn_secret),
    body := payload
  );

  RETURN COALESCE(NEW, OLD);
END;
$fn$;

DROP TRIGGER IF EXISTS tidings_user_roles_sync ON public.tidings_user_roles;
CREATE TRIGGER tidings_user_roles_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.tidings_user_roles
  FOR EACH ROW EXECUTE FUNCTION public.tidings_sync_role_to_shared();
