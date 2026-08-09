import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as solution from './solution.ts'
import * as starter from './starter.ts'
import type { HeaderBag, ResolvedOptions } from './solution.ts'

/**
 * Compile-time API parity, both directions, so neither file can grow, drop or
 * retype an export without tsc saying so.
 */
const _starterMatchesSolution: typeof solution = starter
const _solutionMatchesStarter: typeof starter = solution
void _starterMatchesSolution
void _solutionMatchesStarter

const subject = process.env['EXERCISE_TARGET'] === 'starter' ? starter : solution

const DEFAULTS: ResolvedOptions = {
  method: 'GET',
  headers: {},
  timeoutMs: 5000,
  body: null,
  retries: 0,
}

test('resolveOptions fills in every default', () => {
  assert.deepEqual(subject.resolveOptions(), DEFAULTS)
  assert.deepEqual(subject.resolveOptions({}), DEFAULTS)
  assert.deepEqual(subject.resolveOptions(undefined), DEFAULTS)
})

test('resolveOptions keeps what the caller supplied', () => {
  assert.deepEqual(subject.resolveOptions({ method: 'POST', body: 'hi' }), {
    ...DEFAULTS,
    method: 'POST',
    body: 'hi',
  })
  assert.deepEqual(subject.resolveOptions({ headers: { accept: 'text/plain' } }), {
    ...DEFAULTS,
    headers: { accept: 'text/plain' },
  })
})

test('resolveOptions does not discard a legitimate zero', () => {
  // `options?.timeoutMs || 5000` passes every other test in this file and fails
  // these two.
  assert.equal(subject.resolveOptions({ timeoutMs: 0 }).timeoutMs, 0)
  assert.equal(subject.resolveOptions({ retries: 0 }).retries, 0)
  // Nor an empty body, which is a body somebody sent on purpose.
  assert.equal(subject.resolveOptions({ body: '' }).body, '')
})

test('resolveOptions leaves nothing optional behind', () => {
  // Half the point of this test is that it COMPILES. Every field of
  // `ResolvedOptions` is read without a check of any kind — which is the entire
  // return on the "optional in, required out" shape.
  const resolved = subject.resolveOptions({ method: 'PUT' })

  const method: string = resolved.method
  const timeout: number = resolved.timeoutMs
  const retries: number = resolved.retries

  assert.equal(`${method} ${timeout} ${retries}`, 'PUT 5000 0')
})

test('headerValue ignores case, because HTTP does', () => {
  const headers: HeaderBag = { 'Content-Type': 'text/plain', ACCEPT: '*/*' }

  assert.equal(subject.headerValue(headers, 'content-type'), 'text/plain')
  assert.equal(subject.headerValue(headers, 'Content-Type'), 'text/plain')
  assert.equal(subject.headerValue(headers, 'CONTENT-TYPE'), 'text/plain')
  assert.equal(subject.headerValue(headers, 'accept'), '*/*')

  assert.equal(subject.headerValue(headers, 'authorization'), undefined)
  assert.equal(subject.headerValue({}, 'accept'), undefined)
})

test('withHeader adds, lowercases and replaces any existing spelling', () => {
  assert.deepEqual(subject.withHeader({}, 'Content-Type', 'text/plain'), {
    'content-type': 'text/plain',
  })

  assert.deepEqual(subject.withHeader({ 'Content-Type': 'a' }, 'content-type', 'b'), {
    'content-type': 'b',
  })

  assert.deepEqual(subject.withHeader({ accept: '*/*' }, 'X-Trace', 'abc'), {
    accept: '*/*',
    'x-trace': 'abc',
  })
})

test('withHeader leaves the original alone', () => {
  const original: HeaderBag = { accept: '*/*' }

  subject.withHeader(original, 'x-trace', 'abc')

  assert.deepEqual(original, { accept: '*/*' })
})

test('describeRequest describes the resolved request', () => {
  assert.equal(subject.describeRequest('/users'), 'GET /users (5000ms)')
  assert.equal(
    subject.describeRequest('/users', { method: 'POST', body: 'hi' }),
    'POST /users (5000ms, body 2 chars)',
  )
  assert.equal(subject.describeRequest('/users', { timeoutMs: 250 }), 'GET /users (250ms)')
})

test('describeRequest counts retries, and gets the grammar right', () => {
  assert.equal(subject.describeRequest('/users', { retries: 1 }), 'GET /users (5000ms, 1 retry)')
  assert.equal(subject.describeRequest('/users', { retries: 3 }), 'GET /users (5000ms, 3 retries)')
  assert.equal(
    subject.describeRequest('/users', { method: 'PUT', body: '', retries: 2 }),
    'PUT /users (5000ms, body 0 chars, 2 retries)',
  )
})

test('an index signature is a promise about every property', () => {
  const headers: HeaderBag = { 'content-type': 'text/plain' }

  // @ts-expect-error — reading gives `string | undefined` under
  // `noUncheckedIndexedAccess`, even for a key visible one line above. An index
  // signature says which keys are *allowed*, never which are present.
  const value: string = headers['content-type']
  void value

  // @ts-expect-error — the signature says every value is a `string`, so a number is
  // rejected even under a key nobody listed.
  const numeric: HeaderBag = { 'content-length': 12 }
  void numeric

  assert.equal(subject.headerValue(headers, 'content-type'), 'text/plain')
})

test('a readonly index signature covers every property', () => {
  const scratch: HeaderBag = { accept: '*/*' }

  // @ts-expect-error — `readonly` on an index signature applies to every property it
  // covers, so nothing in the bag can be written. This is why `withHeader` returns a
  // copy rather than editing its argument.
  scratch['accept'] = 'text/plain'

  // Note that the write above *does* land at run time: `readonly` is a compile-time
  // promise and there is nothing left of it once the program starts. The compiler is
  // the only thing stopping you, which is exactly the point lesson 1.1 was making.
  assert.equal(scratch['accept'], 'text/plain')

  assert.equal(subject.withHeader({ accept: '*/*' }, 'accept', 'text/plain')['accept'], 'text/plain')
})

test('a type with no index signature catches a typo', () => {
  // @ts-expect-error — `RequestOptions` lists its properties, so an unrecognised key
  // in a fresh literal is excess-property-checked. This is the casing mistake that
  // costs an afternoon when the type is a loose bag instead.
  subject.resolveOptions({ timeoutMS: 250 })

  assert.equal(subject.resolveOptions({ timeoutMs: 250 }).timeoutMs, 250)
})
