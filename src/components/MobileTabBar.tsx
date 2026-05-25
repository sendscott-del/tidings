import { NavLink, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../i18n/LanguageContext'
import { useDemoMode } from '../contexts/DemoModeContext'
import { TIDINGS_DEMO_INBOX } from '../lib/demoData'
import { NavIcon } from './icons/NavIcon'

type Props = {
  onMoreClick: () => void
  moreOpen: boolean
}

// 5-tab bottom nav for mobile (md:hidden). Secondary destinations
// (Stake / Community / Lists / Admin / Profile / Guide / Release notes)
// live in MoreSheet, opened from the trailing "More" tab.
export default function MobileTabBar({ onMoreClick, moreOpen }: Props) {
  const { appUser } = useAuth()
  const { demoMode } = useDemoMode()
  const { t } = useLanguage()
  const { pathname } = useLocation()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (demoMode) {
      setUnread(TIDINGS_DEMO_INBOX.filter((m) => !m.read_by).length)
      return
    }
    if (!appUser?.id) return
    let alive = true
    async function fetchUnread() {
      if (document.hidden) return
      const { count } = await supabase
        .from('inbound_messages')
        .select('id', { count: 'exact', head: true })
        .is('read_by', null)
      if (alive) setUnread(count ?? 0)
    }
    fetchUnread()
    const id = setInterval(fetchUnread, 30000)
    document.addEventListener('visibilitychange', fetchUnread)
    return () => {
      alive = false
      clearInterval(id)
      document.removeEventListener('visibilitychange', fetchUnread)
    }
  }, [appUser?.id, demoMode])

  // Routes that get their own tab. Everything else shows the More tab
  // as active (we treat sign-in/auth pages as "no tab").
  const primary = ['/', '/compose', '/inbox', '/history']
  const isAuthRoute = ['/login', '/forgot-password', '/reset-password'].some((p) =>
    pathname.startsWith(p),
  )
  const moreActive = !isAuthRoute && (moreOpen || !primary.includes(pathname))

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 grid grid-cols-5 shadow-[0_-2px_12px_rgba(15,23,42,0.04)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <Tab to="/" end icon="home" label={t('nav.dashboard')} />
      <Tab to="/compose" icon="send" label={t('nav.compose')} />
      <Tab to="/inbox" icon="inbox" label={t('nav.inbox')} badge={unread} />
      <Tab to="/history" icon="clock" label={t('nav.history')} />
      <button
        type="button"
        onClick={onMoreClick}
        aria-label={t('nav.more')}
        aria-expanded={moreOpen}
        className={`flex flex-col items-center justify-center gap-0.5 min-h-[56px] text-[10px] font-semibold py-1 ${
          moreActive
            ? 'text-tidings-primary'
            : 'text-slate-500 hover:text-slate-700'
        }`}
      >
        <NavIcon name="dots" className="w-[22px] h-[22px]" />
        <span>{t('nav.more')}</span>
      </button>
    </nav>
  )
}

type TabProps = {
  to: string
  icon: string
  label: string
  end?: boolean
  badge?: number
}

function Tab({ to, icon, label, end, badge }: TabProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `relative flex flex-col items-center justify-center gap-0.5 min-h-[56px] text-[10px] font-semibold py-1 ${
          isActive
            ? 'text-tidings-primary'
            : 'text-slate-500 hover:text-slate-700'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className="relative">
            <NavIcon name={icon} filled={isActive} className="w-[22px] h-[22px]" />
            {badge !== undefined && badge > 0 && (
              <span
                className="absolute -top-1.5 -right-2.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold"
                aria-label={`${badge} unread`}
              >
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </span>
          <span>{label}</span>
        </>
      )}
    </NavLink>
  )
}
