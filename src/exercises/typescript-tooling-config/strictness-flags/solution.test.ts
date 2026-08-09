import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Equals, Expect } from '../../tools/type-assert.ts'
import * as solution from './solution.ts'
import * as starter from './starter.ts'
import type { Level, LogLine } from './solution.ts'

const _starterMatchesSolution: typeof solution = starter
const _solutionMatchesStarter: typeof starter = solution
void _starterMatchesSolution
void _solutionMatchesStarter

const subject = process.env['EXERCISE_TARGET'] === 'starter' ? starter : solution

/* ── noUncheckedIndexedAccess ───────────────────────────────────────────────────────── */

test('firstLine handles the cases the compiler was worried about', () => {
  assert.equal(subject.firstLine('one\ntwo'), 'one')
  assert.equal(subject.firstLine('only'), 'only')
  assert.equal(subject.firstLine(''), '', 'split never returns [], but the type says it might')
  assert.equal(subject.firstLine('\nsecond'), '', 'an empty first line is a real first line')
})

test('firstLine returns a string, not a maybe-string', () => {
  const line = subject.firstLine('x')

  // The signature is the promise: callers of this do not have to check again. That is what
  // answering the question buys, versus passing the `undefined` along.
  type _string = Expect<Equals<typeof line, string>>

  assert.equal(line.toUpperCase(), 'X')
})

test('cellAt answers both levels of index', () => {
  const rows = [
    ['a', 'b'],
    ['c', 'd'],
  ]

  assert.equal(subject.cellAt(rows, 0, 0), 'a')
  assert.equal(subject.cellAt(rows, 1, 1), 'd')
})

test('cellAt returns undefined rather than throwing, at either level', () => {
  const rows = [['a']]

  assert.equal(subject.cellAt(rows, 5, 0), undefined, 'row out of range')
  assert.equal(subject.cellAt(rows, 0, 5), undefined, 'column out of range — the forgotten one')
  assert.equal(subject.cellAt([], 0, 0), undefined)
  assert.equal(subject.cellAt([[]], 0, 0), undefined)

  // Negative indices are out of range too, and produce `undefined` rather than wrapping.
  assert.equal(subject.cellAt(rows, -1, 0), undefined)
})

test('cellAt takes a readonly array at both levels', () => {
  // One `readonly` on the outside would still let a caller mutate a row.
  const rows: readonly (readonly string[])[] = [['a']]

  assert.equal(subject.cellAt(rows, 0, 0), 'a')

  // @ts-expect-error — and nothing about the inner arrays is writable either.
  void rows[0]?.push
})

test('sumOf treats a missing key as zero and keeps a real zero', () => {
  const config = { a: 1, b: 2, zero: 0 }

  assert.equal(subject.sumOf(config, ['a', 'b']), 3)
  assert.equal(subject.sumOf(config, ['a', 'missing']), 1)
  assert.equal(subject.sumOf(config, []), 0)
  assert.equal(subject.sumOf({}, ['anything']), 0)

  // The distinction `||` would have lost. Same answer here, different reason — and the habit
  // matters in the function where the default is not the falsy value.
  assert.equal(subject.sumOf(config, ['zero', 'a']), 1)
})

test('sumOf copes with negative values, which a truthiness check would not', () => {
  assert.equal(subject.sumOf({ a: -5, b: 5 }, ['a', 'b']), 0)
  assert.equal(subject.sumOf({ a: -1 }, ['a', 'missing']), -1)
})

/* ── useUnknownInCatchVariables ─────────────────────────────────────────────────────── */

test('parseJson reports success with the parsed value', () => {
  const result = subject.parseJson('{"a":1}')

  // The type assertion goes **before** the runtime one. `assert.deepEqual` is declared
  // `asserts actual is T`, so it narrows its first argument — put this after it and you are
  // checking the narrowed type rather than the returned one.
  if (result.ok) {
    type _unknown = Expect<Equals<typeof result.value, unknown>>
  }

  // The value is `unknown`, because that is what `JSON.parse` honestly returns.
  assert.deepEqual(result, { ok: true, value: { a: 1 } })
})

test('parseJson turns a thrown Error into its message', () => {
  const result = subject.parseJson('{ not json')

  assert.equal(result.ok, false)
  assert.ok(!result.ok && typeof result.error === 'string')
  assert.ok(!result.ok && result.error.length > 0)
})

