import { useCallback, useState } from 'react'
import { parseCSV, type ParseResult } from '../../lib/csv-parser'
import { supabase, fetchAll } from '../../lib/supabase'

interface Props {
  onComplete: () => void
}

type Stage = 'upload' | 'preview' | 'importing' | 'done'

export default function StakeImport({ onComplete }: Props) {
  const [stage, setStage] = useState<Stage>('upload')
  const [dragOver, setDragOver] = useState(false)
  const [fileName, setFileName] = useState('')
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [existingCount, setExistingCount] = useState(0)
  const [previewStats, setPreviewStats] = useState({ toAdd: 0, toUpdate: 0, toDelete: 0 })
  const [importResult, setImportResult] = useState<{ added: number; updated: number; removed: number } | null>(null)
  const [error, setError] = useState('')

  const handleFile = useCallback(async (file: File) => {
    setError('')
    setFileName(file.name)

    try {
      const result = await parseCSV(file)
      setParseResult(result)

      // Get existing contact count and phones for preview stats (paginated — can exceed 1000)
      const { count } = await supabase.from('contacts').select('*', { count: 'exact', head: true })
      const existingPhones = await fetchAll<{ phone: string }>(() =>
        supabase.from('contacts').select('phone')
      )
      const existingSet = new Set(existingPhones.map((c) => c.phone))
      const incomingSet = new Set(result.contacts.map((c) => c.phone))

      const toAdd = result.contacts.filter((c) => !existingSet.has(c.phone)).length
      const toUpdate = result.contacts.filter((c) => existingSet.has(c.phone)).length
      const toDelete = [...existingSet].filter((p) => !incomingSet.has(p)).length

      setExistingCount(count || 0)
      setPreviewStats({ toAdd, toUpdate, toDelete })
      setStage('preview')
    } catch (err) {
      setError(`Failed to parse CSV: ${(err as Error).message}`)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  async function handleImport() {
    if (!parseResult) return
    setStage('importing')
    setError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/import-contacts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            contacts: parseResult.contacts,
            source_file: fileName,
          }),
        }
      )

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Import failed')

      setImportResult(result)
      setStage('done')
    } catch (err) {
      setError(`Import failed: ${(err as Error).message}`)
      setStage('preview')
    }
  }

  return (
    <div className="max-w-2xl">
      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Upload Stage */}
      {stage === 'upload' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
            dragOver ? 'border-amber-400 bg-amber-50' : 'border-slate-300 bg-white'
          }`}
        >
          <svg className="w-12 h-12 text-slate-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
          </svg>
          <p className="text-slate-700 font-medium mb-1">Drop your LCR CSV export here</p>
          <p className="text-slate-500 text-sm mb-4">or click to browse</p>
          <label className="inline-block px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg cursor-pointer hover:bg-slate-700 transition-colors">
            Choose File
            <input type="file" accept=".csv" onChange={handleFileInput} className="hidden" />
          </label>
        </div>
      )}

      {/* Preview Stage */}
      {stage === 'preview' && parseResult && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Import Preview</h2>
          <p className="text-sm text-slate-500">File: {fileName}</p>

          <div className="grid grid-cols-3 gap-4">
            <StatBox label="To Add" value={previewStats.toAdd} color="green" />
            <StatBox label="To Update" value={previewStats.toUpdate} color="amber" />
            <StatBox label="To Remove" value={previewStats.toDelete} color="red" />
          </div>

          <div className="text-sm text-slate-600 space-y-1">
            <p>Parsed {parseResult.contacts.length} contacts from {parseResult.totalRows} rows</p>
            {existingCount > 0 && <p>Currently {existingCount} contacts in database</p>}
            {parseResult.skipped.length > 0 && (
              <p className="text-amber-600">{parseResult.skipped.length} rows skipped (no phone or invalid data)</p>
            )}
          </div>

          {/* Skipped rows detail */}
          {parseResult.skipped.length > 0 && (
            <details className="text-sm">
              <summary className="text-amber-600 cursor-pointer hover:underline">
                View skipped rows
              </summary>
              <div className="mt-2 max-h-40 overflow-y-auto bg-slate-50 rounded-lg p-3 space-y-1">
                {parseResult.skipped.map((s, i) => (
                  <p key={i} className="text-slate-600">
                    Row {s.row}: {s.reason}
                  </p>
                ))}
              </div>
            </details>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleImport}
              className="px-5 py-2.5 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
            >
              Confirm Import
            </button>
            <button
              onClick={() => { setStage('upload'); setParseResult(null) }}
              className="px-5 py-2.5 text-slate-600 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Importing Stage */}
      {stage === 'importing' && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-slate-300 border-t-slate-800 rounded-full mx-auto mb-4" />
          <p className="text-slate-700 font-medium">Importing contacts...</p>
          <p className="text-slate-500 text-sm mt-1">This may take a moment for large files</p>
        </div>
      )}

      {/* Done Stage */}
      {stage === 'done' && importResult && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-900">Import Complete</h2>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <StatBox label="Added" value={importResult.added} color="green" />
            <StatBox label="Updated" value={importResult.updated} color="amber" />
            <StatBox label="Removed" value={importResult.removed} color="red" />
          </div>

          <button
            onClick={onComplete}
            className="px-5 py-2.5 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors"
          >
            View Contacts
          </button>
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, color }: { label: string; value: number; color: 'green' | 'amber' | 'red' }) {
  const colors = {
    green: 'bg-green-50 text-green-700 border-green-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  }
  return (
    <div className={`rounded-lg border p-3 text-center ${colors[color]}`}>
      <p className="text-2xl font-semibold">{value}</p>
      <p className="text-xs mt-0.5">{label}</p>
    </div>
  )
}
