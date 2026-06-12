// create-admin — DISABLED (2026-06-12 security review)
//
// This was a one-time bootstrap function that created the first admin user.
// It had verify_jwt=false, NO auth check, and a hardcoded production password
// in source — anyone who reached the URL could (re)create a known-password
// admin, and anyone who read the source had the credential.
//
// The first admin already exists. New users are created through the
// admin-gated `create-user` / `invite-create` flow. This endpoint is retired
// and now refuses all requests. Do not re-add credentials here.

Deno.serve(() =>
  new Response(
    JSON.stringify({ error: "Gone — create-admin is permanently disabled." }),
    { status: 410, headers: { "Content-Type": "application/json" } },
  )
);
