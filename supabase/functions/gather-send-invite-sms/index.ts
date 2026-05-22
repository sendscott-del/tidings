// gather-send-invite-sms
// Lightweight SMS dispatcher for cross-app invite use cases (Knit member
// invitations, etc). Authenticates via Bearer <INTERNAL_FN_SECRET> — does NOT
// require a Tidings user JWT, so callers from other Gathered apps (Knit's
// sheetPull runs on the Knit Vercel project) can use it.
//
// Sends a single SMS via Twilio using Tidings' env-configured credentials
// (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER — same ones
// the existing send-message function uses).
//
// Intentionally does NOT enforce ward budgets or write to message_logs.
// These invites are low-volume one-offs from the missionary sheet pull
// cycle; full budget-enforced stake messaging stays on the existing
// send-message endpoint.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const INTERNAL_FN_SECRET = Deno.env.get("INTERNAL_FN_SECRET") ?? "";
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_FROM_NUMBER") ?? "";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const auth = req.headers.get("authorization") ?? "";
  if (!INTERNAL_FN_SECRET || auth !== `Bearer ${INTERNAL_FN_SECRET}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  let payload: { phone?: string; body?: string; audit_tag?: string };
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid JSON" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const phone = (payload.phone ?? "").trim();
  const body = (payload.body ?? "").trim();
  if (!phone || !body) {
    return new Response(JSON.stringify({ error: "phone and body required" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    return new Response(
      JSON.stringify({ error: "Twilio not configured on Tidings project" }),
      { status: 503, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const authHeader = "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  const fd = new URLSearchParams();
  fd.append("To", phone);
  fd.append("From", TWILIO_FROM_NUMBER);
  fd.append("Body", body);

  const res = await fetch(twilioUrl, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: fd.toString(),
  });
  const result = await res.json();

  if (!res.ok) {
    return new Response(
      JSON.stringify({
        error: `Twilio ${res.status}: ${result.message ?? "unknown"}`,
        code: result.code ?? null,
      }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ ok: true, sid: result.sid, audit_tag: payload.audit_tag ?? null }),
    { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
  );
});
