import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Equals, Expect } from '../../tools/type-assert.ts'
import { Geometry } from './legacy-shape.ts'
import * as solution from './solution.ts'
import * as starter from './starter.ts'

const _starterMatchesSolution: typeof solution = starter
const _solutionMatchesStarter: typeof starter = solution
void _starterMatchesSolution
void _solutionMatchesStarter

const subject = process.env['EXERCISE_TARGET'] === 'starter' ? starter : solution

/* ── The flat surface behaves as the nested one did ─────────────────────────────────── */

test('the flat functions match the legacy object they replace', () => {
  // The migration's actual acceptance criterion: same answers, different shape. The old
  // object is imported here purely to be compared against.
  for (const radius of [0, 1, 2.5, 10]) {
    assert.equal(subject.circleArea(radius), Geometry.Area.circle(radius))
  }

  assert.equal(subject.rectangleArea(3, 4), Geometry.Area.rectangle(3, 4))
  assert.equal(subject.toMetres(10), Geometry.Convert.toMetres(10))
  assert.equal(subject.toFeet(3), Geometry.Convert.toFeet(3))
  assert.equal(subject.describeCircle(2), Geometry.describe(2))
})

test('the guards survived the move', () => {
  // Easy to lose when retyping a body. `RangeError` specifically, not just any throw.
  assert.throws(() => subject.circleArea(-1), RangeError)
  assert.throws(() => subject.rectangleArea(-1, 2), RangeError)
  assert.throws(() => subject.rectangleArea(2, -1), RangeError)

  // And zero is legal, which is the boundary worth pinning.
  assert.equal(subject.circleArea(0), 0)
  assert.equal(subject.rectangleArea(0, 5), 0)
})

test('the conversions round-trip through the shared constant', () => {
  assert.equal(subject.FEET_PER_METRE, 3.28084)
  assert.equal(subject.toMetres(subject.FEET_PER_METRE), 1)
  assert.ok(Math.abs(subject.toFeet(subject.toMetres(10)) - 10) < 1e-9)
})

test('describeCircle formats to two places', () => {
  assert.equal(subject.describeCircle(2), 'circle r=2 area=12.57')
  assert.equal(subject.describeCircle(0), 'circle r=0 area=0.00')
})

/* ── The shim ───────────────────────────────────────────────────────────────────────── */

test('the shim presents the old shape', () => {
  const shim = subject.asLegacyShape()

  assert.equal(shim.Area.circle(2), subject.circleArea(2))
  assert.equal(shim.Area.rectangle(3, 4), 12)
  assert.equal(shim.Convert.FEET_PER_METRE, 3.28084)
  assert.equal(shim.Convert.toMetres(10), subject.toMetres(10))
  assert.equal(shim.Convert.toFeet(3), subject.toFeet(3))
  assert.equal(shim.describe(2), 'circle r=2 area=12.57')
})

test('the shim references the flat functions rather than reimplementing them', () => {
  // The point of the whole pattern, and the only thing here worth asserting by identity: one
  // implementation of each behaviour, so old callers and new ones cannot drift apart.
  const shim = subject.asLegacyShape()

  assert.equal(shim.Area.circle, subject.circleArea)
  assert.equal(shim.Area.rectangle, subject.rectangleArea)
  assert.equal(shim.Convert.toMetres, subject.toMetres)
  assert.equal(shim.Convert.toFeet, subject.toFeet)
  assert.equal(shim.describe, subject.describeCircle)
})

test('the shim is a fresh object each call, not a shared one to patch', () => {
  const first = subject.asLegacyShape()
  const second = subject.asLegacyShape()

  assert.notEqual(first, second)
  assert.notEqual(first.Area, second.Area)

  // The functions inside are still shared, which is the combination wanted: no copied logic,
  // and no communal object for a caller to monkey-patch on the way out.
  assert.equal(first.Area.circle, second.Area.circle)
})

test('a shim member is refused if it has the wrong signature', () => {
  const shim = subject.asLegacyShape()

  type _circle = Expect<Equals<typeof shim.Area.circle, (radius: number) => number>>

  // @ts-expect-error — `rectangle` takes two numbers, and `LegacyShape` is what says so.
  shim.Area.rectangle(3)

  // @ts-expect-error — and the shim is readonly, so it is not a hook for late patching.
  shim.describe = () => 'patched'

  assert.equal(shim.Area.rectangle(3, 4), 12)
})

/* ── What replaced namespace-style access ───────────────────────────────────────────── */

test('`import * as` is the modern spelling of a namespace', () => {
  // If a caller genuinely wants one name to hang everything off, this is how. The difference
  // from a nested object is that it is a *view* over the module rather than a value inside
  // it, so a bundler still sees exactly which members were touched.
  //
  // `subject` in this file is precisely that — an `import * as` namespace — so the two forms
  // below are the same function reached two ways.
  assert.equal(subject.circleArea, solution.circleArea)
  assert.equal(subject.circleArea(2), solution.circleArea(2))

  // And the flat surface is what a caller sees: no `Area`, no `Convert`, no `default`.
  const surface = Object.keys(solution).sort()
  assert.deepEqual(surface, [
    'FEET_PER_METRE',
    'asLegacyShape',
    'circleArea',
    'describeCircle',
    'rectangleArea',
    'toFeet',
    'toMetres',
  ])
})
