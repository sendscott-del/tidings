import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface InboundMessage {
  id: string
  from_phone: string
  body: string
  contact_id: string | null
  contact_type: string | null
  is_stop: boolean
  received_at: string
  read_by: string | null
  read_at: string | null
  contact_name?: string
}

export default function Inbox() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [messages, setMessages] = useState<InboundMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<InboundMessage | null>(null)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showUnreadOnly, setShowUnreadOnly] = useState(false)

  useEffect(() => {
    loadMessages()
  }, [])

  async function loadMessages() {
    setLoading(true)
    const { data } = await supabase
      .from('inbound_messages')
      .select('*')
      .order('received_at', { ascending: false })
      .limit(500)

    if (data) {
      const stakeIds = data.filter((m) => m.contact_type === 'stake' && m.contact_id).map((m) => m.contact_id!)
      const communityIds = data.filter((m) => m.contact_type === 'community' && m.contact_id).map((m) => m.contact_id!)

      const nameMap: Record<string, string> = {}

      if (stakeIds.length > 0) {
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id, first_name, last_name')
          .in('id', stakeIds)
        for (const c of contacts || []) {
          nameMap[c.id] = `${c.first_name} ${c.last_name}`
        }
      }

      if (communityIds.length > 0) {
        const { data: contacts } = await supabase
          .from('community_contacts')
          .select('id, first_name, last_name')
          .in('id', communityIds)
        for (const c of contacts || []) {
          nameMap[c.id] = `${c.first_name || ''} ${c.last_name || ''}`.trim()
        }
      }

      setMessages(data.map((m) => ({
        ...m,
        contact_name: m.contact_id ? nameMap[m.contact_id] || undefined : undefined,
      })))
    }
    setLoading(false)
  }

  async function markAsRead(msg: InboundMessage) {
    setSelected(msg)
    if (!msg.read_by && user) {
      await supabase
        .from('inbound_messages')
        .update({ read_by: user.id, read_at: new Date().toISOString() })
        .eq('id', msg.id)
      setMessages((prev) =>
        prev.map((m) => m.id === msg.id ? { ...m, read_by: user.id, read_at: new Date().toISOString() } : m)
      )
    }
  }

  function handleReply() {
    if (!selected) return
    navigate('/compose', {
      state: {
        replyTo: {
          phone: selected.from_phone,
          name: selected.contact_name,
          contactId: selected.contact_id,
          contactType: selected.contact_type,
        },
      },
    })
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : null
    const toTs = dateTo ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 - 1 : null
    return messages.filter((m) => {
      if (showUnreadOnly && m.read_by) return false
      if (q) {
        const hay = `${m.contact_name || ''} ${m.from_phone} ${m.body}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (fromTs && new Date(m.received_at).getTime() < fromTs) return false
      if (toTs && new Date(m.received_at).getTime() > toTs) return false
      return true
    })
  }, [messages, search, dateFrom, dateTo, showUnreadOnly])

  const unreadCount = messages.filter((m) => !m.read_by).length

  if (loading) {
    return <div className="text-slate-400 py-8 text-center">Loading inbox...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">Inbox</h1>
          {unreadCount > 0 && (
            <span className="bg-tidings-primary text-white text-xs font-medium px-2 py-0.5 rounded-full">
              {unreadCount} unread
            </span>
          )}
        </div>
      </div>

      {/* Search & filter row */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone, or message..."
          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-tidings-primary focus:border-transparent"
        />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
          aria-label="From date"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
          aria-label="To date"
        />
        <label className="flex items-center gap-2 text-sm text-slate-700 whitespace-nowrap">
          <input
            type="checkbox"
            checked={showUnreadOnly}
            onChange={(e) => setShowUnreadOnly(e.target.checked)}
            className="rounded border-slate-300 text-tidings-primary focus:ring-tidings-primary"
          />
          Unread only
        </label>
        {(search || dateFrom || dateTo || showUnreadOnly) && (
          <button
            onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); setShowUnreadOnly(false) }}
            className="text-sm text-slate-500 hover:text-slate-700 whitespace-nowrap"
          >
            Clear
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500">
            {messages.length === 0 ? 'No inbound messages yet.' : 'No messages match your filters.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {filtered.map((msg) => (
            <div
              key={msg.id}
              onClick={() => markAsRead(msg)}
              className={`flex items-start gap-3 px-5 py-4 border-b border-slate-100 cursor-pointer transition-colors hover:bg-slate-50 ${
                !msg.read_by ? 'bg-amber-50/50' : ''
              }`}
            >
              <div className="pt-1.5">
                <div className={`w-2 h-2 rounded-full ${!msg.read_by ? 'bg-tidings-primary' : 'bg-transparent'}`} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {msg.contact_name || msg.from_phone}
                  </p>
                  <span className="text-xs text-slate-400 ml-2 whitespace-nowrap">
                    {new Date(msg.received_at).toLocaleDateString()} {new Date(msg.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {msg.contact_name && (
                  <p className="text-xs text-slate-400">{msg.from_phone}</p>
                )}
                <p className="text-sm text-slate-600 mt-0.5 truncate">{msg.body}</p>
                {msg.is_stop && (
                  <span className="inline-block mt-1 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                    STOP
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Message detail */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelected(null)} />
          <div className="relative bg-white w-full max-w-sm shadow-xl p-6 overflow-y-auto">
            <button onClick={() => setSelected(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>

            <h2 className="text-lg font-semibold text-slate-900 mb-1">
              {selected.contact_name || 'Unknown Contact'}
            </h2>
            <p className="text-sm text-slate-500 mb-4">{selected.from_phone}</p>

            <div className="bg-slate-100 rounded-xl p-4 mb-4">
              <p className="text-sm text-slate-900">{selected.body}</p>
            </div>

            <p className="text-xs text-slate-400 mb-4">
              Received {new Date(selected.received_at).toLocaleString()}
            </p>

            {selected.is_stop ? (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">
                This contact has opted out of messages. You cannot reply.
              </div>
            ) : (
              <button
                onClick={handleReply}
                className="w-full px-4 py-2.5 bg-tidings-primary text-white text-sm font-medium rounded-lg hover:bg-tidings-primary-dark inline-flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                </svg>
                Reply to {selected.contact_name?.split(' ')[0] || 'sender'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
