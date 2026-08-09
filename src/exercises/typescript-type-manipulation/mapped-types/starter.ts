/**
 * Exercise: Relabel every jar
 * Lesson:   typescript-type-manipulation/mapped-types
 *
 * This exercise has two halves, and they are graded by different commands.
 *
 * **Half one — write three mapped types.** Each one currently delegates to the built-in
 * it is supposed to reimplement. Replace the delegation with a real mapped type. The
 * `Expect<Equals<…>>` line under each is the grader: get it wrong and
 * `pnpm --filter exercises typecheck` stops with the file and line.
 *
 * **Half two — write the runtime counterpart of a given mapped type.** `Getters<T>` is
 * written for you; `makeGetters` is not. That half is graded by
 * `pnpm --filter exercises attempt` as usual.
 */

import type { Equals, Expect } from '../../tools/type-assert.ts'

/** A mutable shape, so the `readonly` assertions have something to bite on. */
export interface Draft {
  theme: string
  fontSize: number
  beta?: boolean
}

/** The same fields, frozen. */
export interface Settings {
  readonly theme: string
  readonly fontSize: number
  readonly beta?: boolean
}

/* ── Half one: your three mapped types ────────────────────────────────────────── */

/**
 * Every property optional.
 *
 * TODO: replace the delegation with `{ [K in keyof T]?: T[K] }`-shaped code of your own.
 */
export type MyPartial<T> = Partial<T>
type _partial = Expect<Equals<MyPartial<Draft>, Partial<Draft>>>

/**
 * Every property required.
 *
 * TODO. The modifier to remove a `?` is `-?`, and note it removes the `undefined` from
 * the property's type as well — which is why `Required<Draft>['beta']` is `boolean` and
 * not `boolean | undefined`.
 */
export type MyRequired<T> = Required<T>
type _required = Expect<Equals<MyRequired<Draft>, Required<Draft>>>

/** Every property `readonly`. TODO. */
export type MyReadonly<T> = Readonly<T>
type _readonly = Expect<Equals<MyReadonly<Draft>, Readonly<Draft>>>

/* ── Given: read these, do not change them ────────────────────────────────────── */

/**
 * Every property writable again. `-readonly` strips the modifier, and there is no
 * built-in for this one — `Mutable` is the type everybody ends up writing once.
 */
export type Mutable<T> = { -readonly [K in keyof T]: T[K] }

/**
 * A getter per property, with the key renamed.
 *
 * `as` is the **key remapping** clause: it rewrites each key on the way through.
 * `keyof T & string` drops any number or symbol keys, because a template literal type
 * needs a string to work with. `Capitalize` is lesson 7's, arriving early.
 */
export type Getters<T> = {
  readonly [K in keyof T & string as `get${Capitalize<K>}`]: () => T[K]
}

/* ── Half two: the runtime counterpart ────────────────────────────────────────── */

/**
 * Builds the object `Getters<T>` describes.
 *
 *   makeGetters({ theme: 'dark' }).getTheme()   →  'dark'
 *
 * The getters read `source` **live**, so changing the source afterwards changes what they
 * return. One cast is unavoidable; the mapped type is the reason it is safe.
 */
export function makeGetters<T extends object>(source: T): Getters<T> {
  throw new Error('TODO: one getter per key, with the key capitalised and prefixed')
}
