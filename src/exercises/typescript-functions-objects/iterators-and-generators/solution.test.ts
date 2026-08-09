import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as solution from './solution.ts'
import * as starter from './starter.ts'

/**
 * Compile-time API parity, both directions, so neither file can grow, drop or
 * retype an export without tsc saying so.
 */
const _starterMatchesSolution: typeof solution = starter
const _solutionMatchesStarter: typeof starter = solution
void _starterMatchesSolution
void _solutionMatchesStarter

const subject = process.env['EXERCISE_TARGET'] === 'starter' ? starter : solution

test('range counts up to but not including the end', () => {
  assert.deepEqual([...subject.range(0, 3)], [0, 1, 2])
  assert.deepEqual([...subject.range(2, 5)], [2, 3, 4])
  assert.deepEqual([...subject.range(0, 0)], [])
  assert.deepEqual([...subject.range(5, 0)], [])
})

test('range steps', () => {
  assert.deepEqual([...subject.range(2, 10, 3)], [2, 5, 8])
  assert.deepEqual([...subject.range(0, 10, 5)], [0, 5])
  assert.deepEqual([...subject.range(0, 1, 10)], [0])
})

test('range refuses to loop forever', () => {
  // A step of 0 or below never reaches the end. Because generators are lazy, the hang
  // would happen at the consumer — in somebody else's `for…of` — so the guard belongs
  // here.
  assert.deepEqual([...subject.range(0, 3, 0)], [])
  assert.deepEqual([...subject.range(0, 3, -1)], [])
})

test('take takes the first few of anything', () => {
  assert.deepEqual([...subject.take([10, 20, 30, 40], 2)], [10, 20])
  assert.deepEqual([...subject.take(subject.range(0, 100), 3)], [0, 1, 2])
  assert.deepEqual([...subject.take([1, 2], 5)], [1, 2])
  assert.deepEqual([...subject.take([1, 2], 0)], [])
  assert.deepEqual([...subject.take([1, 2], -1)], [])
})

test('take works on an infinite sequence, which is the point', () => {
  // `naturals()` never ends. Nothing hangs, because a generator computes nothing until
  // somebody asks — and `take` stops asking.
  assert.deepEqual([...subject.take(subject.naturals(), 5)], [0, 1, 2, 3, 4])
})

test('take pulls exactly as many values as it needs and no more', () => {
  let produced = 0

  function* counting(): Generator<number, void, undefined> {
    for (let value = 0; ; value += 1) {
      produced += 1
      yield value
    }
  }

  assert.deepEqual([...subject.take(counting(), 3)], [0, 1, 2])

  // 3, not 4. Checking the count *before* pulling the next value would produce one
  // extra — invisible on an array, expensive when each value is a network page.
  assert.equal(produced, 3)
})

test('a playlist can be walked with for…of', () => {
  const playlist = subject.makePlaylist(['intro', 'verse'])

  const seen: string[] = []
  for (const track of playlist) {
    seen.push(track)
  }

  assert.deepEqual(seen, ['intro', 'verse'])
})

test('implementing Symbol.iterator buys the whole ecosystem at once', () => {
  const playlist = subject.makePlaylist(['a', 'b', 'c'])

  // None of these were taught about `Playlist`. They all work because it has the one
  // method the iterable protocol asks for.
  assert.deepEqual([...playlist], ['a', 'b', 'c'])
  assert.deepEqual(Array.from(playlist), ['a', 'b', 'c'])
  assert.deepEqual(new Set(playlist).size, 3)

  const [first, ...rest] = playlist
  assert.equal(first, 'a')
  assert.deepEqual(rest, ['b', 'c'])
})

test('a playlist iterates whatever it holds at the time', () => {
  const playlist = subject.makePlaylist(['a'])

  playlist.add('b')
  assert.deepEqual([...playlist], ['a', 'b'])
  assert.deepEqual(playlist.tracks, ['a', 'b'])

  playlist.add('c')
  assert.deepEqual([...playlist], ['a', 'b', 'c'])
})

test('total accepts anything iterable', () => {
  assert.equal(subject.total([1, 2, 3]), 6)
  assert.equal(subject.total(new Set([1, 2, 3, 3])), 6)
  assert.equal(subject.total(subject.range(1, 5)), 10)
  assert.equal(subject.total(subject.take(subject.naturals(), 4)), 6)
  assert.equal(subject.total([]), 0)
  assert.equal(subject.total(new Map([['a', 5]]).values()), 5)
})

test('Iterable is the loosest parameter type there is', () => {
  // Half the point of this test is that it COMPILES. Five unrelated types, none of
  // which inherit from anything in common — they simply have a `[Symbol.iterator]`
  // method, which is structural typing over a symbol key.
  const sources: readonly Iterable<number>[] = [
    [1, 2],
    new Set([3]),
    new Map([['a', 4]]).values(),
    subject.range(5, 6),
    subject.take(subject.naturals(), 0),
  ]

  assert.equal(
    sources.reduce((sum, source) => sum + subject.total(source), 0),
    1 + 2 + 3 + 4 + 5,
  )
})

test('an array is not assignable to Iterator, and a generator is both', () => {
  // `Iterable` (has a `[Symbol.iterator]`) and `Iterator` (has a `next`) are different
  // types, and conflating them is the single most common confusion here.
  const generator: Iterator<number> = subject.range(0, 2)
  assert.deepEqual(generator.next(), { value: 0, done: false })

  // @ts-expect-error — an array is iterable but is not itself an iterator: no `next`.
  const array: Iterator<number> = [1, 2]
  void array
})
