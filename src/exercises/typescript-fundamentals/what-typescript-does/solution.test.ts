import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as solution from './solution.ts'
import * as starter from './starter.ts'
/* Imported as a type only. `verbatimModuleSyntax` means an unmarked
   `import { Reading }` would survive erasure and fail at run time with "does not
   provide an export named 'Reading'"; the `type` keyword is what removes it. */
import type { Reading } from './solution.ts'

/**
 * Compile-time API parity, both directions, so neither file can grow, drop or
 * retype an export without tsc saying so. Costs nothing at runtime, and it is
 * what lets `attempt` swap one module for the other and only ever fail for the
 * reason the learner cares about.
 */
const _starterMatchesSolution: typeof solution = starter
const _solutionMatchesStarter: typeof starter = solution
void _starterMatchesSolution
void _solutionMatchesStarter

/**
 * CI grades `solution.ts`; `pnpm --filter exercises attempt` sets
 * EXERCISE_TARGET=starter and grades the learner against these same assertions.
 */
const subject = process.env['EXERCISE_TARGET'] === 'starter' ? starter : solution

test('toFahrenheit converts and rounds to one decimal place', () => {
  assert.equal(subject.toFahrenheit(0), 32)
  assert.equal(subject.toFahrenheit(100), 212)
  assert.equal(subject.toFahrenheit(-40), -40)
  assert.equal(subject.toFahrenheit(36.6), 97.9)
  assert.equal(subject.toFahrenheit(21.55), 70.8)
})

test('hottest picks the warmest reading', () => {
  const readings: readonly Reading[] = [
    { label: 'cellar', celsius: 11 },
    { label: 'attic', celsius: 29.5 },
    { label: 'kitchen', celsius: 21 },
  ]
  assert.deepEqual(subject.hottest(readings), { label: 'attic', celsius: 29.5 })
})

test('hottest returns undefined for an empty list', () => {
  assert.equal(subject.hottest([]), undefined)
})

test('parseReading accepts a well-formed value and drops extra keys', () => {
  assert.deepEqual(subject.parseReading({ label: 'kitchen', celsius: 21.5 }), {
    label: 'kitchen',
    celsius: 21.5,
  })
  assert.deepEqual(subject.parseReading({ label: 'attic', celsius: 0, colour: 'red' }), {
    label: 'attic',
    celsius: 0,
  })
})

test('parseReading rejects everything that is not a reading', () => {
  assert.equal(subject.parseReading(null), undefined)
  assert.equal(subject.parseReading(undefined), undefined)
  assert.equal(subject.parseReading('kitchen'), undefined)
  assert.equal(subject.parseReading(21.5), undefined)
  assert.equal(subject.parseReading([{ label: 'kitchen', celsius: 21.5 }]), undefined)
  assert.equal(subject.parseReading({ label: 'kitchen' }), undefined)
  assert.equal(subject.parseReading({ celsius: 21.5 }), undefined)
  assert.equal(subject.parseReading({ label: '', celsius: 21.5 }), undefined)
  assert.equal(subject.parseReading({ label: 'kitchen', celsius: '21.5' }), undefined)
  assert.equal(subject.parseReading({ label: 7, celsius: 21.5 }), undefined)
})

test('parseReading rejects the numbers that are numbers but not temperatures', () => {
  // `typeof NaN === 'number'` and `typeof Infinity === 'number'`. The type system
  // is telling the truth; it is just not the truth you wanted, and JSON really
  // does produce the second one.
  assert.equal(subject.parseReading({ label: 'kitchen', celsius: Number.NaN }), undefined)
  assert.equal(subject.parseReading(JSON.parse('{"label":"kitchen","celsius":1e999}')), undefined)
})

test('an annotation is not a runtime check', () => {
  // This test is the lesson in four lines. `JSON.parse` is typed `any`, so tsc
  // accepts the `as Reading` on trust and every line below type-checks perfectly.
  // At run time the object is nothing like a `Reading`, because by then there is
  // no `Reading` left — the type was deleted before the program started.
  const claimed = JSON.parse('{"label":42}') as Reading

  assert.equal(typeof claimed.label, 'number') // the type promised string
  assert.equal(claimed.celsius, undefined) // the type promised number

  // A function that actually looks is the only thing that catches it.
  assert.equal(subject.parseReading(claimed), undefined)
})

test('a value parseReading approved is usable as a Reading', () => {
  // The point of this test is that it COMPILES. `raw` is `unknown`, and `hottest`
  // accepts only `Reading`s — so this is a type error unless `parseReading`
  // really does return `Reading | undefined` and `assert.ok` really does rule out
  // the `undefined`.
  const raw: unknown = JSON.parse('{"label":"kitchen","celsius":21.5}')
  const reading = subject.parseReading(raw)

  assert.ok(reading)
  assert.deepEqual(subject.hottest([reading]), { label: 'kitchen', celsius: 21.5 })
})
