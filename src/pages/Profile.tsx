import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

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

export default function Profile() {
  const { appUser, refreshAppUser } = useAuth()
  const { toast } = useToast()

  const [fullName, setFullName] = useState('')
  const [signature, setSignature] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  const [newEmail, setNewEmail] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    setFullName(appUser?.full_name || '')
    setSignature(appUser?.signature || '')
  }, [appUser?.id])

  const profileDirty =
    (fullName.trim() !== (appUser?.full_name || '')) ||
    (signature.trim() !== (appUser?.signature || ''))

  async function saveProfile() {
    setSavingProfile(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/profile-update`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ full_name: fullName, signature }),
        }
      )
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Could not save profile')
      await refreshAppUser()
      toast('Profile saved', 'success')
    } catch (err) {
      toast((err as Error).message, 'error')
    }
    setSavingProfile(false)
  }

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault()
    setSavingEmail(true)
    try {
      const target = newEmail.trim().toLowerCase()
      if (!target.includes('@')) throw new Error('Enter a valid email')
      if (target === (appUser?.email || '').toLowerCase()) throw new Error('That is already your email')
      const { error } = await supabase.auth.updateUser({ email: target })
      if (error) throw error
      toast(`Confirmation link sent to ${target}. Click it to finish the change.`, 'success')
      setNewEmail('')
    } catch (err) {
      toast((err as Error).message, 'error')
    }
    setSavingEmail(false)
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    setSavingPassword(true)
    try {
      if (newPassword !== confirmPassword) throw new Error('Passwords do not match')
      if (newPassword.length < 8) throw new Error('Use at least 8 characters')
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      toast('Password updated', 'success')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      toast((err as Error).message, 'error')
    }
    setSavingPassword(false)
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">My Profile</h1>

      {/* Read-only access summary so users understand what role they have */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm">
        <div className="grid grid-cols-2 gap-y-1">
          <span className="text-slate-500">Role</span>
          <span className="text-slate-900 font-medium capitalize">{appUser?.role}</span>
          <span className="text-slate-500">Ward</span>
          <span className="text-slate-900 font-medium">{appUser?.ward || <span className="text-amber-600">— not set —</span>}</span>
          <span className="text-slate-500">Email</span>
          <span className="text-slate-900 font-medium break-all">{appUser?.email}</span>
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Role and ward are managed by your admin. Reach out if you think they need to change.
        </p>
      </div>

      {/* Name + signature (the user-managed bits) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <h2 className="text-base font-medium text-slate-900">Name & signature</h2>

        <div>
          <label htmlFor="full_name" className="block text-xs font-medium text-slate-600 mb-1">Display name</label>
          <input
            id="full_name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-tidings-primary"
          />
        </div>

        <div>
          <label htmlFor="signature" className="block text-xs font-medium text-slate-600 mb-1">
            Signature (appended to every text you send)
          </label>
          <textarea
            id="signature"
            rows={2}
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="e.g. — Sent by the Bishopric"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-tidings-primary"
          />
          <div className="flex flex-wrap gap-1.5 pt-2">
            {SIGNATURE_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setSignature(preset)}
                className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded"
              >
                {preset.replace('— Sent by ', '')}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Leave blank for no signature. Two newlines are added automatically before the signature.
          </p>
        </div>

        <button
          onClick={saveProfile}
          disabled={!profileDirty || savingProfile}
          className="px-4 py-2 bg-tidings-chrome text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50"
        >
          {savingProfile ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* Email change */}
      <form onSubmit={changeEmail} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <h2 className="text-base font-medium text-slate-900">Change email</h2>
        <p className="text-xs text-slate-500">
          We'll send a confirmation link to your new address. The change takes effect once you click that link.
          Until then, you keep signing in with your current email.
        </p>
        <input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="new-email@example.com"
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-tidings-primary"
        />
        <button
          type="submit"
          disabled={savingEmail || !newEmail.trim()}
          className="px-4 py-2 bg-tidings-chrome text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50"
        >
          {savingEmail ? 'Sending…' : 'Send confirmation link'}
        </button>
      </form>

      {/* Password change */}
      <form onSubmit={changePassword} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <h2 className="text-base font-medium text-slate-900">Change password</h2>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New password (8+ characters)"
          minLength={8}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-tidings-primary"
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm new password"
          minLength={8}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-tidings-primary"
        />
        <button
          type="submit"
          disabled={savingPassword || !newPassword || !confirmPassword}
          className="px-4 py-2 bg-tidings-chrome text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50"
        >
          {savingPassword ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </div>
  )
}
