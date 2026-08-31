import { Box, Loader, Paper, Text } from '@mantine/core'
import { useEffect, useRef, useState } from 'react'
import { viewScale, type PageGeometry, type Point } from '../pdf/coords.ts'
import type { PDFDocumentProxy, PDFPageProxy } from '../pdf/pdfjs.ts'
import { renderPage } from '../pdf/renderPage.ts'
import type { Tool } from '../state/types.ts'
import { AnnotationLayer } from './AnnotationLayer.tsx'

/** How far outside the viewport a page starts rendering. */
const PRERENDER_MARGIN = '600px'

export function PageView({
  doc,
  geometry,
  cssWidth,
  tool,
  onSurfaceClick,
}: {
  doc: PDFDocumentProxy
  geometry: PageGeometry
  cssWidth: number
  tool: Tool
  onSurfaceClick: (point: Point, geometry: PageGeometry) => void
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [page, setPage] = useState<PDFPageProxy | null>(null)
  const [painted, setPainted] = useState(false)
  const [approaching, setApproaching] = useState(false)

  const scale = viewScale(cssWidth, geometry)
  const cssHeight = Math.round(geometry.viewHeight * scale)

  // Long documents would exhaust memory if every page rasterized at once, so a
  // page waits until it is near the viewport. Once loaded it stays loaded.
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper || approaching) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setApproaching(true)
      },
      { rootMargin: PRERENDER_MARGIN },
    )
    observer.observe(wrapper)
    return () => observer.disconnect()
  }, [approaching])

  useEffect(() => {
    if (!approaching) return

    let stale = false
    void doc.getPage(geometry.pageIndex + 1).then((loaded) => {
      if (!stale) setPage(loaded)
    })

    return () => {
      stale = true
    }
  }, [approaching, doc, geometry.pageIndex])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!page || !canvas) return

    const render = renderPage(page, canvas, cssWidth)
    void render.done.then(() => setPainted(true))
    return render.cancel
  }, [page, cssWidth])

  return (
    <Paper
      ref={wrapperRef}
      shadow="sm"
      withBorder
      style={{
        position: 'relative',
        width: cssWidth,
        height: cssHeight,
        background: 'var(--mantine-color-white)',
        overflow: 'visible',
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block', position: 'absolute', inset: 0 }} />

      {!painted && (
        <Box
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Loader size="sm" />
          <Text size="xs" c="dimmed">
            Page {geometry.pageIndex + 1}
          </Text>
        </Box>
      )}

      <AnnotationLayer
        geometry={geometry}
        scale={scale}
        tool={tool}
        onSurfaceClick={onSurfaceClick}
      />
    </Paper>
  )
}
