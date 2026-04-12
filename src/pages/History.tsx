import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

interface Message {
  id: string
  body: string
  database: string
  recipient_count: number
  status: string
  sent_at: string
  created_at: string
  sender_name?: string
}

interface MessageLog {
  id: string
  phone: string
  status: string
  error_code: string | null
  sent_at: string
}

export default function History() {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Message | null>(null)
  const [logs, setLogs] = useState<MessageLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [dbFilter, setDbFilter] = useState<string>('')

  useEffect(() => { loadMessages() }, [])

  async function loadMessages() {
    setLoading(true)
    const { data } = await supabase
      .from('messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (data) {
      // Get sender names
      const senderIds = [...new Set(data.map((m) => m.sent_by).filter(Boolean))]
      const nameMap: Record<string, string> = {}
      if (senderIds.length > 0) {
        const { data: users } = await supabase.from('users').select('id, full_name').in('id', senderIds)
        for (const u of users || []) nameMap[u.id] = u.full_name || 'Unknown'
      }
      setMessages(data.map((m) => ({ ...m, sender_name: m.sent_by ? nameMap[m.sent_by] : undefined })))
    }
    setLoading(false)
  }

  async function viewLogs(msg: Message) {
    setSelected(msg)
    setLogsLoading(true)
    const { data } = await supabase
      .from('message_logs')
      .select('id, phone, status, error_code, sent_at')
      .eq('message_id', msg.id)
      .order('sent_at')
    setLogs(data || [])
    setLogsLoading(false)
  }

  const statusColors: Record<string, string> = {
    sent: 'bg-green-100 text-green-700',
    delivered: 'bg-green-100 text-green-700',
    sending: 'bg-yellow-100 text-yellow-700',
    queued: 'bg-yellow-100 text-yellow-700',
    failed: 'bg-red-100 text-red-700',
    undelivered: 'bg-red-100 text-red-700',
  }

  const filtered = messages.filter((m) => !dbFilter || m.database === dbFilter)

  if (loading) return <div className="text-slate-400 py-8 text-center">Loading history...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Message History</h1>
        <select value={dbFilter} onChange={(e) => setDbFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
          <option value="">All</option>
          <option value="stake">Stake</option>
          <option value="community">Community</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500">No messages sent yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((msg) => {
            return (
              <div key={msg.id} onClick={() => viewLogs(msg)}
                className="bg-white rounded-xl border border-slate-200 px-5 py-4 hover:bg-slate-50 cursor-pointer transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-900 font-medium truncate">{msg.body}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span>{new Date(msg.sent_at || msg.created_at).toLocaleDateString()} {new Date(msg.sent_at || msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {msg.sender_name && <span>by {msg.sender_name}</span>}
                      <span className="capitalize">{msg.database}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <div className="text-right">
                      <span className="text-lg font-semibold text-slate-900">{msg.recipient_count}</span>
                      <p className="text-xs text-slate-500">recipients</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[msg.status] || 'bg-slate-100 text-slate-600'}`}>
                      {msg.status}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Detail slide-over */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelected(null)} />
          <div className="relative bg-white w-full max-w-md shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Delivery Details</h2>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              <div className="bg-slate-50 rounded-lg p-3 mb-4">
                <p className="text-sm text-slate-900">{selected.body}</p>
              </div>

              {logsLoading ? (
                <p className="text-slate-400 text-center py-4">Loading delivery logs...</p>
              ) : logs.length === 0 ? (
                <p className="text-slate-500 text-center py-4">No delivery logs found.</p>
              ) : (
                <>
                  <div className="flex gap-3 mb-4 text-sm">
                    <span className="text-green-600 font-medium">
                      {logs.filter((l) => l.status === 'delivered' || l.status === 'sent').length} delivered
                    </span>
                    <span className="text-red-600 font-medium">
                      {logs.filter((l) => l.status === 'failed' || l.status === 'undelivered').length} failed
                    </span>
                  </div>
                  <div className="space-y-2">
                    {logs.map((log) => (
                      <div key={log.id} className="flex items-center justify-between py-2 border-b border-slate-100">
                        <span className="text-sm text-slate-700">{log.phone}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusColors[log.status] || 'bg-slate-100 text-slate-600'}`}>
                          {log.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
