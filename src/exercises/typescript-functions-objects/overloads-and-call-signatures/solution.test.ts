import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as solution from './solution.ts'
import * as starter from './starter.ts'
import type { DateParser } from './solution.ts'

/**
 * Compile-time API parity, both directions. Worth noting that this also checks the
 * *overloads* match: an overload set is part of the type, so dropping one from
 * `starter.ts` is a compile error here rather than a mysterious failure.
 */
const _starterMatchesSolution: typeof solution = starter
const _solutionMatchesStarter: typeof starter = solution
void _starterMatchesSolution
void _solutionMatchesStarter

const subject = process.env['EXERCISE_TARGET'] === 'starter' ? starter : solution

const EPOCH = '1970-01-01T00:00:00.000Z'
const DAY = 86_400_000

test('parseDate reads epoch milliseconds', () => {
  assert.equal(subject.parseDate(0).toISOString(), EPOCH)
  assert.equal(subject.parseDate(DAY).toISOString(), '1970-01-02T00:00:00.000Z')
})

test('parseDate reads ISO strings, and refuses nonsense', () => {
  assert.equal(subject.parseDate('1970-01-01')?.toISOString(), EPOCH)
  assert.equal(subject.parseDate('2026-08-08T12:00:00.000Z')?.toISOString(), '2026-08-08T12:00:00.000Z')

  assert.equal(subject.parseDate('nope'), undefined)
  assert.equal(subject.parseDate(''), undefined)
  assert.equal(subject.parseDate('2026-13-40'), undefined)
})

test('parseDateUnion behaves identically at run time', () => {
  assert.equal(subject.parseDateUnion(0)?.toISOString(), EPOCH)
  assert.equal(subject.parseDateUnion('1970-01-01')?.toISOString(), EPOCH)
  assert.equal(subject.parseDateUnion('nope'), undefined)
  assert.equal(subject.parseDateUnion(''), undefined)
})

test('the overload knows a number cannot fail, and the union does not', () => {
  // This is the whole reason to overload, and it is a compile-time fact rather than
  // a runtime one. The overloaded version promises a `Date` for a number:
  const fromOverload: Date = subject.parseDate(0)
  assert.equal(fromOverload.toISOString(), EPOCH)

  // @ts-expect-error — the union version cannot make that promise. Its return type
  // is `Date | undefined` whatever you pass, so this caller has to handle an
  // `undefined` that can never actually arrive.
  const fromUnion: Date = subject.parseDateUnion(0)
  void fromUnion
})

test('and the union accepts a union, which no overload does', () => {
  // The bill for overloading, and it is a real one. The implementation signature is
  // not public, so there is no overload that takes `string | number` — even though
  // the implementation obviously handles both.
  const raw: string | number = Math.random() < 2 ? 0 : 'nope'

  // @ts-expect-error — "No overload matches this call."
  subject.parseDate(raw)

  // Which is exactly the situation any value read from config, JSON or a form is in.
  assert.equal(subject.parseDateUnion(raw)?.toISOString(), EPOCH)
})

test('makeParser returns something both callable and labelled', () => {
  const iso = subject.makeParser('iso')

  assert.equal(iso.label, 'iso')
  assert.equal(iso('1970-01-01')?.toISOString(), EPOCH)
  assert.equal(iso('nope'), undefined)

  assert.equal(subject.makeParser('other').label, 'other')
})

test('a DateParser is usable wherever either half is expected', () => {
  // Half the point of this test is that it COMPILES. The same value satisfies a
  // plain function type *and* an object type with a `label` — which is what a call
  // signature on an interface buys you, and what a function type expression cannot
  // express.
  const parser: DateParser = subject.makeParser('iso')

  const asFunction: (input: string) => Date | undefined = parser
  const asObject: { readonly label: string } = parser

  assert.equal(asFunction('nope'), undefined)
  assert.equal(asObject.label, 'iso')
})

test('buildAll uses a construct signature', () => {
  // `Date` — the constructor itself, not an instance — satisfies
  // `new (value: number) => Date`, so it goes straight in.
  const dates = subject.buildAll(Date, [0, DAY])

  assert.deepEqual(
    dates.map((date) => date.toISOString()),
    [EPOCH, '1970-01-02T00:00:00.000Z'],
  )
  assert.deepEqual(subject.buildAll(Date, []), [])

  // @ts-expect-error — and an ordinary arrow function is *not* accepted, however
  // right its parameters and return type look: it has a call signature and no
  // construct signature, and those are separate capabilities. At run time this is
  // where "X is not a constructor" comes from.
  subject.buildAll((value: number) => new Date(value), [])
})
