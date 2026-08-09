/**
 * Exercise: A cookie cutter with a checklist
 * Lesson:   typescript-classes/classes-and-members
 *
 * Replace every `throw new Error('TODO: …')` with a real implementation.
 *
 * Note how every field is **declared first and assigned in the constructor body**. The
 * short form — `constructor(private readonly limit: number)` — is a parameter property,
 * and it is the one piece of class syntax that fails *silently* under Node: the field is
 * never assigned and every read is `undefined`. `erasableSyntaxOnly` turns that into a
 * compiler error instead. See `src/exercises/README.md`.
 */

export interface Snapshot<T> {
  readonly size: number
  readonly items: readonly T[]
}

/**
 * A bounded stack.
 *
 * `capacity` is fixed at construction. Pushing past it drops the *oldest* item, so the
 * stack never grows beyond `capacity` and never throws for being full.
 */
export class Stack<T> {
  /** The maximum number of items. Never changes after construction. */
  readonly capacity: number

  /** The items, oldest first. Not exposed directly — see `snapshot()`. */
  #items: T[]

  /**
   * @param capacity must be at least 1; anything less is a `RangeError`.
   * @param initial optional starting items, oldest first, trimmed to `capacity`.
   */
  constructor(capacity: number, initial: readonly T[] = []) {
    throw new Error('TODO: validate capacity, then assign both fields')
  }

  /** How many items are in the stack right now. */
  get size(): number {
    throw new Error('TODO: one line')
  }

  /** `true` when there is nothing to pop. */
  get isEmpty(): boolean {
    throw new Error('TODO: one line, in terms of size')
  }

  /**
   * Adds an item. If the stack is already at capacity, the oldest item is dropped
   * first. Returns `this`, so pushes chain.
   */
  push(item: T): this {
    throw new Error('TODO: drop the oldest if full, then add')
  }

  /** Removes and returns the newest item, or `undefined` when empty. */
  pop(): T | undefined {
    throw new Error('TODO: one line')
  }

  /** The newest item without removing it, or `undefined` when empty. */
  peek(): T | undefined {
    throw new Error('TODO: mind noUncheckedIndexedAccess')
  }

  /** A frozen, read-only view. Mutating the stack afterwards must not change it. */
  snapshot(): Snapshot<T> {
    throw new Error('TODO: copy, do not alias')
  }

  /**
   * Builds a stack from any iterable, sized to fit it.
   *
   * A `static` member belongs to the class rather than to an instance, which is why
   * this can hand back a `Stack<U>` before any stack exists.
   */
  static of<U>(items: Iterable<U>): Stack<U> {
    throw new Error('TODO: spread, size to fit, and mind the empty case')
  }
}
