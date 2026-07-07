import { Link } from 'react-router-dom'

/**
 * Tidings user guide. Top-level prose explanation of what Tidings does,
 * how the inbox/compose/lists flow works, and where to configure things.
 * Updated alongside meaningful product changes; for granular what-changed,
 * see /release-notes.
 */
export default function Guide() {
  return (
    <div className="space-y-8 max-w-3xl">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">User guide</h1>
        <p className="text-sm text-slate-500 mt-1">
          How Tidings works, who can do what, and where to start.
        </p>
      </header>

      <Section title="What is Tidings?">
        <p>
          Tidings is the stake's two-way SMS app, powered by Twilio. Stake and
          ward leaders can send to lists of members, members can text back, and
          inbound replies land in a shared inbox so a conversation never gets
          lost.
        </p>
        <p>
          The name comes from <em>D&amp;C 31:3</em> — "Your tongue shall be
          loosed, and you shall declare glad tidings of great joy."
        </p>
      </Section>

      <Section title="Roles">
        <ul className="space-y-2">
          <li>
            <strong>Member</strong> — receives messages, can reply. No app
            access required.
          </li>
          <li>
            <strong>Sender</strong> — can compose to lists, see inbox, view
            history.
          </li>
          <li>
            <strong>Admin</strong> — everything a sender can do, plus budget
            controls and Twilio settings under{' '}
            <Link to="/admin" className="text-tidings-primary font-medium hover:underline">Settings</Link>.
            User access (invites, roles, removals) is managed centrally in the{' '}
            <a href="https://gather.gatheredin.app/gather" target="_blank" rel="noopener noreferrer" className="text-tidings-primary font-medium hover:underline">Gather hub</a>.
          </li>
        </ul>
        <p className="mt-3 text-sm text-slate-500">
          For privacy, the member contact list (names and phone numbers) is
          visible only to Senders and Admins — the leaders who actually send
          messages.
        </p>
      </Section>

      <Section title="Where to start">
        <ol className="list-decimal pl-5 space-y-1">
          <li>
            <strong>Stake</strong> / <strong>Community</strong> — see who's in
            your roster and pick recipients.
          </li>
          <li>
            <strong>Lists</strong> — save common recipient groups so you don't
            rebuild them every time.
          </li>
          <li>
            <strong>Compose</strong> — write a message; pick a list or
            ad-hoc recipients; send. Budgets and per-send confirmations keep
            you from accidentally blasting everyone.
          </li>
          <li>
            <strong>Inbox</strong> — replies show here as threads. Unread
            count surfaces in the sidebar.
          </li>
          <li>
            <strong>History</strong> — outbound log for audit and resends.
          </li>
        </ol>
      </Section>

      <Section title="Importing the directory (CSV or PDF)">
        <p>
          The <strong>Stake → Import</strong> tab accepts either a CSV or the
          12-column landscape PDF that LCR exports. The expected columns are
          PreferredName, Unit, BirthDate, Callings, ClassAssignment,
          HasChildren, IndividualPhone, IsEndowed, IsReturnedMissionary,
          IsSingle, Gender, and Priesthood. Print the LCR custom report in{' '}
          <strong>landscape</strong> orientation so all 12 columns survive.
        </p>
        <p>
          When you drop a file, Tidings shows a preview with three counts —
          how many contacts will be <strong>added</strong>,{' '}
          <strong>updated</strong>, and <strong>removed</strong>. Anyone
          missing from the import is <strong>hard-deleted</strong>, along with
          their list memberships, so the directory always mirrors the report.
          Birth year is intentionally discarded — only month and day are
          stored.
        </p>
        <p>
          On confirm, Tidings rebuilds the auto-list catalog: existing
          flat-named lists (Aaronic Priesthood, Relief Society, etc.) plus
          the new prefixed sets — <code>Stake — Bishoprics</code>,{' '}
          <code>Stake — Men</code>,{' '}
          <code>Hyde Park 1st Ward — Endowed Members</code>,{' '}
          <code>Moraine Valley Ward — Birthdays This Month</code>, and so on.
          Birthday lists also rotate on the 1st of each month automatically.
        </p>
      </Section>

      <Section title="Community directory (buildings)">
        <p>
          The <strong>Community</strong> area groups contacts by{' '}
          <strong>building</strong> — useful for apartment complexes and other
          non-ward groups. Add a building, then tap the{' '}
          <strong>pencil</strong> on any building card to rename it or correct
          its address, or the trash icon to delete it.
        </p>
        <p>
          Under <strong>Contacts</strong>, pick a building and use{' '}
          <strong>Import CSV</strong> (columns: First Name, Last Name, Phone,
          and optional Notes — phone is required). After the preview you choose
          how to apply it:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Append</strong> (default) — adds new contacts and updates
            any whose phone already exists, and leaves everyone else in the
            building alone. Nothing is deleted.
          </li>
          <li>
            <strong>Replace</strong> — a full sync. In addition to adding and
            updating, it <strong>removes</strong> anyone in the building whose
            phone isn't in the CSV. The preview shows exactly how many will be
            removed before you confirm.
          </li>
        </ul>
      </Section>

      <Section title="Adding members to a list">
        <p>
          Open a list and tap <strong>Add Members</strong>. You can pick people
          one at a time with the checkboxes, or add a whole directory at once:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Everyone</strong> — selects every contact in the directory
            (all not-yet-added members).
          </li>
          <li>
            A <strong>group chip</strong> — selects a whole{' '}
            <strong>ward</strong> (church lists) or a whole{' '}
            <strong>building</strong> (community lists). Tap it again to
            deselect that group.
          </li>
        </ul>
        <p>
          Selected people are added when you tap <strong>Add</strong>. Anyone
          already on the list isn't shown, so you never add duplicates.
        </p>
      </Section>

      <Section title="List visibility">
        <p>
          When you create a custom list — or later, by editing it — choose who
          can see it:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Stake-wide</strong> — visible to all senders.
          </li>
          <li>
            <strong>A specific ward</strong> — visible to that ward's senders
            (and admins).
          </li>
          <li>
            <strong>Community</strong> — visible only to{' '}
            <strong>Community Events Leaders</strong> and admins, and drawn from
            the community directory. Stake and ward senders won't see it. Turn on
            the <strong>Community events → Leader</strong> checkbox for someone in
            the Gather hub to set them up as a community-only leader (they see and
            text only the community directory and community lists — no ward or
            stake access).
          </li>
        </ul>
      </Section>

      <Section title="Opting people out">
        <p>
          Anyone you text can reply <strong>STOP</strong> (or UNSUBSCRIBE,
          CANCEL, END, QUIT) to stop receiving messages, and{' '}
          <strong>START</strong> to opt back in. Tidings records this
          automatically and never texts an opted-out number again — even after
          a directory re-import.
        </p>
        <p>
          You can also do it by hand. Open a <strong>Stake</strong> contact and
          use <strong>Mark as Opted Out</strong> / <strong>Re-subscribe</strong>,
          or on <strong>Community → Contacts</strong> use the{' '}
          <strong>Opt out</strong> / <strong>Re-subscribe</strong> action on the
          row. Manual opt-outs are just as permanent as a texted STOP.
        </p>
      </Section>

      <Section title="Settings">
        <p>
          Settings (formerly "Admin") holds Users, Budgets (per ward, plus a
          Community Events budget for texts to the community directory), and the deeper
          settings tab. The Users tab is read-only — it shows who has access,
          while invites, roles, and removals happen in the Gather hub (the tab
          links there). Demo mode (a safe walkthrough that mocks all sends)
          is enabled from Settings — it is no longer a top-bar button.
        </p>
      </Section>

      <Section title="On a phone">
        <p>
          The mobile bottom bar shows five tabs:{' '}
          <strong>Dashboard · Compose · Inbox · History · More</strong>.
          Inbox shows an unread badge so you don't miss replies.
          The <strong>More</strong> tab opens a sheet with everything else —
          Stake / Community directories, Lists, Settings, your profile, the
          user guide, release notes, and the suggestion box. Sign out is at
          the bottom of that sheet.
        </p>
        <p className="mt-2">
          The <strong>Compose</strong> wizard walks through one step at a time
          on mobile (database → recipients → message → send) with a sticky
          progress bar at the top and a sticky Back/Next button at the bottom
          that shows the recipient count and estimated cost.
        </p>
      </Section>

      <Section title="Suggest an enhancement">
        <p>
          On <strong>desktop</strong>, look for the small{' '}
          <strong>amber lightbulb</strong> in the bottom-right corner of every
          screen. On <strong>mobile</strong>, open the <strong>More</strong>{' '}
          tab and tap <strong>Suggest an enhancement</strong>. Type what
          you&apos;d change or what felt clunky, and hit <strong>Send</strong>.
          Your name, email, and the page you were on are attached automatically
          — suggestions go straight to Scott and into a shared tracker so you
          can be told later when an idea was implemented.
        </p>
      </Section>

      <Section title="Language">
        <p>
          The EN / ES toggle in the top bar switches the interface and
          remembers your preference. Outbound message templates have their
          own language fields when composing — toggling EN/ES in the chrome
          does not change what your recipients receive.
        </p>
      </Section>

      <footer className="pt-4 border-t border-slate-200 text-sm text-slate-500">
        See <Link to="/release-notes" className="text-tidings-primary font-medium hover:underline">release notes</Link> for
        the version-by-version history.
      </footer>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 text-sm text-slate-700 leading-relaxed">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  )
}
