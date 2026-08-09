import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as solution from './solution.ts'
import * as starter from './starter.ts'
import type { Entry } from './solution.ts'

/**
 * Compile-time API parity, both directions, so neither file can grow, drop or
 * retype an export without tsc saying so.
 */
const _starterMatchesSolution: typeof solution = starter
const _solutionMatchesStarter: typeof starter = solution
void _starterMatchesSolution
void _solutionMatchesStarter

const subject = process.env['EXERCISE_TARGET'] === 'starter' ? starter : solution

const entries: readonly Entry[] = [
  ['ada', 90],
  ['grace', 55],
  ['hopper', 72],
]

test('zip pairs the two lists up', () => {
  assert.deepEqual(subject.zip(['a', 'b'], [1, 2]), [
    ['a', 1],
    ['b', 2],
  ])
})

test('zip stops at the shorter list', () => {
  assert.deepEqual(subject.zip(['a', 'b', 'c'], [1, 2]), [
    ['a', 1],
    ['b', 2],
  ])
  assert.deepEqual(subject.zip(['a'], [1, 2, 3]), [['a', 1]])
  assert.deepEqual(subject.zip([], [1, 2]), [])
  assert.deepEqual(subject.zip(['a'], []), [])
})

test('partition splits by score and keeps the order', () => {
  const [passes, fails] = subject.partition(entries, 70)

  assert.deepEqual(passes, [
    ['ada', 90],
    ['hopper', 72],
  ])
  assert.deepEqual(fails, [['grace', 55]])
})

test('partition treats the threshold as a pass', () => {
  const [passes, fails] = subject.partition([['ada', 70]], 70)

  assert.deepEqual(passes, [['ada', 70]])
  assert.deepEqual(fails, [])

  assert.deepEqual(subject.partition([], 70), [[], []])
})

test('headline needs no empty case, because there cannot be one', () => {
  assert.equal(subject.headline(['Results']), 'Results')
  assert.equal(subject.headline(['Results', 'term 1']), 'Results (term 1)')
  assert.equal(subject.headline(['Results', 'term 1', '2026']), 'Results (term 1, 2026)')
})

test('a tuple with a rest element is how you say "at least one"', () => {
  // @ts-expect-error — `readonly [string, ...string[]]` requires a first element, so
  // the empty array is refused at the call site. That is why `headline` can read
  // `parts[0]` with no check: the impossible case was made unrepresentable rather
  // than handled.
  subject.headline([])

  // A plain array is also refused, because its length is unknown — and unknown
  // includes zero.
  const unknownLength: readonly string[] = ['Results']
  // @ts-expect-error — "Target requires 1 element(s) but source may have fewer."
  subject.headline(unknownLength)
})

test('a tuple knows its length, so indexing is not widened', () => {
  const [entry = ['', 0] as Entry] = subject.zip(['ada'], [90])

  // No `| undefined` anywhere, unlike an array: the type says there are exactly two
  // slots and what is in each, so `noUncheckedIndexedAccess` has nothing to warn
  // about. This is the sharpest practical difference between a tuple and an array.
  const name: string = entry[0]
  const score: number = entry[1]
  assert.equal(`${name} ${score}`, 'ada 90')

  // @ts-expect-error — and index 2 does not exist at all, which an array type could
  // never tell you.
  void entry[2]
})

test('destructuring picks up the labels and the types', () => {
  const [name, score] = subject.zip(['ada'], [90])[0] ?? (['', 0] as Entry)

  // Both are exact types with no narrowing needed, and an editor offers the names
  // `name` and `score` from the tuple's labels.
  const upper: string = name.toUpperCase()
  const rounded: string = score.toFixed(1)

  assert.equal(`${upper} ${rounded}`, 'ADA 90.0')
})

test('makeCounter hands back a value and a way to change it', () => {
  const render = subject.makeCounter(0)

  const [value, increment] = render()
  assert.equal(value, 0)

  increment()
  increment()

  assert.equal(render()[0], 2)
})

test('the value in the tuple is a snapshot, not a live view', () => {
  const render = subject.makeCounter(5)
  const [value, increment] = render()

  increment()

  // `value` is still 5. It was the number at the moment `render()` ran, which is
  // exactly how `useState` behaves and exactly what confuses people about it.
  assert.equal(value, 5)
  assert.equal(render()[0], 6)
})

test('a readonly tuple cannot be written to', () => {
  const [passes] = subject.partition([['ada', 90]], 70)
  const entry: Entry = passes[0] ?? ['', 0]

  // @ts-expect-error — "Cannot assign to '0' because it is a read-only property."
  entry[0] = 'grace'

  // @ts-expect-error — and the mutating array methods are not on the type at all,
  // rather than being present and quietly wrong.
  void entry.push

  // The assignment above still landed, because `readonly` is erased before the
  // program runs. The compiler was the only thing stopping you — same story as
  // lesson 1.1.
  assert.deepEqual(entry, ['grace', 90])
})
