import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FALLBACK_CENTS_PER_SEGMENT = 1.5; // US SMS blended (delivery + carrier + compliance); used only if rate cache is empty
const FALLBACK_CENTS_PER_MMS = 2.0;      // US MMS, flat per recipient
const MAX_MEDIA = 10;                    // Twilio caps at 10 MediaUrl entries
// Max ids per `.in('id', [...])` request. Every id goes in the URL, so a few
// hundred UUIDs overflow the gateway's URL-length limit (HTTP/2 "stream error")
// — seen on a 905-recipient community list. ~100 keeps the URL well under.
const IN_CHUNK = 100;

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

// GSM-7 / UCS-2 aware segment counter (mirrors the client helper in Compose.tsx).
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

function sanitizeMediaUrls(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const u of input) {
    if (typeof u !== "string") continue;
    const trimmed = u.trim();
    if (!trimmed.startsWith("https://")) continue;
    out.push(trimmed);
    if (out.length >= MAX_MEDIA) break;
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "No auth header" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const { data: appUser } = await supabase
      .from("users")
      .select("role, signature, ward")
      .eq("id", user.id)
      .single();
    if (!appUser || !['admin', 'sender'].includes(appUser.role)) return new Response(
      JSON.stringify({ error: "Forbidden" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

    if (!appUser.ward) return new Response(
      JSON.stringify({
        error: "NO_WARD_ASSIGNED",
        message: "Your account is not assigned to a ward. Ask an admin to set your ward in Admin → Users before sending.",
      }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

    const { body, database, list_ids, scheduled_at, to_phones, media_urls, client_token } = await req.json();
    const cleanMediaUrls = sanitizeMediaUrls(media_urls);
    const hasMedia = cleanMediaUrls.length > 0;

    // Body is required for SMS but optional for MMS (image-only sends allowed by Twilio).
    if (!body && !hasMedia) return new Response(JSON.stringify({ error: "Missing body" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

    const signature = (appUser.signature || "").trim();
    const finalBody = signature && body ? `${body}\n\n${signature}` : (body || "");

    const isDirectSend = Array.isArray(to_phones) && to_phones.length > 0;
    if (!isDirectSend && (!list_ids || !Array.isArray(list_ids) || list_ids.length === 0)) {
      return new Response(JSON.stringify({ error: "Missing list_ids or to_phones" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    interface Recipient { id: string | null; phone: string; type: string }
    const recipients: Recipient[] = [];
    let resolvedDatabase = database || 'stake';

    if (isDirectSend) {
      const phones: string[] = [...new Set(to_phones.map((p: string) => p.trim()).filter(Boolean))];
      for (const phone of phones) {
        const { data: stake } = await supabase.from("contacts").select("id, opted_out").eq("phone", phone).maybeSingle();
        if (stake) {
          if (!stake.opted_out) recipients.push({ id: stake.id, phone, type: 'stake' });
          continue;
        }
        const { data: comm } = await supabase.from("community_contacts").select("id, opted_out").eq("phone", phone).maybeSingle();
        if (comm) {
          if (!comm.opted_out) recipients.push({ id: comm.id, phone, type: 'community' });
          continue;
        }
        recipients.push({ id: null, phone, type: 'unknown' });
      }
    } else {
      const memberLinks = await fetchAll<{ contact_id: string; contact_type: string }>(() =>
        supabase.from("list_members").select("contact_id, contact_type").in("list_id", list_ids)
      );
      if (memberLinks.length === 0) return new Response(
        JSON.stringify({ error: "No recipients in selected lists" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

      const uniqueContacts = new Map<string, string>();
      for (const m of memberLinks) {
        if (!uniqueContacts.has(m.contact_id)) uniqueContacts.set(m.contact_id, m.contact_type);
      }
      const stakeIds = [...uniqueContacts.entries()].filter(([_, t]) => t === 'stake').map(([id]) => id);
      const communityIds = [...uniqueContacts.entries()].filter(([_, t]) => t === 'community').map(([id]) => id);

      if (stakeIds.length > 0) {
        for (let i = 0; i < stakeIds.length; i += IN_CHUNK) {
          const batch = stakeIds.slice(i, i + IN_CHUNK);
          const data = await fetchAll<{ id: string; phone: string; opted_out: boolean }>(() =>
            supabase.from("contacts").select("id, phone, opted_out").in("id", batch)
          );
          for (const c of data) if (!c.opted_out && c.phone) recipients.push({ id: c.id, phone: c.phone, type: 'stake' });
        }
      }
      if (communityIds.length > 0) {
        for (let i = 0; i < communityIds.length; i += IN_CHUNK) {
          const batch = communityIds.slice(i, i + IN_CHUNK);
          const data = await fetchAll<{ id: string; phone: string; opted_out: boolean }>(() =>
            supabase.from("community_contacts").select("id, phone, opted_out").in("id", batch)
          );
          for (const c of data) if (!c.opted_out && c.phone) recipients.push({ id: c.id, phone: c.phone, type: 'community' });
        }
      }
    }

    // Phone-level dedup.
    const phoneSet = new Set<string>();
    let dedupedRecipients = recipients.filter((r) => {
      if (phoneSet.has(r.phone)) return false;
      phoneSet.add(r.phone);
      return true;
    });

    // Authoritative opt-out gate: drop any phone on the persistent suppression
    // list, even if the contact-row flag was reset by a CSV re-import. This is
    // what makes STOP durable across imports.
    if (dedupedRecipients.length > 0) {
      const phones = dedupedRecipients.map((r) => r.phone);
      const suppressed = new Set<string>();
      for (let i = 0; i < phones.length; i += 200) {
        const batch = phones.slice(i, i + 200);
        const { data: rows } = await supabase.from("tidings_opt_outs").select("phone").in("phone", batch);
        for (const row of rows ?? []) suppressed.add(row.phone);
      }
      if (suppressed.size > 0) {
        dedupedRecipients = dedupedRecipients.filter((r) => !suppressed.has(r.phone));
        for (const p of suppressed) phoneSet.delete(p);
      }
    }

    if (dedupedRecipients.length === 0) return new Response(
      JSON.stringify({ error: "No deliverable recipients (all opted out or invalid)" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

    if (isDirectSend) {
      resolvedDatabase = dedupedRecipients[0].type === 'community' ? 'community' : 'stake';
    }

    // --- Idempotency / resume ------------------------------------------------
    // If this client_token already created a message, reuse that row instead of
    // creating a second one. Combined with the per-recipient skip below, an
    // ambiguous-failure retry RESUMES the send (finishing un-sent recipients)
    // rather than either double-sending the whole list or abandoning it.
    let message: { id: string } | null = null;
    let isResume = false;
    if (client_token) {
      const { data: existing } = await supabase
        .from("messages").select("id, status").eq("client_token", client_token).maybeSingle();
      if (existing) {
        message = { id: existing.id };
        isResume = true;
        if (existing.status === 'queued' || existing.status === 'sent') {
          // Already fully handled (scheduled, or a completed prior run) — no-op.
          return new Response(
            JSON.stringify({ message_id: existing.id, status: existing.status, deduped: true, is_mms: hasMedia }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // Resolve the current blended rate from the cache; fall back to constants.
    let centsPerSegment = FALLBACK_CENTS_PER_SEGMENT;
    let centsPerMms = FALLBACK_CENTS_PER_MMS;
    try {
      const { data: smsRate } = await supabase.rpc("get_current_rate_cents", { p_channel: "sms", p_country: "US" });
      if (smsRate != null && Number(smsRate) > 0) centsPerSegment = Number(smsRate);
      const { data: mmsRate } = await supabase.rpc("get_current_rate_cents", { p_channel: "mms", p_country: "US" });
      if (mmsRate != null && Number(mmsRate) > 0) centsPerMms = Number(mmsRate);
    } catch (_) { /* keep fallbacks */ }

    const segments = segmentsFor(finalBody);
    const projCents = hasMedia
      ? centsPerMms * dedupedRecipients.length
      : segments * dedupedRecipients.length * centsPerSegment;

    // Budget enforcement (skipped on resume — the original send was already
    // budget-checked, and usage is derived from actual message_logs anyway).
    if (!isResume) {
      // Community-directory sends draw from the audience-scoped "Community
      // Events" budget; everything else from the sender's ward budget.
      const budgetWard = resolvedDatabase === 'community' ? 'Community Events' : appUser.ward;
      const { data: budgetRow } = await supabase
        .from("ward_budgets").select("budget_cents").eq("ward_name", budgetWard).maybeSingle();
      const budgetCents = budgetRow?.budget_cents ?? 0;
      const { data: usedRaw } = await supabase.rpc("get_ward_usage_cents", { p_ward: budgetWard });
      const usedCents = Number(usedRaw ?? 0);
      const remainingCents = budgetCents - usedCents;

      if (projCents > remainingCents) {
        return new Response(
          JSON.stringify({
            error: "BUDGET_EXCEEDED",
            message: `This send would cost about $${(projCents / 100).toFixed(2)} but only $${(Math.max(0, remainingCents) / 100).toFixed(2)} remains in the ${budgetWard} budget this quarter.`,
            ward: budgetWard, budget_cents: budgetCents, used_cents: usedCents,
            remaining_cents: remainingCents, projected_cost_cents: projCents,
            recipient_count: dedupedRecipients.length, segments, is_mms: hasMedia,
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Create the message row if this isn't a resume. Guard against a concurrent
    // duplicate (same client_token) via the unique index.
    if (!message) {
      const { data: created, error: msgError } = await supabase.from("messages").insert({
        body: finalBody,
        sent_by: user.id,
        database: resolvedDatabase,
        list_ids: isDirectSend ? [] : list_ids,
        to_phones: isDirectSend ? [...phoneSet] : null,
        recipient_count: dedupedRecipients.length,
        status: 'sending',
        scheduled_at: scheduled_at || null,
        sent_at: scheduled_at ? null : new Date().toISOString(),
        media_urls: hasMedia ? cleanMediaUrls : null,
        client_token: client_token || null,
      }).select("id").single();

      if (msgError) {
        // Unique violation → a concurrent request with the same token won the
        // race. Reuse its row as a resume.
        if (client_token && (msgError as any).code === '23505') {
          const { data: existing } = await supabase
            .from("messages").select("id").eq("client_token", client_token).maybeSingle();
          if (existing) { message = { id: existing.id }; isResume = true; }
        }
        if (!message) return new Response(
          JSON.stringify({ error: "Failed to create message record" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        message = created;
      }
    }

    if (scheduled_at) {
      await supabase.from("messages").update({ status: 'queued' }).eq("id", message!.id);
      return new Response(
        JSON.stringify({ message_id: message!.id, recipient_count: dedupedRecipients.length, status: 'queued', is_mms: hasMedia }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioFrom = Deno.env.get("TWILIO_FROM_NUMBER");

    // On resume, skip recipients that already have a successful log for this
    // message so we never re-text anyone.
    let alreadySent = new Set<string>();
    if (isResume) {
      const priorLogs = await fetchAll<{ phone: string; status: string }>(() =>
        supabase.from("message_logs").select("phone, status").eq("message_id", message!.id)
      );
      for (const l of priorLogs) if (l.status === 'sent') alreadySent.add(l.phone);
    }
    const toSend = dedupedRecipients.filter((r) => !alreadySent.has(r.phone));

    if (!twilioSid || !twilioAuth || !twilioFrom) {
      const logs = toSend.map((r) => ({
        message_id: message!.id, contact_id: r.id,
        contact_type: r.type === 'unknown' ? null : r.type,
        phone: r.phone, status: 'queued', sent_at: new Date().toISOString(),
      }));
      for (let i = 0; i < logs.length; i += 500) {
        await supabase.from("message_logs").insert(logs.slice(i, i + 500));
      }
      await supabase.from("messages").update({ status: 'sent' }).eq("id", message!.id);
      return new Response(
        JSON.stringify({ message_id: message!.id, recipient_count: dedupedRecipients.length, status: 'sent', note: 'Twilio not configured — messages logged but not delivered', is_mms: hasMedia }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let sent = 0, failed = 0;
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
    const twilioAuthHeader = "Basic " + btoa(`${twilioSid}:${twilioAuth}`);

    for (const recipient of toSend) {
      try {
        const formData = new URLSearchParams();
        formData.append("To", recipient.phone);
        formData.append("From", twilioFrom);
        if (finalBody) formData.append("Body", finalBody);
        for (const url of cleanMediaUrls) formData.append("MediaUrl", url);
        const resp = await fetch(twilioUrl, {
          method: "POST",
          headers: { "Authorization": twilioAuthHeader, "Content-Type": "application/x-www-form-urlencoded" },
          body: formData.toString(),
        });
        const result = await resp.json();
        await supabase.from("message_logs").insert({
          message_id: message!.id, contact_id: recipient.id,
          contact_type: recipient.type === 'unknown' ? null : recipient.type,
          phone: recipient.phone, twilio_sid: result.sid || null,
          status: resp.ok ? 'sent' : 'failed',
          error_code: result.code ? String(result.code) : null,
          sent_at: new Date().toISOString(),
        });
        if (resp.ok) sent++; else failed++;
        await new Promise((r) => setTimeout(r, 350));
      } catch (err) {
        await supabase.from("message_logs").insert({
          message_id: message!.id, contact_id: recipient.id,
          contact_type: recipient.type === 'unknown' ? null : recipient.type,
          phone: recipient.phone, status: 'failed',
          error_code: (err as Error).message, sent_at: new Date().toISOString(),
        });
        failed++;
      }
    }

    await supabase.from("messages").update({
      status: failed === toSend.length && sent === 0 ? 'failed' : 'sent',
    }).eq("id", message!.id);

    return new Response(
      JSON.stringify({ message_id: message!.id, recipient_count: dedupedRecipients.length, sent, failed, status: 'sent', is_mms: hasMedia, resumed: isResume }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
