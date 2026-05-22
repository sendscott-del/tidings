// sync-roles-to-shared
// Tidings-side edge function. Fired by a Postgres trigger on tidings_user_roles
// whenever a row is INSERTed or DELETEd. Translates the change into a
// gather_grant_role / gather_revoke_role RPC call against the shared Supabase
// project so the rest of the Gathered suite (Magnify, Steward, Glean, Knit)
// sees the same role assignments Scott made in Tidings' admin UI.
//
// Env vars (set with `supabase secrets set ... --project-ref jdlykebsqafcngpntxma`):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  — already set (Tidings project)
//   INTERNAL_FN_SECRET                       — already set (used by other fns)
//   SHARED_SUPABASE_URL                      — defaults to isogetmvnpimcmouakeg
//   SHARED_SUPABASE_SERVICE_ROLE_KEY         — REQUIRED, must be set by Scott

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const TIDINGS_URL = Deno.env.get("SUPABASE_URL")!;
const TIDINGS_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_FN_SECRET = Deno.env.get("INTERNAL_FN_SECRET")!;
const SHARED_URL =
  Deno.env.get("SHARED_SUPABASE_URL") ?? "https://isogetmvnpimcmouakeg.supabase.co";
const SHARED_SERVICE_KEY = Deno.env.get("SHARED_SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface SyncPayload {
  op: "grant" | "revoke";
  user_id: string;
  role_key: string;
  ward: string | null;
}

Deno.serve(async (req: Request) => {
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${INTERNAL_FN_SECRET}`) {
    return new Response("unauthorized", { status: 401 });
  }

  if (!SHARED_SERVICE_KEY) {
    // Deploy succeeded but the secret isn't set yet. Don't crash — log and
    // return 503 so the trigger's pg_net log shows it; the sync becomes a no-op
    // until Scott runs `supabase secrets set SHARED_SUPABASE_SERVICE_ROLE_KEY=...`.
    console.warn("[sync-roles-to-shared] SHARED_SUPABASE_SERVICE_ROLE_KEY not set — sync disabled");
    return new Response("shared service key not configured", { status: 503 });
  }

  let payload: SyncPayload;
  try {
    payload = (await req.json()) as SyncPayload;
  } catch {
    return new Response("invalid JSON body", { status: 400 });
  }
  if (!payload?.op || !payload?.user_id || !payload?.role_key) {
    return new Response("missing op/user_id/role_key", { status: 400 });
  }

  // Look up the Tidings user's email + full_name. We sync by email since
  // gather_user_roles is email-keyed (the two projects don't share auth uuids).
  const tidings = createClient(TIDINGS_URL, TIDINGS_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: user, error: userErr } = await tidings
    .from("users")
    .select("email, full_name")
    .eq("id", payload.user_id)
    .single();
  if (userErr || !user?.email) {
    return new Response(`user lookup failed: ${userErr?.message ?? "no email"}`, { status: 404 });
  }

  // Call the shared project's RPC with service role. We hit the REST endpoint
  // directly so we can pass arbitrary headers and not worry about the JS client
  // caching session state.
  const rpcName = payload.op === "grant" ? "gather_grant_role" : "gather_revoke_role";
  const body: Record<string, unknown> = {
    p_email: user.email,
    p_role: payload.role_key,
    p_ward: payload.ward,
  };
  if (payload.op === "grant") body.p_full_name = user.full_name;

  // The shared RPCs check gather_super_admins membership via auth.uid(). When
  // called with the service_role JWT, auth.uid() is null — that fails the
  // check. We work around it by hitting a sibling SECURITY DEFINER RPC that
  // bypasses the super-admin gate when invoked with service_role. See the
  // companion migration (gather_user_roles_service_writes) below.
  const proxiedRpc = payload.op === "grant"
    ? "gather_grant_role_service"
    : "gather_revoke_role_service";

  const res = await fetch(`${SHARED_URL}/rest/v1/rpc/${proxiedRpc}`, {
    method: "POST",
    headers: {
      apikey: SHARED_SERVICE_KEY,
      Authorization: `Bearer ${SHARED_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "params=single-object",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    return new Response(`shared RPC ${rpcName} failed (${res.status}): ${text}`, {
      status: 502,
    });
  }

  return new Response(JSON.stringify({ ok: true, op: payload.op, email: user.email, role: payload.role_key }), {
    headers: { "Content-Type": "application/json" },
  });
});
