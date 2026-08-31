import { RenderingCancelledException, type PDFPageProxy } from './pdfjs.ts'

export type PageRender = {
  /** Resolves when the page is painted, or immediately if the render was cancelled. */
  done: Promise<void>
  cancel: () => void
}

/**
 * Draws a page into a canvas at `cssWidth` CSS pixels wide, backing it with a
 * device-pixel-ratio sized bitmap so text stays sharp on HiDPI screens.
 *
 * React effects must call `cancel` on cleanup, otherwise a superseded render
 * (from a fast zoom, say) finishes late and paints stale pixels over the
 * current one.
 */
export function renderPage(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  cssWidth: number,
): PageRender {
  const base = page.getViewport({ scale: 1 })
  const scale = cssWidth / base.width
  const dpr = window.devicePixelRatio || 1
  const viewport = page.getViewport({ scale: scale * dpr })

  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)
  canvas.style.width = `${Math.round(base.width * scale)}px`
  canvas.style.height = `${Math.round(base.height * scale)}px`

  const task = page.render({ canvas, viewport })
  const done = task.promise.catch((error: unknown) => {
    if (error instanceof RenderingCancelledException) return
    throw error
  })

  return { done, cancel: () => task.cancel() }
}
