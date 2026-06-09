import { NavLink, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useLanguage } from '../i18n/LanguageContext'
import { NavIcon } from './icons/NavIcon'

const GATHER_ADMIN_URL = 'https://gather.gatheredin.app/gather'

type Props = {
  open: boolean
  onClose: () => void
  onSuggestEnhancement: () => void
}

// Mobile-only bottom sheet (md:hidden) housing secondary navigation:
// directory pages, admin/profile, help, sign out. Opened from the
// "More" tab in MobileTabBar.
export default function MoreSheet({ open, onClose, onSuggestEnhancement }: Props) {
  const { appUser, signOut } = useAuth()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const isAdmin = appUser?.role === 'admin'

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  async function handleSignOut() {
    onClose()
    await signOut()
    navigate('/login')
  }

  if (!open) return null

  return (
    <div className="md:hidden fixed inset-0 z-[60]" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="absolute left-0 right-0 bottom-0 bg-white rounded-t-2xl shadow-2xl px-3 pt-2 max-h-[85vh] overflow-y-auto"
        style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}
      >
        <div className="mx-auto w-9 h-1 bg-slate-300 rounded-full mt-1 mb-2" />

        <Group title={t('more.directories')}>
          <Row
            to="/stake"
            icon="users"
            label={t('nav.stake')}
            onClose={onClose}
          />
          <Row
            to="/community"
            icon="building"
            label={t('nav.community')}
            onClose={onClose}
          />
          <Row
            to="/lists"
            icon="list"
            label={t('nav.lists')}
            onClose={onClose}
          />
        </Group>

        <Group title={t('more.workspace')}>
          {isAdmin && (
            <Row
              to="/admin"
              icon="shield"
              label={t('nav.admin')}
              onClose={onClose}
            />
          )}
          <Row
            to="/profile"
            icon="user"
            label={t('menu.myProfile')}
            onClose={onClose}
          />
          {isAdmin && (
            <RowExternal
              href={GATHER_ADMIN_URL}
              icon="shield"
              label="Gather"
              meta={t('more.gatherMeta')}
              onClose={onClose}
            />
          )}
        </Group>

        <Group title={t('more.help')}>
          <RowButton
            icon="bulb"
            label={t('more.suggest')}
            onClick={() => {
              onClose()
              onSuggestEnhancement()
            }}
          />
          <Row
            to="/guide"
            icon="book"
            label={t('nav.guide')}
            onClose={onClose}
          />
          <Row
            to="/release-notes"
            icon="sparkles"
            label={t('nav.releaseNotes')}
            onClose={onClose}
          />
        </Group>

        <div className="mt-2 pt-2 border-t border-slate-100">
          <RowButton
            icon="logout"
            label={t('nav.signOut')}
            muted
            onClick={handleSignOut}
          />
        </div>
      </div>
    </div>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-1">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 px-2 pt-2 pb-1">
        {title}
      </h4>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

type RowProps = {
  to: string
  icon: string
  label: string
  meta?: string
  onClose: () => void
}

function Row({ to, icon, label, meta, onClose }: RowProps) {
  return (
    <NavLink
      to={to}
      onClick={onClose}
      className={({ isActive }) =>
        `flex items-center gap-3 px-2 py-2.5 rounded-lg min-h-[44px] ${
          isActive ? 'bg-amber-50' : 'hover:bg-slate-50'
        }`
      }
    >
      <RowIcon icon={icon} />
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold text-slate-900 leading-tight">
          {label}
        </div>
        {meta && (
          <div className="text-[11px] text-slate-500 mt-0.5">{meta}</div>
        )}
      </div>
      <span className="text-slate-400 text-lg leading-none">›</span>
    </NavLink>
  )
}

type RowButtonProps = {
  icon: string
  label: string
  onClick: () => void
  muted?: boolean
}

function RowButton({ icon, label, onClick, muted }: RowButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg min-h-[44px] hover:bg-slate-50 text-left"
    >
      <RowIcon icon={icon} muted={muted} />
      <div className="flex-1 min-w-0">
        <div
          className={`text-[14px] font-semibold leading-tight ${
            muted ? 'text-slate-700' : 'text-slate-900'
          }`}
        >
          {label}
        </div>
      </div>
      {!muted && <span className="text-slate-400 text-lg leading-none">›</span>}
    </button>
  )
}

function RowExternal({
  href,
  icon,
  label,
  meta,
  onClose,
}: {
  href: string
  icon: string
  label: string
  meta?: string
  onClose: () => void
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClose}
      className="flex items-center gap-3 px-2 py-2.5 rounded-lg min-h-[44px] hover:bg-slate-50"
    >
      <RowIcon icon={icon} />
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-semibold text-slate-900 leading-tight">
          {label}
        </div>
        {meta && (
          <div className="text-[11px] text-slate-500 mt-0.5">{meta}</div>
        )}
      </div>
      <span className="text-slate-400 text-lg leading-none">↗</span>
    </a>
  )
}

function RowIcon({ icon, muted }: { icon: string; muted?: boolean }) {
  return (
    <span
      className={`shrink-0 w-8 h-8 rounded-lg inline-flex items-center justify-center ${
        muted
          ? 'bg-slate-100 text-slate-500'
          : 'bg-amber-50 text-amber-700'
      }`}
    >
      <NavIcon name={icon} className="w-4 h-4" />
    </span>
  )
}
