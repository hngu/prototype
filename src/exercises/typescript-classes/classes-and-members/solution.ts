/**
 * Reference solution: A cookie cutter with a checklist
 * Lesson: typescript-classes/classes-and-members
 */

export interface Snapshot<T> {
  readonly size: number
  readonly items: readonly T[]
}

/* Every field is declared with a type and assigned in the constructor body.
   `constructor(readonly capacity: number)` says the same thing in a quarter of the space
   and is the single most tempting piece of TypeScript to write here — which is why it is
   worth knowing exactly what it is. It is not a type annotation; it is an instruction to
   *generate* an assignment. Node's type stripping deletes annotations and generates
   nothing, so the parameter is accepted, the field is never assigned, and every read is
   `undefined`. No error, no warning, wrong answers.

   `erasableSyntaxOnly: true` in this package's tsconfig makes it TS1294 at authoring
   time instead. Course 6's lesson on erasable syntax is where this gets its own page. */
export class Stack<T> {
  readonly capacity: number

  /* `#items` is a real JavaScript private field, not TypeScript's `private`. Lesson 4.2
     is entirely about the difference; the short version is that `#` is enforced at run
     time and `private` is a note to the compiler. */
  #items: T[]

  constructor(capacity: number, initial: readonly T[] = []) {
    /* Validate before assigning. A class's invariants — "capacity is at least 1", "size
       never exceeds capacity" — are only true if the constructor refuses to build an
       object that breaks them. The type system cannot express "at least 1", so this is
       the part you write by hand. */
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new RangeError(`capacity must be a positive integer, got ${capacity}`)
    }

    this.capacity = capacity

    /* `[...initial]` copies. Assigning `initial` directly would alias the caller's array,
       so their later `push` would silently mutate this stack — and `readonly T[]` would
       not have stopped them, because `readonly` is erased and describes only what *this*
       reference may do. `.slice(-capacity)` keeps the newest when trimming. */
    this.#items = [...initial].slice(-capacity)
  }

  /* A getter is a method that reads like a field. `size` is derived rather than stored,
     which means it cannot drift out of sync with `#items` — there is no second copy of
     the truth to update. */
  get size(): number {
    return this.#items.length
  }

  get isEmpty(): boolean {
    return this.size === 0
  }

  /* `this` as a return type, rather than `Stack<T>`. It is worth it even here: a subclass
     of `Stack` gets `push` returning *the subclass*, so chaining does not quietly widen
     to the base. Lesson 4.4 is about this. */
  push(item: T): this {
    if (this.#items.length >= this.capacity) this.#items.shift()
    this.#items.push(item)
    return this
  }

  pop(): T | undefined {
    return this.#items.pop()
  }

  /* `at(-1)` is already typed `T | undefined`, so it satisfies the signature with no
     index-out-of-bounds worry. `this.#items[this.#items.length - 1]` gets the same type
     only because `noUncheckedIndexedAccess` is on; without it the compiler would claim
     a `T` and hand you `undefined` on an empty stack. */
  peek(): T | undefined {
    return this.#items.at(-1)
  }

  /* Copy, then freeze. `readonly T[]` in the return type stops *this* file's callers at
     compile time; `Object.freeze` stops anyone at run time, including JavaScript callers
     who never saw the type. The two protections are unrelated and both worth having. */
  snapshot(): Snapshot<T> {
    return Object.freeze({ size: this.size, items: Object.freeze([...this.#items]) })
  }

  /* `static` members hang off the class, not off instances. This one is the standard
     named-constructor pattern: a class can only have one `constructor`, so alternative
     ways of building it become static factories with names that say what they do.

     `<U>` rather than `<T>` — a static member cannot see the class's type parameter,
     because there is no instance for `T` to have been chosen for yet. Writing `T` here
     is an error, and a genuinely surprising one the first time. */
  static of<U>(items: Iterable<U>): Stack<U> {
    const all = [...items]
    /* `Math.max(1, …)` because capacity must be positive and an empty iterable would
       otherwise ask the constructor for a stack of size 0, which it rightly refuses. */
    return new Stack<U>(Math.max(1, all.length), all)
  }
}
