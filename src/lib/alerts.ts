// Rest-timer alerts: sound, vibration, system notification, screen wake lock.
let audio: AudioContext | null = null

/** Must be called from a user gesture (iOS unlocks Web Audio only then). */
export function unlockAudio(): void {
  try {
    const nav = navigator as Navigator & { audioSession?: { type: string } }
    if (nav.audioSession) nav.audioSession.type = 'transient'
    if (!audio) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      audio = new Ctor()
    }
    if (audio.state === 'suspended') void audio.resume()
  } catch {
    /* audio unavailable */
  }
}

/** Three short rising tones — a mechanical chime, not an alarm. */
export function chime(): void {
  if (!audio) return
  try {
    const t0 = audio.currentTime + 0.02
    ;[0, 0.22, 0.44].forEach((dt, i) => {
      const o = audio!.createOscillator()
      const g = audio!.createGain()
      o.type = 'sine'
      o.frequency.value = [880, 988, 1319][i]
      g.gain.setValueAtTime(0.0001, t0 + dt)
      g.gain.exponentialRampToValueAtTime(0.32, t0 + dt + 0.015)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.2)
      o.connect(g).connect(audio!.destination)
      o.start(t0 + dt)
      o.stop(t0 + dt + 0.22)
    })
  } catch {
    /* ignore */
  }
}

export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* unsupported (iOS) */
  }
}

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export async function requestNotifications(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

export async function systemNotify(title: string, body: string): Promise<boolean> {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) {
      await reg.showNotification(title, { body, tag: 'golgoth-rest', icon: 'icons/pwa-192.png', badge: 'icons/pwa-192.png', silent: false } as NotificationOptions)
      return true
    }
    new Notification(title, { body })
    return true
  } catch {
    return false
  }
}

type Sentinel = { release: () => Promise<void>; released?: boolean }
let lock: Sentinel | null = null
let wanted = false

export async function keepAwake(on: boolean): Promise<void> {
  wanted = on
  try {
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Sentinel> } }).wakeLock
    if (!wl) return
    if (on && (!lock || lock.released)) lock = await wl.request('screen')
    if (!on && lock) {
      await lock.release()
      lock = null
    }
  } catch {
    /* denied or unsupported */
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && wanted) void keepAwake(true)
  })
}
