import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { TidingsLogo } from '../components/icons/TidingsLogo'

interface InvitePreview {
  email: string
  role: string
  ward: string | null
  full_name: string | null
}

export default function InviteAccept() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()

  const [phase, setPhase] = useState<'loading' | 'ready' | 'no-session' | 'invalid'>('loading')
  const [preview, setPreview] = useState<InvitePreview | null>(null)
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function init() {
      if (!token) { setPhase('invalid'); return }
      // Give Supabase a moment to consume any auth tokens in the URL hash from
      // the magic link, then check whether we have a session.
      await new Promise((r) => setTimeout(r, 250))
      const { data: { session } } = await supabase.auth.getSession()

      // get_invite_preview is a SECURITY DEFINER RPC that returns email/role/ward/full_name
      // only for tokens that are pending (not accepted, not revoked, not expired). For any
      // other token it returns nothing, so we treat that as "invalid" without leaking which
      // failure mode it was.
      const { data: rows } = await supabase.rpc('get_invite_preview', { p_token: token })
      const inv = Array.isArray(rows) ? rows[0] : rows

      if (cancelled) return

      if (!inv) {
        setError('This invite link is no longer valid. It may have expired, been revoked, or already been used.')
        setPhase('invalid')
        return
      }

      setPreview({ email: inv.email, role: inv.role, ward: inv.ward, full_name: inv.full_name })
      setFullName(inv.full_name || '')

      if (!session) { setPhase('no-session'); return }
      if ((session.user.email || '').toLowerCase() !== (inv.email || '').toLowerCase()) {
        setError(`This invite was issued to ${inv.email} but you're signed in as ${session.user.email}. Click the invite link from the matching email inbox.`)
        setPhase('invalid')
        return
      }
      setPhase('ready')
    }
    init()
    return () => { cancelled = true }
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Use at least 8 characters'); return }

    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Session expired. Click the invite link from your email again.')

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/invite-accept`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ token, password, full_name: fullName }),
        }
      )
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Could not finish signup')

      // Force a fresh session/user load and bounce to the dashboard.
      await supabase.auth.refreshSession()
      navigate('/', { replace: true })
    } catch (err) {
      setError((err as Error).message)
    }
    setSubmitting(false)
  }

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Loading invite…</p>
      </div>
    )
  }

  if (phase === 'invalid') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-sm w-full bg-white rounded-md shadow p-6 text-center">
          <h1 className="text-lg font-semibold text-slate-900 mb-2">Invite not usable</h1>
          <p className="text-sm text-slate-600">{error || 'This invite link is no longer valid.'}</p>
        </div>
      </div>
    )
  }

  if (phase === 'no-session') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-sm w-full bg-white rounded-md shadow p-6 text-center space-y-3">
          <h1 className="text-lg font-semibold text-slate-900">Open from your email</h1>
          <p className="text-sm text-slate-600">
            For security reasons, this invite has to be opened from the link in the email we sent
            to <span className="font-medium">{preview?.email}</span>. Open that email on this device and
            tap the "Accept invite" button — it will bring you back here automatically.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-tidings-chrome px-6 pt-14 pb-24 text-white">
        <div className="max-w-sm mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <TidingsLogo size={44} />
            <div>
              <p className="text-lg font-semibold tracking-tight">Tidings</p>
              <p className="text-xs text-white/70">Two-Way SMS for Stakes</p>
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome — let's finish setup</h1>
        </div>
      </div>

      <div className="px-4 -mt-12 pb-10">
        <form onSubmit={handleSubmit} className="max-w-sm mx-auto bg-white rounded-md shadow-lg p-6 space-y-4">
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm">
            <p className="text-slate-900">
              You're being added as <span className="font-semibold capitalize">{preview?.role}</span>
              {preview?.ward && (<> in <span className="font-semibold">{preview.ward}</span></>)}.
            </p>
            <p className="text-xs text-slate-600 mt-1">{preview?.email}</p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
          )}

          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-slate-700 mb-1">
              Your name
            </label>
            <input
              id="full_name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="w-full px-3 py-2 border-[1.5px] border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-tidings-primary min-h-[44px]"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
              Choose a password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-3 py-2 border-[1.5px] border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-tidings-primary min-h-[44px]"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label htmlFor="confirm" className="block text-sm font-medium text-slate-700 mb-1">
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              className="w-full px-3 py-2 border-[1.5px] border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-tidings-primary min-h-[44px]"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-tidings-chrome hover:bg-slate-700 text-white font-medium rounded-md transition-colors disabled:opacity-50 min-h-[44px]"
          >
            {submitting ? 'Setting up…' : 'Create my account'}
          </button>
        </form>
      </div>
    </div>
  )
}
