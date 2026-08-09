/**
 * Reference solution: The standard-issue toolkit
 * Lesson: typescript-type-manipulation/utility-types-objects
 */

import type { Equals, Expect } from '../../tools/type-assert.ts'

export interface User {
  readonly id: string
  readonly name: string
  readonly email: string
  readonly passwordHash: string
  readonly createdAt: number
}

/* This is `Pick`, as shipped. Not a simplification — the same three tokens.

   It is not homomorphic in the strict sense (the key expression is `K`, not `keyof T`),
   but because `K` is constrained to `keyof T` the compiler still carries the original
   modifiers across, which is why `PublicUser` below stays `readonly`. */
export type MyPick<T, K extends keyof T> = { [P in K]: T[P] }
type _pick = Expect<Equals<MyPick<User, 'id' | 'name'>, Pick<User, 'id' | 'name'>>>

/* `Omit` is built out of `Pick` and `Exclude` — `Pick<T, Exclude<keyof T, K>>` — and
   `Exclude` is next lesson's. This is the same thing written with lesson 6's `as` clause
   instead: map every key of `T`, and send the ones matching `K` to `never`, which removes
   them.

   The loose `keyof any` constraint is copied from the real definition on purpose. It means
   `Omit<User, 'nmae'>` compiles and silently omits nothing — a genuine wart, kept for
   compatibility, and worth knowing before it costs you an afternoon. `Pick` does not have
   it: `Pick<User, 'nmae'>` is a clean error. */
export type MyOmit<T, K extends keyof any> = { [P in keyof T as P extends K ? never : P]: T[P] }
type _omit = Expect<Equals<MyOmit<User, 'passwordHash'>, Omit<User, 'passwordHash'>>>

/* And `Record`. `keyof any` is `string | number | symbol`, which the standard library also
   calls `PropertyKey`.

   Note that unlike the other two, `Record` builds a shape out of nothing rather than
   transforming one — `V` is not `T[P]`, it is the same type for every key. */
export type MyRecord<K extends keyof any, V> = { [P in K]: V }
type _record = Expect<Equals<MyRecord<'a' | 'b', number>, Record<'a' | 'b', number>>>

export type PublicUser = MyOmit<User, 'passwordHash'>

export type UserSummary = MyPick<User, 'id' | 'name'>

export type UserPatch = Partial<MyOmit<User, 'id' | 'createdAt'>>

export type UsersById = MyRecord<string, User>

/* Destructure the hash out and spread the rest. `_passwordHash` is named with a leading
   underscore by convention for a binding that exists only to be discarded — and it is
   why this package does not enable `noUnusedLocals`, which would object.

   Writing it the other way — listing the four fields you want — compiles today and
   silently stops including new fields as `User` grows. The point of `Omit` is that this
   function keeps working. */
export function toPublic(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...rest } = user
  return rest
}

export function toSummary(user: User): UserSummary {
  return { id: user.id, name: user.name }
}

/* `{ ...user, ...patch }` is the obvious answer and it is wrong.

   `UserPatch` is a `Partial`, so every property is `T | undefined` — and an object spread
   copies a property that is *present and undefined*, overwriting a real value with
   nothing. `applyPatch(user, { name: undefined })` would leave the user nameless. This is
   one of the most common bugs in TypeScript that the type system cannot catch for you,
   because `{ name: undefined }` is a perfectly valid `Partial<User>`.

   So: drop the undefined entries first. The cast is needed because `Object.entries` and
   `fromEntries` lose the key types on the way round, as in lesson 6 — and it is safe
   because every key came out of `patch`, whose type is a subset of `User`'s. */
export function applyPatch(user: User, patch: UserPatch): User {
  const defined = Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as Partial<User>

  return { ...user, ...defined }
}

/* `Record<string, User>` rather than `Map<string, User>`, because that is what the
   exercise's type says — and worth noting the difference: a `Record<string, User>` read is
   `User | undefined` under `noUncheckedIndexedAccess`, exactly like the index signature in
   lesson 2.4, because a string index promises which keys are *allowed* and never which are
   present. */
export function indexUsers(users: readonly User[]): UsersById {
  const index: Record<string, User> = {}

  for (const user of users) {
    index[user.id] = user
  }

  return index
}
