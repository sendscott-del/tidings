-- Web Push subscription registry + trigger on inbound_messages.
-- Already applied to remote via Supabase MCP on 2026-05-05.
-- Pairs with: supabase/functions/tidings-send-inbox-pushes/index.ts

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  last_count INT NOT NULL DEFAULT 0,
  last_pushed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own push subs"   ON push_subscriptions;
DROP POLICY IF EXISTS "Users insert own push subs" ON push_subscriptions;
DROP POLICY IF EXISTS "Users update own push subs" ON push_subscriptions;
DROP POLICY IF EXISTS "Users delete own push subs" ON push_subscriptions;

CREATE POLICY "Users read own push subs"   ON push_subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users insert own push subs" ON push_subscriptions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own push subs" ON push_subscriptions FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own push subs" ON push_subscriptions FOR DELETE USING (user_id = auth.uid());

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'tidings_push_internal_secret') THEN
    PERFORM vault.create_secret(
      coalesce(current_setting('tidings.push_internal_secret', true), 'PLACEHOLDER_SET_VIA_DASHBOARD'),
      'tidings_push_internal_secret',
      'Shared secret used by tidings-send-inbox-pushes Edge Function for trigger auth'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'tidings_push_function_url') THEN
    PERFORM vault.create_secret(
      'https://jdlykebsqafcngpntxma.supabase.co/functions/v1/tidings-send-inbox-pushes',
      'tidings_push_function_url',
      'URL of the tidings-send-inbox-pushes Edge Function'
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION tidings_notify_push()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net, vault
AS $$
DECLARE
  fn_url TEXT;
  fn_secret TEXT;
BEGIN
  SELECT decrypted_secret INTO fn_url   FROM vault.decrypted_secrets WHERE name = 'tidings_push_function_url';
  SELECT decrypted_secret INTO fn_secret FROM vault.decrypted_secrets WHERE name = 'tidings_push_internal_secret';
  IF fn_url IS NULL OR fn_secret IS NULL THEN
    RAISE WARNING 'tidings_notify_push: missing vault secrets, skipping';
    RETURN NULL;
  END IF;
  PERFORM net.http_post(
    url := fn_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || fn_secret),
    body := jsonb_build_object('source', TG_TABLE_NAME, 'op', TG_OP)
  );
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tidings_inbound_messages_push_trigger ON inbound_messages;
CREATE TRIGGER tidings_inbound_messages_push_trigger
  AFTER INSERT OR UPDATE OR DELETE ON inbound_messages
  FOR EACH STATEMENT EXECUTE FUNCTION tidings_notify_push();
