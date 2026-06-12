import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STOP_WORDS = ['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit'];
const START_WORDS = ['start', 'unstop'];
const MMS_BUCKET = 'tidings-mms';
const MAX_INBOUND_MEDIA = 10;

function extFromContentType(ct: string): string {
  const t = (ct || '').toLowerCase();
  if (t.includes('jpeg') || t.includes('jpg')) return 'jpg';
  if (t.includes('png')) return 'png';
  if (t.includes('gif')) return 'gif';
  if (t.includes('webp')) return 'webp';
  if (t.includes('heic')) return 'heic';
  if (t.includes('mp4')) return 'mp4';
  return 'bin';
}

// --- Twilio request signature validation -----------------------------------
// Twilio signs each webhook: base64(HMAC-SHA1(authToken, url + sortedParams)),
// where sortedParams is every POST field concatenated as key+value in
// lexical key order, appended to the exact URL Twilio was configured to call.
// Without this check the endpoint is public and anyone could forge inbound
// texts or STOP/START opt-outs for arbitrary numbers.
async function isValidTwilioSignature(
  authToken: string,
  url: string,
  params: FormData,
  provided: string | null,
): Promise<boolean> {
  if (!provided) return false;
  const keys = [...params.keys()].sort();
  let data = url;
  for (const k of keys) {
    const v = params.getAll(k).map((x) => (typeof x === "string" ? x : "")).join("");
    data += k + v;
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  // length-safe comparison
  if (expected.length !== provided.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  return diff === 0;
}

async function mirrorMedia(
  supabase: any,
  twilioAuthHeader: string,
  twilioMediaUrl: string,
  contentType: string,
  inboundId: string,
  idx: number,
): Promise<string | null> {
  try {
    const resp = await fetch(twilioMediaUrl, { headers: { "Authorization": twilioAuthHeader } });
    if (!resp.ok) {
      console.error(`Inbound media fetch failed (${resp.status}): ${twilioMediaUrl}`);
      return null;
    }
    const finalCt = resp.headers.get("content-type") || contentType || "application/octet-stream";
    const buf = await resp.arrayBuffer();
    const ext = extFromContentType(finalCt);
    const path = `inbound/${inboundId}/${idx}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from(MMS_BUCKET).upload(path, buf, {
      contentType: finalCt,
      upsert: false,
    });
    if (uploadErr) {
      console.error(`Storage upload failed for ${path}:`, uploadErr.message);
      return null;
    }
    const { data: pub } = supabase.storage.from(MMS_BUCKET).getPublicUrl(path);
    return pub?.publicUrl || null;
  } catch (err) {
    console.error(`mirrorMedia error for ${twilioMediaUrl}:`, (err as Error).message);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");

    // Parse Twilio webhook params
    const formData = await req.formData();

    // --- Authenticate the request as genuinely from Twilio --------------------
    // Reconstruct the public URL Twilio called. Defaults to host+path; override
    // with TWILIO_INBOUND_URL if the configured webhook differs (e.g. has a
    // query string). If TWILIO_AUTH_TOKEN is unset we cannot validate, so we
    // fall through (legacy behavior) rather than hard-fail.
    if (twilioAuth) {
      const reqUrl = new URL(req.url);
      const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || reqUrl.host;
      const url = Deno.env.get("TWILIO_INBOUND_URL") || `https://${host}${reqUrl.pathname}`;
      const signature = req.headers.get("x-twilio-signature");
      const ok = await isValidTwilioSignature(twilioAuth, url, formData, signature);
      if (!ok) {
        console.error("Rejected inbound webhook: invalid Twilio signature", { url, hasSig: !!signature });
        return new Response("Forbidden", { status: 403 });
      }
    }

    const fromPhone = formData.get("From") as string || "";
    const body = formData.get("Body") as string || "";
    const messageSid = formData.get("MessageSid") as string || "";
    const numMediaRaw = formData.get("NumMedia") as string || "0";
    const numMedia = Math.min(MAX_INBOUND_MEDIA, Math.max(0, parseInt(numMediaRaw, 10) || 0));

    if (!fromPhone) {
      return new Response("<Response/>", { headers: { "Content-Type": "text/xml" } });
    }

    const bodyLower = body.trim().toLowerCase();
    const isStop = STOP_WORDS.includes(bodyLower);
    const isStart = START_WORDS.includes(bodyLower);

    // Try to resolve contact from phone
    let contactId: string | null = null;
    let contactType: string | null = null;

    const { data: stakeContact } = await supabase
      .from("contacts")
      .select("id")
      .eq("phone", fromPhone)
      .maybeSingle();

    if (stakeContact) {
      contactId = stakeContact.id;
      contactType = "stake";
    } else {
      const { data: communityContact } = await supabase
        .from("community_contacts")
        .select("id")
        .eq("phone", fromPhone)
        .maybeSingle();

      if (communityContact) {
        contactId = communityContact.id;
        contactType = "community";
      }
    }

    // Insert inbound row first so we can use its id as the storage folder.
    const { data: inserted } = await supabase.from("inbound_messages").insert({
      from_phone: fromPhone,
      body,
      twilio_sid: messageSid,
      contact_id: contactId,
      contact_type: contactType,
      is_stop: isStop,
      received_at: new Date().toISOString(),
    }).select("id").single();

    const inboundId = inserted?.id;

    // Mirror inbound media into our bucket so the inbox can render without
    // hitting Twilio (which requires Basic auth). Best-effort — if mirroring
    // fails for an item we just skip it; the text body is still saved.
    if (inboundId && numMedia > 0 && twilioSid && twilioAuth) {
      const twilioAuthHeader = "Basic " + btoa(`${twilioSid}:${twilioAuth}`);
      const mirroredUrls: string[] = [];
      const mirroredTypes: string[] = [];
      for (let i = 0; i < numMedia; i++) {
        const url = formData.get(`MediaUrl${i}`) as string || "";
        const ct = formData.get(`MediaContentType${i}`) as string || "";
        if (!url) continue;
        const publicUrl = await mirrorMedia(supabase, twilioAuthHeader, url, ct, inboundId, i);
        if (publicUrl) {
          mirroredUrls.push(publicUrl);
          mirroredTypes.push(ct);
        }
      }
      if (mirroredUrls.length > 0) {
        await supabase.from("inbound_messages").update({
          media_urls: mirroredUrls,
          media_types: mirroredTypes,
        }).eq("id", inboundId);
      }
    }

    // Handle opt-out/opt-in. The persistent tidings_opt_outs suppression list is
    // the authoritative gate checked by send-message (it survives CSV re-imports
    // that would otherwise reset the contact-row flag), so update it here too.
    if (isStop || isStart) {
      if (contactId) {
        const table = contactType === "stake" ? "contacts" : "community_contacts";
        await supabase.from(table).update({
          opted_out: isStop,
          opted_out_at: isStop ? new Date().toISOString() : null,
        }).eq("id", contactId);
      }
      if (isStop) {
        await supabase.from("tidings_opt_outs")
          .upsert({ phone: fromPhone, opted_out_at: new Date().toISOString() }, { onConflict: "phone" });
      } else {
        await supabase.from("tidings_opt_outs").delete().eq("phone", fromPhone);
      }
    }

    // Return empty TwiML
    return new Response("<Response/>", {
      headers: { "Content-Type": "text/xml" },
    });
  } catch (err) {
    console.error("Inbound webhook error:", err);
    return new Response("<Response/>", {
      headers: { "Content-Type": "text/xml" },
    });
  }
});
