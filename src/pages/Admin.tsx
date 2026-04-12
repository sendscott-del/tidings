import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface AppUser {
  id: string
  email: string
  full_name: string
  role: string
  permissions: Record<string, any>
}

export default function Admin() {
  const { appUser } = useAuth()
  const [tab, setTab] = useState<'users' | 'settings'>('users')
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState<AppUser | null>(null)
  const [form, setForm] = useState({ email: '', full_name: '', password: '', role: 'viewer', can_text_stake: true, can_text_community: false })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadUsers() }, [])

  if (appUser?.role !== 'admin') {
    return (
      <div className="bg-red-50 text-red-700 rounded-xl p-6 text-center">
        You don't have permission to access this page.
      </div>
    )
  }

  async function loadUsers() {
    setLoading(true)
    const { data } = await supabase.from('users').select('*').order('full_name')
    setUsers(data || [])
    setLoading(false)
  }

  async function saveUser() {
    setError('')
    setSaving(true)

    try {
      const permissions = {
        can_text_stake: form.can_text_stake,
        can_text_community: form.can_text_community,
      }

      if (editingUser) {
        // Update existing user
        await supabase.from('users').update({
          full_name: form.full_name,
          role: form.role,
          permissions,
        }).eq('id', editingUser.id)
      } else {
        // Create new user via edge function
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) throw new Error('Not authenticated')

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              email: form.email,
              password: form.password,
              full_name: form.full_name,
              role: form.role,
              permissions,
            }),
          }
        )
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Failed to create user')
      }

      setShowForm(false)
      setEditingUser(null)
      setForm({ email: '', full_name: '', password: '', role: 'viewer', can_text_stake: true, can_text_community: false })
      loadUsers()
    } catch (err) {
      setError((err as Error).message)
    }
    setSaving(false)
  }

  async function deleteUser(userId: string) {
    if (userId === appUser?.id) return
    await supabase.from('users').delete().eq('id', userId)
    loadUsers()
  }

  function startEdit(u: AppUser) {
    setEditingUser(u)
    setForm({
      email: u.email,
      full_name: u.full_name || '',
      password: '',
      role: u.role,
      can_text_stake: u.permissions?.can_text_stake ?? true,
      can_text_community: u.permissions?.can_text_community ?? false,
    })
    setShowForm(true)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Admin</h1>
        <div className="flex bg-slate-100 rounded-lg p-0.5">
          {(['users', 'settings'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
                tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >{t}</button>
          ))}
        </div>
      </div>

      {tab === 'users' && (
        <div>
          <button onClick={() => {
            setEditingUser(null)
            setForm({ email: '', full_name: '', password: '', role: 'viewer', can_text_stake: true, can_text_community: false })
            setShowForm(true)
          }} className="mb-4 px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700">
            Create User
          </button>

          {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}

          {showForm && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 mb-4 space-y-3">
              <h3 className="text-sm font-medium text-slate-900">{editingUser ? 'Edit User' : 'New User'}</h3>
              {!editingUser && (
                <>
                  <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                  <input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
                </>
              )}
              <input placeholder="Full name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900" />
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                <option value="viewer">Viewer</option>
                <option value="sender">Sender</option>
                <option value="admin">Admin</option>
              </select>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={form.can_text_stake}
                    onChange={(e) => setForm({ ...form, can_text_stake: e.target.checked })}
                    className="rounded border-slate-300 text-amber-500 focus:ring-amber-500" />
                  Can text stake contacts
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={form.can_text_community}
                    onChange={(e) => setForm({ ...form, can_text_community: e.target.checked })}
                    className="rounded border-slate-300 text-amber-500 focus:ring-amber-500" />
                  Can text community contacts
                </label>
              </div>
              <div className="flex gap-2">
                <button onClick={saveUser} disabled={saving || (!editingUser && (!form.email || !form.password))}
                  className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50">
                  {saving ? 'Saving...' : editingUser ? 'Update' : 'Create'}
                </button>
                <button onClick={() => { setShowForm(false); setEditingUser(null); setError('') }}
                  className="px-4 py-2 text-slate-600 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
              </div>
            </div>
          )}

          {loading ? <p className="text-slate-400 text-center py-8">Loading...</p> : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 hidden sm:table-cell">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Role</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-slate-100">
                      <td className="px-4 py-3 text-slate-900 font-medium">{u.full_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                          u.role === 'sender' ? 'bg-blue-100 text-blue-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>{u.role}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => startEdit(u)} className="text-slate-400 hover:text-slate-600 mr-2">Edit</button>
                        {u.id !== appUser?.id && (
                          <button onClick={() => deleteUser(u.id)} className="text-slate-400 hover:text-red-500">Delete</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'settings' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-lg font-medium text-slate-900 mb-4">Settings</h2>
          <p className="text-sm text-slate-500">
            Twilio credentials and app settings are configured via Supabase Edge Function secrets.
            Use <code className="bg-slate-100 px-1 py-0.5 rounded text-xs">supabase secrets set</code> to configure:
          </p>
          <ul className="mt-3 space-y-1 text-sm text-slate-600">
            <li><code className="bg-slate-100 px-1 py-0.5 rounded text-xs">TWILIO_ACCOUNT_SID</code></li>
            <li><code className="bg-slate-100 px-1 py-0.5 rounded text-xs">TWILIO_AUTH_TOKEN</code></li>
            <li><code className="bg-slate-100 px-1 py-0.5 rounded text-xs">TWILIO_FROM_NUMBER</code></li>
          </ul>
        </div>
      )}
    </div>
  )
}
