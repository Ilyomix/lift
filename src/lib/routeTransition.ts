import { mainRouteIndex } from './swipeNavigation'

export type PageSnapshot = { node: HTMLElement; scrollY: number; width: number }

/** A visual copy only: no React mount, subscriptions, portals or active embeds. */
export function snapshotPage(screen: HTMLElement, width: number): PageSnapshot {
  const node = screen.cloneNode(true) as HTMLElement
  node.style.removeProperty('translate')
  node.style.removeProperty('will-change')
  node.style.removeProperty('opacity')
  node.querySelectorAll('[id], [autofocus]').forEach(el => { el.removeAttribute('id'); el.removeAttribute('autofocus') })
  const originals = screen.querySelectorAll('canvas')
  node.querySelectorAll('canvas').forEach((canvas, index) => {
    try {
      const image = document.createElement('img')
      image.src = originals[index].toDataURL()
      image.className = canvas.className
      image.style.cssText = canvas.style.cssText
      image.width = canvas.width; image.height = canvas.height
      canvas.replaceWith(image)
    } catch { canvas.remove() }
  })
  node.querySelectorAll('iframe, script, audio, video').forEach(el => el.remove())
  return { node, scrollY: window.scrollY, width }
}

export function routeDirection(from: string, to: string, previousIndex: number, nextIndex: number) {
  const a = mainRouteIndex(from), b = mainRouteIndex(to)
  if (a >= 0 && b >= 0 && a !== b) return b > a ? -1 : 1
  return nextIndex < previousIndex ? 1 : -1
}

/** Both pages share the same displacement, so no gap opens between them. */
export function pageOffsets(offset: number, direction: number, width: number) {
  return { outgoing: offset, incoming: offset - direction * width }
}
