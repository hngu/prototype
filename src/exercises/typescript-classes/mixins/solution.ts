/**
 * Reference solution: Bolt an ability on
 * Lesson: typescript-classes/mixins
 */

/* Two details in one line.

   `any[]` is the one place this pattern genuinely needs it. A mixin's constructor forwards
   `...args` to a `super` whose signature it cannot know, and `unknown[]` makes every such
   call an error. The looseness is contained: this type only describes the *plumbing*, and a
   caller writing `new TimestampedNote('a', 'b')` is still checked against `Note`.

   And it is `new`, not `abstract new`. Allowing an abstract base sounds strictly better, but
   `TS2797` then requires the returned class to be declared `abstract` as well — and an
   abstract class cannot be constructed, so the composed result would be unusable without a
   further concrete `class X extends withThing(Base) {}` wrapper. Worth knowing; not worth
   paying for here. */
export type Constructor<T = object> = new (...args: any[]) => T

export interface Serializable {
  serialize(): string
  toRecord(): Record<string, unknown>
}

export interface Timestamped {
  readonly createdAt: Date
  ageInSeconds(now: Date): number
}

/* A mixin is a *function* that returns a class. That is the whole trick, and everything
   good about the pattern follows from it: functions compose, and a class's single `extends`
   slot does not.

   The return type is written out rather than inferred. `TBase & Constructor<Serializable>`
   reads as "everything the base could do, plus this", and stating it is worth the keystrokes
   — it is the contract, and an inferred anonymous class type is unpleasant to read in an
   error message. */
export function withSerializable<TBase extends Constructor>(
  Base: TBase,
): TBase & Constructor<Serializable> {
  /* An anonymous class expression. It needs no name, because the only thing that ever refers
     to it is the value being returned. */
  return class extends Base {
    toRecord(): Record<string, unknown> {
      /* `{ ...this }` copies own enumerable properties — exactly the set that would be
         serialised, so the two methods cannot disagree. Methods live on the prototype and
         so stay out of it, and `#private` fields are not own properties either. That last
         part is a feature: `serialize` on an object with a `#secret` cannot leak it, whereas
         a TypeScript `private` field would appear here in full. Lesson 4.2.

         The cast is needed and is the same rule lesson 4.4 ran into: a class instance type
         has no *implicit* index signature, so it is not assignable to
         `Record<string, unknown>` even though every property it has is a string key. Only
         object type aliases get that courtesy. The alternative,
         `Object.fromEntries(Object.entries(this))`, avoids the cast by doing real work at
         run time to produce a value the compiler will already believe in. */
      return { ...this } as Record<string, unknown>
    }

    serialize(): string {
      return JSON.stringify(this.toRecord())
    }
  }
}

export function withTimestamp<TBase extends Constructor>(
  Base: TBase,
): TBase & Constructor<Timestamped> {
  return class extends Base {
    readonly createdAt: Date

    /* The one legal shape for a mixin constructor, and it is forced rather than chosen.
       This code cannot know what `Base` takes, so it accepts anything and forwards it
       untouched. `super(...args)` must come before any `this`, as in any subclass. */
    constructor(...args: any[]) {
      super(...args)
      this.createdAt = new Date()
    }

    ageInSeconds(now: Date): number {
      /* `Math.max(0, …)` because a caller can pass any `now`, including one before
         construction, and a negative age is not a thing. `Math.floor` for whole seconds. */
      return Math.max(0, Math.floor((now.getTime() - this.createdAt.getTime()) / 1000))
    }
  }
}

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

/* Composition, and it reads inside-out: `Note`, then timestamped, then serialisable. The
   result is a real class — `new` it, subclass it, pass it around.

   These two mixins are independent, so the order genuinely does not matter here. It matters
   when two mixins define the same member: the outermost application wins, exactly as the
   last `extends` in a chain does. Worth checking when you compose mixins you did not write.

   A function rather than a `const` only so that the starter's stub can throw without making
   the module impossible to import. */
export function timestampedNote(): Constructor<Note & Serializable & Timestamped> {
  return withSerializable(withTimestamp(Note))
}

/* Takes the two capabilities, not the composed class. This is the point of mixins returning
   interface-shaped abilities: a function written today works on a class composed tomorrow,
   with no shared base class anywhere. */
export function describeRecord(value: Serializable & Timestamped, now: Date): string {
  return `${value.serialize()} @ ${value.ageInSeconds(now)}s`
}
