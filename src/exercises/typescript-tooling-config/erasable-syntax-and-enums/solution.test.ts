import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Equals, Expect } from '../../tools/type-assert.ts'
import * as solution from './solution.ts'
import * as starter from './starter.ts'
import type { Status, StatusKey } from './solution.ts'

const _starterMatchesSolution: typeof solution = starter
const _solutionMatchesStarter: typeof starter = solution
void _starterMatchesSolution
void _solutionMatchesStarter

const subject = process.env['EXERCISE_TARGET'] === 'starter' ? starter : solution

/* ── The derived types ──────────────────────────────────────────────────────────────── */

test('the two unions are what they should be', () => {
  // Both derived from one object. An enum conflates these: a member is a name *and* a value,
  // so code that wants only one of them cannot ask.
  type _keys = Expect<Equals<StatusKey, 'Queued' | 'Running' | 'Done' | 'Failed'>>
  type _values = Expect<Equals<Status, 'queued' | 'running' | 'done' | 'failed'>>

  assert.equal(subject.STATUS.Queued, 'queued')
  assert.equal(subject.STATUS.Failed, 'failed')

  // The placeholder unions in `starter.ts` satisfy the two assertions above on their own —
  // that is the honest limit of a self-check. So this test also uses the derived types for
  // something, which the placeholders cannot fake.
  assert.equal(subject.isStatus(subject.STATUS.Queued), true)
})

test('as const is doing the work, and its absence would be silent', () => {
  // Without `as const` every value widens to `string`, `Status` becomes `string`, and every
  // guarantee below quietly evaporates while still compiling. Pinning it here so that a
  // regression is loud.
  type _notWidened = Expect<Equals<typeof subject.STATUS.Queued, 'queued'>>

  /* And the object is `readonly`, which is the other half of `as const` — enforced by the
     compiler and by nothing else.

     `as const` is **not** `Object.freeze`. The `readonly` is erased, so the write below
     genuinely lands, which is why it has to be undone: leaving it would corrupt `STATUS` for
     every test in this file. That is not a hypothetical — it is what happened while this test
     was being written.

     If you want the run-time guarantee too, `Object.freeze` is a separate decision. */
  const original = subject.STATUS.Queued
  const mutable = subject.STATUS as { Queued: string }

  try {
    // @ts-expect-error — the compiler refuses it.
    subject.STATUS.Queued = 'something else'

    assert.equal(subject.STATUS.Queued, 'something else', 'the write landed anyway')
    assert.equal(Object.isFrozen(subject.STATUS), false, '`as const` does not freeze')
  } finally {
    mutable.Queued = original
  }

  assert.equal(subject.STATUS.Queued, 'queued')

  // And the keys/values relationship still holds after the round trip.
  assert.equal(subject.keyOf(subject.STATUS.Queued), 'Queued')
})

/* ── Win 1: the values are inspectable ──────────────────────────────────────────────── */

test('allStatuses returns every value, in declaration order', () => {
  const all = subject.allStatuses()

  type _typed = Expect<Equals<typeof all, readonly Status[]>>

  assert.deepEqual(all, ['queued', 'running', 'done', 'failed'])
})

test('allStatuses is derived, not a second list to maintain', () => {
  // The property that matters: it agrees with STATUS by construction rather than by care.
  assert.deepEqual(subject.allStatuses(), Object.values(subject.STATUS))
  assert.equal(subject.allStatuses().length, Object.keys(subject.STATUS).length)
})

/* ── Win 2: a check that narrows ────────────────────────────────────────────────────── */

test('isStatus accepts the four values and rejects the keys', () => {
  for (const value of ['queued', 'running', 'done', 'failed']) {
    assert.equal(subject.isStatus(value), true, value)
  }

  // The keys are *not* values, which is the distinction an enum cannot express.
  for (const key of ['Queued', 'Running', 'Done', 'Failed']) {
    assert.equal(subject.isStatus(key), false, key)
  }
})

