/**
 * Reference solution: Inherit the machine, sign the contract
 * Lesson: typescript-classes/inheritance-and-abstract
 */

/* The contract, with no code in it. Worth noticing that `Describable` is an `interface`
   rather than an abstract class with an abstract method: nothing here needs inheriting, so
   demanding `extends` would be demanding a slot in the caller's single-inheritance chain
   for no reason. A class can implement any number of interfaces and extend exactly one
   class, which is the practical reason to keep contracts as interfaces. */
export interface Describable {
  describe(): string
}

/* `abstract` says "this is not a thing, it is what several things have in common". You
   cannot call `new Shape(…)` — and that check is entirely the compiler's, because
   `abstract` is erased. At run time `Shape` is an ordinary class and `new` on it would
   succeed, handing back an object missing every method it promised. One of the tests
   demonstrates exactly that, because it is the sort of thing worth having seen once.

   `implements Describable` adds no behaviour; it asks the compiler to check that this
   class really does have `describe`. Doing it here rather than in each subclass means the
   promise is made once, where the method is written. */
export abstract class Shape implements Describable {
  /* `protected`, not `private`: subclasses need it, outside code does not. Promote to
     `protected` only when a subclass actually requires it — unlike `private`, it is part
     of your API and every future subclass may rely on it. */
  protected readonly name: string

  constructor(name: string) {
    this.name = name
  }

  /* Two abstract members, and between them they are everything the base cannot know.
     `abstract` is how a base class says "I need this and cannot provide it", which is
     strictly better than a body that throws: the compiler refuses a subclass that forgets,
     rather than a test discovering it. */
  abstract area(): number
  abstract get sides(): number

  /* And this is what the abstraction buys. `describe` is written once, in terms of an
     `area` this class cannot compute, and every present and future subclass gets it. */
  describe(): string {
    return `${this.name} with area ${this.area().toFixed(2)}`
  }

  isLargerThan(other: Shape): boolean {
    return this.area() > other.area()
  }
}

export class Square extends Shape {
  readonly side: number

  constructor(side: number) {
    /* The ordering rule, and it is genuinely two rules.
       — You may run statements before `super(…)`, so long as they do not touch `this`.
         Validating an argument is the standard reason to, and it is better here than after
         the super call: nothing half-built exists if the argument is bad.
       — You may not assign a field before `super(…)`. The base constructor is what brings
         `this` into existence, and JavaScript enforces that with a `ReferenceError`, not a
         compiler error. */
    if (!Number.isFinite(side) || side <= 0) {
      throw new RangeError(`side must be a positive number, got ${side}`)
    }

    super('square')
    this.side = side
  }

  /* `override` is not *required* on an implementation of an abstract member — there was no
     working code to replace — but it is allowed, and it documents intent for free. */
  override area(): number {
    return this.side ** 2
  }

  override get sides(): number {
    return 4
  }
}

export class Circle extends Shape {
  readonly radius: number

  constructor(radius: number) {
    if (!Number.isFinite(radius) || radius <= 0) {
      throw new RangeError(`radius must be a positive number, got ${radius}`)
    }

    super('circle')
    this.radius = radius
  }

  override area(): number {
    return Math.PI * this.radius ** 2
  }

  /* Zero, and the honest answer. A circle has no sides, and the alternative designs are
     both worse: `Infinity` is a joke the caller has to get, and throwing means every
     consumer of `sides` needs a `try`. The interesting design question an abstract member
     forces is exactly this one — if a subclass cannot answer, the member may belong
     somewhere narrower than the base. */
  override get sides(): number {
    return 0
  }

  /* Here `override` IS required, because `describe` exists as working code on the base and
     this replaces it. Without `noImplicitOverride` the modifier would be optional, and the
     failure mode it prevents is the expensive one: rename `describe` to `summary` on the
     base and this method silently stops overriding anything, becoming a method nobody
     calls. With the flag, that rename is a compiler error at every subclass. */
  override describe(): string {
    /* `super.describe()` reaches the implementation this one replaced — extending the
       inherited behaviour rather than reimplementing it. The base's format stays in one
       place. */
    return `${super.describe()} (r=${this.radius})`
  }
}

/* One function, every present and future subclass, and it never asks what anything is.
   That is the payoff for the abstract member: `area()` is guaranteed to exist. */
export function largestFirst(shapes: readonly Shape[]): readonly Shape[] {
  /* `[...shapes]` because `sort` mutates in place, and the parameter is `readonly` — which
     the compiler enforces here and erases before this runs, so the copy is what actually
     protects the caller. */
  return [...shapes].sort((a, b) => b.area() - a.area())
}

/* Takes `Describable`, not `Shape`. This is the reason the interface exists separately
   from the class: anything that can describe itself qualifies, including things with no
   area and no relationship to `Shape` at all. Structural typing means they do not even
   have to say `implements Describable` — see course 1's lesson on it. */
export function describeAll(items: readonly Describable[]): readonly string[] {
  return items.map((item) => item.describe())
}
