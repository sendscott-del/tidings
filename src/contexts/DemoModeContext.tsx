import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'

// App Store / Play review accounts ALWAYS render demo (fixture) data — never
// real recipient data. This email is OR'd into demoMode so every page that
// already short-circuits to fixtures when demoMode is on does so for the
// reviewer automatically. Defense-in-depth: the reviewer's DB account is also
// a non-leader role, so RLS returns zero real contacts even on pages that are
// not demo-gated. Keep in sync with the approved reviewer account.
export const REVIEW_DEMO_EMAILS = ['applereview@gatheredin.app']
export function isReviewDemoUser(email?: string | null): boolean {
  return !!email && REVIEW_DEMO_EMAILS.includes(email.toLowerCase())
}

export type TidingsDemoRole =
  | 'stake_president'
  | 'stake_clerk'
  | 'admin'
  | 'sender'
  | 'viewer'
  | 'member'

export const TIDINGS_DEMO_ROLE_LABELS: Record<TidingsDemoRole, string> = {
  stake_president: 'Stake President',
  stake_clerk: 'Stake Clerk',
  admin: 'Admin',
  sender: 'Sender',
  viewer: 'Viewer',
  member: 'Member',
}

interface DemoMode {
  demoMode: boolean
  demoRole: TidingsDemoRole
  setDemoMode: (on: boolean) => void
  setDemoRole: (role: TidingsDemoRole) => void
}

const Ctx = createContext<DemoMode | null>(null)
const KEY_MODE = 'tidings.demoMode'
const KEY_ROLE = 'tidings.demoRole'

export function DemoModeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [demoMode, setDemoModeState] = useState(false)
  const [demoRole, setDemoRoleState] = useState<TidingsDemoRole>('admin')

  // App Review accounts are always forced into demo mode — they never see real
  // recipient data. OR'd into the provided demoMode below.
  const reviewerForced = isReviewDemoUser(user?.email)

  useEffect(() => {
    if (typeof window === 'undefined') return
    setDemoModeState(window.localStorage.getItem(KEY_MODE) === 'on')
    const r = window.localStorage.getItem(KEY_ROLE) as TidingsDemoRole | null
    if (r && r in TIDINGS_DEMO_ROLE_LABELS) setDemoRoleState(r)
  }, [])

  const setDemoMode = useCallback((on: boolean) => {
    setDemoModeState(on)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(KEY_MODE, on ? 'on' : 'off')
    }
  }, [])

  const setDemoRole = useCallback((role: TidingsDemoRole) => {
    setDemoRoleState(role)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(KEY_ROLE, role)
    }
  }, [])

  return (
    <Ctx.Provider value={{ demoMode: demoMode || reviewerForced, demoRole, setDemoMode, setDemoRole }}>{children}</Ctx.Provider>
  )
}

export function useDemoMode(): DemoMode {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useDemoMode must be used inside <DemoModeProvider>')
  return ctx
}
