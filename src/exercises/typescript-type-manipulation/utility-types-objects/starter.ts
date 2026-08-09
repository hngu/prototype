/**
 * Exercise: The standard-issue toolkit
 * Lesson:   typescript-type-manipulation/utility-types-objects
 *
 * Two halves again.
 *
 * **Half one — reimplement three utility types.** `Pick`, `Omit` and `Record` are mapped
 * types and you have written mapped types. Each placeholder below delegates to the
 * built-in; replace it with your own. Graded by
 * `pnpm --filter exercises typecheck`.
 *
 * **Half two — four functions** over types built from them. Graded by `attempt`.
 */

import type { Equals, Expect } from '../../tools/type-assert.ts'

export interface User {
  readonly id: string
  readonly name: string
  readonly email: string
  readonly passwordHash: string
  readonly createdAt: number
}

/* ── Half one ─────────────────────────────────────────────────────────────────── */

/** Keep only these keys. TODO. */
export type MyPick<T, K extends keyof T> = Pick<T, K>
type _pick = Expect<Equals<MyPick<User, 'id' | 'name'>, Pick<User, 'id' | 'name'>>>

/**
 * Drop these keys. TODO.
 *
 * Note the constraint: `keyof any`, not `keyof T`. That is what the real `Omit` uses, and
 * it means `Omit<User, 'nope'>` compiles happily — copy the looseness, it is the subject
 * of one of the tests.
 */
export type MyOmit<T, K extends keyof any> = Omit<T, K>
type _omit = Expect<Equals<MyOmit<User, 'passwordHash'>, Omit<User, 'passwordHash'>>>

/** Every key in `K`, all holding a `V`. TODO. */
export type MyRecord<K extends keyof any, V> = Record<K, V>
type _record = Expect<Equals<MyRecord<'a' | 'b', number>, Record<'a' | 'b', number>>>

/* ── Types built from them: given ─────────────────────────────────────────────── */

/** Safe to send to a client. */
export type PublicUser = MyOmit<User, 'passwordHash'>

/** Enough for a list row. */
export type UserSummary = MyPick<User, 'id' | 'name'>

/** What a caller may change: anything except the two fields they may not. */
export type UserPatch = Partial<MyOmit<User, 'id' | 'createdAt'>>

/** An index. */
export type UsersById = MyRecord<string, User>

/* ── Half two ─────────────────────────────────────────────────────────────────── */

/** Strips the password hash and nothing else. */
export function toPublic(user: User): PublicUser {
  throw new Error('TODO: everything but the hash')
}

/** Just the id and the name. */
export function toSummary(user: User): UserSummary {
  throw new Error('TODO: two fields')
}

/**
 * Applies a patch.
 *
 * A property explicitly set to `undefined` must be **ignored**, not applied — which is
 * the classic bug with `Partial` plus object spread, and the reason this is not a
 * one-liner.
 */
export function applyPatch(user: User, patch: UserPatch): User {
  throw new Error('TODO: mind the explicit undefined')
}

/** Indexes users by id. Later duplicates win. */
export function indexUsers(users: readonly User[]): UsersById {
  throw new Error('TODO: build the record')
}
