import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as solution from './solution.ts'
import * as starter from './starter.ts'
import type { Circle, Result, Square } from './solution.ts'

/**
 * Compile-time API parity, both directions, so neither file can grow, drop or
 * retype an export without tsc saying so.
 */
const _starterMatchesSolution: typeof solution = starter
const _solutionMatchesStarter: typeof starter = solution
void _starterMatchesSolution
void _solutionMatchesStarter

const subject = process.env['EXERCISE_TARGET'] === 'starter' ? starter : solution

test('describe handles a string', () => {
  assert.equal(subject.describe('hello'), 'text "hello" (5 characters)')
  assert.equal(subject.describe(''), 'text "" (0 characters)')
})

test('describe handles a number', () => {
  assert.equal(subject.describe(3.5), 'number 3.50')
  assert.equal(subject.describe(42), 'number 42.00')
  assert.equal(subject.describe(-1), 'number -1.00')
})

test('describe handles a Date', () => {
  assert.equal(subject.describe(new Date('2026-08-08T12:34:56Z')), 'date 2026-08-08')
  assert.equal(subject.describe(new Date(0)), 'date 1970-01-01')
})

test('areaOf tells the two untagged shapes apart', () => {
  const circle: Circle = { radius: 2 }
  const square: Square = { side: 3 }

  assert.equal(subject.areaOf(circle), Math.PI * 4)
  assert.equal(subject.areaOf(square), 9)
})

test('render covers every member of the union', () => {
  // Typed `readonly Result[]`, so this array is checked against the union rather
  // than inferred from its contents. Add a member to `Result` and nothing here
  // breaks — but `render` itself stops compiling, which is the protection the
  // default-less switch buys you.
  const cases: readonly (readonly [Result, string])[] = [
    [{ kind: 'ok', data: '42 rows' }, 'ok: 42 rows'],
    [{ kind: 'empty' }, 'nothing to show'],
    [{ kind: 'error', message: 'not found', code: 404 }, 'error 404: not found'],
  ]

  for (const [result, expected] of cases) {
    assert.equal(subject.render(result), expected)
  }
})

test('narrowing reaches the fields that only exist on one member', () => {
  // The point of this test is that it COMPILES. `message` and `code` exist only on
  // the error member, so reading them here requires narrowing `outcome` first —
  // and TypeScript accepts the `if` as proof, with no cast.
  const outcome: Result = { kind: 'error', message: 'teapot', code: 418 }

  if (outcome.kind === 'error') {
    assert.equal(subject.render(outcome), `error ${outcome.code}: ${outcome.message}`)
  } else {
    assert.fail('unreachable')
  }
})

test('describe accepts each union member on its own', () => {
  // Also compile-only. A parameter typed `string | number | Date` accepts any one
  // of the three without a union in sight at the call site — so if the signature
  // narrows, these three lines stop building.
  const text: string = 'x'
  const num: number = 1
  const when: Date = new Date(0)

  assert.equal(subject.describe(text), 'text "x" (1 characters)')
  assert.equal(subject.describe(num), 'number 1.00')
  assert.equal(subject.describe(when), 'date 1970-01-01')
})
