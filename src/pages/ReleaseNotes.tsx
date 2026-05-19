import { CHANGELOG } from '../constants/changelog'

export default function ReleaseNotes() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Release notes</h1>
        <p className="text-sm text-slate-500 mt-1">
          What changed and when, newest first. Updated on every push.
        </p>
      </header>
      <div className="space-y-4">
        {CHANGELOG.map((entry) => (
          <article
            key={entry.version}
            className="rounded-lg border border-slate-200 bg-white p-5"
          >
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="text-base font-bold text-slate-900">v{entry.version}</h2>
              <div className="text-xs text-slate-500">{entry.date}</div>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
              {entry.changes.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </div>
  )
}
