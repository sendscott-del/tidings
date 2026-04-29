import { useEffect, useState } from 'react'
import { supabase, fetchAll } from '../lib/supabase'

interface ListOption {
  id: string
  name: string
  database: string
  is_auto: boolean
  member_count: number
}

type Step = 'database' | 'recipients' | 'message' | 'confirm'

export default function Compose() {
  const [step, setStep] = useState<Step>('database')
  const [database, setDatabase] = useState<'stake' | 'community'>('stake')
  const [lists, setLists] = useState<ListOption[]>([])
  const [selectedListIds, setSelectedListIds] = useState<string[]>([])
  const [recipientCount, setRecipientCount] = useState(0)
  const [body, setBody] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadLists()
  }, [database])

  async function loadLists() {
    const { data: listsData } = await supabase
      .from('lists')
      .select('id, name, database, is_auto')
      .eq('database', database)
      .order('name')

    if (listsData) {
      const counts = await fetchAll<{ list_id: string }>(() =>
        supabase.from('list_members').select('list_id')
      )

      const countMap: Record<string, number> = {}
      for (const row of counts) {
        countMap[row.list_id] = (countMap[row.list_id] || 0) + 1
      }

      setLists(listsData.map((l) => ({ ...l, member_count: countMap[l.id] || 0 })))
    }
    setSelectedListIds([])
    setRecipientCount(0)
  }

  async function updateRecipientCount(listIds: string[]) {
    if (listIds.length === 0) {
      setRecipientCount(0)
      return
    }

    const memberLinks = await fetchAll<{ contact_id: string }>(() =>
      supabase
        .from('list_members')
        .select('contact_id')
        .in('list_id', listIds)
    )

    const uniqueIds = new Set(memberLinks.map((m) => m.contact_id))
    setRecipientCount(uniqueIds.size)
  }

  function toggleList(listId: string) {
    const next = selectedListIds.includes(listId)
      ? selectedListIds.filter((id) => id !== listId)
      : [...selectedListIds, listId]
    setSelectedListIds(next)
    updateRecipientCount(next)
  }

  async function handleSend() {
    setSending(true)
    setError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-message`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            body,
            database,
            list_ids: selectedListIds,
            scheduled_at: scheduledAt || null,
          }),
        }
      )

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Send failed')

      setResult(data)
    } catch (err) {
      setError((err as Error).message)
      setSending(false)
    }
  }

  const smsCount = Math.ceil(body.length / 160) || 0
  const estimatedCost = (recipientCount * 0.0079).toFixed(2)

  // Done state
  if (result) {
    return (
      <div className="max-w-xl">
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {result.status === 'queued' ? 'Message Scheduled' : 'Message Sent'}
              </h2>
              <p className="text-sm text-slate-500">
                Sent to {result.recipient_count} {result.recipient_count === 1 ? 'recipient' : 'recipients'}
                {result.note && ` — ${result.note}`}
              </p>
            </div>
          </div>
          <button
            onClick={() => { setResult(null); setStep('database'); setBody(''); setSelectedListIds([]); setScheduledAt('') }}
            className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700"
          >
            Compose Another
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Compose Message</h1>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>
      )}

      {/* Step indicators */}
      <div className="flex items-center gap-2 mb-6">
        {(['database', 'recipients', 'message', 'confirm'] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
              step === s ? 'bg-amber-500 text-white' :
              (['database', 'recipients', 'message', 'confirm'].indexOf(step) > i) ? 'bg-green-500 text-white' :
              'bg-slate-200 text-slate-500'
            }`}>
              {i + 1}
            </div>
            {i < 3 && <div className="w-8 h-px bg-slate-200" />}
          </div>
        ))}
      </div>

      {/* Step 1: Choose database */}
      {step === 'database' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-lg font-medium text-slate-900">Choose Database</h2>
          <div className="grid grid-cols-2 gap-3">
            {(['stake', 'community'] as const).map((db) => (
              <button
                key={db}
                onClick={() => { setDatabase(db); setStep('recipients') }}
                className={`p-4 rounded-lg border-2 text-left transition-colors ${
                  database === db ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <p className="font-medium text-slate-900 capitalize">{db}</p>
                <p className="text-sm text-slate-500 mt-1">
                  {db === 'stake' ? 'Church members from LCR' : 'Community event contacts'}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Choose recipients */}
      {step === 'recipients' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-lg font-medium text-slate-900">Select Lists</h2>
          {lists.length === 0 ? (
            <p className="text-slate-500 text-sm">No lists available for {database} database.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {lists.map((list) => (
                <label
                  key={list.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedListIds.includes(list.id) ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedListIds.includes(list.id)}
                    onChange={() => toggleList(list.id)}
                    className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-slate-900">{list.name}</span>
                    {list.is_auto && <span className="text-xs text-slate-400 ml-1">(auto)</span>}
                  </div>
                  <span className="text-sm text-slate-500">{list.member_count} {list.member_count === 1 ? 'member' : 'members'}</span>
                </label>
              ))}
            </div>
          )}

          {recipientCount > 0 && (
            <p className="text-sm text-slate-600 font-medium">
              {recipientCount} unique {recipientCount === 1 ? 'recipient' : 'recipients'} selected{selectedListIds.length > 1 ? ` across ${selectedListIds.length} lists` : ''}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep('message')}
              disabled={selectedListIds.length === 0}
              className="px-5 py-2.5 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
            <button
              onClick={() => setStep('database')}
              className="px-5 py-2.5 text-slate-600 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Write message */}
      {step === 'message' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-lg font-medium text-slate-900">Write Message</h2>

          <div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder="Type your message here..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
            />
            <div className="flex justify-between mt-1">
              <span className={`text-xs ${body.length > 320 ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                {body.length} of 160 chars · {smsCount} SMS segment{smsCount !== 1 ? 's' : ''}
              </span>
              {body.length > 320 && (
                <span className="text-xs text-red-500">Long message — higher cost per recipient</span>
              )}
            </div>
          </div>

          {/* Phone preview */}
          {body && (
            <div className="mx-auto w-64 bg-slate-100 rounded-2xl p-4">
              <div className="bg-green-500 text-white text-sm rounded-2xl rounded-bl-sm px-3 py-2 max-w-[90%]">
                {body}
              </div>
            </div>
          )}

          {/* Schedule option */}
          <div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={!!scheduledAt}
                onChange={(e) => setScheduledAt(e.target.checked ? '' : '')}
                className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
              />
              Schedule for later
            </label>
            {scheduledAt !== undefined && scheduledAt !== '' && (
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="mt-2 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep('confirm')}
              disabled={!body.trim()}
              className="px-5 py-2.5 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Review
            </button>
            <button
              onClick={() => setStep('recipients')}
              className="px-5 py-2.5 text-slate-600 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50"
            >
              Back
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Confirm & Send */}
      {step === 'confirm' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-lg font-medium text-slate-900">Confirm & Send</h2>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Database</span>
              <span className="text-slate-900 font-medium capitalize">{database}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Lists</span>
              <span className="text-slate-900 font-medium">{selectedListIds.length} of {lists.length} {lists.length === 1 ? 'list' : 'lists'} selected</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Unique recipients</span>
              <span className="text-slate-900 font-medium">{recipientCount} {recipientCount === 1 ? 'recipient' : 'recipients'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">SMS segments</span>
              <span className="text-slate-900 font-medium">{smsCount} {smsCount === 1 ? 'segment' : 'segments'} per recipient</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Estimated cost</span>
              <span className="text-slate-900 font-medium">${estimatedCost}</span>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500 mb-1">Message preview:</p>
            <p className="text-sm text-slate-900">{body}</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSend}
              disabled={sending}
              className="px-5 py-2.5 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? 'Sending…' : `Send ${recipientCount} ${recipientCount === 1 ? 'message' : 'messages'}`}
            </button>
            <button
              onClick={() => setStep('message')}
              disabled={sending}
              className="px-5 py-2.5 text-slate-600 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
