import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
const INVITE_TTL_DAYS = 7;
const APP_URL = Deno.env.get("TIDINGS_APP_URL") || "https://tidings.gatheredin.app";
const APP_NAME = "Tidings"; // Surfaced in the Left Field Labs branded invite email template.
function randomToken() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return [
    ...arr
  ].map((b)=>b.toString(16).padStart(2, "0")).join("");
}
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") return new Response("ok", {
    headers: corsHeaders
  });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    // Bridge path: the Gather hub (shared project) may invite Tidings users
    // directly. It authenticates with a shared secret instead of a Tidings
    // admin JWT — the caller was already verified as a Gather super admin.
    const bridgeSecret = Deno.env.get("GATHER_BRIDGE_SECRET");
    const bridgeHeader = req.headers.get("X-Gather-Bridge");
    let createdBy = null;
    if (!(bridgeSecret && bridgeHeader && bridgeHeader === bridgeSecret)) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return new Response(JSON.stringify({
        error: "Unauthorized"
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) return new Response(JSON.stringify({
        error: "Unauthorized"
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
      const { data: appUser } = await supabase.from("users").select("role").eq("id", user.id).single();
      if (!appUser || appUser.role !== "admin") return new Response(JSON.stringify({
        error: "Admin only"
      }), {
        status: 403,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
      createdBy = user.id;
    }
    const body = await req.json();
    const email = (body.email || "").trim().toLowerCase();
    const full_name = body.full_name?.trim() || null;
    const role = body.role || "viewer";
    const permissions = body.permissions || {};
    const signature = body.signature?.trim() || null;
    const ward = body.ward || null;
    if (!email || !email.includes("@")) return new Response(JSON.stringify({
      error: "Valid email required"
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
    if (![
      "admin",
      "sender",
      "viewer"
    ].includes(role)) return new Response(JSON.stringify({
      error: "Invalid role"
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
    const { data: existingInvite } = await supabase.from("tidings_invites").select("id").eq("email", email).is("accepted_at", null).is("revoked_at", null).maybeSingle();
    if (existingInvite) return new Response(JSON.stringify({
      error: "A pending invite already exists for that email. Resend or revoke it first."
    }), {
      status: 409,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
    const { data: existingUser } = await supabase.from("users").select("id").eq("email", email).maybeSingle();
    if (existingUser) return new Response(JSON.stringify({
      error: "A user with that email already exists."
    }), {
      status: 409,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
    const inviteToken = randomToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const redirectTo = `${APP_URL}/invite/${inviteToken}`;
    const { data: inviteRow, error: insertErr } = await supabase.from("tidings_invites").insert({
      email,
      full_name,
      role,
      permissions,
      signature,
      ward,
      token: inviteToken,
      expires_at: expiresAt,
      created_by: createdBy
    }).select("id").single();
    if (insertErr || !inviteRow) return new Response(JSON.stringify({
      error: insertErr?.message || "Failed to create invite"
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
    // Send via Supabase Auth. The `app` field in user_metadata is read by the
    // shared Left Field Labs invite email template ({{ .Data.app }}) so the
    // subject and body identify which Gathered app this invite is for.
    const { error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: {
        full_name: full_name || "",
        invite_id: inviteRow.id,
        app: APP_NAME
      }
    });
    if (inviteErr) {
      await supabase.from("tidings_invites").delete().eq("id", inviteRow.id);
      return new Response(JSON.stringify({
        error: `Could not send invite email: ${inviteErr.message}`
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    return new Response(JSON.stringify({
      success: true,
      invite_id: inviteRow.id,
      expires_at: expiresAt,
      accept_url: redirectTo
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: err.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
