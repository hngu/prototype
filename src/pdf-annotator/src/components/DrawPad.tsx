import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { PAD_SIZE, strokeToPath, type Stroke, type StrokePoint } from '../pdf/rasterize.ts'

/** A mark this short is a stray tap, not a pen stroke. */
const MIN_POINTS = 2

export function DrawPad({
  strokes,
  onStrokesChange,
  color,
}: {
  strokes: Stroke[]
  onStrokesChange: (strokes: Stroke[]) => void
  color: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [current, setCurrent] = useState<Stroke | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = PAD_SIZE.width * dpr
    canvas.height = PAD_SIZE.height * dpr

    const context = canvas.getContext('2d')
    if (!context) return

    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    context.clearRect(0, 0, PAD_SIZE.width, PAD_SIZE.height)
    context.fillStyle = color

    for (const stroke of current ? [...strokes, current] : strokes) {
      const path = strokeToPath(stroke)
      if (path) context.fill(new Path2D(path))
    }
  }, [strokes, current, color])

  const pointFrom = (event: ReactPointerEvent<HTMLCanvasElement>): StrokePoint => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return [event.clientX - bounds.left, event.clientY - bounds.top, event.pressure || 0.5]
  }

  return (
    <canvas
      ref={canvasRef}
      aria-label="Signature drawing area"
      style={{
        display: 'block',
        width: PAD_SIZE.width,
        height: PAD_SIZE.height,
        maxWidth: '100%',
        borderRadius: 'var(--mantine-radius-md)',
        border: '1px dashed var(--mantine-color-gray-4)',
        background: 'var(--mantine-color-gray-0)',
        cursor: 'crosshair',
        touchAction: 'none',
      }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        setCurrent([pointFrom(event)])
      }}
      onPointerMove={(event) => {
        if (!current) return
        const point = pointFrom(event)
        setCurrent((stroke) => (stroke ? [...stroke, point] : stroke))
      }}
      onPointerUp={() => {
        if (current && current.length >= MIN_POINTS) onStrokesChange([...strokes, current])
        setCurrent(null)
      }}
      onPointerCancel={() => setCurrent(null)}
    />
  )
}
