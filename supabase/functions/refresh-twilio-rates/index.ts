// refresh-twilio-rates
// Queries Twilio's Usage Records API for the trailing 30 days of outbound
// SMS and MMS, computes a blended cents-per-message rate per channel (the
// "what we actually paid" number, which captures 10DLC carrier pass-through
// fees that the Pricing API doesn't surface), and upserts a fresh row into
// tidings_rate_cache for each channel.
//
// Triggered daily by pg_cron via pg_net, and on-demand from the Admin UI.
// Auth: Bearer <INTERNAL_FN_SECRET> — same shared secret pattern as
// gather-send-invite-sms.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const INTERNAL_FN_SECRET = Deno.env.get("INTERNAL_FN_SECRET") ?? "";
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const LOOKBACK_DAYS = 30;
const MIN_SAMPLES = 10;

type ChannelSpec = {
  cache_channel: "sms" | "mms";
  twilio_category: string;
};

const CHANNELS: ChannelSpec[] = [
  { cache_channel: "sms", twilio_category: "sms-outbound" },
  { cache_channel: "mms", twilio_category: "mms-outbound" },
];

type Refreshed = {
  channel: "sms" | "mms";
  cents_per_unit: number | null;
  sample_size: number;
  total_price_usd: number;
  skipped_reason?: string;
};

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function fetchUsage(category: string, start: string, end: string) {
  const url =
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}` +
    `/Usage/Records.json?Category=${category}` +
    `&StartDate=${start}&EndDate=${end}`;
  const authHeader = "Basic " + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  const res = await fetch(url, { headers: { Authorization: authHeader } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twilio Usage API ${category} ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = await res.json() as {
    usage_records?: Array<{ count: string; price: string; price_unit: string }>;
  };
  let count = 0;
  let priceTotal = 0;
  for (const rec of json.usage_records ?? []) {
    count += Number(rec.count) || 0;
    priceTotal += Math.abs(Number(rec.price) || 0);
  }
  return { count, priceUsd: priceTotal };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const auth = req.headers.get("authorization") ?? "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  let authorized = false;
  if (INTERNAL_FN_SECRET && bearer === INTERNAL_FN_SECRET) {
    authorized = true;
  } else if (bearer) {
    const { data: userData } = await supabase.auth.getUser(bearer);
    if (userData?.user?.id) {
      const { data: row } = await supabase
        .from("users")
        .select("role")
        .eq("id", userData.user.id)
        .maybeSingle();
      if (row?.role === "admin") authorized = true;
    }
  }

  if (!authorized) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    return new Response(
      JSON.stringify({ error: "Twilio credentials not configured" }),
      { status: 503, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - LOOKBACK_DAYS);
  const startStr = ymd(start);
  const endStr = ymd(end);

  const results: Refreshed[] = [];

  for (const ch of CHANNELS) {
    try {
      const { count, priceUsd } = await fetchUsage(ch.twilio_category, startStr, endStr);

      if (count < MIN_SAMPLES) {
        results.push({
          channel: ch.cache_channel,
          cents_per_unit: null,
          sample_size: count,
          total_price_usd: priceUsd,
          skipped_reason: `sample_size ${count} < ${MIN_SAMPLES}`,
        });
        continue;
      }

      const centsPerUnit = (priceUsd * 100) / count;
      const rounded = Math.round(centsPerUnit * 10000) / 10000;

      const { error } = await supabase.from("tidings_rate_cache").insert({
        channel: ch.cache_channel,
        country: "US",
        cents_per_unit: rounded,
        source: "twilio_usage_blended",
        sample_size: count,
        notes: `Twilio Usage Records ${ch.twilio_category} ${startStr}..${endStr}, total $${priceUsd.toFixed(2)}`,
      });
      if (error) throw new Error(`Insert failed: ${error.message}`);

      results.push({
        channel: ch.cache_channel,
        cents_per_unit: rounded,
        sample_size: count,
        total_price_usd: priceUsd,
      });
    } catch (err) {
      results.push({
        channel: ch.cache_channel,
        cents_per_unit: null,
        sample_size: 0,
        total_price_usd: 0,
        skipped_reason: String(err instanceof Error ? err.message : err),
      });
    }
  }

  return new Response(
    JSON.stringify({
      window: { start: startStr, end: endStr },
      results,
    }),
    { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
  );
});
