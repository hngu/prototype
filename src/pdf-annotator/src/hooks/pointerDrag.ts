import type { PointerEvent as ReactPointerEvent } from 'react'

export type DragDelta = { dx: number; dy: number }

export type DragHandlers = {
  onStart?: () => void
  onMove: (delta: DragDelta) => void
  onEnd?: () => void
}

/**
 * Starts a pointer drag, reporting the cumulative offset from where it began.
 *
 * Listeners go on the window so the gesture survives the pointer leaving the
 * element, and the callbacks are captured at pointerdown: consumers snapshot the
 * rect they are about to change in `onStart` and derive every later value from
 * that snapshot plus the delta, which keeps a re-render mid-drag from feeding
 * its own output back in.
 */
export function beginDrag(event: ReactPointerEvent, handlers: DragHandlers): void {
  if (event.button !== 0) return

  event.preventDefault()
  event.stopPropagation()

  const startX = event.clientX
  const startY = event.clientY
  handlers.onStart?.()

  const move = (moveEvent: PointerEvent) => {
    handlers.onMove({ dx: moveEvent.clientX - startX, dy: moveEvent.clientY - startY })
  }

  const finish = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', finish)
    window.removeEventListener('pointercancel', finish)
    handlers.onEnd?.()
  }

  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', finish)
  window.addEventListener('pointercancel', finish)
}
