import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FALLBACK_CENTS_PER_SEGMENT = 1.5; // US SMS blended; only if rate cache empty
const FALLBACK_CENTS_PER_MMS = 2.0;
const MAX_QUEUED_PER_RUN = 5;   // scheduled messages promoted per run
// Every id/phone goes in the request URL; a few hundred UUIDs overflow the
// gateway URL limit (HTTP/2 stream error). Keep chunks small.
const IN_CHUNK = 100;
const PHONE_CHUNK = 200;
// Max recipients actually texted per message per invocation, so one run stays
// well under the function wall-clock limit. The per-minute cron continues any
// message left "sending" on the next tick (skipping who already got it).
const SEND_CAP = 250;
const PACE_MS = 350; // ~3 msg/sec, safe for a toll-free number

// NOTE: intentionally callable without auth. Safe because it only acts on
// messages already created + budget-approved by authenticated users, uses an
// atomic lock to avoid double-dispatch, and takes no behavior-changing input.

async function fetchAll<T>(queryFactory: () => any, pageSize = 1000): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await queryFactory().range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as T[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

const GSM_BASIC = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ ÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXT = "^{}\\[~]|€";
function segmentsFor(text: string): number {
  if (!text) return 1;
  let gsm = true, septets = 0;
  for (const ch of text) {
    if (GSM_BASIC.includes(ch)) septets += 1;
    else if (GSM_EXT.includes(ch)) septets += 2;
    else { gsm = false; break; }
  }
  if (gsm) return septets <= 160 ? 1 : Math.ceil(septets / 153);
  const u16 = text.length;
  return u16 <= 70 ? 1 : Math.ceil(u16 / 67);
}

interface Recipient { id: string | null; phone: string; type: string }

async function loadRecipients(supabase: any, msg: any): Promise<Recipient[]> {
  const recipients: Recipient[] = [];
  const isDirect = Array.isArray(msg.to_phones) && msg.to_phones.length > 0;

  if (isDirect) {
    for (const phone of msg.to_phones as string[]) {
      const { data: stake } = await supabase.from("contacts").select("id, opted_out").eq("phone", phone).maybeSingle();
      if (stake) { if (!stake.opted_out) recipients.push({ id: stake.id, phone, type: "stake" }); continue; }
      const { data: comm } = await supabase.from("community_contacts").select("id, opted_out").eq("phone", phone).maybeSingle();
      if (comm) { if (!comm.opted_out) recipients.push({ id: comm.id, phone, type: "community" }); continue; }
      recipients.push({ id: null, phone, type: "unknown" });
    }
  } else if (Array.isArray(msg.list_ids) && msg.list_ids.length > 0) {
    const memberLinks = await fetchAll<{ contact_id: string; contact_type: string }>(() =>
      supabase.from("list_members").select("contact_id, contact_type").in("list_id", msg.list_ids)
    );
    const uniq = new Map<string, string>();
    for (const m of memberLinks) if (!uniq.has(m.contact_id)) uniq.set(m.contact_id, m.contact_type);
    const stakeIds = [...uniq.entries()].filter(([_, t]) => t === "stake").map(([id]) => id);
    const commIds = [...uniq.entries()].filter(([_, t]) => t === "community").map(([id]) => id);
    for (let i = 0; i < stakeIds.length; i += IN_CHUNK) {
      const batch = stakeIds.slice(i, i + IN_CHUNK);
      const data = await fetchAll<{ id: string; phone: string; opted_out: boolean }>(() =>
        supabase.from("contacts").select("id, phone, opted_out").in("id", batch)
      );
      for (const c of data) if (!c.opted_out && c.phone) recipients.push({ id: c.id, phone: c.phone, type: "stake" });
    }
    for (let i = 0; i < commIds.length; i += IN_CHUNK) {
      const batch = commIds.slice(i, i + IN_CHUNK);
      const data = await fetchAll<{ id: string; phone: string; opted_out: boolean }>(() =>
        supabase.from("community_contacts").select("id, phone, opted_out").in("id", batch)
      );
      for (const c of data) if (!c.opted_out && c.phone) recipients.push({ id: c.id, phone: c.phone, type: "community" });
    }
  }

  // Phone-level dedup.
  const seen = new Set<string>();
  let deduped = recipients.filter((r) => { if (seen.has(r.phone)) return false; seen.add(r.phone); return true; });

  // Persistent opt-out gate.
  if (deduped.length > 0) {
    const phones = deduped.map((r) => r.phone);
    const suppressed = new Set<string>();
    for (let i = 0; i < phones.length; i += PHONE_CHUNK) {
      const batch = phones.slice(i, i + PHONE_CHUNK);
      const { data: rows } = await supabase.from("tidings_opt_outs").select("phone").in("phone", batch);
      for (const row of rows ?? []) suppressed.add(row.phone);
    }
    if (suppressed.size > 0) deduped = deduped.filter((r) => !suppressed.has(r.phone));
  }
  return deduped;
}

async function sendMany(
  supabase: any, msgId: string, body: string, mediaUrls: string[],
  recipients: Recipient[], twilioSid: string, twilioAuth: string, twilioFrom: string,
): Promise<{ sent: number; failed: number }> {
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
  const twilioAuthHeader = "Basic " + btoa(`${twilioSid}:${twilioAuth}`);
  let sent = 0, failed = 0;
  for (const r of recipients) {
    try {
      const form = new URLSearchParams();
      form.append("To", r.phone);
      form.append("From", twilioFrom);
      if (body) form.append("Body", body);
      for (const url of mediaUrls) form.append("MediaUrl", url);
      const resp = await fetch(twilioUrl, {
        method: "POST",
        headers: { "Authorization": twilioAuthHeader, "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      });
      const result = await resp.json();
      await supabase.from("message_logs").insert({
        message_id: msgId, contact_id: r.id, contact_type: r.type === "unknown" ? null : r.type,
        phone: r.phone, twilio_sid: result.sid || null,
        status: resp.ok ? "sent" : "failed", error_code: result.code ? String(result.code) : null,
        sent_at: new Date().toISOString(),
      });
      if (resp.ok) sent++; else failed++;
      await new Promise((res) => setTimeout(res, PACE_MS));
    } catch (err) {
      await supabase.from("message_logs").insert({
        message_id: msgId, contact_id: r.id, contact_type: r.type === "unknown" ? null : r.type,
        phone: r.phone, status: "failed", error_code: (err as Error).message, sent_at: new Date().toISOString(),
      });
      failed++;
    }
  }
  return { sent, failed };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioFrom = Deno.env.get("TWILIO_FROM_NUMBER");
  const twilioReady = !!(twilioSid && twilioAuth && twilioFrom);

  let centsPerSegment = FALLBACK_CENTS_PER_SEGMENT;
  let centsPerMms = FALLBACK_CENTS_PER_MMS;
  try {
    const { data: s } = await supabase.rpc("get_current_rate_cents", { p_channel: "sms", p_country: "US" });
    if (s != null && Number(s) > 0) centsPerSegment = Number(s);
    const { data: m } = await supabase.rpc("get_current_rate_cents", { p_channel: "mms", p_country: "US" });
    if (m != null && Number(m) > 0) centsPerMms = Number(m);
  } catch (_) { /* keep fallbacks */ }

  const summary: any[] = [];
  const lockCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5-min lease

  try {
    // ---- 1. Promote due scheduled ('queued') messages to 'sending' -----------
    // Budget is checked here (fire time); the actual texting happens in the
    // 'sending' pass below, same as an immediate send.
    const { data: due } = await supabase
      .from("messages")
      .select("id, body, sent_by, database, list_ids, to_phones, media_urls, dispatch_attempts")
      .eq("status", "queued")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(MAX_QUEUED_PER_RUN);

    for (const msg of due ?? []) {
      const { data: locked } = await supabase
        .from("messages")
        .update({ status: "sending", dispatch_attempts: (msg.dispatch_attempts ?? 0) + 1, dispatch_lock_at: null })
        .eq("id", msg.id).eq("status", "queued").select("id").maybeSingle();
      if (!locked) continue;

      const { data: sender } = await supabase.from("users").select("ward").eq("id", msg.sent_by).single();
      if (!sender?.ward) {
        await supabase.from("messages").update({ status: "failed", last_dispatch_error: "Sender has no ward at fire time" }).eq("id", msg.id);
        continue;
      }
      const deduped = await loadRecipients(supabase, msg);
      if (deduped.length === 0) {
        await supabase.from("messages").update({ status: "failed", last_dispatch_error: "No deliverable recipients at fire time" }).eq("id", msg.id);
        continue;
      }
      const hasMedia = Array.isArray(msg.media_urls) && msg.media_urls.length > 0;
      const projected = hasMedia ? centsPerMms * deduped.length : segmentsFor(msg.body || "") * deduped.length * centsPerSegment;
      const budgetWard = msg.database === "community" ? "Community Events" : sender.ward;
      const { data: budgetRow } = await supabase.from("ward_budgets").select("budget_cents").eq("ward_name", budgetWard).maybeSingle();
      const { data: usedRaw } = await supabase.rpc("get_ward_usage_cents", { p_ward: budgetWard });
      const remaining = (budgetRow?.budget_cents ?? 0) - Number(usedRaw ?? 0);
      if (projected > remaining) {
        await supabase.from("messages").update({
          status: "failed",
          last_dispatch_error: `Budget exceeded at fire time: needed $${(projected/100).toFixed(2)}, $${(Math.max(0,remaining)/100).toFixed(2)} left in ${budgetWard}.`,
        }).eq("id", msg.id);
        continue;
      }
      // Left 'sending' — the pass below texts it (this run or next tick).
      summary.push({ id: msg.id, promoted: true, recipients: deduped.length });
    }

    // ---- 2. Send 'sending' messages in resumable, locked batches -------------
    const { data: pending } = await supabase
      .from("messages")
      .select("id, body, media_urls, list_ids, to_phones, sent_at")
      .eq("status", "sending")
      .or(`dispatch_lock_at.is.null,dispatch_lock_at.lt.${lockCutoff}`)
      .order("sent_at", { ascending: true, nullsFirst: true })
      .limit(3);

    for (const msg of pending ?? []) {
      // Atomic claim: only one run may hold a message at a time.
      const { data: claimed } = await supabase
        .from("messages")
        .update({ dispatch_lock_at: new Date().toISOString() })
        .eq("id", msg.id).eq("status", "sending")
        .or(`dispatch_lock_at.is.null,dispatch_lock_at.lt.${lockCutoff}`)
        .select("id").maybeSingle();
      if (!claimed) continue;

      const recipients = await loadRecipients(supabase, msg);
      const priorLogs = await fetchAll<{ phone: string }>(() =>
        supabase.from("message_logs").select("phone").eq("message_id", msg.id)
      );
      const done = new Set(priorLogs.map((l) => l.phone));
      const remaining = recipients.filter((r) => !done.has(r.phone));

      if (remaining.length === 0) {
        await supabase.from("messages").update({ status: "sent", sent_at: msg.sent_at ?? new Date().toISOString(), dispatch_lock_at: null }).eq("id", msg.id);
        summary.push({ id: msg.id, completed: true });
        continue;
      }

      const cleanMedia: string[] = Array.isArray(msg.media_urls)
        ? (msg.media_urls as string[]).filter((u) => typeof u === "string" && u.startsWith("https://")) : [];

      if (!twilioReady) {
        const batch = remaining.slice(0, SEND_CAP).map((r) => ({
          message_id: msg.id, contact_id: r.id, contact_type: r.type === "unknown" ? null : r.type,
          phone: r.phone, status: "queued", sent_at: new Date().toISOString(),
        }));
        for (let i = 0; i < batch.length; i += 500) await supabase.from("message_logs").insert(batch.slice(i, i + 500));
        const more = remaining.length > SEND_CAP;
        await supabase.from("messages").update(more ? { dispatch_lock_at: null } : { status: "sent", sent_at: msg.sent_at ?? new Date().toISOString(), dispatch_lock_at: null }).eq("id", msg.id);
        continue;
      }

      const toSend = remaining.slice(0, SEND_CAP);
      const { sent, failed } = await sendMany(supabase, msg.id, msg.body || "", cleanMedia, toSend, twilioSid!, twilioAuth!, twilioFrom!);

      const moreLeft = remaining.length > toSend.length;
      if (moreLeft) {
        // Release the lock so the next tick continues the rest.
        await supabase.from("messages").update({ dispatch_lock_at: null }).eq("id", msg.id);
      } else {
        await supabase.from("messages").update({ status: "sent", sent_at: msg.sent_at ?? new Date().toISOString(), dispatch_lock_at: null }).eq("id", msg.id);
      }
      summary.push({ id: msg.id, batch_sent: sent, batch_failed: failed, more: moreLeft, remaining_after: remaining.length - toSend.length });
    }

    return new Response(JSON.stringify({ processed: summary.length, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message, partial: summary }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
