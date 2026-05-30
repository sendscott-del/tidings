import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Latest blended per-unit rates from tidings_rate_cache. Used by Compose to
// estimate cost and gate sends against ward budgets. Falls back to the prior
// hardcoded values if the cache is unreachable so the app keeps working.
//
// SMS rate is per segment. MMS rate is per recipient (flat regardless of
// caption length, matching how Twilio bills MMS).

const FALLBACK_SMS_CENTS = 0.79
const FALLBACK_MMS_CENTS = 2.0

export type RateInfo = {
  smsCentsPerSegment: number
  mmsCentsPerMessage: number
  source: 'cache' | 'fallback'
  smsComputedAt: string | null
  mmsComputedAt: string | null
  smsRowSource: string | null
  mmsRowSource: string | null
}

const DEFAULTS: RateInfo = {
  smsCentsPerSegment: FALLBACK_SMS_CENTS,
  mmsCentsPerMessage: FALLBACK_MMS_CENTS,
  source: 'fallback',
  smsComputedAt: null,
  mmsComputedAt: null,
  smsRowSource: null,
  mmsRowSource: null,
}

export function useRates(): RateInfo {
  const [rates, setRates] = useState<RateInfo>(DEFAULTS)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('tidings_rate_cache')
        .select('channel, cents_per_unit, source, computed_at')
        .eq('country', 'US')
        .in('channel', ['sms', 'mms'])
        .order('computed_at', { ascending: false })
        .limit(20)

      if (cancelled || error || !data?.length) return

      const sms = data.find((r) => r.channel === 'sms')
      const mms = data.find((r) => r.channel === 'mms')

      setRates({
        smsCentsPerSegment: sms ? Number(sms.cents_per_unit) : FALLBACK_SMS_CENTS,
        mmsCentsPerMessage: mms ? Number(mms.cents_per_unit) : FALLBACK_MMS_CENTS,
        source: sms || mms ? 'cache' : 'fallback',
        smsComputedAt: sms?.computed_at ?? null,
        mmsComputedAt: mms?.computed_at ?? null,
        smsRowSource: sms?.source ?? null,
        mmsRowSource: mms?.source ?? null,
      })
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return rates
}
