import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FALLBACK_CENTS_PER_SEGMENT = 0.79; // US SMS, used only if rate cache is empty
const FALLBACK_CENTS_PER_MMS = 2.0;      // US MMS, flat per recipient
const MAX_MESSAGES_PER_RUN = 5;

// NOTE: This function is intentionally callable without auth. It is safe because:
// - It only operates on messages already queued by authenticated users
// - It uses an atomic UPDATE WHERE status='queued' lock to prevent double-dispatch
// - It accepts no body parameters that change its behavior
// - The worst an attacker could do is fire scheduled messages a bit earlier than scheduled
//   (messages that were going to send anyway, to the recipients the user already chose).

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

// GSM-7 / UCS-2 aware segment counter (mirrors send-message and Compose.tsx).
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
  const u16 = text.length; // UTF-16 units = UCS-2 units
  return u16 <= 70 ? 1 : Math.ceil(u16 / 67);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
  const twilioFrom = Deno.env.get("TWILIO_FROM_NUMBER");

  // Resolve the current blended rate from the cache; fall back to constants.
  let centsPerSegment = FALLBACK_CENTS_PER_SEGMENT;
  let centsPerMms = FALLBACK_CENTS_PER_MMS;
  try {
    const { data: smsRate } = await supabase.rpc("get_current_rate_cents", { p_channel: "sms", p_country: "US" });
    if (smsRate != null && Number(smsRate) > 0) centsPerSegment = Number(smsRate);
    const { data: mmsRate } = await supabase.rpc("get_current_rate_cents", { p_channel: "mms", p_country: "US" });
    if (mmsRate != null && Number(mmsRate) > 0) centsPerMms = Number(mmsRate);
  } catch (_) { /* keep fallbacks */ }

  function projectedCostCents(text: string, recipientCount: number, hasMedia: boolean): number {
    if (hasMedia) return centsPerMms * recipientCount;
    return segmentsFor(text) * recipientCount * centsPerSegment;
  }

  const summary: any[] = [];

  try {
    const { data: due } = await supabase
      .from("messages")
      .select("id, body, sent_by, list_ids, to_phones, recipient_count, dispatch_attempts, media_urls")
      .eq("status", "queued")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(MAX_MESSAGES_PER_RUN);

    if (!due || due.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const msg of due) {
      const { data: locked } = await supabase
        .from("messages")
        .update({ status: "sending", dispatch_attempts: (msg.dispatch_attempts ?? 0) + 1 })
        .eq("id", msg.id)
        .eq("status", "queued")
        .select("id")
        .maybeSingle();
      if (!locked) {
        summary.push({ id: msg.id, skipped: "already_locked" });
        continue;
      }

      const { data: sender } = await supabase.from("users").select("ward").eq("id", msg.sent_by).single();
      if (!sender?.ward) {
        await supabase.from("messages").update({ status: "failed", last_dispatch_error: "Sender has no ward assigned at fire time" }).eq("id", msg.id);
        summary.push({ id: msg.id, status: "failed", reason: "no_ward" });
        continue;
      }

      const cleanMediaUrls: string[] = Array.isArray(msg.media_urls)
        ? (msg.media_urls as string[]).filter((u) => typeof u === "string" && u.startsWith("https://"))
        : [];
      const hasMedia = cleanMediaUrls.length > 0;

      const recipients: { id: string | null; phone: string; type: string }[] = [];
      const isDirect = Array.isArray(msg.to_phones) && msg.to_phones.length > 0;

      if (isDirect) {
        for (const phone of msg.to_phones) {
          const { data: stake } = await supabase.from("contacts").select("id, opted_out").eq("phone", phone).maybeSingle();
          if (stake) {
            if (!stake.opted_out) recipients.push({ id: stake.id, phone, type: "stake" });
            continue;
          }
          const { data: comm } = await supabase.from("community_contacts").select("id, opted_out").eq("phone", phone).maybeSingle();
          if (comm) {
            if (!comm.opted_out) recipients.push({ id: comm.id, phone, type: "community" });
            continue;
          }
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
        if (stakeIds.length > 0) {
          for (let i = 0; i < stakeIds.length; i += 500) {
            const batch = stakeIds.slice(i, i + 500);
            const data = await fetchAll<{ id: string; phone: string; opted_out: boolean }>(() =>
              supabase.from("contacts").select("id, phone, opted_out").in("id", batch)
            );
            for (const c of data) if (!c.opted_out && c.phone) recipients.push({ id: c.id, phone: c.phone, type: "stake" });
          }
        }
        if (commIds.length > 0) {
          for (let i = 0; i < commIds.length; i += 500) {
            const batch = commIds.slice(i, i + 500);
            const data = await fetchAll<{ id: string; phone: string; opted_out: boolean }>(() =>
              supabase.from("community_contacts").select("id, phone, opted_out").in("id", batch)
            );
            for (const c of data) if (!c.opted_out && c.phone) recipients.push({ id: c.id, phone: c.phone, type: "community" });
          }
        }
      }

      const phoneSet = new Set<string>();
      let deduped = recipients.filter((r) => {
        if (phoneSet.has(r.phone)) return false;
        phoneSet.add(r.phone);
        return true;
      });

      // Authoritative opt-out gate: drop any phone on the persistent suppression
      // list, even if the contact-row flag was reset by a CSV re-import.
      if (deduped.length > 0) {
        const phones = deduped.map((r) => r.phone);
        const suppressed = new Set<string>();
        for (let i = 0; i < phones.length; i += 500) {
          const batch = phones.slice(i, i + 500);
          const { data: rows } = await supabase.from("tidings_opt_outs").select("phone").in("phone", batch);
          for (const row of rows ?? []) suppressed.add(row.phone);
        }
        if (suppressed.size > 0) deduped = deduped.filter((r) => !suppressed.has(r.phone));
      }

      if (deduped.length === 0) {
        await supabase.from("messages").update({ status: "failed", last_dispatch_error: "No deliverable recipients at fire time (all opted out)" }).eq("id", msg.id);
        summary.push({ id: msg.id, status: "failed", reason: "no_recipients" });
        continue;
      }

      const projectedCents = projectedCostCents(msg.body || "", deduped.length, hasMedia);
      const { data: budgetRow } = await supabase.from("ward_budgets").select("budget_cents").eq("ward_name", sender.ward).maybeSingle();
      const budgetCents = budgetRow?.budget_cents ?? 0;
      const { data: usedRaw } = await supabase.rpc("get_ward_usage_cents", { p_ward: sender.ward });
      const usedCents = Number(usedRaw ?? 0);
      const remaining = budgetCents - usedCents;
      if (projectedCents > remaining) {
        await supabase.from("messages").update({
          status: "failed",
          last_dispatch_error: `Budget exceeded at fire time: needed $${(projectedCents/100).toFixed(2)}, only $${(Math.max(0,remaining)/100).toFixed(2)} remained in ${sender.ward}.`,
        }).eq("id", msg.id);
        summary.push({ id: msg.id, status: "failed", reason: "budget_exceeded" });
        continue;
      }

      if (!twilioSid || !twilioAuth || !twilioFrom) {
        const logs = deduped.map((r) => ({
          message_id: msg.id, contact_id: r.id,
          contact_type: r.type === "unknown" ? null : r.type,
          phone: r.phone, status: "queued", sent_at: new Date().toISOString(),
        }));
        for (let i = 0; i < logs.length; i += 500) await supabase.from("message_logs").insert(logs.slice(i, i + 500));
        await supabase.from("messages").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", msg.id);
        summary.push({ id: msg.id, status: "sent", note: "twilio_not_configured" });
        continue;
      }

      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
      const twilioAuthHeader = "Basic " + btoa(`${twilioSid}:${twilioAuth}`);
      let sent = 0, failed = 0;
      for (const recipient of deduped) {
        try {
          const formData = new URLSearchParams();
          formData.append("To", recipient.phone);
          formData.append("From", twilioFrom);
          if (msg.body) formData.append("Body", msg.body);
          for (const url of cleanMediaUrls) formData.append("MediaUrl", url);
          const resp = await fetch(twilioUrl, {
            method: "POST",
            headers: { "Authorization": twilioAuthHeader, "Content-Type": "application/x-www-form-urlencoded" },
            body: formData.toString(),
          });
          const result = await resp.json();
          await supabase.from("message_logs").insert({
            message_id: msg.id, contact_id: recipient.id,
            contact_type: recipient.type === "unknown" ? null : recipient.type,
            phone: recipient.phone, twilio_sid: result.sid || null,
            status: resp.ok ? "sent" : "failed",
            error_code: result.code ? String(result.code) : null,
            sent_at: new Date().toISOString(),
          });
          if (resp.ok) sent++; else failed++;
          await new Promise((r) => setTimeout(r, 350));
        } catch (err) {
          await supabase.from("message_logs").insert({
            message_id: msg.id, contact_id: recipient.id,
            contact_type: recipient.type === "unknown" ? null : recipient.type,
            phone: recipient.phone, status: "failed",
            error_code: (err as Error).message, sent_at: new Date().toISOString(),
          });
          failed++;
        }
      }

      await supabase.from("messages").update({
        status: failed === deduped.length ? "failed" : "sent",
        sent_at: new Date().toISOString(),
      }).eq("id", msg.id);
      summary.push({ id: msg.id, status: "dispatched", recipient_count: deduped.length, sent, failed, is_mms: hasMedia });
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