test('isStatus rejects everything else', () => {
  for (const value of ['', 'QUEUED', 'queue', 'cancelled', 'toString', 'constructor']) {
    assert.equal(subject.isStatus(value), false, JSON.stringify(value))
  }
})

test('isStatus narrows, so no cast is needed downstream', () => {
  const raw: string = 'running'

  assert.ok(subject.isStatus(raw))

  type _narrowed = Expect<Equals<typeof raw, Status>>
  assert.equal(subject.describe(raw), 'in progress')
})

/* ── Win 3: both directions at run time ─────────────────────────────────────────────── */

test('keyOf maps a value back to its key', () => {
  assert.equal(subject.keyOf('queued'), 'Queued')
  assert.equal(subject.keyOf('failed'), 'Failed')
})

test('keyOf returns undefined for anything that is not a value', () => {
  assert.equal(subject.keyOf('Queued'), undefined, 'a key is not a value')
  assert.equal(subject.keyOf('cancelled'), undefined)
  assert.equal(subject.keyOf(''), undefined)
})

test('keyOf and STATUS round-trip', () => {
  for (const value of subject.allStatuses()) {
    const key = subject.keyOf(value)
    assert.ok(key !== undefined)
    assert.equal(subject.STATUS[key], value)
  }
})

/* ── Win 4: exhaustiveness ──────────────────────────────────────────────────────────── */

test('describe covers every status', () => {
  assert.equal(subject.describe('queued'), 'waiting to start')
  assert.equal(subject.describe('running'), 'in progress')
  assert.equal(subject.describe('done'), 'finished')
  assert.equal(subject.describe('failed'), 'gave up')
})

test('describe handles every value allStatuses reports, by construction', () => {
  // If the two ever disagreed this would be the test that noticed.
  for (const status of subject.allStatuses()) {
    assert.equal(typeof subject.describe(status), 'string')
    assert.ok(subject.describe(status).length > 0)
  }
})

test('describe refuses a status that does not exist, and says so at run time too', () => {
  assert.throws(() => {
    // @ts-expect-error — `Status` is four strings. A `default` arm would have returned
    // something plausible here instead, which is the trade being avoided.
    subject.describe('cancelled')
  }, Error)

  // Paired with a call that must *not* throw, so an unimplemented `describe` cannot pass this
  // test by throwing its TODO for every input.
  assert.equal(subject.describe('queued'), 'waiting to start')
})

test('DESCRIPTIONS is a complete table, not a partial one', () => {
  assert.deepEqual(subject.DESCRIPTIONS, {
    queued: 'waiting to start',
    running: 'in progress',
    done: 'finished',
    failed: 'gave up',
  })

  // Same answers as the switch. Two shapes, one guarantee — and for a pure mapping the table
  // is shorter and a reader sees the whole relation at once.
  for (const status of subject.allStatuses()) {
    assert.equal(subject.DESCRIPTIONS[status], subject.describe(status))
  }
})

test('DESCRIPTIONS is typed as a total map, which is what makes it exhaustive', () => {
  type _total = Expect<Equals<typeof subject.DESCRIPTIONS, Record<Status, string>>>

  // Every key is required by the type, so a missing one is `Property … is missing` rather
  // than an `undefined` discovered later. That only holds if the `as` cast is gone.
  assert.equal(Object.keys(subject.DESCRIPTIONS).length, 4)
})

test('isCancellable knows which two can be stopped', () => {
  assert.equal(subject.isCancellable('queued'), true)
  assert.equal(subject.isCancellable('running'), true)
  assert.equal(subject.isCancellable('done'), false)
  assert.equal(subject.isCancellable('failed'), false)
})

test('isCancellable has an answer for every status', () => {
  // The point of writing it as a total table rather than `status === 'queued' || …`: adding a
  // fifth status forces somebody to decide, rather than defaulting it to `false`.
  for (const status of subject.allStatuses()) {
    assert.equal(typeof subject.isCancellable(status), 'boolean')
  }
})
