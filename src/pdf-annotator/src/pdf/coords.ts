/**
 * Coordinate plumbing.
 *
 * There are three spaces in play and mixing them up is the main source of bugs
 * in a PDF annotator, so they get explicit names:
 *
 * - **CSS space**: pixels inside the page's overlay element. Origin top-left, y down.
 * - **View space**: PDF points on the page *as displayed*, i.e. with /Rotate
 *   already applied. Origin bottom-left, y up. Annotations are stored here, so
 *   every interaction in the UI can ignore rotation, zoom and device pixel ratio.
 * - **User space**: the PDF's own coordinate system, what pdf-lib draws into.
 *   Only `exportPdf` needs it.
 */

export type Point = { x: number; y: number }

/** Origin bottom-left, PDF points, view space. */
export type Rect = { x: number; y: number; width: number; height: number }

export type PageGeometry = {
  pageIndex: number
  /** /Rotate normalized to 0 | 90 | 180 | 270. */
  rotation: number
  /** View box (CropBox) size in points, before rotation. */
  boxWidth: number
  boxHeight: number
  /** View box lower-left corner in user space. Non-zero when the CropBox is inset. */
  offsetX: number
  offsetY: number
  /** Page size as displayed, rotation applied. */
  viewWidth: number
  viewHeight: number
}

/**
 * Builds geometry from pdf.js's `page.rotate` and `page.view`
 * (the view box as `[x1, y1, x2, y2]` in user space).
 */
export function pageGeometry(pageIndex: number, rotate: number, view: number[]): PageGeometry {
  const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = view
  const boxWidth = Math.abs(x2 - x1)
  const boxHeight = Math.abs(y2 - y1)
  const rotation = normalizeRotation(rotate)
  const quarterTurn = rotation === 90 || rotation === 270

  return {
    pageIndex,
    rotation,
    boxWidth,
    boxHeight,
    offsetX: Math.min(x1, x2),
    offsetY: Math.min(y1, y2),
    viewWidth: quarterTurn ? boxHeight : boxWidth,
    viewHeight: quarterTurn ? boxWidth : boxHeight,
  }
}

export function normalizeRotation(angle: number): number {
  const snapped = Math.round(angle / 90) * 90
  return ((snapped % 360) + 360) % 360
}

/** CSS pixels per PDF point for a page rendered at `cssWidth`. */
export function viewScale(cssWidth: number, geometry: PageGeometry): number {
  return cssWidth / geometry.viewWidth
}

export type CssBox = { left: number; top: number; width: number; height: number }

export function rectToCss(rect: Rect, geometry: PageGeometry, scale: number): CssBox {
  return {
    left: rect.x * scale,
    top: (geometry.viewHeight - rect.y - rect.height) * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  }
}

export function cssPointToView(px: number, py: number, geometry: PageGeometry, scale: number): Point {
  return { x: px / scale, y: geometry.viewHeight - py / scale }
}

/**
 * View space -> PDF user space.
 *
 * /Rotate rotates the page clockwise for display, so undoing it means rotating
 * the point counter-clockwise and translating it back into the box, then adding
 * the view box offset.
 */
export function viewToUser(point: Point, geometry: PageGeometry): Point {
  const { boxWidth, boxHeight, offsetX, offsetY, rotation } = geometry
  let x: number
  let y: number

  switch (rotation) {
    case 90:
      x = boxWidth - point.y
      y = point.x
      break
    case 180:
      x = boxWidth - point.x
      y = boxHeight - point.y
      break
    case 270:
      x = point.y
      y = boxHeight - point.x
      break
    default:
      x = point.x
      y = point.y
  }

  return { x: x + offsetX, y: y + offsetY }
}

/** Inverse of {@link viewToUser}. */
export function userToView(point: Point, geometry: PageGeometry): Point {
  const { boxWidth, boxHeight, offsetX, offsetY, rotation } = geometry
  const x = point.x - offsetX
  const y = point.y - offsetY

  switch (rotation) {
    case 90:
      return { x: y, y: boxWidth - x }
    case 180:
      return { x: boxWidth - x, y: boxHeight - y }
    case 270:
      return { x: boxHeight - y, y: x }
    default:
      return { x, y }
  }
}

/** Keeps a rect inside the page, preserving its size when it fits. */
export function clampRect(rect: Rect, geometry: PageGeometry): Rect {
  const width = Math.min(rect.width, geometry.viewWidth)
  const height = Math.min(rect.height, geometry.viewHeight)

  return {
    width,
    height,
    x: clamp(rect.x, 0, geometry.viewWidth - width),
    y: clamp(rect.y, 0, geometry.viewHeight - height),
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}
