import { useState } from 'react'
import StakeImport from '../components/stake/StakeImport'
import StakeBrowse from '../components/stake/StakeBrowse'

export default function Stake() {
  const [tab, setTab] = useState<'import' | 'browse'>('browse')
  const [refreshKey, setRefreshKey] = useState(0)

  function handleImportComplete() {
    setRefreshKey((k) => k + 1)
    setTab('browse')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Stake Directory</h1>
        <div className="flex bg-slate-100 rounded-lg p-0.5">
          <button
            onClick={() => setTab('browse')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === 'browse' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Browse
          </button>
          <button
            onClick={() => setTab('import')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === 'import' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Import
          </button>
        </div>
      </div>

      {tab === 'import' ? (
        <StakeImport onComplete={handleImportComplete} />
      ) : (
        <StakeBrowse key={refreshKey} />
      )}
    </div>
  )
}
