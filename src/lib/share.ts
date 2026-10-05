import { L } from './i18n'
import { useStore } from './store'
import { Capacitor } from '@capacitor/core'

const shareCancelled = (error: unknown) =>
  (error as Error)?.name === 'AbortError' || (error as Error)?.message === 'Share canceled'

/** Shares a coach brief through the phone's share sheet (straight into an AI assistant app), or copies it. */
export async function shareText(text: string, title: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { Share } = await import('@capacitor/share')
      await Share.share({ title, text })
      return
    } catch (error) {
      if (shareCancelled(error)) return
    }
    await copyText(text)
    return
  }
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

const copied = () => L('Copié. Colle-le dans ton assistant IA.', 'Copied. Paste it into your AI assistant.')

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    useStore.getState().notify(copied(), 'good')
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    try {
      document.execCommand('copy')
      useStore.getState().notify(copied(), 'good')
    } catch {
      useStore.getState().notify(L('Copie impossible. Réessaie depuis cette page.', 'Could not copy. Try again from this page.'), 'bad')
    }
    ta.remove()
  }
}

/** Saves a file: share sheet with a file on mobile (Save to Files / Calendar), download elsewhere. */
export async function saveFile(name: string, content: string, type: string): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    const path = `exports/${name}`
    try {
      const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
        import('@capacitor/filesystem'), import('@capacitor/share'),
      ])
      const file = await Filesystem.writeFile({ path, data: content, directory: Directory.Cache, encoding: Encoding.UTF8, recursive: true })
      try {
        await Share.share({ files: [file.uri], title: name })
        return true
      } finally {
        // iOS resolves after the receiving activity finishes. Android receivers
        // can still be reading after the chooser closes; leave their OS cache.
        if (Capacitor.getPlatform() === 'ios') await Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(() => undefined)
      }
    } catch (error) {
      if (!shareCancelled(error)) useStore.getState().notify(L('Export impossible. Réessaie depuis cette page.', 'Export failed. Try again from this page.'), 'bad')
      return false
    }
  }
  const file = new File([content], name, { type })
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean; share?: (d: ShareData) => Promise<void> }
  if (/iPhone|iPad|Android/i.test(navigator.userAgent) && nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: name })
      return true
    } catch (e) {
      if (shareCancelled(e)) return false
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
  return true
}

export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

export function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent)
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
