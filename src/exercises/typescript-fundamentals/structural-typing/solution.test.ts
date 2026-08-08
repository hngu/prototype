import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as solution from './solution.ts'
import * as starter from './starter.ts'
import type { Identified, Named, Timestamped } from './solution.ts'

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
 * One object, three unrelated interfaces, and it declares none of them. It is
 * accepted everywhere below because it has the right fields — not because anybody
 * wrote the word `Named` next to it.
 */
const widget = { id: 'w1', name: 'widget', createdAt: 0, colour: 'red' }

const _asNamed: Named = widget
const _asIdentified: Identified = widget
const _asTimestamped: Timestamped = widget
void _asNamed
void _asIdentified
void _asTimestamped

/* Three genuinely unrelated types, to prove the point at the call sites below. */
interface User {
  readonly id: string
  readonly name: string
  readonly email: string
}
interface Org {
  readonly name: string
  readonly seats: number
}

test('greet takes anything with a name', () => {
  const user: User = { id: 'u1', name: 'ada', email: 'ada@example.com' }
  const org: Org = { name: 'Analytical Engines', seats: 4 }

  // Neither type mentions `Named`, and neither had to.
  assert.equal(subject.greet(user), 'Hello, ada')
  assert.equal(subject.greet(org), 'Hello, Analytical Engines')
  assert.equal(subject.greet(widget), 'Hello, widget')
  assert.equal(subject.greet({ name: 'ada' }), 'Hello, ada')
})

test('excess property checking only bites a fresh literal', () => {
  const marker = { name: 'ada', label: 'home' }

  // Through a variable: ordinary structural rules, extra field ignored.
  assert.equal(subject.greet(marker), 'Hello, ada')

  // @ts-expect-error — the same object written inline is rejected, on the
  // assumption that an unexpected key in a fresh literal is a typo. This line
  // only compiles because the error is expected: delete `label` and
  // `@ts-expect-error` becomes an error itself, which is how the test stays true.
  assert.equal(subject.greet({ name: 'ada', label: 'home' }), 'Hello, ada')
})

test('listNames says it in English', () => {
  const named = (name: string): Named => ({ name })

  assert.equal(subject.listNames([]), 'nobody')
  assert.equal(subject.listNames([named('ada')]), 'ada')
  assert.equal(subject.listNames([named('ada'), named('grace')]), 'ada and grace')
  assert.equal(
    subject.listNames([named('ada'), named('grace'), named('hopper')]),
    'ada, grace and hopper',
  )
  assert.equal(
    subject.listNames([named('a'), named('b'), named('c'), named('d')]),
    'a, b, c and d',
  )
})

test('auditLine needs all three shapes at once', () => {
  assert.equal(subject.auditLine(widget), 'w1 "widget" @ 1970-01-01')
  assert.equal(
    subject.auditLine({ id: 'w2', name: 'gadget', createdAt: Date.UTC(2026, 7, 8, 12) }),
    'w2 "gadget" @ 2026-08-08',
  )
})

test('isAuditable checks the shape at run time', () => {
  assert.equal(subject.isAuditable(widget), true)
  assert.equal(subject.isAuditable({ id: 'w1', name: 'widget', createdAt: 0 }), true)

  assert.equal(subject.isAuditable(null), false)
  assert.equal(subject.isAuditable('widget'), false)
  assert.equal(subject.isAuditable({ id: 'w1', name: 'widget' }), false)
  assert.equal(subject.isAuditable({ id: 'w1', createdAt: 0 }), false)
  assert.equal(subject.isAuditable({ id: 1, name: 'widget', createdAt: 0 }), false)
  assert.equal(subject.isAuditable({ id: 'w1', name: 'widget', createdAt: '0' }), false)
  assert.equal(subject.isAuditable({ id: 'w1', name: 'widget', createdAt: Number.NaN }), false)
})

test('unrelated shapes are interchangeable when the members match', () => {
  // Half the point of this test is that it COMPILES. `Person` and `Product` share
  // no declaration, no name and no ancestor — and are mutually assignable anyway,
  // because in a structural system a name carries no weight whatsoever.
  interface Person {
    readonly name: string
  }
  interface Product {
    readonly name: string
  }

  const person: Person = { name: 'ada' }
  const product: Product = person
  const backAgain: Person = product

  assert.deepEqual(backAgain, { name: 'ada' })
  assert.equal(subject.greet(product), 'Hello, ada')
  assert.equal(subject.listNames([person, product]), 'ada and ada')
})

test('isAuditable narrows an unknown into all three shapes', () => {
  // Also compile-only. `raw` is `unknown`, and `auditLine` wants an intersection of
  // three interfaces — so this call is a type error unless the guard's predicate is
  // doing its job.
  const raw: unknown = JSON.parse('{"id":"w3","name":"sprocket","createdAt":0}')

  assert.ok(subject.isAuditable(raw))
  if (subject.isAuditable(raw)) {
    assert.equal(subject.auditLine(raw), 'w3 "sprocket" @ 1970-01-01')
    assert.equal(subject.greet(raw), 'Hello, sprocket')
  }
})
