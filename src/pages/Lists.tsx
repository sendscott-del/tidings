import { useEffect, useState } from 'react'
import { supabase, fetchAll } from '../lib/supabase'

interface List {
  id: string
  name: string
  description: string | null
  database: string
  is_auto: boolean
  created_at: string
  member_count: number
}

export default function Lists() {
  const [lists, setLists] = useState<List[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'stake' | 'community'>('all')
  const [selectedList, setSelectedList] = useState<List | null>(null)
  const [members, setMembers] = useState<any[]>([])
  const [membersLoading, setMembersLoading] = useState(false)

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
      // Get member counts (paginated — list_members can exceed 1000)
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

    const results: any[] = []

    if (stakeIds.length > 0) {
      // Batch .in() into chunks of 500 to avoid URL-length limits
      for (let i = 0; i < stakeIds.length; i += 500) {
        const chunk = stakeIds.slice(i, i + 500)
        const data = await fetchAll<any>(() =>
          supabase
            .from('contacts')
            .select('id, first_name, last_name, phone, unit_name, opted_out')
            .in('id', chunk)
            .order('last_name')
        )
        results.push(...data.map((c) => ({ ...c, type: 'stake' })))
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
        results.push(...data.map((c) => ({ ...c, type: 'community' })))
      }
    }

    setMembers(results)
    setMembersLoading(false)
  }

  const filtered = lists.filter((l) => filter === 'all' || l.database === filter)

  if (loading) {
    return <div className="text-slate-400 py-8 text-center">Loading lists...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Lists</h1>
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
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500">No lists yet. Import contacts to auto-generate lists.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((list) => (
            <div
              key={list.id}
              onClick={() => viewMembers(list)}
              className="bg-white rounded-xl border border-slate-200 px-5 py-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors"
            >
              <div>
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
              <div className="text-right">
                <span className="text-lg font-semibold text-slate-900">{list.member_count}</span>
                <p className="text-xs text-slate-500">contacts</p>
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
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{selectedList.name}</h2>
                <p className="text-sm text-slate-500">{selectedList.member_count} contacts</p>
              </div>
              <button onClick={() => setSelectedList(null)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              {membersLoading ? (
                <p className="text-slate-400 text-center py-4">Loading members...</p>
              ) : members.length === 0 ? (
                <p className="text-slate-500 text-center py-4">No members in this list.</p>
              ) : (
                <div className="space-y-2">
                  {members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between py-2 border-b border-slate-100">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {m.first_name} {m.last_name}
                        </p>
                        <p className="text-xs text-slate-500">{m.phone}</p>
                      </div>
                      {m.opted_out && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          Opted Out
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
