import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../i18n/LanguageContext'
import { TidingsLogo } from '../components/icons/TidingsLogo'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const { t, lang, setLang } = useLanguage()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const { error } = await signIn(email, password)
    if (error) {
      setError(t('auth.invalidCredentials'))
      setSubmitting(false)
    } else {
      navigate('/', { replace: true })
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navy hero band */}
      <div className="bg-tidings-chrome px-6 pt-14 pb-24 text-white">
        <div className="max-w-sm mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <TidingsLogo size={44} />
            <div>
              <p className="text-lg font-semibold tracking-tight">Tidings</p>
              <p className="text-xs text-white/70">Two-Way SMS for Stakes</p>
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{t('auth.signInTitle')}</h1>
        </div>
      </div>

      {/* Form card overlapping the hero */}
      <div className="px-4 -mt-12 pb-10">
        <form onSubmit={handleSubmit} className="max-w-sm mx-auto bg-white rounded-2xl shadow-lg p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
              {t('auth.email')}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-tidings-primary focus:border-transparent"
              placeholder={t('auth.emailPlaceholder')}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
              {t('auth.password')}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-tidings-primary focus:border-transparent"
              placeholder={t('auth.passwordPlaceholder')}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-tidings-chrome hover:bg-slate-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? t('auth.signingIn') : t('auth.signIn')}
          </button>

          {/* Language toggle */}
          <div className="flex justify-center gap-1 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-4 py-1 text-xs rounded-full font-semibold transition-colors ${
                lang === 'en' ? 'bg-amber-50 text-tidings-primary-dark' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => setLang('es')}
              className={`px-4 py-1 text-xs rounded-full font-semibold transition-colors ${
                lang === 'es' ? 'bg-amber-50 text-tidings-primary-dark' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Español
            </button>
          </div>
        </form>

        <p className="text-center text-slate-500 text-xs mt-6">
          &ldquo;Glad tidings of great joy&rdquo; — Luke 2:10
        </p>
      </div>
    </div>
  )
}
