/**
 * Reference solution: A sign and a lock
 * Lesson: typescript-classes/visibility-and-static
 */

export class Counter {
  /* `#count` is JavaScript's own privacy, and it is absolute. There is no cast, no
     `as any`, no bracket access and no `Object.keys` that reaches it — outside this class
     the field does not exist. It is not even in `JSON.stringify` output.

     The syntax is deliberately strange because the privacy is lexical: `#count` is only a
     valid *name* inside this class body. That is why nothing at run time can name it. */
  #count: number

  /* `private` is a different kind of thing entirely: a note to the compiler. It is erased,
     so at run time `label` is an ordinary enumerable property — it shows up in
     `Object.keys`, in `JSON.stringify`, and to any JavaScript caller who never saw a type.
     A `as unknown as { label: string }` cast reaches it from TypeScript too.

     That is not a bug, and `private` is not useless. It documents intent and stops honest
     mistakes across a large codebase. It is just a sign, not a lock, and the two are worth
     not confusing — particularly for anything you would call a secret. */
  private readonly label: string

  /* Static and private. There is one of these for the whole class, and nothing outside can
     see or corrupt it. */
  static #created = 0

  constructor(label: string) {
    this.label = label
    this.#count = 0

    /* `Counter.#created` rather than `this.#created`: static members live on the class
       object, so an instance cannot reach them. Naming the class explicitly is also what
       makes this readable — the count belongs to `Counter`, not to this counter. */
    Counter.#created++
  }

  get value(): number {
    return this.#count
  }

  /* The standard shape for "readable but not writable": a `private readonly` field with a
     public getter. `readonly` alone would still let anyone read `counter.label`; `private`
     alone would let this class reassign it. Together they say exactly one thing. */
  get name(): string {
    return this.label
  }

  increment(by = 1): this {
    if (!Number.isInteger(by) || by < 1) {
      throw new RangeError(`increment expects a positive integer, got ${by}`)
    }

    this.#count += by
    return this
  }

  reset(): this {
    this.#count = 0
    return this
  }

  /* A static getter. Read-only from outside, mutable from inside, which is the point of
     pairing it with `static #created`. */
  static get created(): number {
    return Counter.#created
  }

  /* The fact that surprises people: privacy in JavaScript is **per class, not per
     object**. This code is inside `Counter`, so `#count` is a name it may use — on *any*
     `Counter`, including one it has only just been handed. `counter.#count = value` is
     legal here and impossible one line outside the closing brace.

     That is what makes static factories able to do things a caller cannot, and why the
     constructor needs no starting-count parameter it would otherwise have to validate
     twice. */
  static from(value: number, label = 'restored'): Counter {
    if (!Number.isInteger(value) || value < 0) {
      throw new RangeError(`from expects a non-negative integer, got ${value}`)
    }

    const counter = new Counter(label)
    counter.#count = value
    return counter
  }

  /* `#count in value` is a **brand check**, and it is the only genuine run-time type test
     for a class in JavaScript. It asks "does this object carry *my* private field?", which
     is true precisely for objects this class constructed.

     Compare the alternatives. A shape check — `typeof value === 'object' && 'value' in
     value` — passes for `{ value: 3 }`, which is not a `Counter`. And `instanceof` is
     usually right but is defeated by two copies of the module (a common enough thing with
     bundlers and duplicated dependencies) and by anyone reassigning `Symbol.hasInstance`.
     A private field is forgeable by nothing.

     Note the guard on `typeof`: `#count in value` throws a `TypeError` when `value` is a
     primitive or `null`, so the narrowing has to happen before the brand check, not after. */
  static isCounter(value: unknown): value is Counter {
    return typeof value === 'object' && value !== null && #count in value
  }
}
