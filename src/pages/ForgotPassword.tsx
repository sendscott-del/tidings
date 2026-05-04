import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../i18n/LanguageContext'
import { TidingsLogo } from '../components/icons/TidingsLogo'

export default function ForgotPassword() {
  const { t, lang, setLang } = useLanguage()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/reset-password`
        : undefined
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) setError(error.message)
    else setSent(true)
    setSubmitting(false)
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
          <h1 className="text-3xl font-bold tracking-tight">{t('auth.resetTitle')}</h1>
        </div>
      </div>

      <div className="px-4 -mt-12 pb-10">
        <div className="max-w-sm mx-auto bg-white rounded-md shadow-lg p-6 space-y-4">
          {sent ? (
            <>
              <p className="text-sm text-slate-700">{t('auth.resetSent')}</p>
              <Link
                to="/login"
                className="block w-full text-center py-2.5 bg-tidings-chrome hover:bg-slate-700 text-white rounded-lg text-sm font-medium min-h-[44px] flex items-center justify-center"
              >
                {t('auth.backToSignIn')}
              </Link>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-slate-600">{t('auth.resetIntro')}</p>
              {error && (
                <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
              )}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                  {t('auth.email')}
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border-[1.5px] border-slate-300 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-tidings-primary focus:border-transparent min-h-[44px]"
                  placeholder={t('auth.emailPlaceholder')}
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-tidings-chrome hover:bg-slate-700 text-white font-medium rounded-md transition-colors disabled:opacity-50 min-h-[44px]"
              >
                {submitting ? t('auth.sending') : t('auth.sendResetLink')}
              </button>
              <p className="text-center text-sm text-slate-500">
                <Link to="/login" className="text-tidings-primary-dark font-medium hover:underline">
                  {t('auth.backToSignIn')}
                </Link>
              </p>
            </form>
          )}

          <div className="flex justify-center gap-1 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-4 py-1 text-xs rounded-full font-semibold ${
                lang === 'en' ? 'bg-amber-50 text-tidings-primary-dark' : 'text-slate-400'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLang('es')}
              className={`px-4 py-1 text-xs rounded-full font-semibold ${
                lang === 'es' ? 'bg-amber-50 text-tidings-primary-dark' : 'text-slate-400'
              }`}
            >
              Español
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
