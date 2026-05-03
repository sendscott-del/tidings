import { TIDINGS_DEMO_ROLE_LABELS, useDemoMode, type TidingsDemoRole } from '../contexts/DemoModeContext'

export default function DemoModeBanner() {
  const { demoMode, demoRole, setDemoRole, setDemoMode } = useDemoMode()
  if (!demoMode) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full px-4 py-2 flex items-center justify-between gap-3 text-white text-xs"
      style={{ background: 'repeating-linear-gradient(45deg, #b45309, #b45309 12px, #92400e 12px, #92400e 24px)' }}
    >
      <span className="font-bold uppercase tracking-wider">Demo mode</span>
      <span className="hidden sm:inline opacity-80">No real ward data is shown. Use this to train new senders.</span>
      <div className="flex items-center gap-2">
        <label className="font-medium opacity-80">Viewing as</label>
        <select
          value={demoRole}
          onChange={e => setDemoRole(e.target.value as TidingsDemoRole)}
          className="bg-white/10 border border-white/40 rounded px-2 py-0.5 text-white"
        >
          {Object.entries(TIDINGS_DEMO_ROLE_LABELS).map(([k, label]) => (
            <option key={k} value={k} className="text-black">{label}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setDemoMode(false)}
          className="ml-1 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider border border-white/50 hover:bg-white/15 rounded"
        >
          Exit
        </button>
      </div>
    </div>
  )
}

export function DemoModeToggle() {
  const { demoMode, setDemoMode } = useDemoMode()
  return (
    <button
      type="button"
      onClick={() => setDemoMode(!demoMode)}
      className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 flex items-center justify-between"
    >
      <span>Demo mode</span>
      <span className={`text-xs font-bold uppercase ${demoMode ? 'text-amber-700' : 'text-slate-400'}`}>
        {demoMode ? 'On' : 'Off'}
      </span>
    </button>
  )
}
