import { supabase } from './supabase'

export const VAPID_PUBLIC_KEY =
  'BFRTR1VvWb13hL6S0lsD-jiIb1ppm2rG4kjIJ-_pPxbEDhj3QesEGNgMieRjEDI1OfpyyZAmGGv4DeKU5LrGNdk'

export type PushSupportState =
  | 'unsupported'
  | 'denied'
  | 'default'
  | 'granted-no-sub'
  | 'subscribed'

export function pushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export async function getPushState(userId: string | undefined): Promise<PushSupportState> {
  if (!pushSupported()) return 'unsupported'
  const perm = Notification.permission
  if (perm === 'denied') return 'denied'
  if (perm === 'default') return 'default'
  if (!userId) return 'granted-no-sub'
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return 'granted-no-sub'
  const { data } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('endpoint', sub.endpoint)
    .maybeSingle()
  return data ? 'subscribed' : 'granted-no-sub'
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function bufToB64(buf: ArrayBuffer | null): string {
  if (!buf) return ''
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function subscribeToPush(userId: string): Promise<{ ok: boolean; reason?: string }> {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' }

  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return { ok: false, reason: perm }

  let reg = await navigator.serviceWorker.getRegistration()
  if (!reg) reg = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }

  const json = sub.toJSON()
  const p256dh = (json.keys as { p256dh?: string } | undefined)?.p256dh
    ?? bufToB64(sub.getKey('p256dh'))
  const auth = (json.keys as { auth?: string } | undefined)?.auth
    ?? bufToB64(sub.getKey('auth'))

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        user_id: userId,
        endpoint: sub.endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    )
  if (error) {
    console.warn('[push] failed to persist subscription', error)
    return { ok: false, reason: 'db-error' }
  }
  return { ok: true }
}

export async function setLocalAppBadge(count: number): Promise<void> {
  if (typeof navigator === 'undefined') return
  try {
    if (count > 0 && 'setAppBadge' in navigator) {
      await (navigator as Navigator & { setAppBadge: (n: number) => Promise<void> }).setAppBadge(count)
    } else if ('clearAppBadge' in navigator) {
      await (navigator as Navigator & { clearAppBadge: () => Promise<void> }).clearAppBadge()
    }
  } catch {
    // Browser doesn't support badging — silently ignore.
  }
}
