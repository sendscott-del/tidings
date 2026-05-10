import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../i18n/LanguageContext'
import { supabase } from '../lib/supabase'
import type { TranslationKey } from '../i18n/translations'
import { TidingsLogo } from './icons/TidingsLogo'
import AppSwitcher from './AppSwitcher'
import { useDemoMode } from '../contexts/DemoModeContext'

interface NavItem {
  to: string
  labelKey: TranslationKey
  icon: string
}

const navItems: NavItem[] = [
  { to: '/', labelKey: 'nav.dashboard', icon: 'home' },
  { to: '/stake', labelKey: 'nav.stake', icon: 'users' },
  { to: '/community', labelKey: 'nav.community', icon: 'building' },
  { to: '/lists', labelKey: 'nav.lists', icon: 'list' },
  { to: '/compose', labelKey: 'nav.compose', icon: 'send' },
  { to: '/inbox', labelKey: 'nav.inbox', icon: 'inbox' },
  { to: '/history', labelKey: 'nav.history', icon: 'clock' },
]

const adminItem: NavItem = { to: '/admin', labelKey: 'nav.admin', icon: 'shield' }
// Tidings is on its own Supabase project, so it can't host /admin/gather
// directly (cross-project writes need additional plumbing). Steward hosts
// the canonical version; we open it in a new tab for super admins.
const GATHER_ADMIN_URL = 'https://stewards-indeed.vercel.app/admin/gather'

function NavIcon({ name, className }: { name: string; className?: string }) {
  const icons: Record<string, React.ReactNode> = {
    home: <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955a1.126 1.126 0 0 1 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />,
    users: <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />,
    building: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5M3.75 3v18m16.5-18v18M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" />,
    list: <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />,
    send: <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />,
    inbox: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 0 0-2.15-1.588H6.911a2.25 2.25 0 0 0-2.15 1.588L2.35 13.177a2.25 2.25 0 0 0-.1.661Z" />,
    clock: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />,
    shield: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" />,
  }
  return (
    <svg className={className || 'w-5 h-5'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      {icons[name]}
    </svg>
  )
}

export default function Layout() {
  const { appUser, signOut } = useAuth()
  const navigate = useNavigate()
  const { t, lang, setLang } = useLanguage()
  const { demoMode, setDemoMode } = useDemoMode()
  const [unreadInbox, setUnreadInbox] = useState(0)

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  useEffect(() => {
    if (!appUser?.id) return
    if (demoMode) {
      // Demo: hardcoded unread count matching the fixture inbox (2 unread).
      setUnreadInbox(2)
      return
    }
    let active = true
    async function fetchUnread() {
      const { count } = await supabase
        .from('inbound_messages')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null)
      if (active) setUnreadInbox(count ?? 0)
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 30000)
    function onFocus() { fetchUnread() }
    window.addEventListener('focus', onFocus)
    return () => { active = false; clearInterval(interval); window.removeEventListener('focus', onFocus) }
  }, [appUser?.id, demoMode])

  const items = appUser?.role === 'admin' ? [...navItems, adminItem] : navItems
  const badgeFor = (to: string) => (to === '/inbox' ? unreadInbox : 0)

  return (
    <div className="min-h-screen bg-slate-50">
      <AppSwitcher />
      {/* Per-app brand stripe — same amber the Gathered "T" chip uses,
          so Tidings's identity follows through into the chrome. */}
      <div className="h-[3px] w-full bg-tidings-primary" aria-hidden="true" />
      {/* Top bar */}
      <header className="bg-tidings-chrome text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <TidingsLogo size={32} />
            <span className="text-lg font-semibold tracking-tight">Tidings</span>
          </div>

          <div className="flex items-center gap-4">
            <Link
              to="/profile"
              className="text-sm text-slate-300 hover:text-white truncate max-w-[8rem] sm:max-w-none"
              title="My profile"
            >
              {appUser?.full_name || appUser?.email}
            </Link>
            <div className="flex items-center gap-1 text-xs">
              <button
                onClick={() => setLang('en')}
                className={`px-1.5 py-0.5 rounded ${lang === 'en' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                aria-label={t('menu.languageEnglish')}
                aria-pressed={lang === 'en'}
              >
                EN
              </button>
              <span className="text-slate-600">·</span>
              <button
                onClick={() => setLang('es')}
                className={`px-1.5 py-0.5 rounded ${lang === 'es' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                aria-label={t('menu.languageSpanish')}
                aria-pressed={lang === 'es'}
              >
                ES
              </button>
            </div>
            {appUser?.role === 'admin' && (
              <a
                href={GATHER_ADMIN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded border border-slate-600 text-slate-400 hover:text-white"
                title="Manage user access across all Gather apps (opens in Steward)"
              >
                Gather
              </a>
            )}
            <button
              type="button"
              onClick={() => setDemoMode(!demoMode)}
              className={`text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded border ${demoMode ? 'border-amber-300 text-amber-300' : 'border-slate-600 text-slate-400 hover:text-white'}`}
              title={demoMode ? 'Demo mode is on — click to exit' : 'Enable demo mode'}
            >
              Demo
            </button>
            <button
              onClick={handleSignOut}
              className="text-sm text-slate-400 hover:text-white transition-colors"
            >
              {t('nav.signOut')}
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <nav className="w-56 min-h-[calc(100vh-3.5rem)] bg-white border-r border-slate-200 hidden md:block">
          <ul className="py-4 space-y-0.5">
            {items.map((item) => {
              const badge = badgeFor(item.to)
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                        isActive
                          ? 'text-slate-900 bg-slate-100 border-r-2 border-amber-500'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`
                    }
                  >
                    <NavIcon name={item.icon} />
                    <span className="flex-1">{t(item.labelKey)}</span>
                    {badge > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-semibold">
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Mobile bottom nav */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 md:hidden z-50">
          <ul className="flex justify-around py-2">
            {items.slice(0, 6).map((item) => {
              const badge = badgeFor(item.to)
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      `flex flex-col items-center gap-0.5 text-xs relative ${
                        isActive ? 'text-amber-600' : 'text-slate-400'
                      }`
                    }
                  >
                    <div className="relative">
                      <NavIcon name={item.icon} />
                      {badge > 0 && (
                        <span className="absolute -top-1 -right-2 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold">
                          {badge > 9 ? '9+' : badge}
                        </span>
                      )}
                    </div>
                    {t(item.labelKey)}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Main content */}
        <main className="flex-1 p-6 pb-20 md:pb-6">
          <div className="max-w-5xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
