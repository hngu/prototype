import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Equals, Expect } from '../../tools/type-assert.ts'
import * as solution from './solution.ts'
import * as starter from './starter.ts'
import type { Mode, ModeLabel } from './solution.ts'

/**
 * Compile-time API parity, both directions, so neither file can grow, drop or
 * retype an export without tsc saying so.
 */
const _starterMatchesSolution: typeof solution = starter
const _solutionMatchesStarter: typeof starter = solution
void _starterMatchesSolution
void _solutionMatchesStarter

const subject = process.env['EXERCISE_TARGET'] === 'starter' ? starter : solution

/**
 * The given types are the exercise's subject, so they are checked first and directly.
 * These four lines are why the lesson page can claim `keyof typeof` produces what it
 * says: change `MODES` and they move with it, and get one of them wrong and the build
 * stops here.
 */
type _mode = Expect<Equals<Mode, 'dark' | 'light' | 'auto'>>
type _label = Expect<Equals<ModeLabel, 'Dark' | 'Light' | 'Follow system'>>
type _notString = Expect<Equals<Equals<ModeLabel, string>, false>>
type _modesReadonly = Expect<Equals<typeof solution.MODES.dark, 'Dark'>>

test('labelFor looks the label up', () => {
  assert.equal(subject.labelFor('dark'), 'Dark')
  assert.equal(subject.labelFor('light'), 'Light')
  assert.equal(subject.labelFor('auto'), 'Follow system')
})

test('labelFor accepts nothing but a mode', () => {
  // @ts-expect-error — "Argument of type '\"nope\"' is not assignable to parameter of
  // type 'Mode'." The union was derived from the object, so this is checked against the
  // data rather than against a hand-written list that could fall behind it.
  subject.labelFor('nope')

  // @ts-expect-error — nor a label, which is the other union.
  subject.labelFor('Dark')
})

test('allModes returns every key, correctly typed', () => {
  const modes = subject.allModes()

  // Before the assert, because `deepEqual` narrows its first argument.
  type _modes = Expect<Equals<typeof modes, readonly Mode[]>>

  assert.deepEqual(modes, ['dark', 'light', 'auto'])
})

test('allModes results feed straight back in', () => {
  // The reason `allModes` is worth typing properly rather than returning `string[]`:
  // its output is accepted by `labelFor` with no cast and no narrowing at the call site.
  assert.deepEqual(subject.allModes().map(subject.labelFor), ['Dark', 'Light', 'Follow system'])
})

test('isMode accepts exactly the three keys', () => {
  assert.equal(subject.isMode('dark'), true)
  assert.equal(subject.isMode('light'), true)
  assert.equal(subject.isMode('auto'), true)

  assert.equal(subject.isMode('Dark'), false)
  assert.equal(subject.isMode('nope'), false)
  assert.equal(subject.isMode(''), false)
  assert.equal(subject.isMode(undefined), false)
  assert.equal(subject.isMode(null), false)
  assert.equal(subject.isMode(42), false)
  assert.equal(subject.isMode({ dark: true }), false)
})

test('isMode is not fooled by inherited properties', () => {
  // `value in MODES` would return true for all of these, because `in` walks the
  // prototype chain. `Object.hasOwn` is the check that means what you meant.
  assert.equal(subject.isMode('toString'), false)
  assert.equal(subject.isMode('constructor'), false)
  assert.equal(subject.isMode('hasOwnProperty'), false)
  assert.equal(subject.isMode('__proto__'), false)
})

test('isMode narrows an unknown into a Mode', () => {
  // The point of this test is that it COMPILES. `raw` is `unknown`, and `labelFor`
  // accepts only a `Mode` — so this is a type error unless the predicate is honest.
  const raw: unknown = 'auto'

  assert.ok(subject.isMode(raw))
  if (subject.isMode(raw)) {
    assert.equal(subject.labelFor(raw), 'Follow system')
  }
})

test('modeFromLabel goes the other way', () => {
  assert.equal(subject.modeFromLabel('Dark'), 'dark')
  assert.equal(subject.modeFromLabel('Follow system'), 'auto')

  assert.equal(subject.modeFromLabel('dark'), undefined) // case-sensitive
  assert.equal(subject.modeFromLabel('nope'), undefined)
  assert.equal(subject.modeFromLabel(''), undefined)
})

test('modeFromLabel returns something labelFor will take back', () => {
  // Compile-only, and a round trip: `Mode | undefined` in, `Mode` after the check, and
  // `labelFor` accepts it. No cast anywhere in the test.
  const mode = subject.modeFromLabel('Light')

  assert.ok(mode !== undefined)
  assert.equal(subject.labelFor(mode), 'Light')
})
