import { inflateSync } from 'node:zlib'

/**
 * pdf-lib deflates the content streams it writes, so assertions about drawing
 * operators have to inflate them first. Returns the raw file text followed by
 * every stream that could be inflated.
 */
export function readablePdf(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes)
  const parts = [raw.toString('latin1')]

  let cursor = 0
  while (cursor < raw.length) {
    const keyword = raw.indexOf('stream', cursor)
    if (keyword === -1) break

    let start = keyword + 'stream'.length
    if (raw[start] === 0x0d) start += 1
    if (raw[start] === 0x0a) start += 1

    const end = raw.indexOf('endstream', start)
    if (end === -1) break

    let stop = end
    while (stop > start && (raw[stop - 1] === 0x0a || raw[stop - 1] === 0x0d)) stop -= 1

    try {
      parts.push(inflateSync(raw.subarray(start, stop)).toString('latin1'))
    } catch {
      // Not a deflate stream (an embedded image, say). Nothing to assert on.
    }

    cursor = end + 'endstream'.length
  }

  return parts.join('\n')
}

/** pdf-lib writes standard-font text as a hex string, which is what shows up in the stream. */
export function asPdfHexString(text: string): string {
  const hex = [...text]
    .map((char) => (char.codePointAt(0) ?? 0).toString(16).padStart(2, '0').toUpperCase())
    .join('')
  return `<${hex}>`
}
