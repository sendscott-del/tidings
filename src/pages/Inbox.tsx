import { useEffect, useState } from 'react'
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
  const [messages, setMessages] = useState<InboundMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<InboundMessage | null>(null)

  useEffect(() => {
    loadMessages()
  }, [])

  async function loadMessages() {
    setLoading(true)
    const { data } = await supabase
      .from('inbound_messages')
      .select('*')
      .order('received_at', { ascending: false })
      .limit(200)

    if (data) {
      // Resolve contact names
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
        contact_name: m.contact_id ? nameMap[m.contact_id] || null : null,
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
            <span className="bg-amber-500 text-white text-xs font-medium px-2 py-0.5 rounded-full">
              {unreadCount} unread
            </span>
          )}
        </div>
      </div>

      {messages.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500">No inbound messages yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {messages.map((msg) => (
            <div
              key={msg.id}
              onClick={() => markAsRead(msg)}
              className={`flex items-start gap-3 px-5 py-4 border-b border-slate-100 cursor-pointer transition-colors hover:bg-slate-50 ${
                !msg.read_by ? 'bg-amber-50/50' : ''
              }`}
            >
              {/* Unread dot */}
              <div className="pt-1.5">
                <div className={`w-2 h-2 rounded-full ${!msg.read_by ? 'bg-amber-500' : 'bg-transparent'}`} />
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

            <p className="text-xs text-slate-400">
              Received {new Date(selected.received_at).toLocaleString()}
            </p>

            {selected.is_stop && (
              <div className="mt-4 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">
                This contact has opted out of messages.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
