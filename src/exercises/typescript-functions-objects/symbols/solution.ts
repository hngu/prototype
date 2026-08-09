/**
 * Reference solution: A key cut just for you
 * Lesson: typescript-functions-objects/symbols
 */

/* The keys live in `keys.ts` because a `unique symbol` cannot be declared twice — see
   the comment at the top of that file. `Symbol('audit')` produces a value equal to
   nothing but itself, and calling it again gives a *different* key: the string is a
   description for your debugger and carries no identity at all. That is the whole
   guarantee. Another library can write `Symbol('audit')` and still cannot reach these
   properties. */
import { AUDIT, TRACE, type MetaKey } from './keys.ts'

export { AUDIT, TRACE, type MetaKey }

export interface Doc {
  readonly title: string
  readonly [AUDIT]?: string
  readonly [TRACE]?: string
}

/* A computed key from a union of two `unique symbol`s. The spread copies whatever was
   there — string keys and symbol keys alike — and the computed property overwrites one
   of them. */
export function tag(doc: Doc, key: MetaKey, value: string): Doc {
  return { ...doc, [key]: value }
}

export function readTag(doc: Doc, key: MetaKey): string | undefined {
  return doc[key]
}

/* `Object.keys` returns string keys and never symbols. Nor does `for…in`, nor
   `JSON.stringify`, nor `Object.assign`'s enumeration of *string* keys.

   Which is the practical reason to use symbols for metadata: a library can annotate
   your objects, and every piece of code that walks or serialises them carries on as
   though the annotations were not there. `Object.getOwnPropertySymbols` is how you look
   on purpose. */
export function publicKeys(doc: Doc): readonly string[] {
  return Object.keys(doc)
}

/* `[AUDIT, TRACE] as const` gives a readonly tuple of the two `unique symbol` types
   rather than `symbol[]`, so `doc[key]` type-checks — the same `as const` trick from
   lesson 1.2, doing real work.

   Writing this as `Object.getOwnPropertySymbols(doc)` would find them at run time and
   give you `symbol[]`, which is not assignable to `MetaKey[]` and would need a cast.
   Listing the keys you own is both more honest and better typed. */
export function metaKeys(doc: Doc): readonly MetaKey[] {
  return ([AUDIT, TRACE] as const).filter((key) => doc[key] !== undefined)
}

/* The gotcha this function exists for: `{ ...doc }` copies symbol keys. Spread and
   `Object.assign` both do. So the popular summary "symbols are hidden" is only half
   true — they are invisible to *enumeration* (`Object.keys`, `for…in`,
   `JSON.stringify`) and perfectly visible to *copying*.

   Rebuilding the public shape by hand is the honest way to drop them, and the return
   type keeps it correct: add a required field to `Doc` and this function stops
   compiling. */
export function withoutMeta(doc: Doc): Doc {
  return { title: doc.title }
}
