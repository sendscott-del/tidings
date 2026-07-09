import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FALLBACK_CENTS_PER_SEGMENT = 1.5; // US SMS blended (delivery + carrier + compliance)
const FALLBACK_CENTS_PER_MMS = 2.0;      // US MMS, flat per recipient
const MAX_MEDIA = 10;                    // Twilio caps at 10 MediaUrl entries
// Every id goes in the request URL; a few hundred UUIDs overflow the gateway
// URL-length limit (HTTP/2 "stream error"). Keep the id list short.
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

// This function no longer texts recipients inline (that timed out on large
// lists and showed the sender a false "Send failed"). It validates, checks
// budget, records the message as 'sending', and hands off to the dispatcher —
// which texts everyone in resumable, rate-limited batches and auto-resumes via
// the per-minute cron. So this returns in ~seconds regardless of list size.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "No auth header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: appUser } = await supabase.from("users").select("role, signature, ward").eq("id", user.id).single();
    if (!appUser || !["admin", "sender"].includes(appUser.role)) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!appUser.ward) return new Response(JSON.stringify({ error: "NO_WARD_ASSIGNED", message: "Your account is not assigned to a ward. Ask an admin to set your ward in Admin → Users before sending." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { body, database, list_ids, scheduled_at, to_phones, media_urls, client_token } = await req.json();
    const cleanMediaUrls = sanitizeMediaUrls(media_urls);
    const hasMedia = cleanMediaUrls.length > 0;
    if (!body && !hasMedia) return new Response(JSON.stringify({ error: "Missing body" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const signature = (appUser.signature || "").trim();
    const finalBody = signature && body ? `${body}\n\n${signature}` : (body || "");

    const isDirectSend = Array.isArray(to_phones) && to_phones.length > 0;
    if (!isDirectSend && (!list_ids || !Array.isArray(list_ids) || list_ids.length === 0)) return new Response(JSON.stringify({ error: "Missing list_ids or to_phones" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    interface Recipient { id: string | null; phone: string; type: string }
    const recipients: Recipient[] = [];
    let resolvedDatabase = database || "stake";

    if (isDirectSend) {
      const phones: string[] = [...new Set(to_phones.map((p: string) => p.trim()).filter(Boolean))];
      for (const phone of phones) {
        const { data: stake } = await supabase.from("contacts").select("id, opted_out").eq("phone", phone).maybeSingle();
        if (stake) { if (!stake.opted_out) recipients.push({ id: stake.id, phone, type: "stake" }); continue; }
        const { data: comm } = await supabase.from("community_contacts").select("id, opted_out").eq("phone", phone).maybeSingle();
        if (comm) { if (!comm.opted_out) recipients.push({ id: comm.id, phone, type: "community" }); continue; }
        recipients.push({ id: null, phone, type: "unknown" });
      }
    } else {
      const memberLinks = await fetchAll<{ contact_id: string; contact_type: string }>(() =>
        supabase.from("list_members").select("contact_id, contact_type").in("list_id", list_ids)
      );
      if (memberLinks.length === 0) return new Response(JSON.stringify({ error: "No recipients in selected lists" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const uniqueContacts = new Map<string, string>();
      for (const m of memberLinks) if (!uniqueContacts.has(m.contact_id)) uniqueContacts.set(m.contact_id, m.contact_type);
      const stakeIds = [...uniqueContacts.entries()].filter(([_, t]) => t === "stake").map(([id]) => id);
      const communityIds = [...uniqueContacts.entries()].filter(([_, t]) => t === "community").map(([id]) => id);
      for (let i = 0; i < stakeIds.length; i += IN_CHUNK) {
        const batch = stakeIds.slice(i, i + IN_CHUNK);
        const data = await fetchAll<{ id: string; phone: string; opted_out: boolean }>(() =>
          supabase.from("contacts").select("id, phone, opted_out").in("id", batch)
        );
        for (const c of data) if (!c.opted_out && c.phone) recipients.push({ id: c.id, phone: c.phone, type: "stake" });
      }
      for (let i = 0; i < communityIds.length; i += IN_CHUNK) {
        const batch = communityIds.slice(i, i + IN_CHUNK);
        const data = await fetchAll<{ id: string; phone: string; opted_out: boolean }>(() =>
          supabase.from("community_contacts").select("id, phone, opted_out").in("id", batch)
        );
        for (const c of data) if (!c.opted_out && c.phone) recipients.push({ id: c.id, phone: c.phone, type: "community" });
      }
    }

    const phoneSet = new Set<string>();
    let dedupedRecipients = recipients.filter((r) => { if (phoneSet.has(r.phone)) return false; phoneSet.add(r.phone); return true; });

    // Persistent opt-out gate.
    if (dedupedRecipients.length > 0) {
      const phones = dedupedRecipients.map((r) => r.phone);
      const suppressed = new Set<string>();
      for (let i = 0; i < phones.length; i += 200) {
        const batch = phones.slice(i, i + 200);
        const { data: rows } = await supabase.from("tidings_opt_outs").select("phone").in("phone", batch);
        for (const row of rows ?? []) suppressed.add(row.phone);
      }
      if (suppressed.size > 0) { dedupedRecipients = dedupedRecipients.filter((r) => !suppressed.has(r.phone)); for (const p of suppressed) phoneSet.delete(p); }
    }

    if (dedupedRecipients.length === 0) return new Response(JSON.stringify({ error: "No deliverable recipients (all opted out or invalid)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    if (isDirectSend) resolvedDatabase = dedupedRecipients[0].type === "community" ? "community" : "stake";

    // Idempotency: reuse an existing message for this token instead of creating a second one.
    if (client_token) {
      const { data: existing } = await supabase.from("messages").select("id, status").eq("client_token", client_token).maybeSingle();
      if (existing) {
        return new Response(JSON.stringify({ message_id: existing.id, status: existing.status, recipient_count: dedupedRecipients.length, deduped: true, is_mms: hasMedia }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Upfront budget check (blocks over-budget sends before creating the message).
    let centsPerSegment = FALLBACK_CENTS_PER_SEGMENT;
    let centsPerMms = FALLBACK_CENTS_PER_MMS;
    try {
      const { data: smsRate } = await supabase.rpc("get_current_rate_cents", { p_channel: "sms", p_country: "US" });
      if (smsRate != null && Number(smsRate) > 0) centsPerSegment = Number(smsRate);
      const { data: mmsRate } = await supabase.rpc("get_current_rate_cents", { p_channel: "mms", p_country: "US" });
      if (mmsRate != null && Number(mmsRate) > 0) centsPerMms = Number(mmsRate);
    } catch (_) { /* keep fallbacks */ }
    const segments = segmentsFor(finalBody);
    const projCents = hasMedia ? centsPerMms * dedupedRecipients.length : segments * dedupedRecipients.length * centsPerSegment;
    const budgetWard = resolvedDatabase === "community" ? "Community Events" : appUser.ward;
    const { data: budgetRow } = await supabase.from("ward_budgets").select("budget_cents").eq("ward_name", budgetWard).maybeSingle();
    const budgetCents = budgetRow?.budget_cents ?? 0;
    const { data: usedRaw } = await supabase.rpc("get_ward_usage_cents", { p_ward: budgetWard });
    const usedCents = Number(usedRaw ?? 0);
    const remainingCents = budgetCents - usedCents;
    if (projCents > remainingCents) {
      return new Response(JSON.stringify({
        error: "BUDGET_EXCEEDED",
        message: `This send would cost about $${(projCents / 100).toFixed(2)} but only $${(Math.max(0, remainingCents) / 100).toFixed(2)} remains in the ${budgetWard} budget this quarter.`,
        ward: budgetWard, budget_cents: budgetCents, used_cents: usedCents, remaining_cents: remainingCents,
        projected_cost_cents: projCents, recipient_count: dedupedRecipients.length, segments, is_mms: hasMedia,
      }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create the message. Immediate sends are 'sending' (the dispatcher texts
    // them in resumable batches); scheduled sends are 'queued' until fire time.
    const isScheduled = !!scheduled_at;
    const { data: created, error: msgError } = await supabase.from("messages").insert({
      body: finalBody, sent_by: user.id, database: resolvedDatabase,
      list_ids: isDirectSend ? [] : list_ids, to_phones: isDirectSend ? [...phoneSet] : null,
      recipient_count: dedupedRecipients.length, status: isScheduled ? "queued" : "sending",
      scheduled_at: scheduled_at || null, sent_at: isScheduled ? null : new Date().toISOString(),
      media_urls: hasMedia ? cleanMediaUrls : null, client_token: client_token || null,
    }).select("id").single();

    if (msgError) {
      if (client_token && (msgError as any).code === "23505") {
        const { data: existing } = await supabase.from("messages").select("id, status").eq("client_token", client_token).maybeSingle();
        if (existing) return new Response(JSON.stringify({ message_id: existing.id, status: existing.status, recipient_count: dedupedRecipients.length, deduped: true, is_mms: hasMedia }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "Failed to create message record" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (isScheduled) {
      return new Response(JSON.stringify({ message_id: created.id, recipient_count: dedupedRecipients.length, status: "queued", is_mms: hasMedia }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Hand off to the dispatcher (resumable, rate-limited batches that survive
    // the function time limit). Kick it now for an instant start; the per-minute
    // cron is the backstop if this fire-and-forget call is lost.
    fetch(`${supabaseUrl}/functions/v1/dispatch-scheduled-messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => {});

    return new Response(JSON.stringify({ message_id: created.id, recipient_count: dedupedRecipients.length, status: "sending", is_mms: hasMedia }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
