/**
 * Exercise: A sign and a lock
 * Lesson:   typescript-classes/visibility-and-static
 *
 * Replace every `throw new Error('TODO: …')` with a real implementation.
 *
 * Two fields, hidden two different ways. `#count` is a real JavaScript private field —
 * nothing outside this class can read it, ever. `label` uses TypeScript's `private`, which
 * the compiler enforces and the run time knows nothing about. The tests demonstrate the
 * difference rather than taking anyone's word for it.
 */

/** A counter that only ever goes up, and only by whole numbers. */
export class Counter {
  /** A real lock. Unreachable from outside the class at run time, not just at compile time. */
  #count: number

  /** A staff-only sign. Enforced by the compiler and gone by the time this runs. */
  private readonly label: string

  /** Private *and* static: how many counters have been built, visible to nobody. */
  static #created = 0

  constructor(label: string) {
    throw new Error('TODO: assign both fields, and record the construction')
  }

  /** The current count. */
  get value(): number {
    throw new Error('TODO: one line')
  }

  /** The label. Readable by anyone; writable by nobody, including this class. */
  get name(): string {
    throw new Error('TODO: one line')
  }

  /**
   * Adds `by` to the count and returns `this`, so increments chain.
   *
   * @param by must be a positive integer; anything else is a `RangeError`.
   */
  increment(by = 1): this {
    throw new Error('TODO: validate, then add')
  }

  /** Back to zero. Returns `this`. */
  reset(): this {
    throw new Error('TODO: two lines')
  }

  /** How many `Counter`s have ever been constructed. */
  static get created(): number {
    throw new Error('TODO: one line — and note what a static member can reach')
  }

  /**
   * Builds a counter that already stands at `value`.
   *
   * There is no constructor argument for the starting count, and there does not need to
   * be: a `static` member is *inside* the class, so it can reach `#count` on an instance
   * it did not itself create. Working out that this is allowed is half the exercise.
   *
   * @param value must be a non-negative integer; anything else is a `RangeError`.
   */
  static from(value: number, label = 'restored'): Counter {
    throw new Error('TODO: build one, then set its private count directly')
  }

  /**
   * Is this a real `Counter`?
   *
   * Not "does it have the right shape" — an object literal can fake a shape. This must be
   * true only for something actually built by this class.
   */
  static isCounter(value: unknown): value is Counter {
    throw new Error('TODO: one expression, and it is not typeof or instanceof')
  }
}
