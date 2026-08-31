/**
 * The PDF standard fonts can only be encoded as WinAnsi, so `drawText` throws on
 * anything outside it. Checking up front lets the text box reject the character
 * while the user is still typing rather than failing the export.
 */

/** WinAnsi code points above Latin-1, at positions 0x80-0x9F. */
const HIGH_RANGE = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152,
  0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a,
  0x0153, 0x017e, 0x0178,
])

export function isEncodable(codePoint: number): boolean {
  if (codePoint === 0x0a || codePoint === 0x0d || codePoint === 0x09) return true
  if (codePoint >= 0x20 && codePoint <= 0x7e) return true
  if (codePoint >= 0xa0 && codePoint <= 0xff) return true
  return HIGH_RANGE.has(codePoint)
}

/** The distinct characters in `text` that no standard font can render. */
export function unsupportedCharacters(text: string): string[] {
  const found = new Set<string>()
  for (const char of text) {
    const codePoint = char.codePointAt(0)
    if (codePoint !== undefined && !isEncodable(codePoint)) found.add(char)
  }
  return [...found]
}

export function stripUnsupported(text: string): string {
  return [...text].filter((char) => isEncodable(char.codePointAt(0) ?? 0)).join('')
}
