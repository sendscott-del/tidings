import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../i18n/LanguageContext'
import { supabase } from '../lib/supabase'
import type { TranslationKey } from '../i18n/translations'
import { TidingsLogo } from './icons/TidingsLogo'
import { NavIcon } from './icons/NavIcon'
import AppSwitcher from './AppSwitcher'
import SuggestionFAB from './SuggestionFAB'
import MobileTabBar from './MobileTabBar'
import MoreSheet from './MoreSheet'

interface NavItem {
  to: string
  labelKey: TranslationKey
  icon: string
}

// Desktop sidebar still shows the full list — the mobile bottom-tab
// version (MobileTabBar) is the one that's pared down to five.
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
// Gather is the canonical cross-app user-access page. It lives in its own
// standalone deployment at gathered-admin-neon.vercel.app — one host for all
// five Gathered apps. (Previously lived in Glean, before that in Steward.)
const GATHER_ADMIN_URL = 'https://gather.gatheredin.app/gather'

export default function Layout() {
  const { appUser, signOut } = useAuth()
  const navigate = useNavigate()
  const { t, lang, setLang } = useLanguage()
  const [unreadInbox, setUnreadInbox] = useState(0)
  const [moreOpen, setMoreOpen] = useState(false)
  const [suggestOpen, setSuggestOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  useEffect(() => {
    if (!appUser?.id) return
    let active = true
    async function fetchUnread() {
      if (document.hidden) return
      const { count } = await supabase
        .from('inbound_messages')
        .select('id', { count: 'exact', head: true })
        .is('read_by', null)
      if (active) setUnreadInbox(count ?? 0)
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 30000)
    function onFocus() { fetchUnread() }
    document.addEventListener('visibilitychange', fetchUnread)
    window.addEventListener('focus', onFocus)
    return () => {
      active = false
      clearInterval(interval)
      document.removeEventListener('visibilitychange', fetchUnread)
      window.removeEventListener('focus', onFocus)
    }
  }, [appUser?.id])

  const items = appUser?.role === 'admin' ? [...navItems, adminItem] : navItems
  const badgeFor = (to: string) => (to === '/inbox' ? unreadInbox : 0)
  const scripture = t('app.scripture')
  const scriptureRef = t('app.scriptureRef')

  return (
    <div className="min-h-screen bg-slate-50">
      <AppSwitcher />
      {/* Per-app brand stripe — same amber the Gathered "T" chip uses. */}
      <div className="h-[3px] w-full bg-tidings-primary" aria-hidden="true" />

      {/* Suite-wide top sub-bar: scripture (left) + EN/ES + profile + sign out
          on the right. Sticky on mobile so the language switch + sign-out stay
          reachable when long pages like Compose / Inbox scroll. */}
      <div className="sticky top-0 md:static z-20 w-full bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-1.5 flex items-center gap-3">
          <div className="flex-1 min-w-0 text-[11px] text-slate-500 truncate text-center md:text-left">
            <span className="italic">&ldquo;{scripture}&rdquo;</span>{' '}
            <span className="text-slate-400 not-italic">{scriptureRef}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-semibold tracking-wide select-none">
            <button
              onClick={() => setLang('en')}
              aria-pressed={lang === 'en'}
              aria-label={t('menu.languageEnglish')}
              className={lang === 'en' ? 'text-tidings-primary' : 'text-slate-400 hover:text-slate-600'}
            >
              EN
            </button>
            <span className="text-slate-300">|</span>
            <button
              onClick={() => setLang('es')}
              aria-pressed={lang === 'es'}
              aria-label={t('menu.languageSpanish')}
              className={lang === 'es' ? 'text-tidings-primary' : 'text-slate-400 hover:text-slate-600'}
            >
              ES
            </button>
          </div>
          <Link
            to="/profile"
            className="hidden sm:inline-block text-xs text-slate-500 hover:text-slate-800 truncate max-w-[6rem] sm:max-w-[10rem]"
            title={t('menu.myProfile')}
          >
            {appUser?.full_name || appUser?.email}
          </Link>
          {appUser?.role === 'admin' && (
            <a
              href={GATHER_ADMIN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-slate-300 text-slate-500 hover:text-slate-800"
              title="Manage user access across all Gather apps"
            >
              Gather
            </a>
          )}
          <button
            onClick={handleSignOut}
            className="hidden sm:inline-block text-xs text-slate-500 hover:text-slate-800"
          >
            {t('nav.signOut')}
          </button>
        </div>
      </div>

      <div className="md:flex">
        {/* Sidebar — single brand header at the top, primary nav, and a
            bottom rail for the User Guide + Release Notes. Mirrors Glean. */}
        <aside
          className="hidden md:flex md:flex-col md:flex-shrink-0 sticky top-0 h-screen text-white"
          style={{ width: 224, background: '#713F12' }}
        >
          <div className="px-5 pt-6 pb-8 flex items-center gap-2.5">
            <TidingsLogo size={28} />
            <div className="text-xl font-bold tracking-tight leading-none">Tidings</div>
          </div>
          <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
            {items.map((item) => {
              const badge = badgeFor(item.to)
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-semibold transition-colors ${
                      isActive
                        ? 'bg-white/15 text-white'
                        : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  <NavIcon name={item.icon} />
                  <span className="flex-1">{t(item.labelKey)}</span>
                  {badge > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-tidings-primary text-yellow-950 text-[11px] font-bold">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </NavLink>
              )
            })}
          </nav>
          <div className="px-2 pb-5 mt-2 space-y-0.5 border-t border-white/10 pt-3">
            <NavLink
              to="/guide"
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              User guide
            </NavLink>
            <NavLink
              to="/release-notes"
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              Release notes
            </NavLink>
          </div>
        </aside>

        <main className="flex-1 min-w-0 p-4 sm:p-6 safe-pb-tabbar md:pb-6">
          <div className="max-w-5xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation + sheet for secondary destinations. */}
      <MobileTabBar
        moreOpen={moreOpen}
        onMoreClick={() => setMoreOpen((v) => !v)}
      />
      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        onSuggestEnhancement={() => setSuggestOpen(true)}
      />

      {/* SuggestionFAB: floating button is hidden on mobile (lives in the
          More sheet there); controlled-open lets the MoreSheet row drive
          the modal so the same component handles both surfaces. */}
      <SuggestionFAB
        controlledOpen={suggestOpen}
        onControlledClose={() => setSuggestOpen(false)}
      />
    </div>
  )
}
