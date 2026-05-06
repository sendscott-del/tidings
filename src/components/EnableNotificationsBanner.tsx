import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getPushState, pushSupported, subscribeToPush, type PushSupportState } from '../lib/push'

const DISMISS_KEY = 'tidings_push_banner_dismissed_v1'

function readDismissed(): boolean {
  try { return localStorage.getItem(DISMISS_KEY) === '1' } catch { return false }
}
function writeDismissed() {
  try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* ignore */ }
}

export default function EnableNotificationsBanner() {
  const { user } = useAuth()
  const [state, setState] = useState<PushSupportState>('unsupported')
  const [dismissed, setDismissed] = useState(readDismissed())
  const [working, setWorking] = useState(false)

  useEffect(() => {
    if (!pushSupported()) return
    let mounted = true
    getPushState(user?.id).then((s) => { if (mounted) setState(s) })
    return () => { mounted = false }
  }, [user?.id])

  if (!pushSupported()) return null
  if (state === 'subscribed' || state === 'denied') return null
  if (dismissed) return null

  async function enable() {
    if (!user?.id) return
    setWorking(true)
    const res = await subscribeToPush(user.id)
    setWorking(false)
    if (res.ok) setState('subscribed')
    else if (res.reason === 'denied') setState('denied')
  }

  function later() {
    writeDismissed()
    setDismissed(true)
  }

  return (
    <div className="flex items-center gap-3 bg-tidings-primary/10 border border-tidings-primary/20 rounded-lg px-4 py-3 mb-4">
      <div className="w-8 h-8 rounded-full bg-tidings-primary text-white flex items-center justify-center flex-shrink-0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-slate-900">Get a home-screen alert when a new message arrives</div>
        <div className="text-xs text-slate-600 mt-0.5">Add Tidings to your home screen, then tap Enable to see a red badge on the icon when the inbox has unread messages.</div>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={enable}
          disabled={working}
          className="text-xs font-bold px-3 py-1.5 rounded-md bg-tidings-primary text-white hover:opacity-90 disabled:opacity-60"
        >
          {working ? 'Asking…' : 'Enable'}
        </button>
        <button
          onClick={later}
          className="text-xs font-semibold px-3 py-1.5 rounded-md text-slate-600 hover:bg-slate-100"
        >
          Not now
        </button>
      </div>
    </div>
  )
}
