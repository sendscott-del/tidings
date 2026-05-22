import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

// Composite identity key — phone alone is NOT unique (household members share
// phones, 229+ duplicate-phone groups in the live stake).
function contactKey(c: { first_name?: string; last_name?: string; phone?: string }): string {
  const fn = (c.first_name || '').trim().toLowerCase();
  const ln = (c.last_name || '').trim().toLowerCase();
  const ph = (c.phone || '').trim();
  return `${ln}|${fn}|${ph}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false }});
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "No auth header" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }});
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized: " + (authError?.message || "no user") }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }});
    const { data: appUser } = await supabase.from("users").select("role").eq("id", user.id).single();
    if (!appUser || !['admin', 'sender'].includes(appUser.role)) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }});
    const { contacts, source_file } = await req.json();
    if (!contacts || !Array.isArray(contacts)) return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }});

    const incomingByKey = new Map<string, any>();
    let incomingDupes = 0;
    for (const c of contacts) {
      const k = contactKey(c);
      if (incomingByKey.has(k)) { incomingDupes++; continue; }
      incomingByKey.set(k, c);
    }

    const existing = await fetchAll<{ id: string; phone: string; first_name: string; last_name: string }>(() => supabase.from("contacts").select("id, phone, first_name, last_name"));
    const existingByKey = new Map<string, string[]>();
    for (const e of existing) {
      const k = contactKey(e);
      const arr = existingByKey.get(k) || [];
      arr.push(e.id);
      existingByKey.set(k, arr);
    }

    const toInsert: any[] = [];
    const toUpdate: any[] = [];
    let added = 0, updated = 0, removed = 0;
    const errorSamples: string[] = [];

    for (const [key, contact] of incomingByKey) {
      const existingIds = existingByKey.get(key);
      if (existingIds && existingIds.length > 0) {
        toUpdate.push({ ...contact, id: existingIds[0], source_file, updated_at: new Date().toISOString() });
      } else {
        toInsert.push({ ...contact, source_file });
      }
    }

    for (let i = 0; i < toInsert.length; i += 200) {
      const batch = toInsert.slice(i, i + 200);
      const { error } = await supabase.from("contacts").insert(batch);
      if (error) { if (errorSamples.length < 3) errorSamples.push(`insert: ${error.message}`); }
      else added += batch.length;
    }
    for (let i = 0; i < toUpdate.length; i += 200) {
      const batch = toUpdate.slice(i, i + 200);
      const { error } = await supabase.from("contacts").upsert(batch);
      if (error) { if (errorSamples.length < 3) errorSamples.push(`upsert: ${error.message}`); }
      else updated += batch.length;
    }

    const toDeleteIds: string[] = [];
    for (const [key, ids] of existingByKey) {
      if (!incomingByKey.has(key)) toDeleteIds.push(...ids);
      else if (ids.length > 1) toDeleteIds.push(...ids.slice(1));
    }
    if (toDeleteIds.length > 0) {
      for (let i = 0; i < toDeleteIds.length; i += 200) {
        const batch = toDeleteIds.slice(i, i + 200);
        await supabase.from("list_members").delete().in("contact_id", batch).eq("contact_type", "stake");
        await supabase.from("contacts").delete().in("id", batch);
      }
      removed = toDeleteIds.length;
    }

    await rebuildAutoLists(supabase);
    return new Response(JSON.stringify({ added, updated, removed, incoming_dupes_skipped: incomingDupes, errors: errorSamples.length > 0 ? errorSamples : undefined }), { headers: { ...corsHeaders, "Content-Type": "application/json" }});
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }});
  }
});

// ---------------------------------------------------------------------------
// Auto-list rebuild — v0.28.0
//
// Membership filter rule for EVERY list:
//   contact must have phone IS NOT NULL AND opted_out = false.
// (Opted-out contacts are excluded from the list itself; the prior pattern of
// filtering at send time is dropped per Scott's directive.)
// ---------------------------------------------------------------------------

function eligible(c: any): boolean {
  return !!c.phone && !c.opted_out;
}

// --- Leadership matchers (callings text[] inspection) -----------------------

function callingsAny(c: any, predicate: (s: string) => boolean): boolean {
  const callings: string[] = Array.isArray(c.callings) ? c.callings : [];
  return callings.some(predicate);
}

// Stake — High Councilors:
//   Stake President | Stake Presidency * | Stake Clerk (NOT Assistant Clerk)
//   | Stake Executive Secretary (NOT Assistant) | Stake High Councilor
function isStakeHighCouncil(c: any): boolean {
  return callingsAny(c, (s) => {
    if (/\bstake president\b/i.test(s)) return true;
    if (/stake presidency/i.test(s)) return true;
    if (/stake high councilor/i.test(s)) return true;
    if (/\bstake clerk\b/i.test(s) && !/stake assistant clerk/i.test(s)) return true;
    if (/\bstake executive secretary\b/i.test(s) && !/stake assistant executive secretary/i.test(s)) return true;
    return false;
  });
}

// Bishopric (extended): Bishop | Bishopric First/Second Counselor |
// Ward Clerk (NOT Assistant) | Ward Executive Secretary (NOT Assistant)
function isBishopric(c: any): boolean {
  return callingsAny(c, (s) => {
    if (/\bbishop\b/i.test(s)) return true; // \b prevents matching "bishopric"
    if (/bishopric\s+(first|second)\s+counselor/i.test(s)) return true;
    if (/\bward clerk\b/i.test(s) && !/ward assistant clerk/i.test(s)) return true;
    if (/\bward executive secretary\b/i.test(s) && !/ward assistant executive secretary/i.test(s)) return true;
    return false;
  });
}

// Just the bishop (per-ward "Bishops" list)
function isBishop(c: any): boolean {
  return callingsAny(c, (s) => /\bbishop\b/i.test(s));
}

// Org presidency matcher factory — includes president, two counselors,
// secretary, and assistant secretary. Excludes "Ministering Secretary" which
// is a separate ministering-tracking calling, not the org secretary.
function makePresidencyMatcher(org: string) {
  const orgRe = new RegExp(org, 'i');
  const ministeringRe = /ministering\s+secretary/i;
  return (c: any) => callingsAny(c, (s) => {
    if (!orgRe.test(s)) return false;
    if (/(president|first\s+counselor|second\s+counselor)/i.test(s)) return true;
    if (/\bassistant\s+secretary\b/i.test(s)) return true;
    if (/\bsecretary\b/i.test(s) && !ministeringRe.test(s)) return true;
    return false;
  });
}

const isReliefSocietyPresidency = makePresidencyMatcher('relief society');
const isEldersQuorumPresidency = makePresidencyMatcher('elders quorum');
const isPrimaryPresidency = makePresidencyMatcher('primary');
const isYoungWomenPresidency = makePresidencyMatcher('young women');
const isSundaySchoolPresidency = makePresidencyMatcher('sunday school');

function isWardMissionLeader(c: any): boolean {
  return callingsAny(c, (s) => /ward\s+mission\s+leader/i.test(s));
}

function isPrimaryTeacher(c: any): boolean {
  return callingsAny(c, (s) => /primary/i.test(s) && /teacher/i.test(s));
}

async function rebuildAutoLists(supabase: any) {
  const raw = await fetchAll<any>(() => supabase.from("contacts").select("*"));
  if (raw.length === 0) return;
  const allContacts = raw.filter(eligible);

  // ----- Stake-wide leadership (8) -----
  const stakeLeadership: { name: string; predicate: (c: any) => boolean }[] = [
    { name: "Stake — High Councilors",                predicate: isStakeHighCouncil },
    { name: "Stake — Bishoprics",                     predicate: isBishopric },
    { name: "Stake — Elders Quorum Presidencies",     predicate: isEldersQuorumPresidency },
    { name: "Stake — Relief Society Presidencies",    predicate: isReliefSocietyPresidency },
    { name: "Stake — Primary Presidencies",           predicate: isPrimaryPresidency },
    { name: "Stake — Sunday School Presidencies",     predicate: isSundaySchoolPresidency },
    { name: "Stake — Ward Mission Leaders",           predicate: isWardMissionLeader },
    { name: "Stake — Young Women Presidencies",       predicate: isYoungWomenPresidency },
  ];
  for (const def of stakeLeadership) {
    await rebuildList(supabase, def.name, null, allContacts.filter(def.predicate));
  }

  // ----- Stake-wide gender (adults 18+) + priesthood (4) -----
  await rebuildList(supabase, "Stake — Men",   null, allContacts.filter((c) => c.gender === 'M' && c.is_adult));
  await rebuildList(supabase, "Stake — Women", null, allContacts.filter((c) => c.gender === 'F' && c.is_adult));
  await rebuildList(supabase, "Aaronic Priesthood",     null, allContacts.filter((c) => c.priesthood === 'Aaronic'));
  await rebuildList(supabase, "Melchizedek Priesthood", null, allContacts.filter((c) => c.priesthood === 'Melchizedek'));

  // ----- Per-ward lists -----
  const wards = [...new Set(allContacts.map((c: any) => c.unit_name).filter(Boolean))] as string[];
  const currentMonth = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })).getMonth() + 1;

  for (const ward of wards) {
    const w = allContacts.filter((c: any) => c.unit_name === ward);
    await rebuildList(supabase, ward, ward, w);

    const perWard: { suffix: string; matching: any[] }[] = [
      { suffix: "Bishops",                  matching: w.filter(isBishop) },
      { suffix: "Bishopric",                matching: w.filter(isBishopric) },
      { suffix: "Primary Teachers",         matching: w.filter(isPrimaryTeacher) },
      { suffix: "Parents",                  matching: w.filter((c) => c.has_children) },
      { suffix: "Endowed Members",          matching: w.filter((c) => c.is_endowed) },
      { suffix: "Returned Missionaries",    matching: w.filter((c) => c.is_returned_missionary) },
      { suffix: "Single Members",           matching: w.filter((c) => c.is_single) },
      { suffix: "Men",                      matching: w.filter((c) => c.gender === 'M' && c.is_adult) },
      { suffix: "Women",                    matching: w.filter((c) => c.gender === 'F' && c.is_adult) },
      { suffix: "Aaronic Priesthood",       matching: w.filter((c) => c.priesthood === 'Aaronic') },
      { suffix: "Melchizedek Priesthood",   matching: w.filter((c) => c.priesthood === 'Melchizedek') },
      { suffix: "Birthdays This Month",     matching: w.filter((c) => c.birth_month === currentMonth) },
    ];
    for (const def of perWard) {
      await rebuildList(supabase, `${ward} — ${def.suffix}`, ward, def.matching);
    }
  }
}

async function rebuildList(supabase: any, listName: string, wardScope: string | null, matching: any[]) {
  const { data: existingList } = await supabase
    .from("lists").select("id")
    .eq("name", listName).eq("database", "stake").eq("is_auto", true)
    .maybeSingle();
  let listId: string;
  if (existingList) {
    listId = existingList.id;
    await supabase.from("lists").update({ ward_scope: wardScope }).eq("id", listId);
  } else {
    const { data: newList } = await supabase
      .from("lists").insert({ name: listName, database: "stake", is_auto: true, ward_scope: wardScope })
      .select("id").single();
    listId = newList.id;
  }
  await supabase.from("list_members").delete().eq("list_id", listId);
  if (matching.length > 0) {
    const members = matching.map((c: any) => ({ list_id: listId, contact_id: c.id, contact_type: "stake" }));
    for (let i = 0; i < members.length; i += 500) {
      await supabase.from("list_members").insert(members.slice(i, i + 500));
    }
  }
}
