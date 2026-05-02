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
3. **Write message** — Character counter warns at 160/320/480 characters (each 160 = one SMS segment and costs more).
4. **Confirm & Send** — Review the summary, estimated cost, and recipient count before sending.

### Scheduling
On step 3, check "Schedule for later" and pick a date/time to send in the future.

### Signatures
Every message you send can have an automatic signature appended (e.g., `— Sent by the Bishopric`). The signature is set per user by an admin in **Admin → Users → Edit**. When you compose, the active signature is shown in a callout above the preview, the iMessage-style bubble shows what will actually be sent, and the character counter includes the signature so you can see the segment count for the full message. If a user has no signature configured, nothing extra is appended.

### What happens when you send
- Opted-out contacts are **automatically skipped** — you don't need to filter them out.
- Messages go out at approximately 3 per second (Twilio toll-free rate limit).
- Each recipient gets its own delivery log (see **Message History**).
- If your Twilio account is on the free trial, Twilio prepends "Sent from your Twilio trial account" to every outbound message. This is a Twilio behavior and **cannot be removed in the app** — it goes away as soon as the Twilio account is upgraded out of trial mode in the Twilio console.

---

## Inbox

When someone replies to a message or texts your number, it shows up in **Inbox**.

- Unread messages have a badge.
- **STOP** (or STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT) automatically marks that contact as opted out.
- **START** or **UNSTOP** re-subscribes them.
- Click any message to mark it as read.
- Use the search box, date range, or "Unread only" toggle to narrow the list.
- Click any message and then **Reply** to send a 1:1 response — Compose opens pre-filled with the recipient's phone, skipping list selection.

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
