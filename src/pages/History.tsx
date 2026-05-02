import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'

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

function downloadCSV(filename: string, rows: string[][]) {
  const escape = (v: string) => {
    if (v.includes(',') || v.includes('"') || v.includes('\n')) {
      return `"${v.replace(/"/g, '""')}"`
    }
    return v
  }
  const csv = rows.map((r) => r.map(escape).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function History() {
  const { toast } = useToast()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Message | null>(null)
  const [logs, setLogs] = useState<MessageLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [dbFilter, setDbFilter] = useState<string>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

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

  const filtered = useMemo(() => {
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : null
    const toTs = dateTo ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 - 1 : null
    return messages.filter((m) => {
      if (dbFilter && m.database !== dbFilter) return false
      const ts = new Date(m.sent_at || m.created_at).getTime()
      if (fromTs && ts < fromTs) return false
      if (toTs && ts > toTs) return false
      return true
    })
  }, [messages, dbFilter, dateFrom, dateTo])

  function exportFailed() {
    if (!selected) return
    const failed = logs.filter((l) => l.status === 'failed' || l.status === 'undelivered')
    if (failed.length === 0) {
      toast('No failed recipients to export', 'info')
      return
    }
    const rows: string[][] = [
      ['Phone', 'Status', 'Error Code', 'Sent At'],
      ...failed.map((l) => [l.phone, l.status, l.error_code || '', l.sent_at]),
    ]
    const datePart = new Date(selected.sent_at || selected.created_at).toISOString().slice(0, 10)
    downloadCSV(`tidings-failed-${datePart}-${selected.id.slice(0, 8)}.csv`, rows)
    toast(`Exported ${failed.length} failed ${failed.length === 1 ? 'recipient' : 'recipients'}`, 'success')
  }

  if (loading) return <div className="text-slate-400 py-8 text-center">Loading history...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Message History</h1>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <select value={dbFilter} onChange={(e) => setDbFilter(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
          <option value="">All databases</option>
          <option value="stake">Stake</option>
          <option value="community">Community</option>
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          aria-label="From date"
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          aria-label="To date"
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
        />
        {(dbFilter || dateFrom || dateTo) && (
          <button onClick={() => { setDbFilter(''); setDateFrom(''); setDateTo('') }}
            className="text-sm text-slate-500 hover:text-slate-700">
            Clear
          </button>
        )}
        <span className="text-xs text-slate-500 ml-auto">
          {filtered.length} of {messages.length} {messages.length === 1 ? 'message' : 'messages'}
        </span>
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
                  <div className="flex items-center justify-between mb-4 text-sm">
                    <div className="flex gap-3">
                      <span className="text-green-600 font-medium">
                        {logs.filter((l) => l.status === 'delivered' || l.status === 'sent').length} delivered
                      </span>
                      <span className="text-red-600 font-medium">
                        {logs.filter((l) => l.status === 'failed' || l.status === 'undelivered').length} failed
                      </span>
                    </div>
                    {logs.some((l) => l.status === 'failed' || l.status === 'undelivered') && (
                      <button
                        onClick={exportFailed}
                        className="text-xs px-3 py-1.5 bg-tidings-chrome text-white rounded-md hover:bg-slate-700"
                      >
                        Export Failed CSV
                      </button>
                    )}
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
