/**
 * Reference solution: One recipe, any ingredient
 * Lesson: typescript-type-manipulation/generics
 */

/* The declared return type is `T | undefined`, and the body is a bare indexed read that
   is *already* `T | undefined` because `noUncheckedIndexedAccess` is on. The signature
   and the obvious implementation agree, with nothing to reconcile — the same happy
   accident as lesson 1.8's `pick`, which is what a well-chosen signature feels like. */
export function first<T>(items: readonly T[]): T | undefined {
  return items[0]
}

export function last<T>(items: readonly T[]): T | undefined {
  return items[items.length - 1]
}

/* Two type parameters, and they are independent: `pairUp(['a'], [1])` infers
   `A = string` and `B = number` separately, and the resulting tuple keeps them in
   order. A single `<T>` would have forced both lists to hold the same type, which is
   the mistake to notice — the number of type parameters is a design decision, not
   boilerplate.

   The loop is lesson 2.6's, unchanged. Nothing about the *implementation* got harder
   when the types became generic, which is the point: a generic function is an ordinary
   function whose types were left as blanks. */
export function pairUp<A, B>(
  left: readonly A[],
  right: readonly B[],
): readonly (readonly [A, B])[] {
  const pairs: (readonly [A, B])[] = []

  for (const [index, a] of left.entries()) {
    const b = right[index]
    if (b === undefined) break
    pairs.push([a, b])
  }

  return pairs
}

export interface Cache<T> {
  get(key: string): T | undefined
  set(key: string, value: T): void
  has(key: string): boolean
  readonly size: number
}

/* `Map<string, T>` — the type parameter is simply passed along. `makeCache<string>()`
   produces a cache whose `set` accepts only strings, and the compiler will not let a
   number near it.

   Note there is no `T` anywhere in the *body* except as an argument to `Map`. Generic
   code is rarely clever; it is ordinary code with the concrete type lifted out, and if
   a generic implementation starts needing casts that is usually a sign the signature is
   wrong rather than the body. */
export function makeCache<T>(): Cache<T> {
  const entries = new Map<string, T>()

  return {
    get(key) {
      return entries.get(key)
    },

    set(key, value) {
      entries.set(key, value)
    },

    has(key) {
      return entries.has(key)
    },

    get size() {
      return entries.size
    },
  }
}

/* The reason this signature is worth the trouble: `cache`, `compute`'s return type and
   the result are all the same `T`, so it is impossible to build a `Cache<string>`, hand
   it a `compute` returning a number, and find out about it later.

   One honest limitation, which the type made visible rather than caused. `get` returns
   `T | undefined`, and there is no way to tell "not cached" from "cached, and the value
   is `undefined`" — so this treats a cached `undefined` as a miss. `has(key)` would
   distinguish them, but `get` still hands back `T | undefined`, and returning it as a
   `T` would need a cast the compiler cannot check. If `T` can be `undefined`, cache a
   wrapper like `{ value: T }` instead. That is the same "empty box versus no box"
   problem as lesson 1.8, showing up as an API design decision. */
export function cached<T>(cache: Cache<T>, key: string, compute: (key: string) => T): T {
  const hit = cache.get(key)
  if (hit !== undefined) return hit

  const value = compute(key)
  cache.set(key, value)
  return value
}
