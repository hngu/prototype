import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Equals, Expect } from '../../tools/type-assert.ts'
import * as solution from './solution.ts'
import * as starter from './starter.ts'
import type { MyOmit, MyPick, MyRecord, PublicUser, User, UserPatch } from './solution.ts'

/**
 * Compile-time API parity, both directions, so neither file can grow, drop or
 * retype an export without tsc saying so.
 */
const _starterMatchesSolution: typeof solution = starter
const _solutionMatchesStarter: typeof starter = solution
void _starterMatchesSolution
void _solutionMatchesStarter

const subject = process.env['EXERCISE_TARGET'] === 'starter' ? starter : solution

/* ── The three reimplementations, against the built-ins ───────────────────────── */

type _pick = Expect<Equals<MyPick<User, 'id' | 'name'>, Pick<User, 'id' | 'name'>>>
type _pickOne = Expect<Equals<MyPick<User, 'email'>, Pick<User, 'email'>>>
type _omit = Expect<Equals<MyOmit<User, 'passwordHash'>, Omit<User, 'passwordHash'>>>
type _omitTwo = Expect<Equals<MyOmit<User, 'id' | 'createdAt'>, Omit<User, 'id' | 'createdAt'>>>
type _record = Expect<Equals<MyRecord<'a' | 'b', number>, Record<'a' | 'b', number>>>
type _recordString = Expect<Equals<MyRecord<string, User>, Record<string, User>>>

/* Modifiers survive: `User` is entirely `readonly`, and so is everything derived from it. */
type _pickKeepsReadonly = Expect<Equals<MyPick<User, 'id'>, { readonly id: string }>>
type _omitKeepsReadonly = Expect<
  Equals<MyOmit<User, 'name' | 'email' | 'passwordHash' | 'createdAt'>, { readonly id: string }>
>

/* The wart, copied from the real definition on purpose: `Omit` accepts a key the type does
   not have, and quietly omits nothing. */
type _omitIsLoose = Expect<Equals<MyOmit<User, 'nope'>, User>>

/* `Pick` is not loose, which is the contrast worth knowing. */
// @ts-expect-error — "Type '\"nope\"' does not satisfy the constraint 'keyof User'."
type _pickIsStrict = MyPick<User, 'nope'>

/* And `Partial` composes on top, so a patch's fields are all optional. */
type _patch = Expect<Equals<UserPatch, Partial<Omit<User, 'id' | 'createdAt'>>>>

/* ── Runtime ──────────────────────────────────────────────────────────────────── */

const user: User = {
  id: 'u1',
  name: 'ada',
  email: 'ada@example.com',
  passwordHash: 'hunter2-hashed',
  createdAt: 1000,
}

test('toPublic drops the hash and keeps everything else', () => {
  assert.deepEqual(subject.toPublic(user), {
    id: 'u1',
    name: 'ada',
    email: 'ada@example.com',
    createdAt: 1000,
  })
})

test('toPublic really removes the key, not just its value', () => {
  const publicUser = subject.toPublic(user)

  // `{ ...user, passwordHash: undefined }` would pass a `deepEqual` against an object
  // without the key in some assertion libraries. It does not pass this.
  assert.equal(Object.hasOwn(publicUser, 'passwordHash'), false)
  assert.deepEqual(Object.keys(publicUser), ['id', 'name', 'email', 'createdAt'])
})

test('a PublicUser has no hash at the type level either', () => {
  // Half the point of this test is that it COMPILES.
  const publicUser: PublicUser = subject.toPublic(user)
  type _shape = Expect<Equals<typeof publicUser, Omit<User, 'passwordHash'>>>

  assert.equal(publicUser.email, 'ada@example.com')

  // @ts-expect-error — "Property 'passwordHash' does not exist on type …". The whole
  // reason to have the type rather than only the function.
  void publicUser.passwordHash
})

test('toSummary keeps two fields', () => {
  assert.deepEqual(subject.toSummary(user), { id: 'u1', name: 'ada' })

  // @ts-expect-error — and the summary genuinely has nothing else on it.
  void subject.toSummary(user).email
})

test('applyPatch applies what was given', () => {
  assert.deepEqual(subject.applyPatch(user, { name: 'grace' }), { ...user, name: 'grace' })
  assert.deepEqual(subject.applyPatch(user, { name: 'grace', email: 'g@example.com' }), {
    ...user,
    name: 'grace',
    email: 'g@example.com',
  })
  assert.deepEqual(subject.applyPatch(user, {}), user)
})

test('applyPatch ignores a property explicitly set to undefined', () => {
  // The bug `{ ...user, ...patch }` has, and the reason this function is not one line.
  // `{ name: undefined }` is a perfectly valid `Partial`, an object spread copies it, and
  // the user ends up nameless. The type system cannot catch this for you.
  assert.deepEqual(subject.applyPatch(user, { name: undefined }), user)
  assert.deepEqual(subject.applyPatch(user, { name: undefined, email: 'g@example.com' }), {
    ...user,
    email: 'g@example.com',
  })

  // An empty string is not `undefined` and must be applied.
  assert.equal(subject.applyPatch(user, { name: '' }).name, '')
})

test('applyPatch refuses the fields a caller may not change', () => {
  // @ts-expect-error — `id` was omitted from `UserPatch`, so this is a compile error
  // rather than a silent overwrite.
  subject.applyPatch(user, { id: 'u9' })

  // @ts-expect-error — same for createdAt.
  subject.applyPatch(user, { createdAt: 0 })
})

test('indexUsers builds a record, later duplicates winning', () => {
  const other: User = { ...user, id: 'u2', name: 'grace' }
  const index = subject.indexUsers([user, other])

  assert.deepEqual(Object.keys(index), ['u1', 'u2'])
  assert.equal(index['u2']?.name, 'grace')

  const dupes = subject.indexUsers([user, { ...user, name: 'second' }])
  assert.equal(Object.keys(dupes).length, 1)
  assert.equal(dupes['u1']?.name, 'second')

  assert.deepEqual(subject.indexUsers([]), {})
})

test('reading a Record by string is possibly-missing', () => {
  const index = subject.indexUsers([user])

  // @ts-expect-error — a string index says which keys are *allowed*, never which are
  // present, so `noUncheckedIndexedAccess` adds `undefined`. Same as the index signature
  // in lesson 2.4 — a `Record<string, T>` is one.
  const found: User = index['u1']
  void found

  assert.equal(index['u1']?.name, 'ada')
  assert.equal(index['u9'], undefined)
})
