/**
 * Reference solution: Relabel every jar
 * Lesson: typescript-type-manipulation/mapped-types
 */

import type { Equals, Expect } from '../../tools/type-assert.ts'

export interface Draft {
  theme: string
  fontSize: number
  beta?: boolean
}

export interface Settings {
  readonly theme: string
  readonly fontSize: number
  readonly beta?: boolean
}

/* `[K in keyof T]` walks every key; `?` adds the optional marker to each one. That is the
   entire implementation of `Partial`, and looking at it is the point of writing it: the
   standard library is not doing anything you cannot.

   One subtlety worth knowing. Because this maps directly over `keyof T`, it is
   **homomorphic** — TypeScript recognises the shape and preserves the *existing*
   modifiers rather than discarding them. So a `readonly` property stays `readonly` on the
   way through, which is why `MyPartial<Settings>` keeps its readonly markers. Write it as
   `{ [K in keyof T & string]?: T[K] }` and you lose that, because the key expression is
   no longer plain `keyof T`. */
export type MyPartial<T> = { [K in keyof T]?: T[K] }
type _partial = Expect<Equals<MyPartial<Draft>, Partial<Draft>>>

/* `-?` removes the optional marker, and it does one thing more than it looks like:
   removing `?` also strips `undefined` out of the property's type. So
   `MyRequired<Draft>['beta']` is `boolean`, not `boolean | undefined`.

   That is why `Required` is not simply the opposite of `Partial` in every respect — a
   property declared `beta: boolean | undefined` (no `?`) survives `Required` unchanged,
   while `beta?: boolean` comes out as `boolean`. The `?` and the `undefined` are related
   and not the same, exactly as lesson 1.8 said. */
export type MyRequired<T> = { [K in keyof T]-?: T[K] }
type _required = Expect<Equals<MyRequired<Draft>, Required<Draft>>>

export type MyReadonly<T> = { readonly [K in keyof T]: T[K] }
type _readonly = Expect<Equals<MyReadonly<Draft>, Readonly<Draft>>>

/* `-readonly` is the mirror of `-?`, and there is no built-in for it. Every codebase
   eventually grows this type, usually in a file called `types.ts`, usually more than once. */
export type Mutable<T> = { -readonly [K in keyof T]: T[K] }

/* The `as` clause rewrites the key on the way through, which is what turns a mapped type
   from "same shape, different modifiers" into "a genuinely different shape".

   `keyof T & string` matters: a template literal type needs a string, and `keyof T` may
   include `number` and `symbol`. Intersecting with `string` drops those, and — usefully —
   mapping to `never` in an `as` clause *removes* the key entirely, which is how `Omit` is
   built. */
export type Getters<T> = {
  readonly [K in keyof T & string as `get${Capitalize<K>}`]: () => T[K]
}

/* The runtime half, and the mapped type above is the whole justification for the cast.

   `Object.fromEntries` returns `{ [k: string]: T }` — it cannot know which keys it just
   built. So a cast is unavoidable. What makes it honest is that the loop below produces
   exactly the keys `Getters<T>` describes, by the same rule: one entry per own enumerable
   key, prefixed with `get`, first letter upper-cased. Write the transformation twice —
   once in the type, once in the code — and keep them next to each other.

   `() => source[key]` rather than `() => value` so the getters read live, which is what a
   getter is for. `key as keyof T` is the same `Object.entries` widening as lesson 3.3:
   `entries` hands back `string`, and here we know better because the keys came from
   `source` a line earlier. */
export function makeGetters<T extends object>(source: T): Getters<T> {
  const entries = Object.keys(source).map((key) => [
    `get${key.charAt(0).toUpperCase()}${key.slice(1)}`,
    () => source[key as keyof T],
  ])

  return Object.fromEntries(entries) as Getters<T>
}
