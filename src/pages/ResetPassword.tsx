import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../i18n/LanguageContext'
import { TidingsLogo } from '../components/icons/TidingsLogo'

export default function ResetPassword() {
  const navigate = useNavigate()
  const { lang } = useLanguage()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session))
  }, [])

  const t = (en: string, es: string) => (lang === 'es' ? es : en)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError(t('Passwords do not match.', 'Las contraseñas no coinciden.'))
      return
    }
    if (password.length < 6) {
      setError(t('Password must be at least 6 characters.', 'La contraseña debe tener al menos 6 caracteres.'))
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
          <h1 className="text-3xl font-bold tracking-tight">
            {t('Choose a new password', 'Elige una nueva contraseña')}
          </h1>
        </div>
      </div>

      <div className="px-4 -mt-12 pb-10">
        <div className="max-w-sm mx-auto bg-white rounded-2xl shadow-lg p-6">
          {!ready ? (
            <p className="text-sm text-slate-600">
              {t(
                "This page only works from a password reset email link. Please use the link sent to your inbox.",
                "Esta página solo funciona desde el enlace que recibiste por correo."
              )}
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
                  {t('New password', 'Nueva contraseña')}
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-tidings-primary"
                />
              </div>
              <div>
                <label htmlFor="confirm" className="block text-sm font-medium text-slate-700 mb-1">
                  {t('Confirm password', 'Confirmar contraseña')}
                </label>
                <input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-tidings-primary"
                />
              </div>
              {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-tidings-chrome hover:bg-slate-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {submitting ? t('Saving…', 'Guardando…') : t('Update password', 'Actualizar contraseña')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
