import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Building {
  id: string
  name: string
  address: string
  city: string
  state: string
  zip: string
  contact_count: number
}

interface CommunityContact {
  id: string
  first_name: string
  last_name: string
  phone: string
  building_id: string
  notes: string
  opted_out: boolean
}

export default function Community() {
  const [tab, setTab] = useState<'buildings' | 'contacts'>('buildings')
  const [buildings, setBuildings] = useState<Building[]>([])
  const [contacts, setContacts] = useState<CommunityContact[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBuilding, setSelectedBuilding] = useState<string>('')
  const [showBuildingForm, setShowBuildingForm] = useState(false)
  const [showContactForm, setShowContactForm] = useState(false)
  const [editingContact, setEditingContact] = useState<CommunityContact | null>(null)
  const [form, setForm] = useState({ name: '', address: '', city: '', state: '', zip: '' })
  const [contactForm, setContactForm] = useState({ first_name: '', last_name: '', phone: '', notes: '', building_id: '' })

  useEffect(() => { loadBuildings() }, [])
  useEffect(() => { if (tab === 'contacts') loadContacts() }, [tab, selectedBuilding])

  async function loadBuildings() {
    setLoading(true)
    const { data } = await supabase.from('buildings').select('*').order('name')
    const { data: counts } = await supabase.from('community_contacts').select('building_id')
    const countMap: Record<string, number> = {}
    for (const r of counts || []) { if (r.building_id) countMap[r.building_id] = (countMap[r.building_id] || 0) + 1 }
    setBuildings((data || []).map((b) => ({ ...b, contact_count: countMap[b.id] || 0 })))
    setLoading(false)
  }

  async function loadContacts() {
    setLoading(true)
    let query = supabase.from('community_contacts').select('*').order('last_name')
    if (selectedBuilding) query = query.eq('building_id', selectedBuilding)
    const { data } = await query
    setContacts(data || [])
    setLoading(false)
  }

  async function saveBuilding() {
    await supabase.from('buildings').insert(form)
    setForm({ name: '', address: '', city: '', state: '', zip: '' })
    setShowBuildingForm(false)
    loadBuildings()
  }

  async function deleteBuilding(id: string) {
    await supabase.from('buildings').delete().eq('id', id)
    loadBuildings()
  }

  async function saveContact() {
    if (editingContact) {
      await supabase.from('community_contacts').update(contactForm).eq('id', editingContact.id)
    } else {
      await supabase.from('community_contacts').insert(contactForm)
    }
    setContactForm({ first_name: '', last_name: '', phone: '', notes: '', building_id: selectedBuilding || '' })
    setShowContactForm(false)
    setEditingContact(null)
    loadContacts()
  }

  async function deleteContact(id: string) {
    await supabase.from('list_members').delete().eq('contact_id', id).eq('contact_type', 'community')
    await supabase.from('community_contacts').delete().eq('id', id)
    loadContacts()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Community Database</h1>
        <div className="flex bg-slate-100 rounded-lg p-0.5">
          {(['buildings', 'contacts'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
                tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >{t}</button>
          ))}
        </div>
      </div>

      {tab === 'buildings' && (
        <div>
          <button onClick={() => setShowBuildingForm(true)}
            className="mb-4 px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700">
            Add Building
          </button>

          {showBuildingForm && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4 space-y-3">
              <input placeholder="Building name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
              <input placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
              <div className="grid grid-cols-3 gap-3">
                <input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                <input placeholder="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                <input placeholder="ZIP" value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
              </div>
              <div className="flex gap-2">
                <button onClick={saveBuilding} disabled={!form.name}
                  className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50">Save</button>
                <button onClick={() => setShowBuildingForm(false)}
                  className="px-4 py-2 text-slate-600 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
              </div>
            </div>
          )}

          {loading ? <p className="text-slate-400 text-center py-8">Loading...</p> : buildings.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <p className="text-slate-500">No buildings yet. Add one to get started.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {buildings.map((b) => (
                <div key={b.id} className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-slate-900 font-medium">{b.name}</p>
                    <p className="text-sm text-slate-500">{[b.address, b.city, b.state, b.zip].filter(Boolean).join(', ')}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-lg font-semibold text-slate-900">{b.contact_count}</span>
                      <p className="text-xs text-slate-500">contacts</p>
                    </div>
                    <button onClick={() => deleteBuilding(b.id)} className="text-slate-400 hover:text-red-500">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'contacts' && (
        <div>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <select value={selectedBuilding} onChange={(e) => setSelectedBuilding(e.target.value)}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
              <option value="">All Buildings</option>
              {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <button onClick={() => {
              setContactForm({ first_name: '', last_name: '', phone: '', notes: '', building_id: selectedBuilding || (buildings[0]?.id || '') })
              setEditingContact(null)
              setShowContactForm(true)
            }} className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700">
              Add Contact
            </button>
          </div>

          {showContactForm && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="First name" value={contactForm.first_name} onChange={(e) => setContactForm({ ...contactForm, first_name: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                <input placeholder="Last name" value={contactForm.last_name} onChange={(e) => setContactForm({ ...contactForm, last_name: e.target.value })}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
              </div>
              <input placeholder="Phone" value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
              <select value={contactForm.building_id} onChange={(e) => setContactForm({ ...contactForm, building_id: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                <option value="">Select building</option>
                {buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <input placeholder="Notes" value={contactForm.notes} onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
              <div className="flex gap-2">
                <button onClick={saveContact} disabled={!contactForm.phone}
                  className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50">
                  {editingContact ? 'Update' : 'Add'}
                </button>
                <button onClick={() => { setShowContactForm(false); setEditingContact(null) }}
                  className="px-4 py-2 text-slate-600 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
              </div>
            </div>
          )}

          {loading ? <p className="text-slate-400 text-center py-8">Loading...</p> : contacts.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <p className="text-slate-500">No community contacts yet.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 hidden sm:table-cell">Phone</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Notes</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((c) => (
                    <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-900 font-medium">{c.first_name} {c.last_name}</td>
                      <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">{c.phone}</td>
                      <td className="px-4 py-3 text-slate-500 hidden md:table-cell truncate max-w-[200px]">{c.notes}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => {
                          setEditingContact(c)
                          setContactForm({ first_name: c.first_name, last_name: c.last_name, phone: c.phone, notes: c.notes || '', building_id: c.building_id || '' })
                          setShowContactForm(true)
                        }} className="text-slate-400 hover:text-slate-600 mr-2">Edit</button>
                        <button onClick={() => deleteContact(c.id)} className="text-slate-400 hover:text-red-500">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
