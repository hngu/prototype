import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as solution from './solution.ts'
import * as starter from './starter.ts'
import type { Attempt } from './solution.ts'

/**
 * Compile-time API parity, both directions, so neither file can grow, drop or
 * retype an export without tsc saying so.
 */
const _starterMatchesSolution: typeof solution = starter
const _solutionMatchesStarter: typeof starter = solution
void _starterMatchesSolution
void _solutionMatchesStarter

const subject = process.env['EXERCISE_TARGET'] === 'starter' ? starter : solution

test('logLine takes any number of parts', () => {
  assert.equal(subject.logLine('info'), '[info]')
  assert.equal(subject.logLine('warn', 'disk', 'full'), '[warn] disk full')
  assert.equal(subject.logLine('error', 'boom'), '[error] boom')
})

test('logLine accepts a frozen array of parts', () => {
  // The point of this test is that it COMPILES. A `readonly string[]` rest
  // parameter accepts a spread `as const` tuple; drop the `readonly` from the
  // signature and this line is a type error.
  const parts = ['disk', 'full'] as const

  assert.equal(subject.logLine('warn', ...parts), '[warn] disk full')
})

test('truncate cuts only when it has to', () => {
  assert.equal(subject.truncate('hello world', 5), 'hello…')
  assert.equal(subject.truncate('hello', 5), 'hello')
  assert.equal(subject.truncate('hello', 10), 'hello')
  assert.equal(subject.truncate('hello world', 0), '…')
})

test('truncate defaults its optional limit to 20', () => {
  assert.equal(subject.truncate('hello world'), 'hello world')
  assert.equal(subject.truncate('a'.repeat(25)), `${'a'.repeat(20)}…`)
  // An explicit `undefined` is the same as not passing it — which is exactly what
  // `limit ?? 20` says, and what `limit || 20` would also say right up until the
  // `truncate('hello world', 0)` above.
  assert.equal(subject.truncate('hello world', undefined), 'hello world')
})

test('pad uses its two defaults', () => {
  assert.equal(subject.pad('7'), '       7')
  assert.equal(subject.pad('7', 3), '  7')
  assert.equal(subject.pad('7', 3, '0'), '007')
  assert.equal(subject.pad('12345', 3), '12345')
  assert.equal(subject.pad('7', 3, undefined), '  7')
})

test('retry returns on the first success', () => {
  let calls = 0
  const attempt: Attempt = () => {
    calls += 1
    return 'ok'
  }

  assert.equal(subject.retry(attempt), 'ok')
  assert.equal(calls, 1)
})

test('retry keeps trying until it works', () => {
  let calls = 0
  const attempt: Attempt = () => {
    calls += 1
    if (calls < 3) throw new Error('not yet')
    return 'ok'
  }

  assert.equal(subject.retry(attempt), 'ok')
  assert.equal(calls, 3)
})

test('retry gives up after the configured number of tries', () => {
  let calls = 0
  const attempt: Attempt = () => {
    calls += 1
    throw new Error('nope')
  }

  assert.throws(() => subject.retry(attempt), { message: 'failed after 3 attempts: nope' })
  assert.equal(calls, 3)

  calls = 0
  assert.throws(() => subject.retry(attempt, 5), { message: 'failed after 5 attempts: nope' })
  assert.equal(calls, 5)
})

test('retry copes with a thrown value that is not an Error', () => {
  // `throw` accepts anything in JavaScript, and `strict` types the caught value
  // `unknown` because of it. Note the singular "attempt".
  const attempt: Attempt = () => {
    throw 'plain string'
  }

  assert.throws(() => subject.retry(attempt, 1), {
    message: 'failed after 1 attempt: plain string',
  })
})

test('forEachLine visits every line and counts them', () => {
  const seen: string[] = []
  const indexes: number[] = []

  const count = subject.forEachLine('a\nb\nc', (line, index) => {
    seen.push(line)
    indexes.push(index)
  })

  assert.equal(count, 3)
  assert.deepEqual(seen, ['a', 'b', 'c'])
  assert.deepEqual(indexes, [0, 1, 2])
})

test('forEachLine treats an empty string as one empty line', () => {
  assert.equal(
    subject.forEachLine('', () => {}),
    1,
  )
})

test('a void callback may return a value, which is then ignored', () => {
  // Half the point of this test is that it COMPILES. `push` returns a number and
  // the parameter is declared `=> void` — which promises that `forEachLine` will
  // ignore the result, not that the callback must produce none. This is the rule
  // that makes `items.forEach(x => list.push(x))` legal.
  const seen: string[] = []

  assert.equal(
    subject.forEachLine('a\nb', (line) => seen.push(line)),
    2,
  )
  assert.deepEqual(seen, ['a', 'b'])

  // A callback may also ignore parameters it does not need.
  assert.equal(
    subject.forEachLine('a\nb', () => {}),
    2,
  )

  // The other half of the same rule, and the half people confuse it with: a value
  // returned from a `() => void` function is not available to whoever called it.
  const noop: () => void = () => 42

  // @ts-expect-error — the declared type says nothing comes back, so nothing does,
  // whatever the body actually did.
  const answer: number = noop()
  void answer

  assert.equal(noop(), 42)
})
