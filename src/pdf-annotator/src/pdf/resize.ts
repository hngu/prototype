import type { Rect } from './coords.ts'
import { MIN_SIGNATURE_WIDTH } from '../state/types.ts'

export type Corner = 'nw' | 'ne' | 'sw' | 'se'

export const CORNERS: Corner[] = ['nw', 'ne', 'sw', 'se']

/**
 * Aspect-locked corner resize, in view space.
 *
 * Both axes of the gesture contribute so dragging a corner diagonally feels
 * right, and the two edges the user is not holding stay put: the west corners
 * keep the right edge, the north corners keep the bottom edge.
 *
 * `dy` arrives in CSS direction (down is positive) while view space has y up,
 * hence the north/south sign flip.
 */
export function resizeCorner(
  origin: Rect,
  corner: Corner,
  dx: number,
  dy: number,
  aspect: number,
): Rect {
  const fromX = corner.includes('e') ? dx : -dx
  const fromY = corner.includes('s') ? dy : -dy
  const width = Math.max(MIN_SIGNATURE_WIDTH, origin.width + (fromX + fromY * aspect) / 2)
  const height = width / aspect

  return {
    width,
    height,
    x: corner.includes('e') ? origin.x : origin.x + origin.width - width,
    y: corner.includes('n') ? origin.y : origin.y + origin.height - height,
  }
}
