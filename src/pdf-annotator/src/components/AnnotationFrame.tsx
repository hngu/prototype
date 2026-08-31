import { CloseButton } from '@mantine/core'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Corner } from '../pdf/resize.ts'

const GRIP_HEIGHT = 20

/**
 * The bar above a selected annotation. Text boxes need a dedicated drag target
 * because a pointerdown on the body has to place the caret instead of starting a
 * move, and giving signatures the same bar keeps the two consistent.
 */
export function GripBar({
  width,
  label,
  onDragStart,
  onDelete,
}: {
  width: number
  label: string
  onDragStart: (event: ReactPointerEvent) => void
  onDelete: () => void
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: -1,
        top: -GRIP_HEIGHT,
        height: GRIP_HEIGHT,
        minWidth: 72,
        width: Math.max(width + 2, 72),
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '0 2px 0 6px',
        borderRadius: '4px 4px 0 0',
        background: 'var(--mantine-color-blue-6)',
        color: 'var(--mantine-color-white)',
        fontSize: 11,
        lineHeight: 1,
        cursor: 'move',
        userSelect: 'none',
        touchAction: 'none',
      }}
      onPointerDown={onDragStart}
    >
      <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden' }}>{label}</span>
      <CloseButton
        size="xs"
        variant="transparent"
        c="white"
        aria-label="Delete annotation"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onDelete}
      />
    </div>
  )
}

const HANDLE_SIZE = 10

export function ResizeHandle({
  corner,
  onDragStart,
}: {
  corner: Corner
  onDragStart: (corner: Corner, event: ReactPointerEvent) => void
}) {
  const offset = -HANDLE_SIZE / 2

  return (
    <div
      role="presentation"
      onPointerDown={(event) => onDragStart(corner, event)}
      style={{
        position: 'absolute',
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
        left: corner.includes('w') ? offset : undefined,
        right: corner.includes('e') ? offset : undefined,
        top: corner.includes('n') ? offset : undefined,
        bottom: corner.includes('s') ? offset : undefined,
        background: 'var(--mantine-color-white)',
        border: '1px solid var(--mantine-color-blue-6)',
        borderRadius: 2,
        cursor: corner === 'nw' || corner === 'se' ? 'nwse-resize' : 'nesw-resize',
        touchAction: 'none',
      }}
    />
  )
}
