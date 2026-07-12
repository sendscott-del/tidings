import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Returns the live Twilio account balance. ADMIN ONLY — the Twilio auth token
// must never reach the client, so this reads it server-side and the caller is
// verified as a Tidings admin before anything is returned.
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "No auth header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: appUser } = await supabase.from("users").select("role").eq("id", user.id).single();
    if (!appUser || appUser.role !== "admin") return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    if (!sid || !twToken) return new Response(JSON.stringify({ error: "Twilio not configured" }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Balance.json`, {
      headers: { "Authorization": "Basic " + btoa(`${sid}:${twToken}`) },
    });
    if (!resp.ok) {
      const body = await resp.text();
      return new Response(JSON.stringify({ error: `Twilio API error (${resp.status})`, detail: body.slice(0, 200) }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const data = await resp.json();
    return new Response(JSON.stringify({ balance: data.balance ?? null, currency: data.currency ?? "USD" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
