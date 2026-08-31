import { describe, expect, it } from 'vitest'
import { resizeCorner } from './resize.ts'

const origin = { x: 100, y: 200, width: 180, height: 60 }
const aspect = 3

describe('resizeCorner', () => {
  it('keeps the aspect ratio', () => {
    const resized = resizeCorner(origin, 'se', 60, 0, aspect)
    expect(resized.width / resized.height).toBeCloseTo(aspect, 6)
  })

  it('grows to the right and down from the south-east corner, holding the top-left', () => {
    const resized = resizeCorner(origin, 'se', 60, 20, aspect)
    expect(resized.x).toBe(origin.x)
    expect(resized.y + resized.height).toBeCloseTo(origin.y + origin.height, 6)
    expect(resized.width).toBeGreaterThan(origin.width)
  })

  it('holds the opposite corner when dragging north-west', () => {
    const resized = resizeCorner(origin, 'nw', -60, -20, aspect)
    expect(resized.x + resized.width).toBeCloseTo(origin.x + origin.width, 6)
    expect(resized.y).toBe(origin.y)
    expect(resized.width).toBeGreaterThan(origin.width)
  })

  it('shrinks when the corner is dragged inward', () => {
    expect(resizeCorner(origin, 'se', -60, -20, aspect).width).toBeLessThan(origin.width)
  })

  it('refuses to shrink below the minimum width', () => {
    const resized = resizeCorner(origin, 'se', -10_000, -10_000, aspect)
    expect(resized.width).toBe(24)
    expect(resized.height).toBeCloseTo(8, 6)
  })

  it('treats a pure vertical drag as a proportional resize', () => {
    // Dragging the bottom edge down by 20pt asks for 20pt more height, which at
    // this aspect is 60pt more width; averaged with the idle x axis, 30pt.
    expect(resizeCorner(origin, 'se', 0, 20, aspect).width).toBeCloseTo(210, 6)
  })
})
