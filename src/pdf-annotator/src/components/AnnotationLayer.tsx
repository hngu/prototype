import { cssPointToView, type PageGeometry, type Point } from '../pdf/coords.ts'
import { useAnnotations } from '../state/annotationsStore.ts'
import type { Tool } from '../state/types.ts'
import { SignatureBox } from './SignatureBox.tsx'
import { TextBox } from './TextBox.tsx'

/**
 * Transparent surface over a rendered page. Owns hit testing: a pointerdown that
 * reaches this element rather than one of its children is a click on the page
 * itself, which is what places a new annotation.
 */
export function AnnotationLayer({
  geometry,
  scale,
  tool,
  onSurfaceClick,
}: {
  geometry: PageGeometry
  scale: number
  tool: Tool
  onSurfaceClick: (point: Point, geometry: PageGeometry) => void
}) {
  const { annotations, selectedId } = useAnnotations()
  const onThisPage = annotations.filter((a) => a.pageIndex === geometry.pageIndex)

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        cursor: tool === 'select' ? 'default' : 'crosshair',
        touchAction: 'none',
      }}
      onPointerDown={(event) => {
        if (event.target !== event.currentTarget) return
        const bounds = event.currentTarget.getBoundingClientRect()
        onSurfaceClick(
          cssPointToView(event.clientX - bounds.left, event.clientY - bounds.top, geometry, scale),
          geometry,
        )
      }}
    >
      {onThisPage.map((annotation) =>
        annotation.kind === 'text' ? (
          <TextBox
            key={annotation.id}
            annotation={annotation}
            geometry={geometry}
            scale={scale}
            selected={annotation.id === selectedId}
          />
        ) : (
          <SignatureBox
            key={annotation.id}
            annotation={annotation}
            geometry={geometry}
            scale={scale}
            selected={annotation.id === selectedId}
          />
        ),
      )}
    </div>
  )
}
