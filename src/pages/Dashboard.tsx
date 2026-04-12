import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

interface RecentMessage {
  id: string
  body: string
  recipient_count: number
  status: string
  sent_at: string
  created_at: string
}

export default function Dashboard() {
  const { appUser } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ stakeContacts: 0, unreadReplies: 0, optedOut: 0, messagesSent: 0 })
  const [recentMessages, setRecentMessages] = useState<RecentMessage[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    const [
      { count: stakeCount },
      { count: unreadCount },
      { count: optedOutStake },
      { count: optedOutCommunity },
      { count: msgCount },
      { data: recent },
    ] = await Promise.all([
      supabase.from('contacts').select('*', { count: 'exact', head: true }),
      supabase.from('inbound_messages').select('*', { count: 'exact', head: true }).is('read_by', null),
      supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('opted_out', true),
      supabase.from('community_contacts').select('*', { count: 'exact', head: true }).eq('opted_out', true),
      supabase.from('messages').select('*', { count: 'exact', head: true }),
      supabase.from('messages').select('id, body, recipient_count, status, sent_at, created_at').order('created_at', { ascending: false }).limit(5),
    ])

    setStats({
      stakeContacts: stakeCount || 0,
      unreadReplies: unreadCount || 0,
      optedOut: (optedOutStake || 0) + (optedOutCommunity || 0),
      messagesSent: msgCount || 0,
    })
    setRecentMessages(recent || [])
    setLoading(false)
  }

  if (loading) {
    return <div className="text-slate-400 py-8 text-center">Loading dashboard...</div>
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <button
          onClick={() => navigate('/compose')}
          className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors"
        >
          Compose Message
        </button>
      </div>

      <p className="text-slate-600 mb-6">
        Welcome{appUser?.full_name ? `, ${appUser.full_name}` : ''}.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <DashCard label="Stake Contacts" value={stats.stakeContacts.toLocaleString()} onClick={() => navigate('/stake')} />
        <DashCard label="Unread Replies" value={stats.unreadReplies.toLocaleString()} highlight={stats.unreadReplies > 0} onClick={() => navigate('/inbox')} />
        <DashCard label="Messages Sent" value={stats.messagesSent.toLocaleString()} onClick={() => navigate('/history')} />
        <DashCard label="Opted Out" value={stats.optedOut.toLocaleString()} />
      </div>

      {recentMessages.length > 0 && (
        <div>
          <h2 className="text-lg font-medium text-slate-900 mb-3">Recent Messages</h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {recentMessages.map((msg) => (
              <div
                key={msg.id}
                onClick={() => navigate('/history')}
                className="flex items-center justify-between px-5 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-900 truncate">{msg.body}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(msg.sent_at || msg.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3 ml-4">
                  <span className="text-sm text-slate-600">{msg.recipient_count} recipients</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    msg.status === 'sent' ? 'bg-green-100 text-green-700' :
                    msg.status === 'failed' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>{msg.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function DashCard({ label, value, highlight, onClick }: { label: string; value: string; highlight?: boolean; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border p-5 transition-colors ${
        highlight ? 'border-amber-300 bg-amber-50' : 'border-slate-200'
      } ${onClick ? 'cursor-pointer hover:bg-slate-50' : ''}`}
    >
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${highlight ? 'text-amber-600' : 'text-slate-900'}`}>{value}</p>
    </div>
  )
}
