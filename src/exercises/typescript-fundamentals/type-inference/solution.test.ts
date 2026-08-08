import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as solution from './solution.ts'
import * as starter from './starter.ts'

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
 * CI grades `solution.ts`, which keeps `main` green and proves the reference
 * answer satisfies its own tests. `pnpm --filter exercises attempt` sets
 * EXERCISE_TARGET=starter and grades the learner's work with these same
 * assertions — one set of criteria, so the answer and the tests cannot drift.
 */
const subject = process.env['EXERCISE_TARGET'] === 'starter' ? starter : solution

test('makeConfig fills in the default contrast', () => {
  assert.deepEqual(subject.makeConfig('dark'), { mode: 'dark', contrast: 'normal' })
  assert.deepEqual(subject.makeConfig('light'), { mode: 'light', contrast: 'normal' })
})

test('MODES lists both modes, in order', () => {
  assert.deepEqual(subject.MODES, ['dark', 'light'])
})

test('isMode accepts exactly the two modes', () => {
  assert.equal(subject.isMode('dark'), true)
  assert.equal(subject.isMode('light'), true)

  assert.equal(subject.isMode('DARK'), false)
  assert.equal(subject.isMode(''), false)
  assert.equal(subject.isMode(undefined), false)
  assert.equal(subject.isMode(null), false)
  assert.equal(subject.isMode({ mode: 'dark' }), false)
  assert.equal(subject.isMode(['dark']), false)
})

test('isMode narrows, not just checks', () => {
  // The point of this test is that it COMPILES. `raw` is `unknown`, and
  // `makeConfig` only accepts a `Mode` — so the call inside the guard is a type
  // error unless `isMode` is a real predicate. A body that returned the right
  // booleans from a `boolean` return type would pass the test above and fail here.
  const raw: unknown = 'dark'

  assert.ok(subject.isMode(raw))
  if (subject.isMode(raw)) {
    assert.deepEqual(subject.makeConfig(raw), { mode: 'dark', contrast: 'normal' })
  }
})
