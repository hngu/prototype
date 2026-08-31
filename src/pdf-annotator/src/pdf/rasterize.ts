import { getStroke } from 'perfect-freehand'

/**
 * Every signature — drawn, typed or uploaded — ends up as a trimmed PNG. One
 * representation means placement, resizing and export have a single code path,
 * and the alpha channel keeps the page showing through.
 */
export type SignatureImage = { dataUrl: string; aspect: number }

export const SIGNATURE_FONT = 'Great Vibes'

/** CSS size of the drawing pad. Stroke coordinates are relative to it. */
export const PAD_SIZE = { width: 520, height: 190 }

/** Bitmaps are rendered above CSS size so a signature stays crisp when enlarged. */
const OVERSAMPLE = 3

/** Ink threshold below which a pixel counts as blank when trimming. */
const ALPHA_FLOOR = 8

const TRIM_PADDING = 2

export type StrokePoint = [x: number, y: number, pressure: number]
export type Stroke = StrokePoint[]

const STROKE_OPTIONS = {
  size: 4,
  thinning: 0.6,
  smoothing: 0.6,
  streamline: 0.4,
  simulatePressure: true,
}

/** perfect-freehand returns an outline polygon; this is its documented path builder. */
export function strokeToPath(stroke: Stroke, sizeScale = 1): string {
  const outline = getStroke(stroke, { ...STROKE_OPTIONS, size: STROKE_OPTIONS.size * sizeScale })
  if (outline.length === 0) return ''

  const parts: Array<string | number> = ['M', outline[0]?.[0] ?? 0, outline[0]?.[1] ?? 0, 'Q']
  for (let i = 0; i < outline.length; i += 1) {
    const [x0 = 0, y0 = 0] = outline[i] ?? []
    const [x1 = 0, y1 = 0] = outline[(i + 1) % outline.length] ?? []
    parts.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
  }
  parts.push('Z')

  return parts.join(' ')
}

export function strokesToPng(
  strokes: Stroke[],
  size: { width: number; height: number },
  color: string,
): SignatureImage | null {
  if (strokes.every((stroke) => stroke.length === 0)) return null

  const { canvas, context } = createCanvas(size.width * OVERSAMPLE, size.height * OVERSAMPLE)
  context.scale(OVERSAMPLE, OVERSAMPLE)
  context.fillStyle = color

  for (const stroke of strokes) {
    const path = strokeToPath(stroke)
    if (path) context.fill(new Path2D(path))
  }

  return finish(canvas)
}

export async function loadSignatureFont(sample: string): Promise<void> {
  if (!('fonts' in document)) return
  try {
    await document.fonts.load(`64px "${SIGNATURE_FONT}"`, sample || 'Signature')
  } catch {
    // Falls back to the generic cursive stack declared alongside the @font-face.
  }
}

export async function typedSignatureToPng(
  text: string,
  color: string,
): Promise<SignatureImage | null> {
  const trimmed = text.trim()
  if (!trimmed) return null

  await loadSignatureFont(trimmed)

  const fontSize = 96
  const font = `${fontSize * OVERSAMPLE}px "${SIGNATURE_FONT}", cursive`
  const probe = createCanvas(1, 1).context
  probe.font = font
  const measured = probe.measureText(trimmed)

  // Script faces have long ascenders and deep descenders, so the box is sized
  // from the actual ink bounds rather than the font size.
  const ascent = measured.actualBoundingBoxAscent || fontSize * OVERSAMPLE
  const descent = measured.actualBoundingBoxDescent || fontSize * OVERSAMPLE * 0.4
  const padding = fontSize * OVERSAMPLE * 0.1

  const { canvas, context } = createCanvas(
    Math.ceil(measured.width + padding * 2),
    Math.ceil(ascent + descent + padding * 2),
  )
  context.font = font
  context.fillStyle = color
  context.textBaseline = 'alphabetic'
  context.fillText(trimmed, padding, padding + ascent)

  return finish(canvas)
}

/** Longest edge of an uploaded signature after downscaling. */
const MAX_UPLOAD_EDGE = 1600

export async function imageFileToPng(
  file: File,
  options: { removeBackground: boolean },
): Promise<SignatureImage> {
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, MAX_UPLOAD_EDGE / Math.max(bitmap.width, bitmap.height))
    const { canvas, context } = createCanvas(
      Math.max(1, Math.round(bitmap.width * scale)),
      Math.max(1, Math.round(bitmap.height * scale)),
    )
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    if (options.removeBackground) removeLightBackground(canvas, context)

    const result = finish(canvas)
    if (!result) throw new Error('That image looks empty once the background was removed.')
    return result
  } finally {
    bitmap.close()
  }
}

/**
 * Turns a photographed or scanned signature into ink on transparency by reading
 * alpha from how dark each pixel is. Paper drops out, pen strokes survive with
 * their anti-aliased edges intact.
 */
function removeLightBackground(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
): void {
  const image = context.getImageData(0, 0, canvas.width, canvas.height)
  const { data } = image

  for (let i = 0; i < data.length; i += 4) {
    const darkest = Math.min(data[i] ?? 255, data[i + 1] ?? 255, data[i + 2] ?? 255)
    const ink = 255 - darkest
    // Below this the pixel is paper grain, not ink.
    data[i + 3] = ink < 40 ? 0 : Math.min(255, ink * 1.4)
    data[i] = 0
    data[i + 1] = 0
    data[i + 2] = 0
  }

  context.putImageData(image, 0, 0)
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas 2D is unavailable, so signatures cannot be rendered')
  return { canvas, context }
}

/** Crops blank margins so the placed signature box hugs the ink. */
function finish(canvas: HTMLCanvasElement): SignatureImage | null {
  const cropped = trimTransparent(canvas)
  if (!cropped) return null

  return {
    dataUrl: cropped.toDataURL('image/png'),
    aspect: cropped.width / cropped.height,
  }
}

function trimTransparent(canvas: HTMLCanvasElement): HTMLCanvasElement | null {
  const context = canvas.getContext('2d')
  if (!context) return null

  const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
  let minX = canvas.width
  let minY = canvas.height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      if ((data[(y * canvas.width + x) * 4 + 3] ?? 0) <= ALPHA_FLOOR) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }

  if (maxX < 0 || maxY < 0) return null

  const left = Math.max(0, minX - TRIM_PADDING)
  const top = Math.max(0, minY - TRIM_PADDING)
  const width = Math.min(canvas.width - left, maxX - minX + 1 + TRIM_PADDING * 2)
  const height = Math.min(canvas.height - top, maxY - minY + 1 + TRIM_PADDING * 2)

  const { canvas: out, context: outContext } = createCanvas(width, height)
  outContext.drawImage(canvas, left, top, width, height, 0, 0, width, height)
  return out
}
