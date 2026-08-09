import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Equals, Expect } from '../../tools/type-assert.ts'
import * as solution from './solution.ts'
import * as starter from './starter.ts'
import type { Bucket } from './solution.ts'

/**
 * Compile-time API parity, both directions, so neither file can grow, drop or
 * retype an export without tsc saying so.
 */
const _starterMatchesSolution: typeof solution = starter
const _solutionMatchesStarter: typeof starter = solution
void _starterMatchesSolution
void _solutionMatchesStarter

const subject = process.env['EXERCISE_TARGET'] === 'starter' ? starter : solution

interface User {
  readonly id: string
  readonly name: string
  readonly age: number
}

const users: readonly User[] = [
  { id: 'u1', name: 'ada', age: 36 },
  { id: 'u2', name: 'grace', age: 45 },
]

test('pluck reads one field from every item', () => {
  assert.deepEqual(subject.pluck(users, 'name'), ['ada', 'grace'])
  assert.deepEqual(subject.pluck(users, 'age'), [36, 45])
  assert.deepEqual(subject.pluck(users, 'id'), ['u1', 'u2'])
  assert.deepEqual(subject.pluck([], 'name'), [])
})

test('the result type follows from which key you asked for', () => {
  // Half the point of this test is that it COMPILES, and it is the reason
  // `K extends keyof T` is written that way rather than `key: keyof T`. One signature,
  // and the element type changes per call.
  const names = subject.pluck(users, 'name')
  const ages = subject.pluck(users, 'age')

  type _names = Expect<Equals<typeof names, readonly string[]>>
  type _ages = Expect<Equals<typeof ages, readonly number[]>>

  assert.equal(names.join(' ').toUpperCase(), 'ADA GRACE')
  assert.equal(
    ages.reduce((a, b) => a + b, 0),
    81,
  )
})

test('pluck refuses a key the item does not have', () => {
  // @ts-expect-error — "Argument of type '\"nmae\"' is not assignable to parameter of
  // type 'keyof User'." A typo is a compile error rather than an array of `undefined`.
  subject.pluck(users, 'nmae')

  // @ts-expect-error — and a key from some other type is no better.
  subject.pluck(users, 'email')
})

test('byId indexes by id, later duplicates winning', () => {
  const index = subject.byId(users)

  assert.equal(index.size, 2)
  assert.deepEqual(index.get('u1'), { id: 'u1', name: 'ada', age: 36 })
  assert.equal(index.get('u9'), undefined)

  const dupes = subject.byId([
    { id: 'u1', name: 'first', age: 1 },
    { id: 'u1', name: 'second', age: 2 },
  ])
  assert.equal(dupes.size, 1)
  assert.equal(dupes.get('u1')?.name, 'second')
})

test('a constraint is a floor, not a ceiling', () => {
  // This is the single most valuable thing in the lesson. `byId` asks only for an `id`,
  // and hands back the *whole* `User` — `name` is available below with no cast and no
  // narrowing. A non-generic `byId(items: readonly { id: string }[])` would compile,
  // accept the same argument, and return `{ id: string }`, silently discarding the rest.
  const index = subject.byId(users)
  type _values = Expect<Equals<ReturnType<typeof subject.byId<User>>, Map<string, User>>>

  const found = index.get('u2')
  assert.equal(found?.name, 'grace')
  assert.equal(found?.age, 45)
})

test('byId refuses anything without an id', () => {
  // @ts-expect-error — "Property 'id' is missing." The constraint is the door.
  subject.byId([{ name: 'ada' }])

  // @ts-expect-error — and an `id` of the wrong type does not fit either.
  subject.byId([{ id: 42 }])
})

test('longest works on anything with a length', () => {
  assert.equal(subject.longest('abc', 'de'), 'abc')
  assert.equal(subject.longest('de', 'abc'), 'abc')
  assert.equal(subject.longest('ab', 'cd'), 'ab') // ties go to a
  assert.deepEqual(subject.longest([1], [2, 3]), [2, 3])
})

test('longest returns the type it was given, and refuses lengthless things', () => {
  // Compile-only. The constraint is structural: strings and arrays both have a `length`
  // and neither had to opt in. And the return type is `T`, so a string comes back a
  // string rather than a `{ length: number }`.
  const text: string = subject.longest('abc', 'de')
  const list: readonly number[] = subject.longest([1], [2, 3])

  assert.equal(`${text.toUpperCase()} ${list.length}`, 'ABC 2')

  // @ts-expect-error — a number has no `length`, so it does not fit through the door.
  subject.longest(1, 2)

  // @ts-expect-error — and both parameters are the same `T`, so one of each is refused.
  subject.longest('abc', [1, 2])
})

test('makeBucket falls back to its parameter default', () => {
  const empty = subject.makeBucket('empty')

  /* Nothing to infer `T` from, so `= string` decides. Without the default it would be
     `unknown` and the bucket would be useless.

     Note this assertion comes *before* the `deepEqual` below, and has to. `deepEqual`
     from `node:assert/strict` is declared `asserts actual is T`, so it narrows `empty`
     to the shape of the expected value — after which `typeof empty` is no longer the
     type the function returned. */
  type _empty = Expect<Equals<typeof empty, Bucket<string>>>

  assert.deepEqual(empty, { label: 'empty', items: [] })
})

test('an inferred type argument beats the default', () => {
  const numbers = subject.makeBucket('counts', [1, 2, 3])
  type _numbers = Expect<Equals<typeof numbers, Bucket<number>>>
  assert.deepEqual(numbers.items, [1, 2, 3])

  // And an explicit argument works with no items to infer from.
  const explicit = subject.makeBucket<number>('counts')
  type _explicit = Expect<Equals<typeof explicit, Bucket<number>>>
  assert.deepEqual(explicit.items, [])

  // @ts-expect-error — a default is not a constraint. It decides what happens when
  // nobody says; it does not restrict what may be said.
  subject.makeBucket<number>('counts', ['a'])
})
