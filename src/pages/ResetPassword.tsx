import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../i18n/LanguageContext'
import { TidingsLogo } from '../components/icons/TidingsLogo'

export default function ResetPassword() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError(t('auth.passwordsNoMatch'))
      return
    }
    if (password.length < 6) {
      setError(t('auth.passwordTooShort'))
      return
    }
    setSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSubmitting(false)
    if (error) setError(error.message)
    else navigate('/', { replace: true })
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
          <h1 className="text-3xl font-bold tracking-tight">{t('auth.chooseNewPassword')}</h1>
        </div>
      </div>

      <div className="px-4 -mt-12 pb-10">
        <div className="max-w-sm mx-auto bg-white rounded-2xl shadow-lg p-6">
          {!ready ? (
            <p className="text-sm text-slate-600">{t('auth.resetGateOnly')}</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                  {t('auth.newPassword')}
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-tidings-primary min-h-[44px]"
                />
              </div>
              <div>
                <label htmlFor="confirm" className="block text-sm font-medium text-slate-700 mb-1">
                  {t('auth.confirmPassword')}
                </label>
                <input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-tidings-primary min-h-[44px]"
                />
              </div>
              {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-tidings-chrome hover:bg-slate-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 min-h-[44px]"
              >
                {submitting ? t('auth.saving') : t('auth.updatePassword')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
