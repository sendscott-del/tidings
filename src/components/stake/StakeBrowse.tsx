import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

interface Contact {
  id: string
  first_name: string
  last_name: string
  phone: string
  email: string
  unit_name: string
  age_group: string
  opted_out: boolean
}

export default function StakeBrowse() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [wardFilter, setWardFilter] = useState('')
  const [wards, setWards] = useState<string[]>([])
  const [selected, setSelected] = useState<Contact | null>(null)

  useEffect(() => {
    loadContacts()
  }, [])

  async function loadContacts() {
    setLoading(true)
    const { data } = await supabase
      .from('contacts')
      .select('id, first_name, last_name, phone, email, unit_name, age_group, opted_out')
      .order('last_name')
    setContacts(data || [])
    const uniqueWards = [...new Set((data || []).map((c) => c.unit_name).filter(Boolean))]
    setWards(uniqueWards.sort())
    setLoading(false)
  }

  const filtered = contacts.filter((c) => {
    const matchesSearch =
      !search ||
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone || '').includes(search) ||
      (c.email || '').toLowerCase().includes(search.toLowerCase())
    const matchesWard = !wardFilter || c.unit_name === wardFilter
    return matchesSearch && matchesWard
  })

  if (loading) {
    return <div className="text-slate-400 py-8 text-center">Loading contacts...</div>
  }

  if (contacts.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
        <p className="text-slate-500">No contacts yet. Use the Import tab to upload an LCR CSV export.</p>
      </div>
    )
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Search by name, phone, or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
        />
        <select
          value={wardFilter}
          onChange={(e) => setWardFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
        >
          <option value="">All Wards</option>
          {wards.map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
      </div>

      <p className="text-sm text-slate-500 mb-3">
        Showing {filtered.length} of {contacts.length} contacts
      </p>

      {/* Contact Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 hidden sm:table-cell">Phone</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Ward</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Age</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-slate-900 font-medium">
                    {c.first_name} {c.last_name}
                  </td>
                  <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">{c.phone}</td>
                  <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{c.unit_name}</td>
                  <td className="px-4 py-3 text-slate-600 hidden md:table-cell">{c.age_group}</td>
                  <td className="px-4 py-3 text-center">
                    {c.opted_out ? (
                      <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                        Opted Out
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                        Active
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 100 && (
          <p className="text-center text-sm text-slate-500 py-3 border-t border-slate-100">
            Showing first 100 of {filtered.length} results
          </p>
        )}
      </div>

      {/* Contact Detail Slide-over */}
      {selected && (
        <ContactDetail contact={selected} onClose={() => setSelected(null)} onUpdate={loadContacts} />
      )}
    </div>
  )
}

function ContactDetail({
  contact,
  onClose,
  onUpdate,
}: {
  contact: Contact
  onClose: () => void
  onUpdate: () => void
}) {
  const [toggling, setToggling] = useState(false)

  async function toggleOptOut() {
    setToggling(true)
    await supabase
      .from('contacts')
      .update({
        opted_out: !contact.opted_out,
        opted_out_at: !contact.opted_out ? new Date().toISOString() : null,
      })
      .eq('id', contact.id)
    setToggling(false)
    onUpdate()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-sm shadow-xl p-6 overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          {contact.first_name} {contact.last_name}
        </h2>

        <div className="space-y-3 text-sm">
          <DetailRow label="Phone" value={contact.phone || '—'} />
          <DetailRow label="Email" value={contact.email || '—'} />
          <DetailRow label="Ward" value={contact.unit_name || '—'} />
          <DetailRow label="Age Group" value={contact.age_group || '—'} />
          <DetailRow
            label="Status"
            value={contact.opted_out ? 'Opted Out' : 'Active'}
          />
        </div>

        <div className="mt-6">
          <button
            onClick={toggleOptOut}
            disabled={toggling}
            className={`w-full py-2 text-sm font-medium rounded-lg transition-colors ${
              contact.opted_out
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            } disabled:opacity-50`}
          >
            {contact.opted_out ? 'Re-subscribe Contact' : 'Mark as Opted Out'}
          </button>
        </div>
      </div>
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-slate-100">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-900 font-medium">{value}</span>
    </div>
  )
}
