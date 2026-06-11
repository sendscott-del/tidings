import { Fragment, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useDemoMode } from '../contexts/DemoModeContext'

interface RateRow {
  channel: 'sms' | 'mms'
  cents_per_unit: string | number
  source: string
  sample_size: number | null
  computed_at: string
  notes: string | null
}

interface AppUser {
  id: string
  email: string
  full_name: string
  role: string
  permissions: Record<string, any>
  signature: string | null
  ward: string | null
}

interface PendingInvite {
  id: string
  email: string
  full_name: string | null
  role: string
  ward: string | null
  permissions: Record<string, any>
  signature: string | null
  token: string
  expires_at: string
  created_at: string
}

interface WardBudget {
  ward_name: string
  budget_cents: number
  used_cents: number
  remaining_cents: number
  quarter_end: string
}

// Gather hub — the single place user access is managed for all five Gathered apps.
const GATHER_URL = 'https://gather.gatheredin.app/gather'

// The 19-role suite catalog (mirrors public.gather_roles_catalog on the shared
// project). Used by Glean, Knit, Magnify, Steward and Tidings to derive per-app
// access. Tidings stores its own copy of assignments in `tidings_user_roles`
// for fast RLS; a follow-up release will sync that mirror up to the shared
// `gather_user_roles` so the other apps see grants made in Tidings.
type SuiteRoleScope = 'stake' | 'ward'
interface SuiteRole {
  key: string
  label: string
  scope: SuiteRoleScope
}
const SUITE_ROLES: SuiteRole[] = [
  { key: 'stake_president',           label: 'Stake President',                          scope: 'stake' },
  { key: 'stake_clerk',                label: 'Stake Clerk',                              scope: 'stake' },
  { key: 'sp_1st_counselor',           label: 'Stake Presidency 1st Counselor',           scope: 'stake' },
  { key: 'sp_2nd_counselor',           label: 'Stake Presidency 2nd Counselor',           scope: 'stake' },
  { key: 'stake_exec_secretary',       label: 'Stake Executive Secretary',                scope: 'stake' },
  { key: 'high_councilor',             label: 'High Councilor',                           scope: 'stake' },
  { key: 'hc_missionary_work',         label: 'High Councilor — Missionary Work',         scope: 'stake' },
  { key: 'hc_welfare_self_reliance',   label: 'High Councilor — Welfare & Self Reliance', scope: 'stake' },
  { key: 'community_events_leader',    label: 'Community Events Leader',                  scope: 'stake' },
  { key: 'stake_council',              label: 'Stake Council',                            scope: 'stake' },
  { key: 'bishop',                     label: 'Bishop',                                   scope: 'ward'  },
  { key: 'bishopric_1st_counselor',    label: 'Bishopric 1st Counselor',                  scope: 'ward'  },
  { key: 'bishopric_2nd_counselor',    label: 'Bishopric 2nd Counselor',                  scope: 'ward'  },
  { key: 'ward_clerk',                 label: 'Ward Clerk',                               scope: 'ward'  },
  { key: 'ward_exec_secretary',        label: 'Ward Executive Secretary',                 scope: 'ward'  },
  { key: 'ward_council',               label: 'Ward Council',                             scope: 'ward'  },
  { key: 'ward_org_presidency',        label: 'Ward Organization Presidency',             scope: 'ward'  },
  { key: 'ward_mission_leader',        label: 'Ward Mission Leader',                      scope: 'ward'  },
  { key: 'ward_member',                label: 'Ward Member',                              scope: 'ward'  },
]

