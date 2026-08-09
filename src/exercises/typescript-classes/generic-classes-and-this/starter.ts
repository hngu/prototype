/**
 * Exercise: Chains that remember what they are
 * Lesson:   typescript-classes/generic-classes-and-this
 *
 * Replace every `throw new Error('TODO: …')` with a real implementation.
 *
 * Two features, and the exercise is watching them meet. The class is generic over the row
 * type it queries, and its chainable methods return `this` rather than `QueryBuilder<T>` —
 * which is what lets a subclass add a method and still have the chain reach it.
 */

/** The shape of a row. Only used as a constraint. */
export type Row = Record<string, unknown>

/** A rendered query. `where` clauses are joined with ` AND `. */
export interface Query {
  readonly text: string
  readonly params: readonly unknown[]
}

/**
 * A tiny query builder over a table of `T`.
 *
 * `T extends Row` is a constraint, not a promise about what `T` is: a caller passing
 * `{ id: string; name: string }` gets a builder whose column names are checked against
 * exactly those keys.
 */
export class QueryBuilder<T extends Row> {
  readonly table: string

  /** Rendered `where` fragments, in the order they were added. */
  protected readonly clauses: string[]

  /** Values for the placeholders, in the same order. */
  protected readonly values: unknown[]

  constructor(table: string) {
    throw new Error('TODO: assign all three')
  }

  /**
   * Adds `column = ?` and records the value.
   *
   * `K extends keyof T & string` is the interesting part of this signature: the column has
   * to be a real key of `T`, and the value has to be that key's type. Passing a column
   * that does not exist, or the wrong type of value for one that does, is a compile error.
   *
   * Returns `this`, so calls chain — and so a subclass keeps its own type through them.
   */
  where<K extends keyof T & string>(column: K, value: T[K]): this {
    throw new Error('TODO: push a fragment and a value, then return this')
  }

  /** Adds a raw fragment with no parameters. Returns `this`. */
  whereRaw(fragment: string): this {
    throw new Error('TODO: as above, minus the value')
  }

  /** Renders `SELECT * FROM <table>` plus a `WHERE` clause if there is one. */
  build(): Query {
    throw new Error('TODO: join with " AND ", and omit WHERE entirely when there is nothing')
  }

  /**
   * A copy with the same clauses, so a shared base query can be branched from safely.
   *
   * `this` as a return type is a promise you have to keep: called on a `PagedQuery`, this
   * must really produce a `PagedQuery`, not a `QueryBuilder`. Hard-coding `new
   * QueryBuilder(…)` here would be a lie the compiler cannot catch.
   *
   * One cast is unavoidable, and working out why is the exercise.
   */
  clone(): this {
    throw new Error('TODO: build a new one of whatever class this actually is')
  }
}

/**
 * A builder that can also paginate.
 *
 * Nothing here re-declares an inherited field — a redeclaration would run after `super()`
 * and overwrite it with `undefined`.
 */
export class PagedQuery<T extends Row> extends QueryBuilder<T> {
  #limit: number
  #offset: number

  constructor(table: string) {
    super(table)
    throw new Error('TODO: both default to 0, meaning "unset"')
  }

  /** @param count must be a positive integer; anything else is a `RangeError`. */
  limit(count: number): this {
    throw new Error('TODO: validate, store, return this')
  }

  /** @param count must be a non-negative integer; anything else is a `RangeError`. */
  offset(count: number): this {
    throw new Error('TODO: as above')
  }

  /**
   * The inherited query, with ` LIMIT n` and ` OFFSET n` appended when they are set.
   * `LIMIT` comes first. Neither appears when unset.
   */
  override build(): Query {
    throw new Error('TODO: start from super.build()')
  }

  /**
   * The inherited `clone` would produce a `PagedQuery` — `this.constructor` sees to that —
   * but it knows nothing about `#limit` and `#offset`, so they would come back unset.
   *
   * That is the cost of promising `this`: every subclass with extra state has to extend
   * the copy. Start from `super.clone()`.
   */
  override clone(): this {
    throw new Error('TODO: copy the inherited state, then this class’s own')
  }
}

/**
 * Runs a builder against some rows.
 *
 * Note what this signature does *not* do: it does not mention `QueryBuilder`. It asks only
 * for something that can `build()`, so a `PagedQuery` and a hand-written object both
 * qualify. Course 1's structural typing, arriving where it is useful.
 */
export function explain(builder: { build(): Query }): string {
  throw new Error('TODO: `${text} [${params joined with ", "}]`')
}
