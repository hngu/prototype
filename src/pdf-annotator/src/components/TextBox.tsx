import { notifications } from '@mantine/notifications'
import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { beginDrag } from '../hooks/pointerDrag.ts'
import { clampRect, rectToCss, type PageGeometry } from '../pdf/coords.ts'
import { baselineOffset, textSize } from '../pdf/measure.ts'
import { lineHeight, resizeFromTopLeft } from '../pdf/textLayout.ts'
import { stripUnsupported, unsupportedCharacters } from '../pdf/winAnsi.ts'
import { useAnnotations } from '../state/annotationsStore.ts'
import { FONT_STACKS, type TextAnnotation } from '../state/types.ts'
import { GripBar } from './AnnotationFrame.tsx'

export function TextBox({
  annotation,
  geometry,
  scale,
  selected,
}: {
  annotation: TextAnnotation
  geometry: PageGeometry
  scale: number
  selected: boolean
}) {
  const { select, setRect, setText, remove, checkpoint } = useAnnotations()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const box = rectToCss(annotation.rect, geometry, scale)
  const fontPx = annotation.fontSize * scale
  const lineHeightPx = lineHeight(annotation.fontSize) * scale
  const baselineNudge = baselineOffset(annotation.font, annotation.fontSize) * scale

  useEffect(() => {
    if (selected) textareaRef.current?.focus()
  }, [selected])

  const applyValue = (value: string) => {
    if (unsupportedCharacters(value).length > 0) {
      notifications.show({
        id: 'unsupported-character',
        color: 'yellow',
        title: 'Character not available',
        message: 'The PDF standard fonts cannot render that character, so it was left out.',
      })
    }

    const lines = value.split('\n').map(stripUnsupported)
    const size = textSize(lines, annotation.font, annotation.fontSize)

    setText(annotation.id, { lines })
    setRect(
      annotation.id,
      clampRect(resizeFromTopLeft(annotation.rect, size.width, size.height), geometry),
    )
  }

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
      }}
      onPointerDown={(event) => {
        if (selected) return
        event.stopPropagation()
        select(annotation.id)
      }}
    >
      {selected && (
        <GripBar
          width={box.width}
          label={`Text ${Math.round(annotation.fontSize)}pt`}
          onDragStart={startMove}
          onDelete={() => remove(annotation.id)}
        />
      )}

      <textarea
        ref={textareaRef}
        value={annotation.lines.join('\n')}
        onChange={(event) => applyValue(event.target.value)}
        onFocus={checkpoint}
        onKeyDown={(event) => {
          // The page owns Delete and Escape, but not while the caret is here.
          event.stopPropagation()
          if (event.key === 'Escape') select(null)
        }}
        spellCheck={false}
        wrap="off"
        aria-label="Annotation text"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: box.width + fontPx * 1.5,
          height: box.height,
          transform: `translateY(${baselineNudge}px)`,
          margin: 0,
          padding: 0,
          border: 'none',
          outline: 'none',
          resize: 'none',
          overflow: 'hidden',
          background: 'transparent',
          whiteSpace: 'pre',
          color: annotation.color,
          caretColor: annotation.color,
          fontFamily: FONT_STACKS[annotation.font],
          fontSize: `${fontPx}px`,
          lineHeight: `${lineHeightPx}px`,
          pointerEvents: selected ? 'auto' : 'none',
        }}
      />
    </div>
  )
}