export default function Admin() {
  const { appUser } = useAuth()
  const { toast } = useToast()
  const { demoMode, setDemoMode } = useDemoMode()
  const [tab, setTab] = useState<'users' | 'budgets' | 'settings'>('users')
  const [users, setUsers] = useState<AppUser[]>([])
  const [invites, setInvites] = useState<PendingInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [budgets, setBudgets] = useState<WardBudget[]>([])
  const [budgetsLoading, setBudgetsLoading] = useState(false)
  const [budgetEdits, setBudgetEdits] = useState<Record<string, string>>({})
  const [rates, setRates] = useState<{ sms: RateRow | null; mms: RateRow | null }>({ sms: null, mms: null })
  const [ratesLoading, setRatesLoading] = useState(false)
  const [refreshingRates, setRefreshingRates] = useState(false)
  const [historyOpenFor, setHistoryOpenFor] = useState<string | null>(null)
  const [historyData, setHistoryData] = useState<Record<string, { quarter_label: string; used_cents: number }[]>>({})

  // Suite-role assignments: read-only per-user mirror of public.tidings_user_roles.
  // Assignments are managed in Gather; Tidings only displays them.
  const [userRolesByUserId, setUserRolesByUserId] = useState<Record<string, Array<{ role_key: string; ward: string | null }>>>({})

  useEffect(() => { loadUsers(); loadInvites(); loadUserRolesMap() }, [])
  useEffect(() => { if (tab === 'budgets') loadBudgets() }, [tab])
  useEffect(() => { if (tab === 'settings') loadRates() }, [tab])

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

  async function loadInvites() {
    const { data } = await supabase
      .from('tidings_invites')
      .select('*')
      .is('accepted_at', null)
      .is('revoked_at', null)
      .order('created_at', { ascending: false })
    setInvites(data || [])
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

  async function loadRates() {
    setRatesLoading(true)
    const { data } = await supabase
      .from('tidings_rate_cache')
      .select('channel, cents_per_unit, source, sample_size, computed_at, notes')
      .eq('country', 'US')
      .in('channel', ['sms', 'mms'])
      .order('computed_at', { ascending: false })
      .limit(20)
    const rows = (data || []) as RateRow[]
    setRates({
      sms: rows.find((r) => r.channel === 'sms') ?? null,
      mms: rows.find((r) => r.channel === 'mms') ?? null,
    })
    setRatesLoading(false)
  }

  async function refreshRatesNow() {
    setRefreshingRates(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/refresh-twilio-rates`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: '{}',
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`)
      const skipped = (body?.results || []).filter((r: { skipped_reason?: string }) => r.skipped_reason)
      if (skipped.length) {
        toast(`Refreshed with notes: ${skipped.map((r: { channel: string; skipped_reason: string }) => `${r.channel} ${r.skipped_reason}`).join('; ')}`, 'success')
      } else {
        toast('Rates refreshed from Twilio Usage Records', 'success')
      }
      await loadRates()
    } catch (err) {
      toast((err as Error).message, 'error')
    } finally {
      setRefreshingRates(false)
    }
  }

  async function toggleHistory(wardName: string) {
    if (historyOpenFor === wardName) {
      setHistoryOpenFor(null)
      return
    }
    setHistoryOpenFor(wardName)
    if (!historyData[wardName]) {
      const { data } = await supabase.rpc('get_ward_usage_history', { p_ward: wardName, p_quarters_back: 4 })
      setHistoryData((prev) => ({
        ...prev,
        [wardName]: (data || []).map((r: any) => ({
          quarter_label: r.quarter_label,
          used_cents: Number(r.used_cents ?? 0),
        })),
      }))
    }
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

  async function loadUserRolesMap() {
    const { data } = await supabase.from('tidings_user_roles').select('user_id, role_key, ward')
    const map: Record<string, Array<{ role_key: string; ward: string | null }>> = {}
    for (const row of (data || []) as Array<{ user_id: string; role_key: string; ward: string | null }>) {
      if (!map[row.user_id]) map[row.user_id] = []
      map[row.user_id].push({ role_key: row.role_key, ward: row.ward })
    }
    setUserRolesByUserId(map)
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
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-blue-900">User access is managed in Gather</p>
              <p className="text-xs text-blue-800 mt-0.5">
                Invites, roles, permissions, and removals for all five Gathered apps happen in the Gather hub.
                This page is read-only.
              </p>
            </div>
            <a
              href={GATHER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-tidings-chrome text-white text-sm font-medium rounded-lg hover:bg-yellow-800 whitespace-nowrap text-center"
            >
              Open Gather
            </a>
          </div>

          {invites.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-4">
              <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-200 text-xs font-medium text-amber-900">
                Pending invites ({invites.length})
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left px-4 py-2 font-medium text-slate-600">Email</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-600">Role</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-600 hidden sm:table-cell">Ward</th>
                    <th className="text-left px-4 py-2 font-medium text-slate-600 hidden md:table-cell">Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map((inv) => (
                    <tr key={inv.id} className="border-b border-slate-100">
                      <td className="px-4 py-2.5 text-slate-900 break-all">{inv.email}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">{inv.role}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 hidden sm:table-cell">{inv.ward || '—'}</td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs hidden md:table-cell">
                        {new Date(inv.expires_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const roles = userRolesByUserId[u.id] ?? []
                    return (
                      <Fragment key={u.id}>
                        <tr className="border-b-0">
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
                        </tr>
                        <tr className="border-b border-slate-100">
                          <td colSpan={4} className="px-4 pb-3 pt-0">
                            <div className="flex flex-wrap gap-1">
                              {u.permissions?.can_text_stake && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200">Can text stake</span>
                              )}
                              {u.permissions?.can_text_community && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200">Can text community</span>
                              )}
                              {roles.map((r) => {
                                const def = SUITE_ROLES.find((s) => s.key === r.role_key)
                                if (!def) return null
                                return (
                                  <span
                                    key={`${r.role_key}-${r.ward ?? ''}`}
                                    className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200"
                                  >
                                    {def.label}{r.ward ? ` · ${r.ward}` : ''}
                                  </span>
                                )
                              })}
                            </div>
                          </td>
                        </tr>
                      </Fragment>
                    )
                  })}
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
          {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}
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
                    const history = historyData[b.ward_name] || []
                    return (
                      <Fragment key={b.ward_name}>
                        <tr className="border-b border-slate-100">
                          <td className="px-4 py-3 text-slate-900 font-medium">
                            <button
                              onClick={() => toggleHistory(b.ward_name)}
                              className="inline-flex items-center gap-1 hover:text-slate-700"
                              title="Show / hide quarterly history"
                            >
                              <span className={`inline-block w-3 text-slate-400 transition-transform ${historyOpenFor === b.ward_name ? 'rotate-90' : ''}`}>▸</span>
                              {b.ward_name}
                            </button>
                          </td>
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
                                className="px-3 py-1 bg-tidings-chrome text-white text-xs font-medium rounded hover:bg-yellow-800"
                              >
                                Save
                              </button>
                            )}
                          </td>
                        </tr>
                        {historyOpenFor === b.ward_name && (
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <td colSpan={5} className="px-4 py-3">
                              <p className="text-xs font-medium text-slate-500 mb-2">Quarterly history (last 4 quarters, oldest right)</p>
                              {history.length === 0 ? (
                                <p className="text-xs text-slate-400">Loading…</p>
                              ) : (
                                <div className="flex gap-3 items-end">
                                  {[...history].reverse().map((h) => {
                                    const dollars = h.used_cents / 100
                                    const pct = b.budget_cents > 0 ? Math.min(100, (h.used_cents / b.budget_cents) * 100) : 0
                                    return (
                                      <div key={h.quarter_label} className="flex flex-col items-center text-center min-w-16">
                                        <div className="h-16 w-8 bg-slate-200 rounded relative overflow-hidden flex items-end">
                                          <div className="w-full bg-slate-500" style={{ height: `${pct}%` }} />
                                        </div>
                                        <span className="text-xs text-slate-700 font-medium mt-1">${dollars.toFixed(2)}</span>
                                        <span className="text-[10px] text-slate-500">{h.quarter_label}</span>
                                      </div>
                                    )
                                  })}
                                  <p className="text-[11px] text-slate-400 ml-2 self-center">
                                    Bars are scaled to the current cap (${(b.budget_cents / 100).toFixed(2)}).
                                  </p>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
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
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-medium text-slate-900">Demo mode</h2>
                <p className="text-sm text-slate-500 mt-1">
                  When demo mode is on, Tidings runs against in-memory fixtures
                  instead of the live Twilio + Supabase stack. Use it to walk
                  someone through the app without sending real messages.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDemoMode(!demoMode)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium border whitespace-nowrap ${
                  demoMode
                    ? 'border-amber-400 bg-amber-50 text-amber-800'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {demoMode ? 'Exit demo mode' : 'Enable demo mode'}
              </button>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="text-lg font-medium text-slate-900">SMS & MMS rates</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Per-unit costs used by the Compose preview and the ward-budget ledger.
                  Refreshed daily from Twilio Usage Records (last 30 days), so the rate
                  reflects what Twilio actually billed including 10DLC carrier fees.
                </p>
              </div>
              <button
                type="button"
                onClick={refreshRatesNow}
                disabled={refreshingRates}
                className="px-3 py-1.5 rounded-md text-sm font-medium border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
              >
                {refreshingRates ? 'Refreshing…' : 'Refresh now'}
              </button>
            </div>
            {ratesLoading ? (
              <p className="text-slate-400 text-sm py-3">Loading rates…</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(['sms', 'mms'] as const).map((channel) => {
                  const row = rates[channel]
                  return (
                    <div key={channel} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          {channel} {channel === 'sms' ? '(per segment)' : '(per message)'}
                        </span>
                        <span className="text-lg font-semibold text-slate-900">
                          {row ? `${Number(row.cents_per_unit).toFixed(4)}¢` : '—'}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500 space-y-0.5">
                        <div>Source: {row?.source ?? 'no data'}</div>
                        {row?.sample_size != null && <div>Sample: {row.sample_size} messages</div>}
                        {row?.computed_at && (
                          <div>Updated: {new Date(row.computed_at).toLocaleString()}</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-6">
            <h2 className="text-lg font-medium text-slate-900 mb-4">Twilio configuration</h2>
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
        </div>
      )}
    </div>
  )
}
