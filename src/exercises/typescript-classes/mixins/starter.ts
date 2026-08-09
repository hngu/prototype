/**
 * Exercise: Bolt an ability on
 * Lesson:   typescript-classes/mixins
 *
 * Replace every `throw new Error('TODO: …')` with a real implementation.
 *
 * A mixin is a function that takes a class and returns a subclass of it with something
 * extra. Because it is only a function, you can apply two and get both abilities — which is
 * what `extends` cannot do, since a class has exactly one base.
 *
 * Two mixins to write, then one class composed from both.
 */

/**
 * "Any class."
 *
 * `any[]` rather than `unknown[]` is the one place this pattern needs it: a mixin's
 * constructor forwards `...args` to a `super` it knows nothing about, and `unknown[]` makes
 * every such call an error. It is contained — arguments are still checked against the
 * concrete class at every `new`.
 *
 * Deliberately **not** `abstract new`. That would let you mix into an abstract base, but
 * then `TS2797` requires the returned class to be `abstract` too, and the composed result
 * could never be constructed. See the README.
 */
export type Constructor<T = object> = new (...args: any[]) => T

/** What `withSerializable` adds. */
export interface Serializable {
  /** A JSON string of every own enumerable property. */
  serialize(): string
  /** The same data as a plain object, for tests and logging. */
  toRecord(): Record<string, unknown>
}

/** What `withTimestamp` adds. */
export interface Timestamped {
  /** When this object was constructed. Never changes. */
  readonly createdAt: Date
  /** Whole seconds elapsed between construction and `now`, never negative. */
  ageInSeconds(now: Date): number
}

/**
 * Adds `serialize` and `toRecord` to any class.
 *
 * The return type is written out rather than inferred, which is worth doing for a mixin:
 * `TBase & Constructor<Serializable>` says "everything the base could do, plus this". Return
 * the class itself, not an instance.
 */
export function withSerializable<TBase extends Constructor>(
  Base: TBase,
): TBase & Constructor<Serializable> {
  throw new Error('TODO: return a class expression extending Base')
}

/**
 * Adds `createdAt` and `ageInSeconds` to any class.
 *
 * `createdAt` is set at construction, so this mixin needs a constructor — and a mixin
 * constructor has exactly one legal shape, because it cannot know what its base takes. The
 * hint has it if you need it.
 */
export function withTimestamp<TBase extends Constructor>(
  Base: TBase,
): TBase & Constructor<Timestamped> {
  throw new Error('TODO: as above, with a constructor')
}

/** The class the mixins get applied to. Nothing about it knows they exist. */
export class Note {
  title: string
  body: string

  constructor(title: string, body: string) {
    this.title = title
    this.body = body
  }

  summary(): string {
    return `${this.title}: ${this.body.slice(0, 10)}`
  }
}

/**
 * `Note`, with both abilities bolted on.
 *
 * This is a function rather than a `const` for a boring but real reason: a stub that throws
 * at module scope would make the file impossible to import, and the tests import both files.
 *
 * The two mixins here are independent, so composition order genuinely does not matter — the
 * README explains when it does.
 */
export function timestampedNote(): Constructor<Note & Serializable & Timestamped> {
  throw new Error('TODO: compose withSerializable and withTimestamp around Note')
}

/**
 * Reads a summary off anything with both abilities.
 *
 * Take the two interfaces, not the composed class. That is the payoff: this works for any
 * class either mixin was applied to, including ones written later.
 *
 * Format: `<serialize() output> @ <ageInSeconds(now)>s`
 */
export function describeRecord(value: Serializable & Timestamped, now: Date): string {
  throw new Error('TODO: one line')
}