test('parseJson survives a thrown non-Error, which is the whole point of the flag', () => {
  // `catch (e)` used to be `any`, so `e.message` compiled and threw a *second* error whenever
  // something threw a string. Anyone can `throw 'nope'` — it is legal JavaScript.
  const originalParse = JSON.parse

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(JSON as { parse: unknown }).parse = () => {
      throw 'a bare string'
    }

    assert.deepEqual(subject.parseJson('anything'), { ok: false, error: 'a bare string' })
  } finally {
    ;(JSON as { parse: unknown }).parse = originalParse
  }
})

test('parseJson narrows through the result union', () => {
  const result = subject.parseJson('1')

  // The discriminated union means one check unlocks the right half — no `!`, no cast.
  if (result.ok) {
    assert.equal(result.value, 1)
    // @ts-expect-error — there is no `error` on the success arm.
    void result.error
  } else {
    // @ts-expect-error — nor a `value` on the failure arm.
    void result.value
  }
})

/* ── Exhaustiveness ─────────────────────────────────────────────────────────────────── */

test('labelFor covers every level', () => {
  assert.equal(subject.labelFor('debug'), 'trace')
  assert.equal(subject.labelFor('info'), 'note')
  assert.equal(subject.labelFor('warn'), 'careful')
  assert.equal(subject.labelFor('error'), 'stop')
})

test('labelFor refuses a level that does not exist', () => {
  // Two protections, and both fire. The compiler refuses the call; and because
  // `@ts-expect-error` silences the type error without removing the code, the call runs,
  // falls past every arm, and `assertNever` throws rather than returning something made up.
  assert.throws(() => {
    // @ts-expect-error — `Level` is four strings and nothing else.
    subject.labelFor('fatal')
  }, Error)

  // The exhaustive switch is also why adding `'fatal'` to `Level` would be a compile error in
  // `labelFor` rather than a silent `'unknown'` at run time. That is the trade a `default`
  // arm gives away.
  assert.equal(subject.labelFor('error'), 'stop')
})

/* ── Predicates and parsing ─────────────────────────────────────────────────────────── */

test('isLevel accepts the four and rejects everything else', () => {
  for (const level of ['debug', 'info', 'warn', 'error']) {
    assert.equal(subject.isLevel(level), true, level)
  }

  for (const value of ['', 'DEBUG', 'fatal', 'inf', 'debug ', 'toString']) {
    assert.equal(subject.isLevel(value), false, JSON.stringify(value))
  }
})

test('isLevel narrows, which is the only reason it is worth writing', () => {
  const value: string = 'warn'

  assert.ok(subject.isLevel(value))

  // Compile-only. A function returning plain `boolean` would leave this a `string`, and
  // `labelFor(value)` would not compile.
  type _narrowed = Expect<Equals<typeof value, Level>>
  assert.equal(subject.labelFor(value), 'careful')
})

test('parseLines keeps the good lines', () => {
  const parsed = subject.parseLines('info: started\nwarn: disk low\nerror: gave up')

  assert.deepEqual(parsed, [
    { level: 'info', message: 'started' },
    { level: 'warn', message: 'disk low' },
    { level: 'error', message: 'gave up' },
  ] satisfies LogLine[])
})

test('parseLines skips what it cannot understand', () => {
  const parsed = subject.parseLines(
    ['', 'no colon here', 'fatal: unknown level', '   ', 'info:', 'info: kept'].join('\n'),
  )

  assert.deepEqual(parsed, [{ level: 'info', message: 'kept' }])
})

test('parseLines keeps colons inside the message', () => {
  // `parts[1]` alone would truncate at the second colon, which is the easy version of this
  // function and the wrong one.
  assert.deepEqual(subject.parseLines('error: failed at 10:30:00'), [
    { level: 'error', message: 'failed at 10:30:00' },
  ])
})

test('parseLines returns a readonly array of fully known lines', () => {
  const parsed = subject.parseLines('info: x')

  type _readonly = Expect<Equals<typeof parsed, readonly LogLine[]>>

  // @ts-expect-error — the result is ours, and callers do not get to append to it.
  void parsed.push

  assert.equal(parsed[0]?.level, 'info')
})
