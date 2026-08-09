import assert from 'node:assert/strict'
import { test } from 'node:test'
/* `Equals` compares two types exactly; `Expect` fails to compile unless given `true`.
   Course 3's subject is types, so several tests below assert on types rather than
   values. Nothing in that module exists at run time. */
import type { Equals, Expect } from '../../tools/type-assert.ts'
import * as solution from './solution.ts'
import * as starter from './starter.ts'
import type { Cache } from './solution.ts'

/**
 * Compile-time API parity, both directions, so neither file can grow, drop or
 * retype an export without tsc saying so.
 */
const _starterMatchesSolution: typeof solution = starter
const _solutionMatchesStarter: typeof starter = solution
void _starterMatchesSolution
void _solutionMatchesStarter

const subject = process.env['EXERCISE_TARGET'] === 'starter' ? starter : solution

test('first and last do the obvious thing', () => {
  assert.equal(subject.first([1, 2, 3]), 1)
  assert.equal(subject.last([1, 2, 3]), 3)
  assert.equal(subject.first(['a']), 'a')
  assert.equal(subject.last(['a']), 'a')
})

test('first and last cope with an empty list', () => {
  assert.equal(subject.first([]), undefined)
  assert.equal(subject.last([]), undefined)
})

test('the caller never writes a type argument', () => {
  // Half the point of this test is that it COMPILES. `T` is inferred from the
  // argument every time, and the return type follows — no `first<number>([1, 2])`
  // anywhere, which is what a good generic signature buys.
  const n: number | undefined = subject.first([1, 2])
  const s: string | undefined = subject.last(['a', 'b'])
  const d: Date | undefined = subject.first([new Date(0)])

  assert.equal(`${n} ${s} ${d?.getTime()}`, '1 b 0')

  // @ts-expect-error — `T` was inferred as `number`, so the result is not a string.
  // A generic function is not a loose one.
  const wrong: string | undefined = subject.first([1, 2])
  void wrong
})

test('pairUp keeps its two type parameters apart', () => {
  assert.deepEqual(subject.pairUp(['a', 'b'], [1, 2]), [
    ['a', 1],
    ['b', 2],
  ])
  assert.deepEqual(subject.pairUp(['a', 'b', 'c'], [1, 2]), [
    ['a', 1],
    ['b', 2],
  ])
  assert.deepEqual(subject.pairUp([], [1]), [])
  assert.deepEqual(subject.pairUp([1], []), [])
})

test('pairUp infers each side independently', () => {
  // Also compile-only, and the reason `pairUp` has two type parameters rather than one.
  // A single `<T>` would have forced both lists to hold the same type.
  const pairs = subject.pairUp(['a'], [new Date(0)])
  type _pair = Expect<Equals<(typeof pairs)[number], readonly [string, Date]>>

  const [pair] = pairs
  assert.equal(pair?.[0], 'a')
  assert.equal(pair?.[1].getTime(), 0)
})

test('a cache holds one type of value', () => {
  const cache = subject.makeCache<string>()

  assert.equal(cache.size, 0)
  assert.equal(cache.has('a'), false)
  assert.equal(cache.get('a'), undefined)

  cache.set('a', 'ada')
  assert.equal(cache.get('a'), 'ada')
  assert.equal(cache.has('a'), true)
  assert.equal(cache.size, 1)

  cache.set('a', 'grace')
  assert.equal(cache.get('a'), 'grace')
  assert.equal(cache.size, 1)
})

test('two caches of different types do not mix', () => {
  const strings: Cache<string> = subject.makeCache<string>()
  const numbers: Cache<number> = subject.makeCache<number>()

  strings.set('a', 'ada')
  numbers.set('a', 42)

  assert.equal(strings.get('a'), 'ada')
  assert.equal(numbers.get('a'), 42)

  // @ts-expect-error — `Cache<string>` and `Cache<number>` are unrelated types, and the
  // type argument is what makes them so. Without it, both would be `Cache<unknown>` and
  // this line would be fine.
  strings.set('b', 42)

  // @ts-expect-error — nor are the caches themselves interchangeable.
  const wrong: Cache<string> = numbers
  void wrong
})

test('cached computes on a miss and remembers', () => {
  const cache = subject.makeCache<number>()
  let calls = 0

  const compute = (key: string): number => {
    calls += 1
    return key.length
  }

  assert.equal(subject.cached(cache, 'abc', compute), 3)
  assert.equal(calls, 1)

  assert.equal(subject.cached(cache, 'abc', compute), 3)
  assert.equal(calls, 1) // the second call was a hit

  assert.equal(subject.cached(cache, 'wxyz', compute), 4)
  assert.equal(calls, 2)
  assert.equal(cache.size, 2)
})

test('cached ties the cache and the compute function to one type', () => {
  const cache = subject.makeCache<string>()

  const value: string = subject.cached(cache, 'a', (key) => key.toUpperCase())
  assert.equal(value, 'A')

  // @ts-expect-error — `compute` must return the type the cache holds. This is the
  // whole return on threading one `T` through three positions: a mismatch is a compile
  // error here rather than a surprise on a cache hit six months later.
  subject.cached(cache, 'b', () => 42)

  // And `key` is a `string` with no annotation, because the signature said so.
  assert.equal(
    subject.cached(cache, 'ada', (key) => key.length.toString()),
    '3',
  )
})
