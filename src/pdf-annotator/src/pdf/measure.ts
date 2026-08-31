import { FONT_STACKS, type FontKey } from '../state/types.ts'
import { baselineFromTop, lineHeight, textBoxHeight } from './textLayout.ts'

/** Trailing room so the caret is visible at the end of the longest line. */
const CARET_SLACK = 0.3

export const MIN_TEXT_WIDTH = 16

let sharedContext: CanvasRenderingContext2D | null = null

function measureContext(): CanvasRenderingContext2D {
  if (!sharedContext) {
    const context = document.createElement('canvas').getContext('2d')
    if (!context) throw new Error('Canvas 2D is unavailable, so text cannot be measured')
    sharedContext = context
  }
  return sharedContext
}

/**
 * Measures with the browser's metric-compatible stand-in for each PDF standard
 * font (Arial for Helvetica, Times New Roman for Times-Roman, Courier New for
 * Courier). Those pairs share advance widths by design, so a box measured here
 * fits the text the exporter will draw.
 *
 * Canvas units are arbitrary, so measuring at the point size returns points.
 */
export function measureLine(text: string, font: FontKey, fontSize: number): number {
  const context = measureContext()
  context.font = `${fontSize}px ${FONT_STACKS[font]}`
  return context.measureText(text).width
}

export function textSize(lines: string[], font: FontKey, fontSize: number) {
  const widest = lines.reduce((max, line) => Math.max(max, measureLine(line, font, fontSize)), 0)

  return {
    width: Math.max(MIN_TEXT_WIDTH, widest + fontSize * CARET_SLACK),
    height: textBoxHeight(lines.length, fontSize),
  }
}

/**
 * How far to nudge a textarea so its first baseline lands where the exporter
 * will put it.
 *
 * A CSS line box centres the font's ascent+descent inside `line-height`, and the
 * browser uses the font's own hhea metrics for that. The exporter instead
 * anchors the baseline to the AFM ascender. The two disagree by a point or two,
 * which is visible when a text box sits on a form line, so the difference is
 * measured and applied as a transform. Returns points; negative means up.
 */
export function baselineOffset(font: FontKey, fontSize: number): number {
  const context = measureContext()
  context.font = `${fontSize}px ${FONT_STACKS[font]}`
  const metrics = context.measureText('Hg')
  const ascent = metrics.fontBoundingBoxAscent
  const descent = metrics.fontBoundingBoxDescent
  if (ascent === undefined || descent === undefined) return 0

  const natural = (lineHeight(fontSize) - (ascent + descent)) / 2 + ascent
  return baselineFromTop(0, font, fontSize) - natural
}
