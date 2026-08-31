import type { Point, Rect } from './coords.ts'
import type { FontKey, TextAnnotation } from '../state/types.ts'

/** Matches pdf-lib's default line height for standard fonts. */
export const LINE_HEIGHT_RATIO = 1.2

/**
 * Ascender height as a fraction of the font size, from each font's AFM metrics
 * (Helvetica 718, Times-Roman 683, Courier 629, per 1000 units).
 *
 * The top edge of a text box is defined as the ascender top of its first line.
 * Preview and export both derive baselines from that one rule, which is what
 * keeps the two in agreement.
 */
const ASCENDER: Record<FontKey, number> = {
  Helvetica: 0.718,
  'Times-Roman': 0.683,
  Courier: 0.629,
}

export function lineHeight(fontSize: number): number {
  return fontSize * LINE_HEIGHT_RATIO
}

export function textBoxHeight(lineCount: number, fontSize: number): number {
  return Math.max(lineCount, 1) * lineHeight(fontSize)
}

/** Distance from the top of the box down to line `index`'s baseline, in points. */
export function baselineFromTop(index: number, font: FontKey, fontSize: number): number {
  return index * lineHeight(fontSize) + ASCENDER[font] * fontSize
}

export type LineBaseline = { text: string; origin: Point }

/** Baseline start points for every non-empty line, in view space. */
export function textBaselines(annotation: TextAnnotation): LineBaseline[] {
  const top = annotation.rect.y + annotation.rect.height

  return annotation.lines.flatMap((text, index) =>
    text.length === 0
      ? []
      : [
          {
            text,
            origin: {
              x: annotation.rect.x,
              y: top - baselineFromTop(index, annotation.font, annotation.fontSize),
            },
          },
        ],
  )
}

/**
 * Grows or shrinks a box around its top-left corner, so text added at the
 * bottom does not push the first line off its anchor.
 */
export function resizeFromTopLeft(rect: Rect, width: number, height: number): Rect {
  return { x: rect.x, y: rect.y + rect.height - height, width, height }
}
