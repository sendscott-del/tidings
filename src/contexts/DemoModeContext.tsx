import { createContext, useCallback, useContext, useEffect, useState } from 'react'

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
  const [demoMode, setDemoModeState] = useState(false)
  const [demoRole, setDemoRoleState] = useState<TidingsDemoRole>('admin')

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
    <Ctx.Provider value={{ demoMode, demoRole, setDemoMode, setDemoRole }}>{children}</Ctx.Provider>
  )
}

export function useDemoMode(): DemoMode {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useDemoMode must be used inside <DemoModeProvider>')
  return ctx
}
