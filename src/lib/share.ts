import { L } from './i18n'
import { useStore } from './store'

/** Shares text through the iOS share sheet (straight into the Claude app), or copies it. */
export async function shareText(text: string, title: string): Promise<void> {
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> }
  if (nav.share && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
    try {
      await nav.share({ title, text })
      return
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return
    }
  }
  await copyText(text)
}

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    useStore.getState().notify(L('Copié. Colle-le dans Claude.', 'Copied. Paste it into Claude.'), 'good')
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand('copy')
      useStore.getState().notify(L('Copié. Colle-le dans Claude.', 'Copied. Paste it into Claude.'), 'good')
    } catch {
      useStore.getState().notify(L('Copie impossible sur cet appareil.', 'Copying isn’t possible on this device.'), 'bad')
    }
    ta.remove()
  }
}

/** Saves a file: share sheet with a file on mobile (Save to Files / Calendar), download elsewhere. */
export async function saveFile(name: string, content: string, type: string): Promise<void> {
  const file = new File([content], name, { type })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean; share?: (d: ShareData) => Promise<void> }
  if (/iPhone|iPad|Android/i.test(navigator.userAgent) && nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: name })
      return
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return
    }
  }
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/** Downscales a photo to keep IndexedDB and backups light. */
export async function imageToDataUrl(file: File, max = 1400, quality = 0.84): Promise<string> {
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) {
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.onerror = () => reject(r.error)
      r.readAsDataURL(file)
    })
  }
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}
