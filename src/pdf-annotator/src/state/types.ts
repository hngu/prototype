import type { Rect } from '../pdf/coords.ts'

/** What a click on a page surface does. */
export type Tool = 'select' | 'text' | 'signature'

/** The three PDF standard font families we expose. All are WinAnsi-only. */
export const FONTS = ['Helvetica', 'Times-Roman', 'Courier'] as const
export type FontKey = (typeof FONTS)[number]

export const FONT_STACKS: Record<FontKey, string> = {
  Helvetica: 'Helvetica, Arial, sans-serif',
  'Times-Roman': '"Times New Roman", Times, serif',
  Courier: '"Courier New", Courier, monospace',
}

export const DEFAULT_FONT_SIZE = 14

/** Width a new signature gets, in points, before the user resizes it. */
export const DEFAULT_SIGNATURE_WIDTH = 160

export const MIN_SIGNATURE_WIDTH = 24

export type TextAnnotation = {
  id: string
  kind: 'text'
  pageIndex: number
  rect: Rect
  /** One entry per visual line. Text never auto-wraps, so this is also the layout. */
  lines: string[]
  fontSize: number
  font: FontKey
  /** Hex, `#rrggbb`. */
  color: string
}

export type SignatureAnnotation = {
  id: string
  kind: 'signature'
  pageIndex: number
  rect: Rect
  /** `data:image/png;base64,...`. Kept as a string so history snapshots stay plain data. */
  dataUrl: string
  /** width / height of the source bitmap; resizing preserves it. */
  aspect: number
}

export type Annotation = TextAnnotation | SignatureAnnotation

export function newId(): string {
  return crypto.randomUUID()
}
