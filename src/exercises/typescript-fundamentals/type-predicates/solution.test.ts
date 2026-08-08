import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as solution from './solution.ts'
import * as starter from './starter.ts'
import type { User } from './solution.ts'

/**
 * Compile-time API parity, both directions, so neither file can grow, drop or
 * retype an export without tsc saying so.
 */
const _starterMatchesSolution: typeof solution = starter
const _solutionMatchesStarter: typeof starter = solution
void _starterMatchesSolution
void _solutionMatchesStarter

/**
 * The `: typeof solution` annotation is **required** here, not stylistic.
 * `subject.assertDefined(…)` is a call to an assertion function, and TypeScript
 * only honours those when every name in the call target has an explicit type
 * annotation — otherwise: "Assertions require every name in the call target to be
 * declared with an explicit type annotation" (TS2775). Drop the annotation and the
 * narrowing tests below stop compiling.
 */
const subject: typeof solution = process.env['EXERCISE_TARGET'] === 'starter' ? starter : solution

const users: readonly User[] = [
  { id: 'u1', name: 'ada' },
  { id: 'u2', name: 'grace' },
]

test('isNonEmptyString accepts strings with real content', () => {
  assert.equal(subject.isNonEmptyString('ada'), true)
  assert.equal(subject.isNonEmptyString('0'), true)
  assert.equal(subject.isNonEmptyString(' x '), true)
})

test('isNonEmptyString rejects blanks and non-strings', () => {
  assert.equal(subject.isNonEmptyString(''), false)
  assert.equal(subject.isNonEmptyString('   '), false)
  assert.equal(subject.isNonEmptyString('\n\t'), false)
  assert.equal(subject.isNonEmptyString(undefined), false)
  assert.equal(subject.isNonEmptyString(null), false)
  assert.equal(subject.isNonEmptyString(42), false)
  assert.equal(subject.isNonEmptyString(['ada']), false)
  assert.equal(subject.isNonEmptyString({ toString: () => 'ada' }), false)
})

test('isRecord accepts objects with named fields', () => {
  assert.equal(subject.isRecord({}), true)
  assert.equal(subject.isRecord({ a: 1 }), true)
  // A Date is an object, and this guard is about shape rather than class, so it
  // passes. Worth knowing before you rely on `isRecord` to mean "came from JSON".
  assert.equal(subject.isRecord(new Date(0)), true)
})

test('isRecord rejects null, arrays and primitives', () => {
  assert.equal(subject.isRecord(null), false)
  assert.equal(subject.isRecord(undefined), false)
  assert.equal(subject.isRecord([]), false)
  assert.equal(subject.isRecord([{ a: 1 }]), false)
  assert.equal(subject.isRecord('a'), false)
  assert.equal(subject.isRecord(42), false)
  assert.equal(subject.isRecord(true), false)
})

test('assertDefined throws only for null and undefined', () => {
  assert.throws(() => subject.assertDefined(undefined, 'the widget'), {
    message: 'the widget is missing',
  })
  assert.throws(() => subject.assertDefined(null, 'the widget'), {
    message: 'the widget is missing',
  })

  // Everything else passes, including the falsy values that a truthiness check
  // would have wrongly rejected.
  subject.assertDefined(0, 'zero')
  subject.assertDefined('', 'empty string')
  subject.assertDefined(false, 'false')
  subject.assertDefined(Number.NaN, 'nan')
})

test('requireField pulls a string out of untrusted data', () => {
  assert.equal(subject.requireField({ name: 'ada' }, 'name'), 'ada')
  assert.equal(subject.requireField(JSON.parse('{"name":"grace"}'), 'name'), 'grace')
})

test('requireField reports what was wrong', () => {
  assert.throws(() => subject.requireField(null, 'name'), { message: 'expected an object' })
  assert.throws(() => subject.requireField('ada', 'name'), { message: 'expected an object' })
  assert.throws(() => subject.requireField([], 'name'), { message: 'expected an object' })

  assert.throws(() => subject.requireField({}, 'name'), {
    message: 'field "name" is not a non-empty string',
  })
  assert.throws(() => subject.requireField({ name: '  ' }, 'name'), {
    message: 'field "name" is not a non-empty string',
  })
  assert.throws(() => subject.requireField({ name: 42 }, 'name'), {
    message: 'field "name" is not a non-empty string',
  })
})

test('nameOf finds a user, and complains about one that is not there', () => {
  assert.equal(subject.nameOf(users, 'u2'), 'grace')
  assert.throws(() => subject.nameOf(users, 'u9'), { message: 'user u9 is missing' })
})

test('the predicates narrow, not just answer', () => {
  // The point of this test is that it COMPILES. `raw` is `unknown`; `.trim()` and
  // `Object.keys` are both type errors on an `unknown`. They are only legal here
  // because the guards' return types promised something, which is a promise a
  // plain `boolean` cannot make.
  const raw: unknown = ' ada '

  assert.ok(subject.isNonEmptyString(raw))
  if (subject.isNonEmptyString(raw)) {
    assert.equal(raw.trim(), 'ada')
  }

  const bag: unknown = { name: 'ada' }
  assert.ok(subject.isRecord(bag))
  if (subject.isRecord(bag)) {
    assert.deepEqual(Object.keys(bag), ['name'])
  }
})

test('assertDefined narrows everything after the call', () => {
  // Also compile-only, and the interesting one: nothing is reassigned and there is
  // no `if`. `found` is `User | undefined` on the line it is declared and `User`
  // on the line after the assertion, purely because the compiler believes the
  // `asserts` signature.
  const found: User | undefined = users.find((user) => user.id === 'u1')

  subject.assertDefined(found, 'user u1')
  assert.equal(found.name, 'ada')
})
