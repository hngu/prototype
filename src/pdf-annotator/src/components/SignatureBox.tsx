import type { PointerEvent as ReactPointerEvent } from 'react'
import { beginDrag } from '../hooks/pointerDrag.ts'
import { clampRect, rectToCss, type PageGeometry } from '../pdf/coords.ts'
import { CORNERS, resizeCorner, type Corner } from '../pdf/resize.ts'
import { useAnnotations } from '../state/annotationsStore.ts'
import type { SignatureAnnotation } from '../state/types.ts'
import { GripBar, ResizeHandle } from './AnnotationFrame.tsx'

export function SignatureBox({
  annotation,
  geometry,
  scale,
  selected,
}: {
  annotation: SignatureAnnotation
  geometry: PageGeometry
  scale: number
  selected: boolean
}) {
  const { select, setRect, remove, checkpoint } = useAnnotations()
  const box = rectToCss(annotation.rect, geometry, scale)

  const startMove = (event: ReactPointerEvent) => {
    const origin = annotation.rect
    checkpoint()
    beginDrag(event, {
      onMove: ({ dx, dy }) =>
        setRect(
          annotation.id,
          clampRect({ ...origin, x: origin.x + dx / scale, y: origin.y - dy / scale }, geometry),
        ),
    })
  }

  const startResize = (corner: Corner, event: ReactPointerEvent) => {
    const origin = annotation.rect
    checkpoint()
    beginDrag(event, {
      onMove: ({ dx, dy }) =>
        setRect(
          annotation.id,
          clampRect(
            resizeCorner(origin, corner, dx / scale, dy / scale, annotation.aspect),
            geometry,
          ),
        ),
    })
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        outline: selected ? '1px solid var(--mantine-color-blue-6)' : 'none',
        outlineOffset: 1,
        cursor: 'move',
        touchAction: 'none',
      }}
      onPointerDown={(event) => {
        event.stopPropagation()
        if (!selected) select(annotation.id)
        startMove(event)
      }}
    >
      <img
        src={annotation.dataUrl}
        alt="Signature"
        draggable={false}
        style={{ display: 'block', width: '100%', height: '100%', pointerEvents: 'none' }}
      />

      {selected && (
        <>
          <GripBar
            width={box.width}
            label="Signature"
            onDragStart={startMove}
            onDelete={() => remove(annotation.id)}
          />
          {CORNERS.map((corner) => (
            <ResizeHandle key={corner} corner={corner} onDragStart={startResize} />
          ))}
        </>
      )}
    </div>
  )
}
