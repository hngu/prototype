/**
 * Exercise: A key cut just for you
 * Lesson:   typescript-functions-objects/symbols
 *
 * Replace every `throw new Error('TODO: …')` with a real implementation.
 *
 * `AUDIT` and `TRACE` come from `keys.ts` rather than being declared here, and the
 * reason is the lesson: a `unique symbol` is nominal, so declaring it twice produces
 * two different keys. Read the comment at the top of that file — it is the shortest
 * demonstration of the whole idea in the repo.
 */

import { AUDIT, TRACE, type MetaKey } from './keys.ts'

export { AUDIT, TRACE, type MetaKey }

/**
 * A document with public data and optional metadata under symbol keys.
 *
 * A computed property name in an interface is only allowed when the key is a
 * `unique symbol` — a plain `symbol` does not identify a single property.
 */
export interface Doc {
  readonly title: string
  readonly [AUDIT]?: string
  readonly [TRACE]?: string
}

/** A copy of `doc` with `key` set to `value`. */
export function tag(doc: Doc, key: MetaKey, value: string): Doc {
  throw new Error('TODO: copy the doc and set the symbol key')
}

/** Reads a metadata value back, or `undefined`. */
export function readTag(doc: Doc, key: MetaKey): string | undefined {
  throw new Error('TODO: read the symbol key')
}

/**
 * The document's ordinary string keys. `Object.keys` never returns symbols, which is
 * most of the reason to use them for metadata.
 */
export function publicKeys(doc: Doc): readonly string[] {
  throw new Error('TODO: the string keys only')
}

/** Whichever metadata keys are actually present, in `[AUDIT, TRACE]` order. */
export function metaKeys(doc: Doc): readonly MetaKey[] {
  throw new Error('TODO: the symbol keys that have a value')
}

/**
 * A copy carrying the public data and none of the metadata.
 *
 * Worth doing deliberately, because object spread **does** copy symbol keys — the
 * "invisible" reputation only covers `Object.keys`, `for…in` and `JSON.stringify`.
 */
export function withoutMeta(doc: Doc): Doc {
  throw new Error('TODO: public data only — and note that {...doc} is not the answer')
}
