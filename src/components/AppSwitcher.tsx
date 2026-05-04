import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { fetchGatherAppsForEmail } from '../lib/gatherSharedSupabase'

interface AppInfo {
  name: string
  label: string
  url: string
  color: string
  blurb: string
}

// Canonical Gather suite catalog. Mirror this list across all five apps.
const APP_CATALOG: AppInfo[] = [
  { name: 'magnify', label: 'Magnify', url: 'https://magnify-sendscott-dels-projects.vercel.app', color: '#1B3A6B', blurb: 'Calling administration' },
  { name: 'steward', label: 'Steward', url: 'https://stewards-indeed.vercel.app',                color: '#2563EB', blurb: 'Leader standard work' },
  { name: 'glean',   label: 'Glean',   url: 'https://glean-blue.vercel.app',                     color: '#C9A84C', blurb: 'Welfare & self-reliance' },
  { name: 'tidings', label: 'Tidings', url: 'https://tidings-sendscott-dels-projects.vercel.app', color: '#F59E0B', blurb: 'Two-way SMS' },
  { name: 'knit',    label: 'Knit',    url: 'https://knit-together.vercel.app',                   color: '#E11D48', blurb: 'Fellowship matching' },
]

const CURRENT_APP = 'tidings'

function AppMark({ app, size = 28 }: { app: AppInfo; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 7,
        backgroundColor: app.color,
        color: 'white',
        fontWeight: 800,
        fontSize: size * 0.5,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      {app.label[0]}
    </span>
  )
}

export default function AppSwitcher() {
  const { appUser } = useAuth()
  const [otherApps, setOtherApps] = useState<AppInfo[]>([])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    let cancelled = false
    const email = appUser?.email
    if (!email) {
      setOtherApps([])
      return
    }
    void (async () => {
      // Tidings is on a separate Supabase project from the other apps.
      // Use the cross-project RPC gather_apps_for_email to find out which
      // apps the user has access to. If the call fails or env vars are
      // missing, fetchGatherAppsForEmail returns null and we show the
      // full catalog as a permissive fallback (better than hiding apps
      // the user might have access to).
      const accessible = await fetchGatherAppsForEmail(email)
      if (cancelled) return
      if (accessible === null) {
        // Fallback: show all other apps.
        setOtherApps(APP_CATALOG.filter(a => a.name !== CURRENT_APP))
      } else {
        setOtherApps(
          APP_CATALOG.filter(a => a.name !== CURRENT_APP && accessible.includes(a.name))
        )
      }
    })()
    return () => { cancelled = true }
  }, [appUser?.email])

  if (!appUser || otherApps.length === 0) return null

  const currentApp = APP_CATALOG.find(a => a.name === CURRENT_APP)!

  return (
    <div className="relative z-[100] w-full">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-1.5"
        style={{ backgroundColor: '#1e1b4b' }}
        aria-haspopup="menu"
        aria-expanded={expanded}
      >
        <span className="flex items-center gap-2">
          <span className="text-[11px] font-bold text-white/50 uppercase tracking-wider">Gathered</span>
          <span className="w-px h-3 bg-white/20" />
          <AppMark app={currentApp} size={18} />
          <span className="text-sm font-bold text-white">{currentApp.label}</span>
        </span>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: expanded ? 'rotate(180deg)' : undefined }}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div className="absolute left-0 right-0 bg-white border-b border-gray-200 py-1 shadow-md">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-4 py-1">Switch to</p>
          {otherApps.map(app => (
            <a
              key={app.name}
              href={app.url}
              onClick={() => setExpanded(false)}
              className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50"
            >
              <AppMark app={app} size={28} />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-gray-800 truncate">{app.label}</span>
                <span className="block text-xs text-gray-500 truncate">{app.blurb}</span>
              </span>
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="text-gray-400 flex-shrink-0"
                aria-hidden="true"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
