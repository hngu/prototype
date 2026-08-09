import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Equals, Expect } from '../../tools/type-assert.ts'
import * as solution from './solution.ts'
import * as starter from './starter.ts'
import type { ElementOf, IsAllStrings, StringsOnly, Unwrap } from './solution.ts'

/**
 * Compile-time API parity, both directions, so neither file can grow, drop or
 * retype an export without tsc saying so.
 */
const _starterMatchesSolution: typeof solution = starter
const _solutionMatchesStarter: typeof starter = solution
void _starterMatchesSolution
void _solutionMatchesStarter

const subject = process.env['EXERCISE_TARGET'] === 'starter' ? starter : solution

/* ── The given types, asserted directly ───────────────────────────────────────── */

type _unwrapPromise = Expect<Equals<Unwrap<Promise<string>>, string>>
type _unwrapPlain = Expect<Equals<Unwrap<string>, string>>
type _unwrapUnion = Expect<Equals<Unwrap<Promise<string> | number>, string | number>>

/* The recursion, which is the reason `Unwrap` is not one line shorter. Without the
   recursive call this would be `Promise<number>` — and `await` would still return `3`,
   leaving the type lying about its own implementation. */
type _unwrapNested = Expect<Equals<Unwrap<Promise<Promise<Promise<number>>>>, number>>

/* And it agrees with the built-in it reimplements, which lesson 9 uses. */
type _matchesAwaited = Expect<Equals<Unwrap<Promise<number>>, Awaited<Promise<number>>>>

type _elementArray = Expect<Equals<ElementOf<number[]>, number>>
type _elementReadonly = Expect<Equals<ElementOf<readonly string[]>, string>>
type _elementTuple = Expect<Equals<ElementOf<readonly [1, 'a']>, 1 | 'a'>>
type _elementNotArray = Expect<Equals<ElementOf<string>, never>>

/* Distributive: once per union member, `never` dropping out of the result. */
type _stringsOnly = Expect<Equals<StringsOnly<'a' | 1 | 'b'>, 'a' | 'b'>>
type _stringsOnlyAll = Expect<Equals<StringsOnly<'a' | 'b'>, 'a' | 'b'>>
type _stringsOnlyNone = Expect<Equals<StringsOnly<1 | 2>, never>>

/* Non-distributive: one question about the whole union. The same argument gives a
   different shape of answer, which is the entire lesson. */
type _allStringsYes = Expect<Equals<IsAllStrings<'a' | 'b'>, true>>
type _allStringsNo = Expect<Equals<IsAllStrings<'a' | 1>, false>>

/* The contrast, stated as one assertion: distributive keeps the good members,
   non-distributive rejects the union. */
type _contrast = Expect<Equals<[StringsOnly<'a' | 1>, IsAllStrings<'a' | 1>], ['a', false]>>

/* ── Runtime ──────────────────────────────────────────────────────────────────── */

test('unwrap awaits a promise', async () => {
  assert.equal(await subject.unwrap(Promise.resolve(3)), 3)
  assert.equal(await subject.unwrap(Promise.resolve('ada')), 'ada')
})

test('unwrap passes a plain value straight through', async () => {
  assert.equal(await subject.unwrap(3), 3)
  assert.equal(await subject.unwrap('ada'), 'ada')
  assert.equal(await subject.unwrap(undefined), undefined)
  assert.deepEqual(await subject.unwrap({ a: 1 }), { a: 1 })
})

test('unwrap goes all the way down, exactly like its type says', async () => {
  const nested = Promise.resolve(Promise.resolve(Promise.resolve(7)))

  // `await` keeps unwrapping until it reaches a plain value, and `Unwrap` recurses to
  // match. If either had stopped at one level the two would disagree.
  assert.equal(await subject.unwrap(nested), 7)
})

test('unwrap returns the unwrapped type, not a promise of a promise', async () => {
  // The point of this test is that it COMPILES. `.toFixed` exists on a number and not on
  // a `Promise<number>`, so this only builds if the return type resolved properly.
  const value = await subject.unwrap(Promise.resolve(3))
  type _value = Expect<Equals<typeof value, number>>

  assert.equal(value.toFixed(1), '3.0')
})

test('firstOf returns the first element or undefined', () => {
  assert.equal(subject.firstOf([1, 2, 3]), 1)
  assert.equal(subject.firstOf(['a']), 'a')
  assert.equal(subject.firstOf([]), undefined)
})

test('firstOf keeps a tuple as precise as it was', () => {
  const fromArray = subject.firstOf([1, 2])
  type _fromArray = Expect<Equals<typeof fromArray, number | undefined>>

  const fromTuple = subject.firstOf([1, 'a'] as const)
  type _fromTuple = Expect<Equals<typeof fromTuple, 1 | 'a' | undefined>>

  assert.equal(fromArray, 1)
  assert.equal(fromTuple, 1)
})

test('stringsOnly filters and narrows without a cast', () => {
  assert.deepEqual(subject.stringsOnly(['a', 1, 'b', null, undefined, 'c']), ['a', 'b', 'c'])
  assert.deepEqual(subject.stringsOnly([]), [])
  assert.deepEqual(subject.stringsOnly([1, 2]), [])
  assert.deepEqual(subject.stringsOnly(['', 'a']), ['', 'a'])
})

test('stringsOnly output is genuinely strings', () => {
  // Compile-only. The elements are `string` rather than `unknown`, which came from a real
  // runtime check via a type predicate rather than from a cast — the honest version of
  // what the two functions above had to promise.
  const strings = subject.stringsOnly(['a', 1, 'b'])
  type _strings = Expect<Equals<typeof strings, readonly string[]>>

  assert.equal(strings.map((s) => s.toUpperCase()).join(''), 'AB')
})
