import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function fetchAll<T>(
  queryFactory: () => any,
  pageSize = 1000
): Promise<T[]> {
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized: " + (authError?.message || "no user") }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: appUser } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();
    if (!appUser || !['admin', 'sender'].includes(appUser.role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { contacts, source_file } = await req.json();
    if (!contacts || !Array.isArray(contacts)) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const existing = await fetchAll<{ id: string; phone: string }>(() =>
      supabase.from("contacts").select("id, phone")
    );
    const existingByPhone = new Map(existing.map((c) => [c.phone, c.id]));
    const incomingPhones = new Set(contacts.map((c: any) => c.phone));

    let added = 0;
    let updated = 0;
    let removed = 0;

    const toInsert: any[] = [];
    const toUpdate: any[] = [];

    for (const contact of contacts) {
      const existingId = existingByPhone.get(contact.phone);
      if (existingId) {
        toUpdate.push({ ...contact, id: existingId, source_file, updated_at: new Date().toISOString() });
      } else {
        toInsert.push({ ...contact, source_file });
      }
    }

    for (let i = 0; i < toInsert.length; i += 200) {
      const batch = toInsert.slice(i, i + 200);
      const { error } = await supabase.from("contacts").insert(batch);
      if (!error) added += batch.length;
    }

    for (let i = 0; i < toUpdate.length; i += 200) {
      const batch = toUpdate.slice(i, i + 200);
      const { error } = await supabase.from("contacts").upsert(batch);
      if (!error) updated += batch.length;
    }

    const toDeleteIds: string[] = [];
    for (const [phone, id] of existingByPhone) {
      if (!incomingPhones.has(phone)) {
        toDeleteIds.push(id);
      }
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

    return new Response(
      JSON.stringify({ added, updated, removed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ---------------------------------------------------------------------------
// Auto-list rebuild — v0.26.0
//
// Existing flat-named stake lists (Aaronic Priesthood, Households with
// Children, etc.) and per-ward catch-all lists keep their previous names for
// backward compatibility. All new lists added in v0.26.0 use the prefixed
// naming convention: `Stake — <Name>` for stake-wide, `<Ward> — <Name>` for
// ward-scoped.
// ---------------------------------------------------------------------------

// Substring patterns (case-insensitive) for matching leadership callings.
// Tested against each element of the contact's `callings` text[].
const LEADERSHIP_PATTERNS: Record<string, RegExp> = {
  bishopric: /\bbishop\b|bishopric\s+(first|second)\s+counselor/i,
  elders_quorum_presidency: /elders\s+quorum\s+(president|first\s+counselor|second\s+counselor)/i,
  relief_society_presidency: /relief\s+society\s+(president|first\s+counselor|second\s+counselor)/i,
  primary_presidency: /primary\s+(president|first\s+counselor|second\s+counselor)/i,
  sunday_school_presidency: /sunday\s+school\s+(president|first\s+counselor|second\s+counselor)/i,
  ward_mission_leader: /ward\s+mission\s+leader/i,
  young_women_presidency: /young\s+women\s+(president|first\s+counselor|second\s+counselor)/i,
};

function callingsMatch(contact: any, pattern: RegExp): boolean {
  const callings: string[] = Array.isArray(contact.callings) ? contact.callings : [];
  return callings.some((c) => pattern.test(c));
}

function isPrimaryTeacher(contact: any): boolean {
  const callings: string[] = Array.isArray(contact.callings) ? contact.callings : [];
  return callings.some((c) => /primary/i.test(c) && /teacher/i.test(c));
}

async function rebuildAutoLists(supabase: any) {
  const allContacts = await fetchAll<any>(() =>
    supabase.from("contacts").select("*")
  );
  if (allContacts.length === 0) return;

  // ----- Existing stake-wide flat-named lists (kept for backward compat) -----
  const legacyStakeLists: { name: string; filter: (c: any) => boolean }[] = [
    { name: "Relief Society", filter: (c) => c.relief_society },
    { name: "Elders Quorum", filter: (c) => c.elders_quorum },
    { name: "Young Women", filter: (c) => c.young_women },
    { name: "Aaronic Priesthood", filter: (c) => c.aaronic || c.priesthood === 'Aaronic' },
    { name: "Primary", filter: (c) => c.primary_member },
    { name: "Melchizedek Priesthood", filter: (c) => c.melchizedek || c.priesthood === 'Melchizedek' },
    { name: "Households with Children", filter: (c) => c.has_children },
  ];
  for (const def of legacyStakeLists) {
    await rebuildList(supabase, def.name, null, allContacts.filter(def.filter));
  }

  // ----- New stake-wide leadership lists (7) -----
  const stakeLeadership: { name: string; pattern: RegExp }[] = [
    { name: "Stake — Bishoprics", pattern: LEADERSHIP_PATTERNS.bishopric },
    { name: "Stake — Elders Quorum Presidencies", pattern: LEADERSHIP_PATTERNS.elders_quorum_presidency },
    { name: "Stake — Relief Society Presidencies", pattern: LEADERSHIP_PATTERNS.relief_society_presidency },
    { name: "Stake — Primary Presidencies", pattern: LEADERSHIP_PATTERNS.primary_presidency },
    { name: "Stake — Sunday School Presidencies", pattern: LEADERSHIP_PATTERNS.sunday_school_presidency },
    { name: "Stake — Ward Mission Leaders", pattern: LEADERSHIP_PATTERNS.ward_mission_leader },
    { name: "Stake — Young Women Presidencies", pattern: LEADERSHIP_PATTERNS.young_women_presidency },
  ];
  for (const def of stakeLeadership) {
    await rebuildList(supabase, def.name, null, allContacts.filter((c) => callingsMatch(c, def.pattern)));
  }

  // ----- New stake-wide gender splits (2) -----
  // (Stake-wide Aaronic / Melchizedek already covered by the legacy flat names.)
  await rebuildList(supabase, "Stake — Men", null, allContacts.filter((c) => c.gender === 'M'));
  await rebuildList(supabase, "Stake — Women", null, allContacts.filter((c) => c.gender === 'F'));

  // ----- Per-ward lists -----
  const wards = [...new Set(allContacts.map((c: any) => c.unit_name).filter(Boolean))] as string[];
  const currentMonth = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Chicago' })
  ).getMonth() + 1;

  for (const ward of wards) {
    const wardContacts = allContacts.filter((c: any) => c.unit_name === ward);

    // Catch-all ward list (existing pattern, kept)
    await rebuildList(supabase, ward, ward, wardContacts);

    // New ward-scoped lists — all prefixed `<ward> — `
    const perWard: { suffix: string; matching: any[] }[] = [
      { suffix: "Primary Teachers", matching: wardContacts.filter(isPrimaryTeacher) },
      { suffix: "Parents", matching: wardContacts.filter((c) => c.has_children) },
      { suffix: "Endowed Members", matching: wardContacts.filter((c) => c.is_endowed) },
      { suffix: "Returned Missionaries", matching: wardContacts.filter((c) => c.is_returned_missionary) },
      { suffix: "Single Members", matching: wardContacts.filter((c) => c.is_single) },
      { suffix: "Men", matching: wardContacts.filter((c) => c.gender === 'M') },
      { suffix: "Women", matching: wardContacts.filter((c) => c.gender === 'F') },
      { suffix: "Aaronic Priesthood", matching: wardContacts.filter((c) => c.priesthood === 'Aaronic') },
      { suffix: "Melchizedek Priesthood", matching: wardContacts.filter((c) => c.priesthood === 'Melchizedek') },
      { suffix: "Birthdays This Month", matching: wardContacts.filter((c) => c.birth_month === currentMonth) },
    ];

    for (const def of perWard) {
      await rebuildList(supabase, `${ward} — ${def.suffix}`, ward, def.matching);
    }
  }
}

async function rebuildList(supabase: any, listName: string, wardScope: string | null, matching: any[]) {
  const { data: existingList } = await supabase
    .from("lists")
    .select("id")
    .eq("name", listName)
    .eq("database", "stake")
    .eq("is_auto", true)
    .maybeSingle();

  let listId: string;
  if (existingList) {
    listId = existingList.id;
    await supabase.from("lists").update({ ward_scope: wardScope }).eq("id", listId);
  } else {
    const { data: newList } = await supabase
      .from("lists")
      .insert({ name: listName, database: "stake", is_auto: true, ward_scope: wardScope })
      .select("id")
      .single();
    listId = newList.id;
  }

  await supabase.from("list_members").delete().eq("list_id", listId);

  if (matching.length > 0) {
    const members = matching.map((c: any) => ({
      list_id: listId,
      contact_id: c.id,
      contact_type: "stake",
    }));
    for (let i = 0; i < members.length; i += 500) {
      await supabase.from("list_members").insert(members.slice(i, i + 500));
    }
  }
}
