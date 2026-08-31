import { describe, expect, it } from 'vitest'
import {
  clampRect,
  cssPointToView,
  pageGeometry,
  rectToCss,
  userToView,
  viewScale,
  viewToUser,
  type PageGeometry,
} from './coords.ts'

const a4 = (rotate = 0, view = [0, 0, 595, 842]) => pageGeometry(0, rotate, view)

describe('pageGeometry', () => {
  it('reports the displayed size unchanged for an upright page', () => {
    const geometry = a4()
    expect(geometry.viewWidth).toBe(595)
    expect(geometry.viewHeight).toBe(842)
  })

  it('swaps the displayed size on a quarter turn', () => {
    for (const rotate of [90, 270]) {
      const geometry = a4(rotate)
      expect(geometry.viewWidth).toBe(842)
      expect(geometry.viewHeight).toBe(595)
    }
  })

  it('normalizes rotation to a quarter turn in [0, 360)', () => {
    expect(a4(-90).rotation).toBe(270)
    expect(a4(450).rotation).toBe(90)
    expect(a4(0).rotation).toBe(0)
  })

  it('records the offset of an inset crop box', () => {
    const geometry = a4(0, [20, 30, 615, 872])
    expect(geometry.offsetX).toBe(20)
    expect(geometry.offsetY).toBe(30)
    expect(geometry.viewWidth).toBe(595)
    expect(geometry.viewHeight).toBe(842)
  })
})

describe('css <-> view space', () => {
  const geometry = a4()
  const scale = viewScale(1190, geometry) // rendered at 2x

  it('flips the y axis', () => {
    const box = rectToCss({ x: 100, y: 742, width: 200, height: 100 }, geometry, scale)
    expect(box).toEqual({ left: 200, top: 0, width: 400, height: 200 })
  })

  it('round-trips a point through the css mapping', () => {
    const view = cssPointToView(200, 0, geometry, scale)
    expect(view).toEqual({ x: 100, y: 842 })
  })

  it('puts the view-space origin at the bottom-left of the rendered page', () => {
    const cssHeight = geometry.viewHeight * scale
    expect(cssPointToView(0, cssHeight, geometry, scale)).toEqual({ x: 0, y: 0 })
  })
})

describe('view <-> user space', () => {
  const cases: Array<[string, PageGeometry]> = [
    ['upright', a4(0)],
    ['rotated 90', a4(90)],
    ['rotated 180', a4(180)],
    ['rotated 270', a4(270)],
    ['rotated 90 with inset crop box', a4(90, [20, 30, 615, 872])],
  ]

  for (const [label, geometry] of cases) {
    it(`round-trips every corner when ${label}`, () => {
      const corners = [
        { x: 0, y: 0 },
        { x: geometry.viewWidth, y: 0 },
        { x: 0, y: geometry.viewHeight },
        { x: geometry.viewWidth, y: geometry.viewHeight },
        { x: 123, y: 456 },
      ]

      for (const corner of corners) {
        const round = userToView(viewToUser(corner, geometry), geometry)
        expect(round.x).toBeCloseTo(corner.x, 6)
        expect(round.y).toBeCloseTo(corner.y, 6)
      }
    })

    it(`maps the view origin inside the page box when ${label}`, () => {
      const user = viewToUser({ x: 0, y: 0 }, geometry)
      expect(user.x).toBeGreaterThanOrEqual(geometry.offsetX - 1e-9)
      expect(user.x).toBeLessThanOrEqual(geometry.offsetX + geometry.boxWidth + 1e-9)
      expect(user.y).toBeGreaterThanOrEqual(geometry.offsetY - 1e-9)
      expect(user.y).toBeLessThanOrEqual(geometry.offsetY + geometry.boxHeight + 1e-9)
    })
  }

  it('is the identity on an upright page with no offset', () => {
    expect(viewToUser({ x: 42, y: 99 }, a4())).toEqual({ x: 42, y: 99 })
  })

  it('follows the sheet when a 90 degree page is displayed', () => {
    // Rotating the sheet clockwise carries the unrotated bottom-right corner to
    // the displayed bottom-left, and the top-right corner to the bottom-right.
    expect(viewToUser({ x: 0, y: 0 }, a4(90))).toEqual({ x: 595, y: 0 })
    expect(viewToUser({ x: 842, y: 0 }, a4(90))).toEqual({ x: 595, y: 842 })
    expect(userToView({ x: 0, y: 0 }, a4(90))).toEqual({ x: 0, y: 595 })
  })
})

describe('clampRect', () => {
  const geometry = a4()

  it('leaves a rect that already fits alone', () => {
    const rect = { x: 10, y: 10, width: 100, height: 50 }
    expect(clampRect(rect, geometry)).toEqual(rect)
  })

  it('pushes an overhanging rect back onto the page', () => {
    expect(clampRect({ x: 580, y: -20, width: 100, height: 50 }, geometry)).toEqual({
      x: 495,
      y: 0,
      width: 100,
      height: 50,
    })
  })

  it('shrinks a rect larger than the page', () => {
    expect(clampRect({ x: -10, y: -10, width: 900, height: 1000 }, geometry)).toEqual({
      x: 0,
      y: 0,
      width: 595,
      height: 842,
    })
  })
})
