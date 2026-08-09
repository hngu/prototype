/**
 * An untyped JavaScript helper — given, and the thing you are not allowed to change.
 *
 * This is a plain `.js` file with no annotations anywhere. `allowJs` is off in this package,
 * so the compiler never looks inside it: everything it believes about this module comes from
 * `text-utils.d.ts` next door. Delete that file and the import becomes
 * `TS7016: Could not find a declaration file for module './text-utils.js'`.
 *
 * Read it, then read the declaration file, then read what the declaration file's comments say
 * about the choices it had to make.
 */

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function truncate(text, maxLength, suffix) {
  const ellipsis = suffix === undefined ? '…' : suffix
  const input = String(text)
  if (input.length <= maxLength) return input
  return input.slice(0, Math.max(0, maxLength - ellipsis.length)) + ellipsis
}

export function parseList(text, separator) {
  return String(text)
    .split(separator === undefined ? ',' : separator)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

/**
 * Parses the first line of `text` as JSON.
 *
 * Returns whatever was in there, or `undefined` if it was not valid JSON. Note that this can
 * genuinely return anything at all — a number, a string, `null`, an array, an object with any
 * shape. That is not sloppiness in the JavaScript; it is what the function does.
 */
export function parseJsonHeader(text) {
  const [first] = String(text).split('\n')
  try {
    return JSON.parse(first)
  } catch {
    return undefined
  }
}

export const WORD_SEPARATOR = /[\s\-_]+/

export default { slugify, truncate, parseList, parseJsonHeader }
