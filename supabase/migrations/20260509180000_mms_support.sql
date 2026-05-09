-- MMS support: media columns on outbound + inbound, public storage bucket for media.

-- 1. Outbound: media URLs attached to a message (Twilio MediaUrl param[]).
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS media_urls text[];

COMMENT ON COLUMN public.messages.media_urls IS
  'Public HTTPS URLs of images attached to this send (passed to Twilio as MediaUrl). NULL or empty = SMS, non-empty = MMS.';

-- 2. Inbound: media URLs + content types from received MMS, mirrored to our bucket.
ALTER TABLE public.inbound_messages
  ADD COLUMN IF NOT EXISTS media_urls text[];

ALTER TABLE public.inbound_messages
  ADD COLUMN IF NOT EXISTS media_types text[];

COMMENT ON COLUMN public.inbound_messages.media_urls IS
  'Public HTTPS URLs of media received with this inbound message (mirrored from Twilio into the tidings-mms bucket).';
COMMENT ON COLUMN public.inbound_messages.media_types IS
  'Parallel array to media_urls — content type for each (e.g. "image/jpeg").';

-- 3. Public storage bucket for outbound + inbound MMS media.
--    Public = true so Twilio can fetch outbound URLs and the browser can render inbound thumbs without auth.
INSERT INTO storage.buckets (id, name, public)
VALUES ('tidings-mms', 'tidings-mms', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 4. Storage policies.
--    Authenticated senders/admins can upload to outbound/<their-user-id>/...
--    Service role (used by twilio-inbound edge fn) bypasses RLS and writes to inbound/.
DROP POLICY IF EXISTS "tidings_mms_outbound_upload" ON storage.objects;
CREATE POLICY "tidings_mms_outbound_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tidings-mms'
    AND (storage.foldername(name))[1] = 'outbound'
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'sender')
    )
  );

DROP POLICY IF EXISTS "tidings_mms_outbound_delete_own" ON storage.objects;
CREATE POLICY "tidings_mms_outbound_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'tidings-mms'
    AND (storage.foldername(name))[1] = 'outbound'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
