// Tidings: every authorized user shares the same inbox, so the badge
// count is global = number of inbound_messages where read_by IS NULL.
// We send a push to every subscription whose last_count is stale.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:sendscott@gmail.com";
const INTERNAL_FN_SECRET = Deno.env.get("INTERNAL_FN_SECRET")!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

interface Subscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  last_count: number;
}

Deno.serve(async (req: Request) => {
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${INTERNAL_FN_SECRET}`) {
    return new Response("unauthorized", { status: 401 });
  }

  const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { count, error: countErr } = await supa
    .from("inbound_messages")
    .select("id", { count: "exact", head: true })
    .is("read_by", null);

  if (countErr) {
    console.error("unread count failed", countErr);
    return new Response(JSON.stringify({ error: countErr.message }), { status: 500 });
  }
  const newCount = count ?? 0;

  const { data: subsData } = await supa
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth, last_count");
  const subs: Subscription[] = subsData ?? [];

  let sent = 0;
  let pruned = 0;
  for (const sub of subs) {
    if (sub.last_count === newCount) continue;
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ count: newCount }),
        { TTL: 60 * 60 * 24 },
      );
      await supa.from("push_subscriptions").update({
        last_count: newCount,
        last_pushed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", sub.id);
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number })?.statusCode;
      if (status === 404 || status === 410) {
        await supa.from("push_subscriptions").delete().eq("id", sub.id);
        pruned++;
      } else {
        console.error("push send failed", { id: sub.id, status, err });
      }
    }
  }

  return new Response(
    JSON.stringify({ subscribers: subs.length, sent, pruned, count: newCount }),
    { headers: { "Content-Type": "application/json" } },
  );
});
