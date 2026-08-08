import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as solution from './solution.ts'
import * as starter from './starter.ts'
import type { Status } from './solution.ts'

/**
 * Compile-time API parity, both directions, so neither file can grow, drop or
 * retype an export without tsc saying so.
 */
const _starterMatchesSolution: typeof solution = starter
const _solutionMatchesStarter: typeof starter = solution
void _starterMatchesSolution
void _solutionMatchesStarter

const subject = process.env['EXERCISE_TARGET'] === 'starter' ? starter : solution

test('parseJson reports success with the parsed value', () => {
  assert.deepEqual(subject.parseJson('{"count":3}'), { ok: true, value: { count: 3 } })
  assert.deepEqual(subject.parseJson('[1,2]'), { ok: true, value: [1, 2] })
  assert.deepEqual(subject.parseJson('null'), { ok: true, value: null })
  assert.deepEqual(subject.parseJson('42'), { ok: true, value: 42 })
})

test('parseJson reports failure instead of throwing', () => {
  assert.deepEqual(subject.parseJson('nope'), { ok: false, error: 'invalid JSON' })
  assert.deepEqual(subject.parseJson(''), { ok: false, error: 'invalid JSON' })
  assert.deepEqual(subject.parseJson('{'), { ok: false, error: 'invalid JSON' })
  assert.deepEqual(subject.parseJson("{'count':3}"), { ok: false, error: 'invalid JSON' })
})

test('unknown refuses to be used until something checks it', () => {
  const parsed = subject.parseJson('{"count":3}')
  assert.ok(parsed.ok)

  // @ts-expect-error — `value` is `unknown`, so even reading a property off it is
  // refused. This is the entire difference from `any`: `any` would have waved the
  // line through and failed at run time instead. The `@ts-expect-error` fails the
  // build if the line ever *stops* erroring, so the claim cannot go stale.
  void parsed.value.count

  // With a check in front of it, the same value is perfectly usable.
  assert.equal(typeof parsed.value, 'object')
})

test('statusLabel covers every status', () => {
  const cases: readonly (readonly [Status, string])[] = [
    ['queued', 'waiting to start'],
    ['running', 'in progress'],
    ['done', 'finished'],
  ]

  for (const [status, label] of cases) {
    assert.equal(subject.statusLabel(status), label)
  }
})

test('statusLabel complains loudly about a status that cannot happen', () => {
  // Only reachable by lying to the compiler, which is exactly what a value from
  // outside the program does. `assertNever` turns "silently returns undefined" into
  // a message naming the offender.
  const impossible = 'exploded' as Status

  assert.throws(() => subject.statusLabel(impossible), {
    message: 'unexpected status: "exploded"',
  })
})

test('assertNever names the context and the value', () => {
  assert.throws(() => subject.assertNever('nope' as never, 'status'), {
    message: 'unexpected status: "nope"',
  })
  assert.throws(() => subject.assertNever(7 as never, 'currency'), {
    message: 'unexpected currency: 7',
  })
})

test('countFrom reads the number when it is really there', () => {
  assert.equal(subject.countFrom('{"count":3}'), 3)
  assert.equal(subject.countFrom('{"count":0}'), 0)
  assert.equal(subject.countFrom('{"count":-2.5}'), -2.5)
  assert.equal(subject.countFrom('{"count":3,"extra":true}'), 3)
})

test('countFrom returns undefined for everything else', () => {
  assert.equal(subject.countFrom('nope'), undefined)
  assert.equal(subject.countFrom('{}'), undefined)
  assert.equal(subject.countFrom('null'), undefined)
  assert.equal(subject.countFrom('42'), undefined)
  assert.equal(subject.countFrom('[3]'), undefined)
  assert.equal(subject.countFrom('{"count":"3"}'), undefined)
  assert.equal(subject.countFrom('{"count":null}'), undefined)
  assert.equal(subject.countFrom('{"count":true}'), undefined)
  assert.equal(subject.countFrom('{"count":1e999}'), undefined)
})

test('a checked unknown is as good as any other value', () => {
  // The point of this test is that it COMPILES. `countFrom` returns
  // `number | undefined`, and `toFixed` exists on neither `undefined` nor
  // `unknown` — so this only builds because the return type is honest and
  // `assert.ok` removes the `undefined`.
  const count = subject.countFrom('{"count":3}')

  assert.ok(count !== undefined)
  assert.equal(count.toFixed(1), '3.0')
})
