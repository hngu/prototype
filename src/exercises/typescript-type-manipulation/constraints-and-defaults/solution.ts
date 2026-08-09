/**
 * Reference solution: Must fit through this door
 * Lesson: typescript-type-manipulation/constraints-and-defaults
 */

/* One line of implementation and a signature worth reading twice.

   `K extends keyof T` does two jobs at once. It rejects a key the item does not have —
   `pluck(users, 'nmae')` is a compile error, not an array of `undefined` — and it keeps
   `K` at the *specific* key that was passed rather than widening it to `keyof T`. That
   second part is what makes `T[K]` useful: ask for `'name'` and you get `string[]`, ask
   for `'age'` and you get `number[]`, from one signature.

   Written as `key: keyof T` instead, the return type could only be
   `T[keyof T][]` — `(string | number)[]` for a user — and every caller would be
   narrowing a union that was never actually uncertain. */
export function pluck<T, K extends keyof T>(items: readonly T[], key: K): readonly T[K][] {
  return items.map((item) => item[key])
}

/* The constraint asks for an `id` and nothing else, and the map still holds the whole
   `T`. Compare the non-generic version:

     function byId(items: readonly { id: string }[]): Map<string, { id: string }>

   ...which compiles, accepts the same arguments, and throws away every other field on
   the way out. A caller would get their users in and `{ id: string }` back.

   That is the distinction to take away from this lesson: a parameter type is a *floor*
   that also becomes the ceiling, and a constraint is a floor that lets the real type
   through. */
export function byId<T extends { readonly id: string }>(items: readonly T[]): Map<string, T> {
  const index = new Map<string, T>()

  for (const item of items) {
    index.set(item.id, item)
  }

  return index
}

/* Both parameters are the same `T`, so this compares two strings or two arrays and
   refuses one of each. The constraint is structural, as ever — `{ length: number }`
   matches strings, arrays, `NodeList`s and anything else that happens to have a length,
   none of which had to opt in. */
export function longest<T extends { readonly length: number }>(a: T, b: T): T {
  return a.length >= b.length ? a : b
}

export interface Bucket<T = string> {
  readonly label: string
  readonly items: readonly T[]
}

/* A generic parameter default answers "what if there is nothing to infer from?".
   `makeBucket('empty')` supplies no items, so inference has no candidate for `T`, and
   without the `= string` it would land on `unknown` and make the bucket useless.

   Note the difference from a *constraint*: `T extends string` restricts what may be
   passed, `T = string` only decides what happens when nobody says. They are unrelated
   and can be combined — `<T extends Named = User>` is legal and occasionally what you
   want. */
export function makeBucket<T = string>(label: string, items?: readonly T[]): Bucket<T> {
  return { label, items: items ?? [] }
}
