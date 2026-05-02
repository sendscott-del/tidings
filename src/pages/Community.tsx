import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { parseCommunityCSV, type CommunityParseResult } from '../lib/community-csv'
import { useToast } from '../contexts/ToastContext'
import ConfirmDialog from '../components/ConfirmDialog'

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

type ImportStage = 'upload' | 'preview' | 'importing' | 'done'

export default function Community() {
  const { toast } = useToast()
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

  const [confirmDeleteBuilding, setConfirmDeleteBuilding] = useState<Building | null>(null)
  const [confirmDeleteContact, setConfirmDeleteContact] = useState<CommunityContact | null>(null)

  const [showImport, setShowImport] = useState(false)
  const [importStage, setImportStage] = useState<ImportStage>('upload')
  const [importDragOver, setImportDragOver] = useState(false)
  const [importFileName, setImportFileName] = useState('')
  const [importParse, setImportParse] = useState<CommunityParseResult | null>(null)
  const [importStats, setImportStats] = useState({ toAdd: 0, toUpdate: 0, toDelete: 0 })
  const [importResult, setImportResult] = useState<{ added: number; updated: number; removed: number } | null>(null)
  const [importError, setImportError] = useState('')

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
    const { error } = await supabase.from('buildings').insert(form)
    if (error) {
      toast(`Failed to save: ${error.message}`, 'error')
      return
    }
    toast('Building added', 'success')
    setForm({ name: '', address: '', city: '', state: '', zip: '' })
    setShowBuildingForm(false)
    loadBuildings()
  }

  async function deleteBuilding() {
    if (!confirmDeleteBuilding) return
    const id = confirmDeleteBuilding.id
    setConfirmDeleteBuilding(null)
    const { error } = await supabase.from('buildings').delete().eq('id', id)
    if (error) {
      toast(`Failed to delete: ${error.message}`, 'error')
      return
    }
    toast('Building deleted', 'success')
    loadBuildings()
  }

  async function saveContact() {
    if (editingContact) {
      const { error } = await supabase.from('community_contacts').update(contactForm).eq('id', editingContact.id)
      if (error) { toast(`Failed: ${error.message}`, 'error'); return }
      toast('Contact updated', 'success')
    } else {
      const { error } = await supabase.from('community_contacts').insert(contactForm)
      if (error) { toast(`Failed: ${error.message}`, 'error'); return }
      toast('Contact added', 'success')
    }
    setContactForm({ first_name: '', last_name: '', phone: '', notes: '', building_id: selectedBuilding || '' })
    setShowContactForm(false)
    setEditingContact(null)
    loadContacts()
  }

  async function deleteContact() {
    if (!confirmDeleteContact) return
    const id = confirmDeleteContact.id
    setConfirmDeleteContact(null)
    await supabase.from('list_members').delete().eq('contact_id', id).eq('contact_type', 'community')
    const { error } = await supabase.from('community_contacts').delete().eq('id', id)
    if (error) { toast(`Failed to delete: ${error.message}`, 'error'); return }
    toast('Contact deleted', 'success')
    loadContacts()
  }

  // ---- CSV import ----

  const startImport = () => {
    setShowImport(true)
    setImportStage('upload')
    setImportParse(null)
    setImportStats({ toAdd: 0, toUpdate: 0, toDelete: 0 })
    setImportResult(null)
    setImportError('')
    setImportFileName('')
  }

  const handleImportFile = useCallback(async (file: File) => {
    if (!selectedBuilding) {
      setImportError('Select a building before importing.')
      return
    }
    setImportError('')
    setImportFileName(file.name)
    try {
      const result = await parseCommunityCSV(file)
      setImportParse(result)

      const { data: existing } = await supabase
        .from('community_contacts')
        .select('phone')
        .eq('building_id', selectedBuilding)
      const existingSet = new Set((existing || []).map((c) => c.phone))
      const incomingSet = new Set(result.contacts.map((c) => c.phone))

      const toAdd = result.contacts.filter((c) => !existingSet.has(c.phone)).length
      const toUpdate = result.contacts.filter((c) => existingSet.has(c.phone)).length
      const toDelete = [...existingSet].filter((p) => !incomingSet.has(p)).length

      setImportStats({ toAdd, toUpdate, toDelete })
      setImportStage('preview')
    } catch (err) {
      setImportError(`Failed to parse CSV: ${(err as Error).message}`)
    }
  }, [selectedBuilding])

  async function runImport() {
    if (!importParse || !selectedBuilding) return
    setImportStage('importing')
    setImportError('')

    try {
      const { data: existing } = await supabase
        .from('community_contacts')
        .select('id, phone')
        .eq('building_id', selectedBuilding)
      const existingByPhone = new Map<string, string>()
      for (const c of existing || []) existingByPhone.set(c.phone, c.id)

      const incomingByPhone = new Map<string, typeof importParse.contacts[number]>()
      for (const c of importParse.contacts) incomingByPhone.set(c.phone, c)

      let added = 0, updated = 0, removed = 0

      const inserts = importParse.contacts
        .filter((c) => !existingByPhone.has(c.phone))
        .map((c) => ({
          first_name: c.first_name,
          last_name: c.last_name,
          phone: c.phone,
          notes: c.notes,
          building_id: selectedBuilding,
        }))
      for (let i = 0; i < inserts.length; i += 500) {
        const batch = inserts.slice(i, i + 500)
        const { error } = await supabase.from('community_contacts').insert(batch)
        if (error) throw error
        added += batch.length
      }

      for (const c of importParse.contacts) {
        const existingId = existingByPhone.get(c.phone)
        if (!existingId) continue
        const { error } = await supabase
          .from('community_contacts')
          .update({
            first_name: c.first_name,
            last_name: c.last_name,
            notes: c.notes,
          })
          .eq('id', existingId)
        if (error) throw error
        updated++
      }

      const removeIds: string[] = []
      for (const [phone, id] of existingByPhone) {
        if (!incomingByPhone.has(phone)) removeIds.push(id)
      }
      for (let i = 0; i < removeIds.length; i += 500) {
        const batch = removeIds.slice(i, i + 500)
        await supabase.from('list_members').delete().in('contact_id', batch).eq('contact_type', 'community')
        const { error } = await supabase.from('community_contacts').delete().in('id', batch)
        if (error) throw error
        removed += batch.length
      }

      setImportResult({ added, updated, removed })
      setImportStage('done')
      toast(`Import complete: ${added} added, ${updated} updated, ${removed} removed`, 'success')
      loadContacts()
      loadBuildings()
    } catch (err) {
      setImportError(`Import failed: ${(err as Error).message}`)
      setImportStage('preview')
      toast(`Import failed: ${(err as Error).message}`, 'error')
    }
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
            className="mb-4 px-4 py-2 bg-tidings-chrome text-white text-sm font-medium rounded-lg hover:bg-slate-700">
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
                  className="px-4 py-2 bg-tidings-chrome text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50">Save</button>
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
                    <button onClick={() => setConfirmDeleteBuilding(b)} className="text-slate-400 hover:text-red-500">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166M18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165M15.75 5.79V4.875c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916" />
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
            }} className="px-4 py-2 bg-tidings-chrome text-white text-sm font-medium rounded-lg hover:bg-slate-700">
              Add Contact
            </button>
            <button
              onClick={startImport}
              disabled={!selectedBuilding}
              title={selectedBuilding ? 'Import CSV for selected building' : 'Select a building first'}
              className="px-4 py-2 bg-tidings-primary text-white text-sm font-medium rounded-lg hover:bg-tidings-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Import CSV
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
                  className="px-4 py-2 bg-tidings-chrome text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50">
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
                        <button onClick={() => setConfirmDeleteContact(c)} className="text-slate-400 hover:text-red-500">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CSV Import slide-over */}
      {showImport && (
        <div className="fixed inset-0 z-[55] flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowImport(false)} />
          <div className="relative bg-white w-full max-w-md shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Import Community CSV</h2>
                <p className="text-xs text-slate-500">
                  Building: {buildings.find((b) => b.id === selectedBuilding)?.name || '—'}
                </p>
              </div>
              <button onClick={() => setShowImport(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {importError && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{importError}</div>
              )}

              {importStage === 'upload' && (
                <>
                  <p className="text-sm text-slate-600">
                    CSV columns expected: <code className="bg-slate-100 px-1 rounded">First Name</code>,{' '}
                    <code className="bg-slate-100 px-1 rounded">Last Name</code>,{' '}
                    <code className="bg-slate-100 px-1 rounded">Phone</code>,{' '}
                    <code className="bg-slate-100 px-1 rounded">Notes</code> (optional). Phone is required.
                  </p>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setImportDragOver(true) }}
                    onDragLeave={() => setImportDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault()
                      setImportDragOver(false)
                      const f = e.dataTransfer.files[0]
                      if (f) handleImportFile(f)
                    }}
                    className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors ${
                      importDragOver ? 'border-amber-400 bg-amber-50' : 'border-slate-300 bg-slate-50'
                    }`}
                  >
                    <p className="text-slate-700 font-medium mb-1">Drop CSV here</p>
                    <p className="text-slate-500 text-sm mb-3">or click to browse</p>
                    <label className="inline-block px-4 py-2 bg-tidings-chrome text-white text-sm font-medium rounded-lg cursor-pointer hover:bg-slate-700">
                      Choose File
                      <input
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) handleImportFile(f)
                        }}
                      />
                    </label>
                  </div>
                  <div className="bg-amber-50 text-amber-800 text-xs px-3 py-2 rounded">
                    Full sync: contacts in this building whose phone isn't in the CSV will be removed.
                  </div>
                </>
              )}

              {importStage === 'preview' && importParse && (
                <>
                  <p className="text-sm text-slate-500">File: {importFileName}</p>
                  <div className="grid grid-cols-3 gap-3">
                    <Stat label="To Add" value={importStats.toAdd} color="green" />
                    <Stat label="To Update" value={importStats.toUpdate} color="amber" />
                    <Stat label="To Remove" value={importStats.toDelete} color="red" />
                  </div>
                  <p className="text-sm text-slate-600">
                    Parsed {importParse.contacts.length} of {importParse.totalRows} rows
                  </p>
                  {importParse.skipped.length > 0 && (
                    <details className="text-sm">
                      <summary className="text-amber-600 cursor-pointer hover:underline">
                        View {importParse.skipped.length} skipped {importParse.skipped.length === 1 ? 'row' : 'rows'}
                      </summary>
                      <div className="mt-2 max-h-40 overflow-y-auto bg-slate-50 rounded-lg p-3 space-y-1">
                        {importParse.skipped.map((s, i) => (
                          <p key={i} className="text-slate-600">Row {s.row}: {s.reason}</p>
                        ))}
                      </div>
                    </details>
                  )}
                  <div className="flex gap-2 pt-2">
                    <button onClick={runImport} className="px-4 py-2 bg-tidings-primary text-white text-sm font-medium rounded-lg hover:bg-tidings-primary-dark">
                      Confirm Import
                    </button>
                    <button onClick={() => setImportStage('upload')} className="px-4 py-2 text-slate-600 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">
                      Cancel
                    </button>
                  </div>
                </>
              )}

              {importStage === 'importing' && (
                <div className="text-center py-12">
                  <div className="animate-spin w-8 h-8 border-2 border-slate-300 border-t-slate-800 rounded-full mx-auto mb-4" />
                  <p className="text-slate-700 font-medium">Importing contacts...</p>
                </div>
              )}

              {importStage === 'done' && importResult && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">Import Complete</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Stat label="Added" value={importResult.added} color="green" />
                    <Stat label="Updated" value={importResult.updated} color="amber" />
                    <Stat label="Removed" value={importResult.removed} color="red" />
                  </div>
                  <button
                    onClick={() => setShowImport(false)}
                    className="px-4 py-2 bg-tidings-chrome text-white text-sm font-medium rounded-lg hover:bg-slate-700"
                  >
                    Done
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDeleteBuilding}
        title="Delete building?"
        message={confirmDeleteBuilding ? `"${confirmDeleteBuilding.name}" will be deleted. Community contacts assigned to this building keep their record but lose the building reference.` : ''}
        confirmLabel="Delete"
        destructive
        onConfirm={deleteBuilding}
        onCancel={() => setConfirmDeleteBuilding(null)}
      />

      <ConfirmDialog
        open={!!confirmDeleteContact}
        title="Delete contact?"
        message={confirmDeleteContact ? `${confirmDeleteContact.first_name} ${confirmDeleteContact.last_name} (${confirmDeleteContact.phone}) will be removed from the community database and from all lists.` : ''}
        confirmLabel="Delete"
        destructive
        onConfirm={deleteContact}
        onCancel={() => setConfirmDeleteContact(null)}
      />
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: 'green' | 'amber' | 'red' }) {
  const colors = {
    green: 'bg-green-50 text-green-700 border-green-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  }
  return (
    <div className={`rounded-lg border p-3 text-center ${colors[color]}`}>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs mt-0.5">{label}</p>
    </div>
  )
}
