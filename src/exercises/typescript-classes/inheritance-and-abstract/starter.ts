/**
 * Exercise: Inherit the machine, sign the contract
 * Lesson:   typescript-classes/inheritance-and-abstract
 *
 * Replace every `throw new Error('TODO: …')` with a real implementation.
 *
 * `extends` hands down working code. `implements` only promises a shape. This file uses
 * both, on purpose, and the difference is the point.
 *
 * Everything here is authored under `noImplicitOverride`, so a method that replaces a
 * **concrete** inherited one must say `override`. Leave it off and the compiler stops you.
 * Implementing an `abstract` member does not require it — there was nothing working to
 * replace — but saying it anyway is free and self-documenting, so this file does.
 *
 * One oddity to explain up front: the subclass constructor stubs below already call
 * `super(…)`. That is not a freebie, it is a requirement — `TS2377` insists a derived
 * constructor contains a `super` call, so a stub of pure `throw` would not compile, and a
 * fresh clone of this package has to typecheck cleanly. Rewrite the whole body.
 */

/** A shape that can describe itself. Note this is a *contract*, with no code in it. */
export interface Describable {
  /** A one-line human-readable description. */
  describe(): string
}

/**
 * The base class. `abstract` means it cannot be constructed directly — there is no such
 * thing as "a shape", only a square or a circle.
 *
 * It `implements Describable`, which is a promise checked here rather than in each
 * subclass. Notice how little the base has to know: `describe` is written once, in terms
 * of an `area` it does not have and cannot compute.
 */
export abstract class Shape implements Describable {
  /** Available to this class and its subclasses, and to nobody else. */
  protected readonly name: string

  constructor(name: string) {
    throw new Error('TODO: one line')
  }

  /**
   * No body: every concrete subclass must supply one. An `abstract` member is the
   * cleanest way a base class has of saying "I need this and cannot provide it".
   */
  abstract area(): number

  /** Also abstract: how many sides, with a circle answering zero. */
  abstract get sides(): number

  /**
   * A real method, inherited as working code, written in terms of the abstract members
   * above. Format: `square with area 9.00`.
   *
   * Areas are formatted to two decimal places.
   */
  describe(): string {
    throw new Error('TODO: use this.name and this.area()')
  }

  /** Is this shape bigger than that one? Inherited by everything, written once. */
  isLargerThan(other: Shape): boolean {
    throw new Error('TODO: one line')
  }
}

/** A square. */
export class Square extends Shape {
  readonly side: number

  /**
   * @param side must be a positive, finite number; anything else is a `RangeError`.
   *
   * Two statements have a required order and one does not, which is the thing to notice.
   * You may run code *before* `super(…)` as long as it does not touch `this`; you may not
   * assign a field before it.
   */
  constructor(side: number) {
    super('square')
    throw new Error('TODO: validate, call super, assign — in the only order that works')
  }

  override area(): number {
    throw new Error('TODO: one line')
  }

  override get sides(): number {
    throw new Error('TODO: one line')
  }
}

/** A circle, which is where "how many sides" stops being a sensible question. */
export class Circle extends Shape {
  readonly radius: number

  /** @param radius must be a positive, finite number; anything else is a `RangeError`. */
  constructor(radius: number) {
    super('circle')
    throw new Error('TODO: as above')
  }

  override area(): number {
    throw new Error('TODO: one line')
  }

  override get sides(): number {
    throw new Error('TODO: zero, and the lesson explains why that is the honest answer')
  }

  /**
   * Overrides the inherited `describe` and calls the inherited one inside itself.
   * Format: `circle with area 12.57 (r=2)`.
   */
  override describe(): string {
    throw new Error('TODO: super.describe() is available, and is the point')
  }
}

/**
 * Sorts shapes largest first, without knowing what any of them are.
 *
 * This is what inheritance buys: one function, every present and future subclass.
 * The array must not be modified.
 */
export function largestFirst(shapes: readonly Shape[]): readonly Shape[] {
  throw new Error('TODO: copy before sorting')
}

/**
 * Describes anything that can describe itself — including things that are not shapes.
 *
 * Take the parameter as `Describable`, not `Shape`. That is the whole reason the
 * interface exists separately from the class.
 */
export function describeAll(items: readonly Describable[]): readonly string[] {
  throw new Error('TODO: one line')
}
