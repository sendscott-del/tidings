# Tidings — User Guide

Tidings is a two-way SMS communications app for an LDS stake. It sends bulk text messages to stake members (imported from LCR) and community contacts near each meetinghouse, and captures replies in a shared inbox.

---

## First-time setup

### 1. Create your admin account
Ask an existing admin to create a user account for you in **Admin → Users**. You'll receive email + password credentials.

### 2. Log in
Go to the Tidings site and sign in with the email and password your admin provided.

---

## Stake Directory

### Importing from LCR
1. In LCR (`lcr.churchofjesuschrist.org`), export all members to CSV.
2. In Tidings, go to **Stake Directory → Import**.
3. Drag the CSV onto the upload area (or click "Choose File").
4. Review the preview: how many contacts will be added, updated, and removed.
5. Click **Confirm Import**.

Tidings does a **full sync**: any phone number in the CSV is added or updated, and any number not in the CSV is removed. Re-import whenever your stake roster changes.

**What happens automatically:**
- Contacts are deduplicated by phone number.
- Phone numbers are normalized (e.g., `(312) 555-1234` → `+13125551234`).
- Auto-lists are rebuilt from the new data: one per ward, plus Relief Society, Elders Quorum, Young Women, Aaronic Priesthood, Primary, Melchizedek Priesthood, and Households with Children.
- Rows without a phone number are skipped (not an error — you'll see them under "View skipped rows").

### Browsing contacts
**Stake Directory → Browse** shows the full directory. Search by name, phone, or email. Filter by ward. Click any contact to see their details, message history, and opt-out status.

You can manually toggle a contact's opt-out status from their detail panel.

---

## Community Database

Community contacts are people near your meetinghouses who've opted in to receive invitations for community events. They are kept separate from the stake directory.

### Buildings
**Community → Buildings**: add each meetinghouse (name + address). Every community contact belongs to one building.

### Contacts
**Community → Contacts**: add, edit, or delete community contacts manually, or import a CSV per building.

### Importing a community CSV
1. Pick a building from the dropdown at the top of the Contacts tab.
2. Click **Import CSV** and drop in a file with `First Name`, `Last Name`, `Phone`, `Notes` (optional). Phone is required.
3. Review the preview (added / updated / removed) and click **Confirm Import**.

Like the stake import, this is a **full sync** scoped to the selected building: any contact whose phone isn't in the new CSV is removed from that building.

---

## Lists

Lists are how you target a group of contacts in a single message.

- **Auto-lists** (labeled "(auto)") are rebuilt every time you import the LCR CSV — you can't edit them directly.
- **Custom lists** can be created manually from either database. Useful for things like "Stake Youth Council" or "Hyde Park Community Event Attendees."

### Ward visibility

Each list has a **ward scope**. Lists scoped to a ward (shown with a green ward tag) are only visible to senders assigned to that ward. Lists with no ward scope are stake-wide and visible to everyone.

- **Ward auto-lists** ("Hyde Park 1st Ward", "Westchester 2nd Ward (Spanish)", etc.) are auto-scoped to their ward.
- **Org auto-lists** (Relief Society, Elders Quorum, Young Women, Aaronic Priesthood, Primary, Melchizedek Priesthood, Households with Children) are stake-wide.
- **Custom lists**: when an admin or "Stake" pool user creates a list, they pick the visibility (stake-wide or scoped to a specific ward). When a ward sender creates a list, it is automatically scoped to their ward.

Admins and users in the "Stake" pool see every list regardless of scope.

### Creating a custom list
1. **Lists → New List**.
2. Name the list, optionally describe it, choose stake or community.
3. After creating, the list opens — click **+ Add Members** to pick contacts from the chosen database. Search by name, phone, or ward.

### Editing or deleting a custom list
- Open any custom list and click the pencil icon to rename or change its description.
- Click the trash icon on the list card (or in the slide-over) to delete. Members are not deleted, just removed from the list.

Auto-lists cannot be edited or deleted — re-import the CSV if you need them refreshed.

---

## Compose & Send

The Compose page walks you through four steps:

1. **Choose database** — Stake or Community.
2. **Choose recipients** — Pick one or more lists. Tidings shows the **unique** recipient count (if someone's in two lists, they only get the message once).
3. **Write message** — Character counter warns at 160/320/480 characters (each 160 = one SMS segment and costs more). You can also attach up to 3 images to send as MMS — see "Sending images (MMS)" below.
4. **Confirm & Send** — Review the summary, estimated cost, and recipient count before sending.

### LLM-assisted shortening

When your message is 2 or more SMS segments long, Compose shows a **"✨ Suggest shorter"** button with the dollar savings you'd capture by shortening. Click it to have Claude Haiku 4.5 rewrite a tighter version. You see the original and suggestion side-by-side and explicitly choose **"Use shortened version"** or **"Keep original"** — nothing is auto-applied.

The model is told to preserve names, dates, times, locations, links, and tone, and to omit any sign-off (your signature is appended separately). It will not match your voice perfectly, so important communications should still be reviewed before sending.

**Setup:** the feature requires an **`ANTHROPIC_API_KEY`** in Supabase Edge Function secrets. Set it in the Supabase dashboard under **Edge Functions → Secrets**, otherwise the button surfaces a clear "feature not configured" error.

**Cost note:** a single shortening call is fractions of a cent. On a 100-recipient ward broadcast, shaving one segment saves about $0.79; on a stake-wide blast, about $25. The LLM cost is dwarfed by the SMS savings at any non-trivial broadcast size.

### Sending images (MMS)

On step 3, click **📎 Add image** to attach up to **3 images** (JPG, PNG, GIF, or WebP, max 5 MB each). When at least one image is attached:

- The send becomes an **MMS** instead of an SMS. Twilio bills MMS at a flat **~$0.02 per recipient** regardless of caption length, so the cost preview switches from "X segments × Y¢" to a single per-recipient flat rate.
- The 160-character SMS counter is replaced with a free-form character count, since MMS doesn't have segment math.
- The "✨ Suggest shorter" prompt is hidden — there's no segment savings to chase.
- The **caption is optional**. You can send an image with no text at all (e.g., just a flyer).
- Images upload to a private Tidings storage bucket as soon as you pick them. Click the **×** on a thumbnail to remove an upload before sending.

**Twilio number requirement:** the sending number must be MMS-enabled. Most US 10DLC and toll-free numbers can send MMS by default, but if delivery starts failing with code `21620` ("Invalid mediaUrl") or `30007` ("Carrier filtering"), check the number's Messaging capabilities in the Twilio console.

**Carrier behavior:** receiving carriers may compress or transcode large images, and animated GIFs may be flattened to a single frame on some carriers. For event flyers we recommend ≤1 MB JPG/PNG.

### Ward budgets

Every ward has a quarterly SMS budget in dollars. The budget shows up at the top of Compose as a pill: **"Hyde Park 1st Ward · $14.20 of $25.00 left this quarter — resets Jul 1, 2026"**.

- **Yellow** at 80% used.
- **Red** at 95% used.
- **Hard block** at 100%: the Send button disables and the user can't send anything else from that ward until the next calendar quarter (Jan 1 / Apr 1 / Jul 1 / Oct 1).
- A user must be assigned to a ward to send. Stake-level senders (Stake Presidency, etc.) use the special **"Stake"** pool.

**Setting and adjusting budgets:** **Admin → Budgets**. You'll see every ward with editable dollar cap, current quarter usage (with %), remaining, and the next reset date. Type a new dollar amount and click Save. Initial caps are seeded at $25/quarter for every ward — review and adjust to match what you actually want to spend.

**Assigning users to wards:** **Admin → Users → Edit**. The Ward dropdown is populated from the wards in your stake (taken from LCR import) plus "Stake". Users without a ward will see a clear "No ward assigned" message in Compose and won't be able to send.

**What counts toward the budget:** every successful Twilio attempt (sent + failed) is counted at $0.0079 per segment per recipient for SMS, or **$0.02 per recipient flat** for MMS (any send that has an image attached). A 2-segment SMS broadcast to 100 ward members costs ~$1.58; the same MMS broadcast costs ~$2.00. Twilio bills attempts even on some failures, so failed deliveries are counted to keep the budget honest.

**What about scheduling?** The budget check happens at submit time. If the budget shifts after a message is queued, the queued message currently goes through. (Worth knowing: scheduled sends aren't delivered yet by a worker — that's a separate piece of work.)

### Scheduling
On step 3, check "Schedule for later" and pick a date/time to send in the future. The message is queued in the database and dispatched by a background worker that runs every minute.

**No setup needed.** A `pg_cron` job runs every minute calling the `dispatch-scheduled-messages` edge function automatically. Verify by scheduling a test message a couple minutes out and watching it move from `queued` → `sent` in Message History.

The worker re-checks the ward budget at fire time (so a message scheduled before a budget hit won't sneak through), refreshes the recipient list (so anyone who opted out between scheduling and firing is skipped), and uses an atomic lock so the same message can't be dispatched twice.

**Why the dispatch endpoint is open (no auth):** the edge function is callable without authentication. This is intentional and safe — it only acts on messages already queued by authenticated users, uses an atomic UPDATE WHERE status='queued' lock to prevent double-dispatch, and accepts no input that changes its behavior. The worst an external caller could do is dispatch your already-queued messages a few seconds early — to the recipients you already chose.

### Signatures
Every message you send can have an automatic signature appended (e.g., `— Sent by the Bishopric`). The signature is set per user by an admin in **Admin → Users → Edit**. When you compose, the active signature is shown in a callout above the preview, the iMessage-style bubble shows what will actually be sent, and the character counter includes the signature so you can see the segment count for the full message. If a user has no signature configured, nothing extra is appended.

### What happens when you send
- Opted-out contacts are **automatically skipped** — you don't need to filter them out.
- Messages go out at approximately 3 per second (Twilio toll-free rate limit).
- Each recipient gets its own delivery log (see **Message History**).
- If your Twilio account is on the free trial, Twilio prepends "Sent from your Twilio trial account" to every outbound message. This is a Twilio behavior and **cannot be removed in the app** — it goes away as soon as the Twilio account is upgraded out of trial mode in the Twilio console.

---

## Inbox

When someone replies to a message or texts your number, it shows up in **Inbox**. A **red badge** with the unread count appears next to the Inbox nav item (sidebar on desktop, bottom nav on mobile). The badge polls every 30 seconds and refreshes when you focus the tab.

- Unread messages have a badge.
- **STOP** (or STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT) automatically marks that contact as opted out.
- **START** or **UNSTOP** re-subscribes them.
- Click any message to mark it as read.
- Use the search box, date range, or "Unread only" toggle to narrow the list.
- Click any message and then **Reply** to send a 1:1 response — Compose opens pre-filled with the recipient's phone, skipping list selection.
- **Inbound images (MMS):** if a member texts back a photo, the list shows a 📷 next to that row, and the detail panel renders thumbnails — tap one to open full-size. Images are mirrored from Twilio into Tidings' own storage so they keep working even after Twilio's media URLs would otherwise expire.

---

## Message History

All sent messages, with delivery stats per message. Filter by date range or database. Click a message to see per-recipient delivery status.

If any recipients failed delivery, click **Export Failed CSV** in the detail panel to download a CSV of phone numbers, status, and Twilio error code — useful for triaging which numbers to clean up or retry by hand.

---

## Admin (admin role only)

### Users
Create, edit, or delete Tidings user accounts. Roles:
- **Admin** — full access.
- **Sender** — can compose, send, view inbox and history. No user management.
- **Viewer** — read-only.

Each user has two permission flags: `can_text_stake` and `can_text_community`, and an optional **signature** that is appended to every message they send. The Edit form has quick-pick buttons for common signatures (Stake Presidency, Bishopric, EQ Presidency, RS Presidency, YM/YW Presidency, Primary Presidency); you can also type a custom one or leave it blank for no signature.

### Budgets
See **Ward budgets** under Compose & Send for full detail. In short: each ward has a dollar cap per calendar quarter; usage resets automatically; senders are hard-blocked at 100%.

Click the triangle next to a ward name in **Admin → Budgets** to expand a small bar chart of the last 4 quarters' usage in dollars — useful for spotting wards trending high before they hit the cap.

### Settings
Twilio credentials (Account SID, Auth Token, From Number) are stored as Supabase Edge Function secrets — not in the app database. Set them in the Supabase dashboard under **Edge Functions → Secrets**.

---

## Troubleshooting

**"I imported the CSV but I can't find myself or several members in the browse view."**
This was a bug fixed in version 0.2.0 — queries were capped at 1000 rows. Update to the latest deploy and re-import the CSV. The full directory will load.

**"My message didn't go out to everyone on the list."**
Same 1000-row bug — fixed in 0.2.0. Re-send after updating.

**"A message failed to send to a specific person."**
Open **Message History**, click the message, look at the per-recipient delivery. Common failures:
- `21610` — recipient has opted out at the carrier level.
- `21408` — recipient's number is unreachable/invalid.
- `30007` — carrier filtered the message (more common before A2P verification is approved).

**"I sent a test message but my phone never got it."**
If A2P verification is still pending, Twilio only delivers to numbers you've **verified as Caller IDs** in the Twilio console. Verify your own number, then re-test.
