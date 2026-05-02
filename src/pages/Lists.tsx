import { useEffect, useMemo, useState } from 'react'
import { supabase, fetchAll } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'
import ConfirmDialog from '../components/ConfirmDialog'

interface List {
  id: string
  name: string
  description: string | null
  database: string
  is_auto: boolean
  created_at: string
  member_count: number
}

interface Member {
  id: string
  first_name: string
  last_name: string
  phone: string
  unit_name?: string
  opted_out: boolean
  type: 'stake' | 'community'
}

interface PickerContact {
  id: string
  first_name: string
  last_name: string
  phone: string
  unit_name?: string
  opted_out: boolean
  type: 'stake' | 'community'
}

export default function Lists() {
  const { toast } = useToast()
  const [lists, setLists] = useState<List[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'stake' | 'community'>('all')
  const [selectedList, setSelectedList] = useState<List | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [membersLoading, setMembersLoading] = useState(false)

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState<{ name: string; description: string; database: 'stake' | 'community' }>({
    name: '',
    description: '',
    database: 'stake',
  })
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<{ name: string; description: string }>({ name: '', description: '' })
  const [confirmDelete, setConfirmDelete] = useState<List | null>(null)

  const [showPicker, setShowPicker] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [pickerContacts, setPickerContacts] = useState<PickerContact[]>([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadLists()
  }, [])

  async function loadLists() {
    setLoading(true)
    const { data: listsData } = await supabase
      .from('lists')
      .select('*')
      .order('name')

    if (listsData) {
      const counts = await fetchAll<{ list_id: string }>(() =>
        supabase.from('list_members').select('list_id')
      )

      const countMap: Record<string, number> = {}
      for (const row of counts) {
        countMap[row.list_id] = (countMap[row.list_id] || 0) + 1
      }

      setLists(
        listsData.map((l) => ({
          ...l,
          member_count: countMap[l.id] || 0,
        }))
      )
    }
    setLoading(false)
  }

  async function viewMembers(list: List) {
    setSelectedList(list)
    setEditing(false)
    setEditForm({ name: list.name, description: list.description || '' })
    setMembersLoading(true)

    const memberLinks = await fetchAll<{ contact_id: string; contact_type: string }>(() =>
      supabase
        .from('list_members')
        .select('contact_id, contact_type')
        .eq('list_id', list.id)
    )

    if (memberLinks.length === 0) {
      setMembers([])
      setMembersLoading(false)
      return
    }

    const stakeIds = memberLinks.filter((m) => m.contact_type === 'stake').map((m) => m.contact_id)
    const communityIds = memberLinks.filter((m) => m.contact_type === 'community').map((m) => m.contact_id)

    const results: Member[] = []

    if (stakeIds.length > 0) {
      for (let i = 0; i < stakeIds.length; i += 500) {
        const chunk = stakeIds.slice(i, i + 500)
        const data = await fetchAll<any>(() =>
          supabase
            .from('contacts')
            .select('id, first_name, last_name, phone, unit_name, opted_out')
            .in('id', chunk)
            .order('last_name')
        )
        results.push(...data.map((c) => ({ ...c, type: 'stake' as const })))
      }
    }

    if (communityIds.length > 0) {
      for (let i = 0; i < communityIds.length; i += 500) {
        const chunk = communityIds.slice(i, i + 500)
        const data = await fetchAll<any>(() =>
          supabase
            .from('community_contacts')
            .select('id, first_name, last_name, phone, opted_out')
            .in('id', chunk)
            .order('last_name')
        )
        results.push(...data.map((c) => ({ ...c, type: 'community' as const })))
      }
    }

    setMembers(results)
    setMembersLoading(false)
  }

  async function handleCreate() {
    const name = createForm.name.trim()
    if (!name) return
    const { data, error } = await supabase
      .from('lists')
      .insert({
        name,
        description: createForm.description.trim() || null,
        database: createForm.database,
        is_auto: false,
      })
      .select()
      .single()
    if (error) {
      toast(`Failed to create list: ${error.message}`, 'error')
      return
    }
    toast(`List "${name}" created`, 'success')
    setShowCreate(false)
    setCreateForm({ name: '', description: '', database: 'stake' })
    await loadLists()
    if (data) viewMembers({ ...data, member_count: 0 })
  }

  async function handleSaveEdit() {
    if (!selectedList) return
    const name = editForm.name.trim()
    if (!name) return
    const { error } = await supabase
      .from('lists')
      .update({ name, description: editForm.description.trim() || null })
      .eq('id', selectedList.id)
    if (error) {
      toast(`Failed to update list: ${error.message}`, 'error')
      return
    }
    toast('List updated', 'success')
    setSelectedList({ ...selectedList, name, description: editForm.description.trim() || null })
    setEditing(false)
    await loadLists()
  }

  async function handleDelete() {
    if (!confirmDelete) return
    const id = confirmDelete.id
    setConfirmDelete(null)
    const { error } = await supabase.from('lists').delete().eq('id', id)
    if (error) {
      toast(`Failed to delete: ${error.message}`, 'error')
      return
    }
    toast('List deleted', 'success')
    if (selectedList?.id === id) setSelectedList(null)
    await loadLists()
  }

  async function openPicker() {
    if (!selectedList) return
    setShowPicker(true)
    setPickerSelected(new Set())
    setPickerLoading(true)
    const existing = new Set(members.map((m) => m.id))
    if (selectedList.database === 'stake') {
      const data = await fetchAll<any>(() =>
        supabase
          .from('contacts')
          .select('id, first_name, last_name, phone, unit_name, opted_out')
          .order('last_name')
      )
      setPickerContacts(
        data.filter((c) => !existing.has(c.id)).map((c) => ({ ...c, type: 'stake' as const }))
      )
    } else {
      const data = await fetchAll<any>(() =>
        supabase
          .from('community_contacts')
          .select('id, first_name, last_name, phone, opted_out')
          .order('last_name')
      )
      setPickerContacts(
        data.filter((c) => !existing.has(c.id)).map((c) => ({ ...c, type: 'community' as const }))
      )
    }
    setPickerLoading(false)
  }

  function togglePickerContact(id: string) {
    const next = new Set(pickerSelected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setPickerSelected(next)
  }

  async function handleAddSelected() {
    if (!selectedList || pickerSelected.size === 0) return
    const rows = pickerContacts
      .filter((c) => pickerSelected.has(c.id))
      .map((c) => ({
        list_id: selectedList.id,
        contact_id: c.id,
        contact_type: c.type,
      }))
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from('list_members').insert(rows.slice(i, i + 500))
      if (error) {
        toast(`Failed to add members: ${error.message}`, 'error')
        return
      }
    }
    toast(`Added ${rows.length} ${rows.length === 1 ? 'member' : 'members'}`, 'success')
    setShowPicker(false)
    await loadLists()
    const refreshed = lists.find((l) => l.id === selectedList.id)
    if (refreshed) await viewMembers(refreshed)
    else await viewMembers(selectedList)
  }

  async function handleRemoveMember(member: Member) {
    if (!selectedList) return
    const { error } = await supabase
      .from('list_members')
      .delete()
      .eq('list_id', selectedList.id)
      .eq('contact_id', member.id)
      .eq('contact_type', member.type)
    if (error) {
      toast(`Failed to remove: ${error.message}`, 'error')
      return
    }
    toast('Member removed', 'success')
    setMembers((prev) => prev.filter((m) => !(m.id === member.id && m.type === member.type)))
    await loadLists()
  }

  const pickerFiltered = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase()
    if (!q) return pickerContacts.slice(0, 200)
    return pickerContacts
      .filter((c) =>
        `${c.first_name} ${c.last_name} ${c.phone} ${c.unit_name || ''}`.toLowerCase().includes(q)
      )
      .slice(0, 200)
  }, [pickerContacts, pickerSearch])

  const filtered = lists.filter((l) => filter === 'all' || l.database === filter)

  if (loading) {
    return <div className="text-slate-400 py-8 text-center">Loading lists...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Lists</h1>
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            {(['all', 'stake', 'community'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
                  filter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-tidings-chrome text-white text-sm font-medium rounded-lg hover:bg-slate-700"
          >
            New List
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Create custom list</h2>
          <input
            placeholder="List name"
            value={createForm.name}
            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
            autoFocus
          />
          <input
            placeholder="Description (optional)"
            value={createForm.description}
            onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
          />
          <div className="flex gap-2">
            {(['stake', 'community'] as const).map((db) => (
              <button
                key={db}
                onClick={() => setCreateForm({ ...createForm, database: db })}
                className={`px-3 py-1.5 text-sm font-medium rounded-md border capitalize ${
                  createForm.database === db
                    ? 'border-amber-500 bg-amber-50 text-amber-700'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {db}
              </button>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCreate}
              disabled={!createForm.name.trim()}
              className="px-4 py-2 bg-tidings-chrome text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50"
            >
              Create
            </button>
            <button
              onClick={() => {
                setShowCreate(false)
                setCreateForm({ name: '', description: '', database: 'stake' })
              }}
              className="px-4 py-2 text-slate-600 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500">No lists yet. Import contacts to auto-generate lists, or create a custom list above.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((list) => (
            <div
              key={list.id}
              className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
              <div onClick={() => viewMembers(list)} className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <span className="text-slate-900 font-medium">{list.name}</span>
                  {list.is_auto && (
                    <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">(auto)</span>
                  )}
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    list.database === 'stake' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                  }`}>
                    {list.database}
                  </span>
                </div>
                {list.description && (
                  <p className="text-sm text-slate-500 mt-0.5">{list.description}</p>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div onClick={() => viewMembers(list)} className="text-right cursor-pointer">
                  <span className="text-lg font-semibold text-slate-900">{list.member_count}</span>
                  <p className="text-xs text-slate-500">contacts</p>
                </div>
                {!list.is_auto && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(list) }}
                    className="text-slate-400 hover:text-red-500"
                    aria-label="Delete list"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166M18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165M15.75 5.79V4.875c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Members slide-over */}
      {selectedList && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelectedList(null)} />
          <div className="relative bg-white w-full max-w-md shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-start justify-between">
              <div className="flex-1 min-w-0">
                {editing ? (
                  <div className="space-y-2">
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                      autoFocus
                    />
                    <input
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      placeholder="Description"
                      className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                    />
                    <div className="flex gap-2">
                      <button onClick={handleSaveEdit} className="px-3 py-1 bg-tidings-chrome text-white text-xs font-medium rounded hover:bg-slate-700">
                        Save
                      </button>
                      <button onClick={() => setEditing(false)} className="px-3 py-1 text-slate-600 text-xs border border-slate-300 rounded hover:bg-slate-50">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h2 className="text-lg font-semibold text-slate-900 truncate">{selectedList.name}</h2>
                    {selectedList.description && (
                      <p className="text-xs text-slate-500 truncate">{selectedList.description}</p>
                    )}
                    <p className="text-sm text-slate-500">{selectedList.member_count} contacts</p>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 ml-3">
                {!selectedList.is_auto && !editing && (
                  <button onClick={() => setEditing(true)} className="text-slate-400 hover:text-slate-600" aria-label="Edit list">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                    </svg>
                  </button>
                )}
                <button onClick={() => setSelectedList(null)} className="text-slate-400 hover:text-slate-600" aria-label="Close">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              {!selectedList.is_auto && (
                <button
                  onClick={openPicker}
                  className="mb-4 px-3 py-1.5 bg-tidings-primary text-white text-sm font-medium rounded-lg hover:bg-tidings-primary-dark"
                >
                  + Add Members
                </button>
              )}
              {membersLoading ? (
                <p className="text-slate-400 text-center py-4">Loading members...</p>
              ) : members.length === 0 ? (
                <p className="text-slate-500 text-center py-4">No members in this list.</p>
              ) : (
                <div className="space-y-2">
                  {members.map((m) => (
                    <div key={`${m.type}-${m.id}`} className="flex items-center justify-between py-2 border-b border-slate-100">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {m.first_name} {m.last_name}
                        </p>
                        <p className="text-xs text-slate-500">{m.phone}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {m.opted_out && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Opted Out</span>
                        )}
                        {!selectedList.is_auto && (
                          <button
                            onClick={() => handleRemoveMember(m)}
                            className="text-slate-400 hover:text-red-500"
                            aria-label="Remove from list"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Member picker (nested over the slide-over) */}
      {showPicker && selectedList && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowPicker(false)} />
          <div className="relative bg-white w-full max-w-md shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-slate-900">Add Members</h2>
                <button onClick={() => setShowPicker(false)} className="text-slate-400 hover:text-slate-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <input
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder={`Search ${selectedList.database} contacts...`}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
              />
              <p className="text-xs text-slate-500 mt-2">
                {pickerSelected.size} selected · {pickerContacts.length} available
                {pickerFiltered.length < pickerContacts.length && ` · showing ${pickerFiltered.length}`}
              </p>
            </div>

            <div className="px-6 py-4">
              {pickerLoading ? (
                <p className="text-slate-400 text-center py-4">Loading contacts...</p>
              ) : pickerFiltered.length === 0 ? (
                <p className="text-slate-500 text-center py-4">No contacts to add.</p>
              ) : (
                <div className="space-y-1">
                  {pickerFiltered.map((c) => (
                    <label
                      key={c.id}
                      className={`flex items-center gap-3 px-2 py-2 rounded cursor-pointer ${
                        pickerSelected.has(c.id) ? 'bg-amber-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={pickerSelected.has(c.id)}
                        onChange={() => togglePickerContact(c.id)}
                        className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">
                          {c.first_name} {c.last_name}
                        </p>
                        <p className="text-xs text-slate-500">{c.phone}{c.unit_name ? ` · ${c.unit_name}` : ''}</p>
                      </div>
                      {c.opted_out && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Opted Out</span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-3 flex gap-2">
              <button
                onClick={handleAddSelected}
                disabled={pickerSelected.size === 0}
                className="px-4 py-2 bg-tidings-primary text-white text-sm font-medium rounded-lg hover:bg-tidings-primary-dark disabled:opacity-50"
              >
                Add {pickerSelected.size} {pickerSelected.size === 1 ? 'contact' : 'contacts'}
              </button>
              <button
                onClick={() => setShowPicker(false)}
                className="px-4 py-2 text-slate-600 text-sm border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete list?"
        message={confirmDelete ? `"${confirmDelete.name}" will be deleted. Members are not deleted, only removed from this list.` : ''}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
