import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Equals, Expect } from '../../tools/type-assert.ts'
import * as solution from './solution.ts'
import * as starter from './starter.ts'
import type { Describable } from './solution.ts'

/**
 * The API declared once. `Shape` has a `protected` member, and `protected` is nominal in
 * exactly the way `private` is, so the two files' `Shape`s are unrelated types and the
 * usual whole-module parity check cannot work. See `classes-and-members` for the details.
 *
 * Every member below uses **method syntax** deliberately. `largestFirst: (shapes: …) => …`
 * would be checked contravariantly under `strictFunctionTypes` and fail; a method
 * declaration is bivariant, which is what lets a function over the real `Shape` satisfy a
 * contract written over `ShapeApi`.
 */
interface ShapeApi extends Describable {
  area(): number
  readonly sides: number
  isLargerThan(other: ShapeApi): boolean
}

interface ExerciseModule {
  readonly Shape: abstract new (name: string) => ShapeApi
  readonly Square: new (side: number) => ShapeApi & { readonly side: number }
  readonly Circle: new (radius: number) => ShapeApi & { readonly radius: number }
  largestFirst(shapes: readonly ShapeApi[]): readonly ShapeApi[]
  describeAll(items: readonly Describable[]): readonly string[]
}

const subject: ExerciseModule = process.env['EXERCISE_TARGET'] === 'starter' ? starter : solution

const { Shape, Square, Circle, largestFirst, describeAll } = subject

test('a square knows its own area and side count', () => {
  const square = new Square(3)

  assert.equal(square.side, 3)
  assert.equal(square.area(), 9)
  assert.equal(square.sides, 4)
})

test('a circle knows its own, and answers zero sides', () => {
  const circle = new Circle(2)

  assert.equal(circle.radius, 2)
  assert.equal(circle.area().toFixed(4), '12.5664')
  assert.equal(circle.sides, 0)
})

test('both constructors validate, and validation happens before anything is built', () => {
  assert.throws(() => new Square(0), RangeError)
  assert.throws(() => new Square(-1), RangeError)
  assert.throws(() => new Square(Number.POSITIVE_INFINITY), RangeError)
  assert.throws(() => new Square(Number.NaN), RangeError)

  assert.throws(() => new Circle(0), RangeError)
  assert.throws(() => new Circle(-2), RangeError)
})

/* ── What `extends` hands down ──────────────────────────────────────────────────────── */

test('describe is written once on the base and inherited by both', () => {
  // Neither subclass implements this format. The base does, in terms of an `area` it
  // cannot compute itself.
  assert.equal(new Square(3).describe(), 'square with area 9.00')
})

test('a subclass can extend the inherited method rather than replace it', () => {
  // `Circle.describe` calls `super.describe()` and adds to it, so the base's format stays
  // in exactly one place.
  assert.equal(new Circle(2).describe(), 'circle with area 12.57 (r=2)')
})

test('isLargerThan is inherited by everything and compares across subclasses', () => {
  const square = new Square(3)
  const circle = new Circle(2)

  assert.equal(circle.isLargerThan(square), true, '12.57 > 9')
  assert.equal(square.isLargerThan(circle), false)
  assert.equal(square.isLargerThan(new Square(2)), true)
})

test('largestFirst sorts without knowing what any shape is', () => {
  const shapes = [new Square(1), new Circle(3), new Square(4), new Circle(1)]

  const sorted = largestFirst(shapes)

  assert.deepEqual(
    sorted.map((shape) => shape.describe()),
    [
      'circle with area 28.27 (r=3)',
      'square with area 16.00',
      'circle with area 3.14 (r=1)',
      'square with area 1.00',
    ],
  )
})

test('largestFirst copies rather than sorting the caller’s array', () => {
  // `readonly Shape[]` is a compile-time promise and is erased before this runs, so the
  // copy is the thing that actually protects the caller.
  const shapes = [new Square(1), new Square(4)]

  largestFirst(shapes)

  assert.equal(shapes[0]?.area(), 1, 'the original order must survive')
})

/* ── What `implements` does not hand down ───────────────────────────────────────────── */

test('describeAll accepts anything describable, shape or not', () => {
  // The reason `Describable` exists separately from `Shape`. This object has no area, no
  // sides and no relationship to the class hierarchy — and it does not say
  // `implements Describable` either, because structural typing does not require it.
  const version: Describable = { describe: () => 'v6.0.3' }

  assert.deepEqual(describeAll([new Square(2), version, new Circle(1)]), [
    'square with area 4.00',
    'v6.0.3',
    'circle with area 3.14 (r=1)',
  ])
})

test('a Describable is not a Shape, and the compiler keeps them apart', () => {
  const version: Describable = { describe: () => 'v6.0.3' }

  // @ts-expect-error — `largestFirst` needs an `area()`, which a bare `Describable` has no
  // way of providing. `implements` promised a shape, not a family tree.
  largestFirst([version])

  assert.deepEqual(describeAll([version]), ['v6.0.3'])
})

/* ── abstract, and what is left of it at run time ───────────────────────────────────── */

test('the compiler refuses to construct the abstract base', () => {
  // @ts-expect-error — "Cannot create an instance of an abstract class".
  void new Shape('shape')

  // And `abstract` is a compile-time concept only: it is erased, so the construction above
  // actually *succeeds* at run time and hands back an object missing every method it
  // promised. Worth having seen once — this is the entire protection, and it lives in the
  // compiler.
  const broken = new (Shape as unknown as new (name: string) => ShapeApi)('shape')

  assert.throws(() => broken.describe(), TypeError, 'no area() to call')
})

test('a subclass is usable everywhere the base is', () => {
  // Which is the point of inheritance, and the one relationship `implements` would not
  // have given: a `Square` really is a `Shape`.
  const shapes: readonly ShapeApi[] = [new Square(1), new Circle(1)]
  assert.equal(shapes.length, 2)

  const square = new Square(2)
  type _stillASquare = Expect<Equals<typeof square.side, number>>

  // @ts-expect-error — the relationship does not run the other way: not every `Shape` has
  // a `side`.
  void largestFirst(shapes)[0].side
})
