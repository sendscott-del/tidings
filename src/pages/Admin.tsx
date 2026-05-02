import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

interface AppUser {
  id: string
  email: string
  full_name: string
  role: string
  permissions: Record<string, any>
  signature: string | null
  ward: string | null
}

interface WardBudget {
  ward_name: string
  budget_cents: number
  used_cents: number
  remaining_cents: number
  quarter_end: string
}

const SIGNATURE_PRESETS = [
  '— Sent by Chicago Stake',
  '— Sent by the Stake Presidency',
  '— Sent by the Bishopric',
  '— Sent by the Elders Quorum Presidency',
  '— Sent by the Relief Society Presidency',
  '— Sent by the Young Men Presidency',
  '— Sent by the Young Women Presidency',
  '— Sent by the Primary Presidency',
]

export default function Admin() {
  const { appUser } = useAuth()
  const [tab, setTab] = useState<'users' | 'budgets' | 'settings'>('users')
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState<AppUser | null>(null)
  const [form, setForm] = useState({ email: '', full_name: '', password: '', role: 'viewer', can_text_stake: true, can_text_community: false, signature: '', ward: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [wardOptions, setWardOptions] = useState<string[]>([])
  const [budgets, setBudgets] = useState<WardBudget[]>([])
  const [budgetsLoading, setBudgetsLoading] = useState(false)
  const [budgetEdits, setBudgetEdits] = useState<Record<string, string>>({})

  useEffect(() => { loadUsers(); loadWardOptions() }, [])
  useEffect(() => { if (tab === 'budgets') loadBudgets() }, [tab])

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

  async function loadWardOptions() {
    const { data } = await supabase.from('ward_budgets').select('ward_name').order('ward_name')
    setWardOptions((data || []).map((r: { ward_name: string }) => r.ward_name))
  }

  async function loadBudgets() {
    setBudgetsLoading(true)
    const { data: rows } = await supabase.from('ward_budgets').select('*').order('ward_name')
    const result: WardBudget[] = []
    for (const row of rows || []) {
      const { data: status } = await supabase.rpc('get_ward_budget_status', { p_ward: row.ward_name })
      const s = Array.isArray(status) ? status[0] : status
      result.push({
        ward_name: row.ward_name,
        budget_cents: row.budget_cents,
        used_cents: Number(s?.used_cents ?? 0),
        remaining_cents: Number(s?.remaining_cents ?? 0),
        quarter_end: s?.quarter_end ?? '',
      })
    }
    setBudgets(result)
    setBudgetEdits({})
    setBudgetsLoading(false)
  }

  async function saveBudget(wardName: string) {
    const raw = budgetEdits[wardName]
    if (raw === undefined) return
    const dollars = parseFloat(raw)
    if (isNaN(dollars) || dollars < 0) {
      setError('Budget must be a number ≥ 0')
      return
    }
    const cents = Math.round(dollars * 100)
    await supabase.from('ward_budgets').update({
      budget_cents: cents,
      updated_at: new Date().toISOString(),
    }).eq('ward_name', wardName)
    loadBudgets()
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
          signature: form.signature.trim() || null,
          ward: form.ward || null,
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
              signature: form.signature.trim() || null,
              ward: form.ward || null,
            }),
          }
        )
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Failed to create user')
      }

      setShowForm(false)
      setEditingUser(null)
      setForm({ email: '', full_name: '', password: '', role: 'viewer', can_text_stake: true, can_text_community: false, signature: '', ward: '' })
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
      signature: u.signature || '',
      ward: u.ward || '',
    })
    setShowForm(true)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Admin</h1>
        <div className="flex bg-slate-100 rounded-lg p-0.5">
          {(['users', 'budgets', 'settings'] as const).map((t) => (
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
            setForm({ email: '', full_name: '', password: '', role: 'viewer', can_text_stake: true, can_text_community: false, signature: '', ward: '' })
            setShowForm(true)
          }} className="mb-4 px-4 py-2 bg-tidings-chrome text-white text-sm font-medium rounded-lg hover:bg-slate-700">
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
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Ward (budget pool this user draws from)
                </label>
                <select value={form.ward} onChange={(e) => setForm({ ...form, ward: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900">
                  <option value="">— Not assigned (cannot send) —</option>
                  {wardOptions.map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Senders must be assigned to a ward. Use "Stake" for stake-level senders.
                </p>
              </div>
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
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-600">
                  Signature (appended to every message this user sends)
                </label>
                <textarea
                  placeholder="e.g. — Sent by the Bishopric"
                  value={form.signature}
                  onChange={(e) => setForm({ ...form, signature: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900"
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {SIGNATURE_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setForm({ ...form, signature: preset })}
                      className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded"
                    >
                      {preset.replace('— Sent by ', '')}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500">
                  Leave blank for no signature. Two newlines are added automatically before the signature.
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={saveUser} disabled={saving || (!editingUser && (!form.email || !form.password))}
                  className="px-4 py-2 bg-tidings-chrome text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50">
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
                    <th className="text-left px-4 py-3 font-medium text-slate-600 hidden md:table-cell">Ward</th>
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
                      <td className="px-4 py-3 text-slate-600 hidden md:table-cell">
                        {u.ward || <span className="text-amber-600 text-xs">— not set —</span>}
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

      {tab === 'budgets' && (
        <div>
          <div className="bg-blue-50 border border-blue-200 text-blue-900 text-sm rounded-lg px-4 py-3 mb-4">
            Each ward has a quarterly SMS budget in dollars. Usage is computed live from sent messages and
            <strong> resets automatically on Jan 1, Apr 1, Jul 1, and Oct 1</strong>. Senders can't send when their ward is at 100%.
          </div>
          {budgetsLoading ? (
            <p className="text-slate-400 text-center py-8">Loading budgets...</p>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-3 font-medium text-slate-600">Ward</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Quarter Cap</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600 hidden sm:table-cell">Used</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Remaining</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">Save</th>
                  </tr>
                </thead>
                <tbody>
                  {budgets.map((b) => {
                    const editValue = budgetEdits[b.ward_name] ?? (b.budget_cents / 100).toFixed(2)
                    const pctUsed = b.budget_cents > 0 ? (b.used_cents / b.budget_cents) * 100 : 0
                    const remainingClass =
                      pctUsed >= 100 ? 'text-red-600 font-semibold' :
                      pctUsed >= 95 ? 'text-red-600' :
                      pctUsed >= 80 ? 'text-amber-600' :
                      'text-slate-700'
                    return (
                      <tr key={b.ward_name} className="border-b border-slate-100">
                        <td className="px-4 py-3 text-slate-900 font-medium">{b.ward_name}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <span className="text-slate-400 text-xs">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.25"
                              value={editValue}
                              onChange={(e) => setBudgetEdits({ ...budgetEdits, [b.ward_name]: e.target.value })}
                              className="w-20 px-2 py-1 border border-slate-300 rounded text-sm text-right text-slate-900"
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600 hidden sm:table-cell">
                          ${(b.used_cents / 100).toFixed(2)}
                          <span className="text-xs text-slate-400 ml-1">({pctUsed.toFixed(0)}%)</span>
                        </td>
                        <td className={`px-4 py-3 text-right ${remainingClass}`}>
                          ${(Math.max(0, b.remaining_cents) / 100).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {budgetEdits[b.ward_name] !== undefined &&
                            budgetEdits[b.ward_name] !== (b.budget_cents / 100).toFixed(2) && (
                            <button
                              onClick={() => saveBudget(b.ward_name)}
                              className="px-3 py-1 bg-tidings-chrome text-white text-xs font-medium rounded hover:bg-slate-700"
                            >
                              Save
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {budgets[0]?.quarter_end && (
                <div className="px-4 py-3 bg-slate-50 text-xs text-slate-500 border-t border-slate-100">
                  Current quarter resets on {new Date(budgets[0].quarter_end).toLocaleDateString()}.
                </div>
              )}
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
