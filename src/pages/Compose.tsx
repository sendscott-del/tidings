import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase, fetchAll } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { useDemoMode } from '../contexts/DemoModeContext'

interface ListOption {
  id: string
  name: string
  database: string
  is_auto: boolean
  member_count: number
}

interface ReplyTarget {
  phone: string
  name?: string
  contactId?: string | null
  contactType?: 'stake' | 'community' | null
}

type Step = 'database' | 'recipients' | 'message' | 'confirm'

const MAX_MEDIA = 3
const MAX_MEDIA_BYTES = 5 * 1024 * 1024 // 5 MB per image (Twilio MMS limit is ~5 MB total)
const ACCEPTED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const CENTS_PER_MMS = 2.0 // US MMS pricing (matches send-message edge fn)

interface MediaItem {
  url: string
  path: string
  name: string
  contentType: string
  size: number
}

export default function Compose() {
  const location = useLocation()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { appUser } = useAuth()
  const { demoMode } = useDemoMode()
  const replyTo = (location.state as { replyTo?: ReplyTarget } | null)?.replyTo
  const signature = (appUser?.signature || '').trim()

  const [budget, setBudget] = useState<{ budget_cents: number; used_cents: number; remaining_cents: number; quarter_end: string } | null>(null)
  const [shortening, setShortening] = useState(false)
  const [shortenError, setShortenError] = useState('')
  const [suggestion, setSuggestion] = useState<{ shortened: string; original_chars: number; shortened_chars: number; shortened_segments: number; original_segments: number } | null>(null)

  const [step, setStep] = useState<Step>(replyTo ? 'message' : 'database')
  const [database, setDatabase] = useState<'stake' | 'community'>(
    replyTo?.contactType === 'community' ? 'community' : 'stake'
  )
  const [lists, setLists] = useState<ListOption[]>([])
  const [selectedListIds, setSelectedListIds] = useState<string[]>([])
  const [recipientCount, setRecipientCount] = useState(0)
  const [optedOutCount, setOptedOutCount] = useState(0)
  const [body, setBody] = useState('')
  const [media, setMedia] = useState<MediaItem[]>([])
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [mediaError, setMediaError] = useState('')
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!replyTo) loadLists()
  }, [database])

  useEffect(() => {
    if (appUser?.ward) loadBudget(appUser.ward)
  }, [appUser?.ward])

  async function handleAttach(files: FileList | null) {
    if (!files || files.length === 0) return
    setMediaError('')

    const slotsLeft = MAX_MEDIA - media.length
    if (slotsLeft <= 0) {
      setMediaError(`Maximum ${MAX_MEDIA} images per message.`)
      return
    }

    const toUpload: File[] = []
    for (const f of Array.from(files).slice(0, slotsLeft)) {
      if (!ACCEPTED_MEDIA_TYPES.includes(f.type)) {
        setMediaError(`${f.name}: only JPG, PNG, GIF, or WebP images are supported.`)
        return
      }
      if (f.size > MAX_MEDIA_BYTES) {
        setMediaError(`${f.name}: image must be ${MAX_MEDIA_BYTES / 1024 / 1024} MB or smaller.`)
        return
      }
      toUpload.push(f)
    }

    if (demoMode) {
      // Demo: don't upload. Use object URLs so the trainer sees the preview,
      // and tag them with a fake path that we'll never send to Twilio.
      const demoItems: MediaItem[] = toUpload.map((f, i) => ({
        url: URL.createObjectURL(f),
        path: `demo-${Date.now()}-${i}`,
        name: f.name,
        contentType: f.type,
        size: f.size,
      }))
      setMedia((prev) => [...prev, ...demoItems])
      return
    }

    if (!appUser?.id) {
      setMediaError('Not authenticated.')
      return
    }

    setUploadingMedia(true)
    try {
      const uploaded: MediaItem[] = []
      for (const file of toUpload) {
        const ext = file.type.split('/')[1] || 'bin'
        const safeExt = ext === 'jpeg' ? 'jpg' : ext
        const rand = crypto.randomUUID()
        const path = `outbound/${appUser.id}/${Date.now()}-${rand}.${safeExt}`
        const { error: upErr } = await supabase.storage
          .from('tidings-mms')
          .upload(path, file, { contentType: file.type, upsert: false })
        if (upErr) throw new Error(upErr.message)
        const { data: pub } = supabase.storage.from('tidings-mms').getPublicUrl(path)
        if (!pub?.publicUrl) throw new Error('Failed to get public URL for uploaded image')
        uploaded.push({
          url: pub.publicUrl,
          path,
          name: file.name,
          contentType: file.type,
          size: file.size,
        })
      }
      setMedia((prev) => [...prev, ...uploaded])
    } catch (err) {
      setMediaError((err as Error).message)
    }
    setUploadingMedia(false)
  }

  async function handleRemoveMedia(idx: number) {
    const item = media[idx]
    if (!item) return
    setMedia((prev) => prev.filter((_, i) => i !== idx))
    if (demoMode) {
      try { URL.revokeObjectURL(item.url) } catch {}
      return
    }
    // Best-effort cleanup; ignore failures (Storage RLS scopes deletes to the
    // user's own outbound/ folder, so this won't leak others' files even on
    // unexpected paths).
    if (item.path && item.path.startsWith('outbound/')) {
      await supabase.storage.from('tidings-mms').remove([item.path]).catch(() => {})
    }
  }

  async function requestShortening() {
    if (!body.trim()) return
    setShortening(true)
    setShortenError('')
    setSuggestion(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')
      // Target is 160 chars MINUS the signature length (so the final body fits in 1 segment)
      const sigLen = signature ? signature.length + 2 : 0 // +2 for "\n\n"
      const target = Math.max(40, 160 - sigLen)
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shorten-message`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ body, target_chars: target }),
        }
      )
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.message || data.error || 'Shorten failed')
      setSuggestion(data)
    } catch (err) {
      setShortenError((err as Error).message)
    }
    setShortening(false)
  }

  function acceptShortening() {
    if (suggestion) {
      setBody(suggestion.shortened)
      setSuggestion(null)
    }
  }

  async function loadBudget(ward: string) {
    const { data } = await supabase.rpc('get_ward_budget_status', { p_ward: ward })
    const row = Array.isArray(data) ? data[0] : data
    if (row) {
      setBudget({
        budget_cents: row.budget_cents,
        used_cents: Number(row.used_cents),
        remaining_cents: Number(row.remaining_cents),
        quarter_end: row.quarter_end,
      })
    }
  }

  async function loadLists() {
    let query = supabase
      .from('lists')
      .select('id, name, database, is_auto, ward_scope')
      .eq('database', database)
      .order('name')

    // Non-admin, non-Stake users see only stake-wide lists + their own ward's lists.
    if (appUser?.role !== 'admin' && appUser?.ward && appUser.ward !== 'Stake') {
      query = query.or(`ward_scope.is.null,ward_scope.eq.${appUser.ward}`)
    }

    const { data: listsData } = await query

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
    setOptedOutCount(0)
  }

  async function updateRecipientCount(listIds: string[]) {
    if (listIds.length === 0) {
      setRecipientCount(0)
      setOptedOutCount(0)
      return
    }

    const memberLinks = await fetchAll<{ contact_id: string; contact_type: string }>(() =>
      supabase
        .from('list_members')
        .select('contact_id, contact_type')
        .in('list_id', listIds)
    )

    const uniqueByType = new Map<string, string>()
    for (const m of memberLinks) {
      if (!uniqueByType.has(m.contact_id)) uniqueByType.set(m.contact_id, m.contact_type)
    }

    const stakeIds = [...uniqueByType.entries()].filter(([_, t]) => t === 'stake').map(([id]) => id)
    const communityIds = [...uniqueByType.entries()].filter(([_, t]) => t === 'community').map(([id]) => id)

    let optedOut = 0
    const phoneSet = new Set<string>()

    if (stakeIds.length > 0) {
      for (let i = 0; i < stakeIds.length; i += 500) {
        const chunk = stakeIds.slice(i, i + 500)
        const data = await fetchAll<{ phone: string | null; opted_out: boolean }>(() =>
          supabase.from('contacts').select('phone, opted_out').in('id', chunk)
        )
        for (const c of data) {
          if (!c.phone) continue
          if (phoneSet.has(c.phone)) continue
          phoneSet.add(c.phone)
          if (c.opted_out) optedOut++
        }
      }
    }
    if (communityIds.length > 0) {
      for (let i = 0; i < communityIds.length; i += 500) {
        const chunk = communityIds.slice(i, i + 500)
        const data = await fetchAll<{ phone: string | null; opted_out: boolean }>(() =>
          supabase.from('community_contacts').select('phone, opted_out').in('id', chunk)
        )
        for (const c of data) {
          if (!c.phone) continue
          if (phoneSet.has(c.phone)) continue
          phoneSet.add(c.phone)
          if (c.opted_out) optedOut++
        }
      }
    }

    setRecipientCount(phoneSet.size)
    setOptedOutCount(optedOut)
  }

  function toggleList(listId: string) {
    const next = selectedListIds.includes(listId)
      ? selectedListIds.filter((id) => id !== listId)
      : [...selectedListIds, listId]
    setSelectedListIds(next)
    updateRecipientCount(next)
  }

  const minScheduleAt = useMemo(() => {
    const d = new Date(Date.now() + 60 * 1000)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }, [])

  async function handleSend() {
    setSending(true)
    setError('')

    try {
      // Demo: never call the send-message edge function (Twilio-backed) in
      // demo mode. Fake a success response so the trainer can walk through
      // the post-send UI without spending real SMS credit or contacting
      // real recipients.
      if (demoMode) {
        await new Promise(r => setTimeout(r, 600))
        const recipient_count = replyTo ? 1 : Math.max(1, recipientCount - optedOutCount)
        const fakeResult = {
          status: scheduleEnabled && scheduledAt ? 'queued' : 'sent',
          recipient_count,
          message_id: 'demo-msg-' + Date.now(),
          demo: true,
          is_mms: media.length > 0,
        }
        setResult(fakeResult)
        toast(
          fakeResult.status === 'queued'
            ? `Demo: pretended to schedule message for ${recipient_count} ${recipient_count === 1 ? 'recipient' : 'recipients'}`
            : `Demo: pretended to send to ${recipient_count} ${recipient_count === 1 ? 'recipient' : 'recipients'}`,
          'success'
        )
        setSending(false)
        return
      }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const payload: Record<string, unknown> = {
        body,
        scheduled_at: scheduleEnabled && scheduledAt ? new Date(scheduledAt).toISOString() : null,
        media_urls: media.map((m) => m.url),
      }
      if (replyTo) {
        payload.to_phones = [replyTo.phone]
        payload.database = replyTo.contactType || 'stake'
      } else {
        payload.database = database
        payload.list_ids = selectedListIds
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-message`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(payload),
        }
      )

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Send failed')

      setResult(data)
      toast(
        data.status === 'queued'
          ? `Message scheduled for ${data.recipient_count} ${data.recipient_count === 1 ? 'recipient' : 'recipients'}`
          : `Sent to ${data.recipient_count} ${data.recipient_count === 1 ? 'recipient' : 'recipients'}`,
        'success'
      )
    } catch (err) {
      setError((err as Error).message)
      toast((err as Error).message, 'error')
      setSending(false)
    }
  }

  const finalBody = signature && body.trim() ? `${body}\n\n${signature}` : body
  const smsCount = Math.ceil(finalBody.length / 160) || 0
  const effectiveRecipientCount = replyTo ? 1 : recipientCount
  const willReceive = Math.max(0, effectiveRecipientCount - optedOutCount)
  const isMms = media.length > 0
  const projectedCostCents = isMms
    ? CENTS_PER_MMS * willReceive
    : smsCount * willReceive * 0.79
  const estimatedCost = (projectedCostCents / 100).toFixed(2)

  const pctUsed = budget && budget.budget_cents > 0
    ? (budget.used_cents / budget.budget_cents) * 100
    : 0
  const pctAfter = budget && budget.budget_cents > 0
    ? ((budget.used_cents + projectedCostCents) / budget.budget_cents) * 100
    : 0
  const wouldExceed = budget !== null && projectedCostCents > budget.remaining_cents
  const noWardAssigned = !appUser?.ward
  const hardBlock = noWardAssigned || wouldExceed

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
          <div className="flex gap-2">
            <button
              onClick={() => {
                setResult(null)
                setBody('')
                if (demoMode) {
                  for (const m of media) {
                    try { URL.revokeObjectURL(m.url) } catch {}
                  }
                }
                setMedia([])
                setMediaError('')
                setSelectedListIds([])
                setScheduleEnabled(false)
                setScheduledAt('')
                if (replyTo) navigate('/inbox')
                else setStep('database')
              }}
              className="px-4 py-2 bg-tidings-chrome text-white text-sm font-medium rounded-lg hover:bg-slate-700"
            >
              {replyTo ? 'Back to Inbox' : 'Compose Another'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const budgetPillClasses =
    pctUsed >= 100 || wouldExceed ? 'bg-red-50 border-red-200 text-red-900' :
    pctUsed >= 95 || pctAfter >= 100 ? 'bg-red-50 border-red-200 text-red-900' :
    pctUsed >= 80 || pctAfter >= 80 ? 'bg-amber-50 border-amber-200 text-amber-900' :
    'bg-slate-50 border-slate-200 text-slate-700'

  const quarterEndLabel = budget?.quarter_end
    ? new Date(budget.quarter_end).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : ''

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">
        {replyTo ? 'Reply' : 'Compose Message'}
      </h1>

      {noWardAssigned && (
        <div className="bg-red-50 border border-red-200 text-red-900 text-sm px-4 py-3 rounded-lg mb-4">
          <strong>You're not assigned to a ward.</strong> Ask an admin to set your ward in Admin → Users before sending.
        </div>
      )}

      {appUser?.ward && budget && (
        <div className={`border rounded-lg px-4 py-3 mb-4 text-sm ${budgetPillClasses}`}>
          <div className="flex items-center justify-between">
            <div>
              <span className="font-semibold">{appUser.ward}</span>
              <span className="ml-2">
                ${(Math.max(0, budget.remaining_cents) / 100).toFixed(2)} of ${(budget.budget_cents / 100).toFixed(2)} left this quarter
              </span>
            </div>
            <span className="text-xs opacity-75">resets {quarterEndLabel}</span>
          </div>
          {budget.budget_cents > 0 && (
            <div className="mt-2 h-1.5 bg-white/60 rounded-full overflow-hidden">
              <div
                className={`h-full ${
                  pctUsed >= 95 ? 'bg-red-500' :
                  pctUsed >= 80 ? 'bg-amber-500' :
                  'bg-slate-500'
                }`}
                style={{ width: `${Math.min(100, pctUsed)}%` }}
              />
            </div>
          )}
          {wouldExceed && (
            <p className="mt-2 text-xs font-medium">
              This send would cost ~${(projectedCostCents / 100).toFixed(2)} and exceed the remaining budget. It will be blocked.
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>
      )}

      {replyTo && (
        <div className="bg-blue-50 border border-blue-200 text-blue-900 text-sm px-4 py-3 rounded-lg mb-4">
          Replying to <span className="font-semibold">{replyTo.name || replyTo.phone}</span>
          {replyTo.name && <span className="text-blue-700 ml-2">{replyTo.phone}</span>}
        </div>
      )}

      {!replyTo && (
        <div className="flex items-center gap-2 mb-6">
          {(['database', 'recipients', 'message', 'confirm'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                step === s ? 'bg-tidings-primary text-white' :
                (['database', 'recipients', 'message', 'confirm'].indexOf(step) > i) ? 'bg-green-500 text-white' :
                'bg-slate-200 text-slate-500'
              }`}>
                {i + 1}
              </div>
              {i < 3 && <div className="w-8 h-px bg-slate-200" />}
            </div>
          ))}
        </div>
      )}

      {!replyTo && step === 'database' && (
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

      {!replyTo && step === 'recipients' && (
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
            <div className="text-sm text-slate-600 space-y-1">
              <p className="font-medium">
                {recipientCount} unique {recipientCount === 1 ? 'recipient' : 'recipients'} selected{selectedListIds.length > 1 ? ` across ${selectedListIds.length} lists` : ''}
              </p>
              {optedOutCount > 0 && (
                <p className="text-amber-700">
                  {optedOutCount} opted out — they will be skipped ({recipientCount - optedOutCount} will receive)
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep('message')}
              disabled={selectedListIds.length === 0}
              className="px-5 py-2.5 bg-tidings-chrome text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
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

      {step === 'message' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-lg font-medium text-slate-900">Write Message</h2>

          <div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder={isMms ? 'Optional caption for your image…' : 'Type your message here...'}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
            />
            <div className="flex justify-between mt-1">
              <span className={`text-xs ${!isMms && finalBody.length > 320 ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                {isMms
                  ? `${finalBody.length} chars · MMS — flat ~2¢ per recipient regardless of length`
                  : `${finalBody.length} of 160 chars · ${smsCount} SMS segment${smsCount !== 1 ? 's' : ''}`}
                {signature && body.trim() && <span className="text-slate-500"> (incl. signature)</span>}
              </span>
              {!isMms && finalBody.length > 320 && (
                <span className="text-xs text-red-500">Long message — higher cost per recipient</span>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-700">
                Images <span className="text-slate-400 font-normal">(optional, up to {MAX_MEDIA})</span>
              </span>
              <label
                className={`text-xs font-medium px-3 py-1.5 rounded-md border cursor-pointer transition-colors ${
                  uploadingMedia || media.length >= MAX_MEDIA
                    ? 'border-slate-200 text-slate-300 cursor-not-allowed'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                {uploadingMedia ? 'Uploading…' : '📎 Add image'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  multiple
                  className="hidden"
                  disabled={uploadingMedia || media.length >= MAX_MEDIA}
                  onChange={(e) => {
                    handleAttach(e.target.files)
                    e.target.value = '' // allow picking the same file again later
                  }}
                />
              </label>
            </div>
            {media.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {media.map((m, i) => (
                  <div key={m.path} className="relative group rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                    <img src={m.url} alt={m.name} className="w-full h-24 object-cover" />
                    <button
                      onClick={() => handleRemoveMedia(i)}
                      className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                      aria-label={`Remove ${m.name}`}
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            {mediaError && (
              <p className="text-xs text-red-600 mt-2">{mediaError}</p>
            )}
            {isMms && (
              <p className="text-xs text-violet-700 mt-2">
                MMS — Twilio bills a flat rate per recipient regardless of caption length.
              </p>
            )}
          </div>

          {signature && (
            <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
              <span className="font-medium text-slate-600">Your signature:</span> <span className="whitespace-pre-wrap">{signature}</span>
              <span className="block mt-1 text-slate-400">Appended automatically to every message you send.</span>
            </div>
          )}

          {!isMms && smsCount >= 2 && willReceive > 0 && !suggestion && (
            <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-violet-900">
                    This message is {smsCount} segments per recipient.
                  </p>
                  <p className="text-xs text-violet-700 mt-0.5">
                    Shortening to 1 segment could save about $
                    {((smsCount - 1) * willReceive * 0.79 / 100).toFixed(2)} on this send.
                  </p>
                </div>
                <button
                  onClick={requestShortening}
                  disabled={shortening}
                  className="px-3 py-1.5 bg-violet-600 text-white text-xs font-medium rounded-md hover:bg-violet-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {shortening ? 'Thinking…' : '✨ Suggest shorter'}
                </button>
              </div>
              {shortenError && (
                <p className="text-xs text-red-600 mt-2">{shortenError}</p>
              )}
            </div>
          )}

          {suggestion && (
            <div className="rounded-lg border border-violet-300 bg-white p-3 text-sm space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-slate-500">Original</span>
                  <span className="text-xs text-slate-400">
                    {suggestion.original_chars} chars · {suggestion.original_segments} segments
                  </span>
                </div>
                <p className="text-slate-700 whitespace-pre-wrap text-sm bg-slate-50 rounded px-2.5 py-2">{body}</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-violet-700">✨ Suggested</span>
                  <span className="text-xs text-violet-600">
                    {suggestion.shortened_chars} chars · {suggestion.shortened_segments} segments
                  </span>
                </div>
                <p className="text-slate-900 whitespace-pre-wrap text-sm bg-violet-50 border border-violet-200 rounded px-2.5 py-2">{suggestion.shortened}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={acceptShortening}
                  className="px-3 py-1.5 bg-violet-600 text-white text-xs font-medium rounded-md hover:bg-violet-700"
                >
                  Use shortened version
                </button>
                <button
                  onClick={() => setSuggestion(null)}
                  className="px-3 py-1.5 text-slate-600 text-xs font-medium rounded-md border border-slate-300 hover:bg-slate-50"
                >
                  Keep original
                </button>
                <button
                  onClick={requestShortening}
                  disabled={shortening}
                  className="px-3 py-1.5 text-violet-700 text-xs font-medium rounded-md border border-violet-300 hover:bg-violet-50 disabled:opacity-50 ml-auto"
                >
                  {shortening ? 'Thinking…' : 'Try again'}
                </button>
              </div>
            </div>
          )}

          {(body || media.length > 0) && (
            <div className="mx-auto w-64 bg-slate-100 rounded-2xl p-4 space-y-2">
              {media.length > 0 && (
                <div className="bg-green-500 rounded-2xl rounded-bl-sm overflow-hidden max-w-[90%]">
                  <img src={media[0].url} alt="" className="w-full h-auto" />
                  {media.length > 1 && (
                    <div className="bg-green-600 text-white text-[10px] px-2 py-1">+{media.length - 1} more</div>
                  )}
                </div>
              )}
              {body && (
                <div className="bg-green-500 text-white text-sm rounded-2xl rounded-bl-sm px-3 py-2 max-w-[90%] whitespace-pre-wrap">
                  {finalBody}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={scheduleEnabled}
                onChange={(e) => {
                  setScheduleEnabled(e.target.checked)
                  if (!e.target.checked) setScheduledAt('')
                }}
                className="rounded border-slate-300 text-amber-500 focus:ring-amber-500"
              />
              Schedule for later
            </label>
            {scheduleEnabled && (
              <input
                type="datetime-local"
                value={scheduledAt}
                min={minScheduleAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="mt-2 px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep('confirm')}
              disabled={(!body.trim() && media.length === 0) || uploadingMedia || (scheduleEnabled && !scheduledAt)}
              className="px-5 py-2.5 bg-tidings-chrome text-white text-sm font-medium rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Review
            </button>
            <button
              onClick={() => replyTo ? navigate('/inbox') : setStep('recipients')}
              className="px-5 py-2.5 text-slate-600 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50"
            >
              {replyTo ? 'Cancel' : 'Back'}
            </button>
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="text-lg font-medium text-slate-900">Confirm & Send</h2>

          <div className="space-y-3 text-sm">
            {replyTo ? (
              <>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">To</span>
                  <span className="text-slate-900 font-medium">{replyTo.name || replyTo.phone}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Phone</span>
                  <span className="text-slate-900 font-medium">{replyTo.phone}</span>
                </div>
              </>
            ) : (
              <>
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
                {optedOutCount > 0 && (
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-amber-700">Opted out (will be skipped)</span>
                    <span className="text-amber-700 font-medium">{optedOutCount}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Will receive</span>
                  <span className="text-slate-900 font-medium">{recipientCount - optedOutCount}</span>
                </div>
              </>
            )}
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Type</span>
              <span className="text-slate-900 font-medium">
                {isMms
                  ? `MMS (${media.length} ${media.length === 1 ? 'image' : 'images'})`
                  : `SMS — ${smsCount} ${smsCount === 1 ? 'segment' : 'segments'} per recipient`}
              </span>
            </div>
            {scheduleEnabled && scheduledAt && (
              <div className="flex justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">Scheduled for</span>
                <span className="text-slate-900 font-medium">{new Date(scheduledAt).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Estimated cost</span>
              <span className="text-slate-900 font-medium">${estimatedCost}</span>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-3 space-y-2">
            <p className="text-xs text-slate-500 mb-1">Message preview:</p>
            {media.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {media.map((m) => (
                  <img key={m.path} src={m.url} alt={m.name} className="w-full h-20 object-cover rounded border border-slate-200" />
                ))}
              </div>
            )}
            {finalBody && <p className="text-sm text-slate-900 whitespace-pre-wrap">{finalBody}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSend}
              disabled={sending || hardBlock}
              className="px-5 py-2.5 bg-tidings-primary text-white text-sm font-medium rounded-lg hover:bg-tidings-primary-dark disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
            >
              {sending && (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                </svg>
              )}
              {sending
                ? 'Sending…'
                : noWardAssigned
                ? 'No ward assigned'
                : wouldExceed
                ? 'Budget exceeded — blocked'
                : scheduleEnabled
                ? `Schedule ${effectiveRecipientCount} ${effectiveRecipientCount === 1 ? 'message' : 'messages'}`
                : `Send ${effectiveRecipientCount} ${effectiveRecipientCount === 1 ? 'message' : 'messages'}`}
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
