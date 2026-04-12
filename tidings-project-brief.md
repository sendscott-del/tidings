# Tidings — Claude Code Project Brief

## Overview

Build a web application called **Tidings** for managing and sending two-way SMS communications on behalf of a Church of Jesus Christ of Latter-day Saints stake. The app serves two distinct contact databases: (1) a **Stake database** of church members imported from LCR (the church's member system), and (2) a **Community database** of residents near each building who receive invitations to community events. Both databases feed into a shared messaging interface backed by Twilio SMS.

The name "Tidings" references Luke 2:10 — *"glad tidings of great joy"* — and Mosiah 3:3.

---

## Tech Stack

Use the same stack as the other apps in this project family (Magnify, Sparkle Pro):

- **Frontend**: React (Vite), TypeScript, Tailwind CSS
- **Backend/DB**: Supabase (PostgreSQL + Auth + Row Level Security + Edge Functions)
- **Hosting**: Vercel
- **SMS**: Twilio (toll-free number, A2P campaign)
- **Repo**: GitHub → Vercel auto-deploy

Create this as its **own Supabase project** — do not share the project used by Magnify or other apps.

---

## Database Schema

### `contacts` table — Stake members (from LCR CSV)
```sql
id              uuid primary key default gen_random_uuid()
first_name      text not null
last_name       text not null
phone           text  -- E.164 format e.g. +13125551234
email           text
household_id    text  -- from LCR, used to group households
unit_name       text  -- Ward name from LCR
membership_type text  -- e.g. "Member", "Record only"
sex             text
age_group       text  -- "Adult", "Youth", "Child" parsed from LCR data
has_children    boolean default false
melchizedek     boolean default false  -- holds Melchizedek priesthood
relief_society  boolean default false
elders_quorum   boolean default false
young_women     boolean default false
aaronic         boolean default false
primary_member  boolean default false
opted_out       boolean default false  -- set true when STOP is received
opted_out_at    timestamptz
source_file     text  -- filename of the CSV that created/last updated this record
created_at      timestamptz default now()
updated_at      timestamptz default now()
```

### `community_contacts` table — Community event recipients
```sql
id           uuid primary key default gen_random_uuid()
first_name   text
last_name    text
phone        text not null  -- E.164 format
building_id  uuid references buildings(id)
notes        text
opted_out    boolean default false
opted_out_at timestamptz
created_at   timestamptz default now()
updated_at   timestamptz default now()
```

### `buildings` table — Stake meetinghouses with community lists
```sql
id         uuid primary key default gen_random_uuid()
name       text not null  -- e.g. "Hyde Park Building"
address    text
city       text
state      text
zip        text
created_at timestamptz default now()
```

### `lists` table — Named groups (auto-created from LCR import + manually created)
```sql
id          uuid primary key default gen_random_uuid()
name        text not null
description text
database    text not null check (database in ('stake', 'community'))
building_id uuid references buildings(id)  -- null = stake-wide list
is_auto     boolean default false  -- auto-managed by import vs. manual
created_at  timestamptz default now()
```

### `list_members` table — Contact ↔ list membership
```sql
id           uuid primary key default gen_random_uuid()
list_id      uuid references lists(id) on delete cascade
contact_id   uuid  -- references either contacts.id or community_contacts.id
contact_type text check (contact_type in ('stake', 'community'))
```

### `messages` table — All outbound messages
```sql
id              uuid primary key default gen_random_uuid()
body            text not null
sent_by         uuid references users(id)
database        text check (database in ('stake', 'community'))
list_ids        uuid[]  -- lists targeted
recipient_count integer
status          text default 'queued'  -- queued, sending, sent, failed
scheduled_at    timestamptz  -- null = send immediately
sent_at         timestamptz
created_at      timestamptz default now()
```

### `message_logs` table — Per-recipient delivery record
```sql
id           uuid primary key default gen_random_uuid()
message_id   uuid references messages(id)
contact_id   uuid
contact_type text
phone        text
twilio_sid   text  -- Twilio message SID for status tracking
status       text  -- queued, sent, delivered, failed, undelivered
error_code   text
sent_at      timestamptz
updated_at   timestamptz default now()
```

### `inbound_messages` table — Replies from recipients
```sql
id           uuid primary key default gen_random_uuid()
from_phone   text not null
body         text
twilio_sid   text
contact_id   uuid  -- resolved from phone lookup
contact_type text
is_stop      boolean default false  -- auto-detected STOP/UNSTOP
received_at  timestamptz default now()
read_by      uuid references users(id)
read_at      timestamptz
```

### `users` table — App users (managed separately from contacts)
```sql
id          uuid primary key references auth.users(id)
email       text
full_name   text
role        text default 'viewer'  -- admin, sender, viewer
permissions jsonb default '{}'  -- e.g. {"can_text_community": true, "buildings": ["uuid1"]}
created_at  timestamptz default now()
```

---

## Application Pages & Features

### 1. Auth
- Email/password login via Supabase Auth
- No self-registration — admin creates all user accounts
- Redirect to dashboard after login

---

### 2. Dashboard
Default landing page after login. Show:
- Recent messages sent (last 5)
- Unread replies count (badge)
- Quick-compose button
- Opted-out count (stake + community)

---

### 3. Stake Directory

**Import tab:**
- Drag-and-drop or file picker for LCR CSV export
- Parse the CSV on the client using `papaparse`
- Map LCR columns to the `contacts` schema (see Column Mapping section below)
- Show a preview: "X new, Y updated, Z to be deleted"
- On confirm: upsert matching records by phone number; **hard delete any record not present in the new file** (full sync, not soft delete)
- Auto-create/update the following lists from the parsed data:
  - One list per ward (unit_name)
  - "Households with Children"
  - "Relief Society"
  - "Elders Quorum"
  - "Young Women"
  - "Aaronic Priesthood"
  - "Primary"
  - "Melchizedek Priesthood"
- Show a results toast: "Import complete: 12 added, 3 updated, 2 removed"

**LCR CSV Column Mapping:**
The LCR export typically uses these column names (handle case-insensitively and trim whitespace):
- `Preferred Name` or `Name` → split into first/last
- `Phone` or `Individual Phone` or `Mobile` → phone
- `Email` or `Individual Email` → email
- `Household ID` → household_id
- `Unit Name` → unit_name
- `Sex` → sex
- `Age` → parse into age_group: <12 = Child, 12-17 = Youth, 18+ = Adult
- Look for column headers containing "children" to set has_children

**Browse tab:**
- Searchable, sortable table of all stake contacts
- Filter by ward, list, opted-out status
- Click a contact to see their profile: name, phone, email, lists they belong to, message history, opt-out status
- Manually toggle opt-out status
- Cannot edit other fields (source of truth is LCR)

---

### 4. Community Database

**Buildings tab:**
- CRUD for buildings (name, address)
- Each building shows its community contact count

**Contacts tab:**
- Searchable table filtered by building
- Manual add/edit/delete of community contacts
- CSV import per building (simpler format: first name, last name, phone)
- Import also does full sync (add new, delete removed, update existing matched by phone)

---

### 5. Lists

- View all lists (stake and community)
- Auto-generated lists are labeled "(auto)" and cannot be manually edited
- Create custom lists manually by selecting contacts from either database
- Each list shows: name, contact count, last messaged date
- Clicking a list shows its members

---

### 6. Compose & Send

This is the core feature. Design it carefully.

**Step 1 — Choose database**
Toggle: Stake | Community

**Step 2 — Choose recipients**
Multi-select from available lists. Show running total of unique recipients (deduplicated by phone). If a phone appears in multiple selected lists, only send once.

**Step 3 — Write message**
- Textarea for message body
- Character counter (160 = 1 SMS, warn at 320+)
- Preview: shows how it will appear on a phone
- Option to schedule: date/time picker for future sends (store in `scheduled_at`)

**Step 4 — Confirm & Send**
- Summary: "Sending to 312 unique recipients across 3 lists"
- Estimated cost display: `recipients × $0.0079`
- Confirm button triggers send

**Sending logic (Edge Function):**
- Create a `messages` record with status `sending`
- For each unique phone in selected lists:
  - Skip if contact is opted out
  - Call Twilio API to send SMS
  - Create a `message_logs` record with Twilio SID
- Update `messages.status` to `sent` when all logs are created
- Handle failures gracefully: log the error, continue with remaining recipients

---

### 7. Inbox (Two-Way Replies)

- List of all inbound messages, newest first
- Each row shows: sender name (looked up from phone), phone, message body, received time, read/unread badge
- STOP/UNSTOP handling:
  - If body is exactly "STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", or "QUIT" (case-insensitive): mark contact as opted_out = true
  - If body is "START" or "UNSTOP": mark opted_out = false
  - Twilio also handles opt-outs at the carrier level, but the app must mirror this in the database
- Click a message to mark it as read
- Reply button: opens compose pre-filled to that person's phone number (1:1 reply, not a broadcast)

**Twilio webhook setup:**
- Create a Supabase Edge Function at `/functions/v1/twilio-inbound`
- Validate Twilio signature
- Parse incoming params: `From`, `Body`, `MessageSid`
- Insert into `inbound_messages`
- Return TwiML: `<Response/>` (empty response, no auto-reply)

---

### 8. Message History

- All sent messages with status, recipient count, delivery success rate
- Click a message to see per-recipient delivery status
- Filter by date range, database (stake/community), sender

---

### 9. Admin

Accessible only to users with role = `admin`.

**Users sub-page:**
- List all users with their role and permissions
- Create new user: email, name, role selection
- Edit existing user: change role, toggle permissions
- Delete user (with confirmation)
- Roles:
  - `admin` — full access to everything
  - `sender` — can compose and send messages, view history, view inbox; cannot manage users or buildings
  - `viewer` — read-only access to history and inbox

**Permission flags (stored in `permissions` jsonb):**
- `can_text_community` — allow sending to community lists
- `can_text_stake` — allow sending to stake lists
- `buildings` — array of building UUIDs they can text for (empty = all buildings)

**Settings sub-page:**
- Twilio credentials: Account SID, Auth Token, From number (stored in Supabase vault/secrets, not in the database table)
- Stake name (displayed in the app header)
- App branding: upload a logo

---

## Environment Variables

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # Edge functions only
TWILIO_ACCOUNT_SID=          # Edge functions only
TWILIO_AUTH_TOKEN=           # Edge functions only
TWILIO_FROM_NUMBER=          # E.164 format
```

Store Twilio credentials in Supabase secrets (not .env) for production. Use `supabase secrets set` for Edge Function environment.

---

## Supabase Row Level Security Policies

Enable RLS on all tables. Key policies:

- `contacts`: authenticated users can read; only service role can insert/update/delete (import runs via Edge Function with service role)
- `community_contacts`: authenticated users with `can_text_community` permission can read; admin can write
- `messages` / `message_logs`: authenticated users can read; sender role can insert
- `inbound_messages`: authenticated users can read; service role inserts (webhook)
- `users`: admin only for write; users can read their own row
- `lists` / `list_members`: authenticated users can read; admin/sender can write

---

## Twilio Setup Notes

- Use a **toll-free number** (simpler A2P registration than 10DLC)
- Register a toll-free A2P campaign via the Twilio console (required for bulk messaging)
- Set the inbound webhook URL to: `https://[your-supabase-project].supabase.co/functions/v1/twilio-inbound`
- Twilio handles carrier-level STOP compliance automatically on toll-free numbers, but the app must also track opt-outs in the database
- Send rate: ~1 message/second on toll-free; implement a queue/delay loop for large sends to stay within rate limits

---

## UI Design Notes

- Clean, simple interface — primary users are church leaders, not tech-savvy
- Mobile-friendly (leaders may use this from a phone)
- Color palette suggestion: deep navy + warm gold (ties to the "glad tidings" theme)
- App name "Tidings" displayed in header with a simple icon (bell or star)
- Status badges: green = delivered, yellow = sent/pending, red = failed, gray = opted out
- Always show opt-out count prominently before a send — make it easy to see how many people won't receive a message

---

## Build Order

Build in this sequence so each phase is usable:

1. **Supabase project setup** — schema, RLS, auth
2. **Auth UI** — login page, protected routes
3. **Stake import** — CSV upload, parsing, upsert/delete sync, auto-list creation
4. **Browse contacts & lists** — read-only views
5. **Twilio integration** — Edge Function for outbound send
6. **Compose & Send** — full send flow with Twilio
7. **Inbound webhook** — receive replies, STOP handling
8. **Inbox UI** — view and manage replies
9. **Community database** — buildings, community contacts, community import
10. **Message history** — delivery tracking
11. **Admin panel** — user management, permissions, settings

---

## Notes on LCR CSV Export

The admin will export this file from: `lcr.churchofjesuschrist.org → Members → Export to CSV`

The exact column names in the LCR export change occasionally. Write the import parser defensively:
- Match column names case-insensitively
- Trim all whitespace from values
- Skip rows with no phone number (they can't be texted anyway)
- Normalize all phone numbers to E.164 on import using a simple regex: strip all non-digits, prepend +1 if 10 digits
- Log any rows that couldn't be parsed and show them in the import results UI

---

## Out of Scope (for now)

- Native mobile app (web only)
- Email sending (the church already has that)
- MMS / media messages
- Message templates library (nice to have later)
- Analytics / reporting beyond basic delivery stats
