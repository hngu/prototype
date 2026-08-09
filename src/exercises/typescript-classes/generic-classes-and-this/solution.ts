/**
 * Reference solution: Chains that remember what they are
 * Lesson: typescript-classes/generic-classes-and-this
 */

export type Row = Record<string, unknown>

export interface Query {
  readonly text: string
  readonly params: readonly unknown[]
}

/* `T extends Row` is a constraint rather than a claim about what `T` is. Course 3's lesson
   on constraints applies unchanged here: the caller passing `{ id: string; name: string }`
   gets a builder specialised to exactly those keys, not one widened to `Row`. */
export class QueryBuilder<T extends Row> {
  readonly table: string

  /* `protected` so `PagedQuery` can read them and outside code cannot. Note they are
     `readonly` *references* to mutable arrays — the field cannot be reassigned, and the
     arrays can still be pushed to, which is what these need. */
  protected readonly clauses: string[]
  protected readonly values: unknown[]

  constructor(table: string) {
    this.table = table
    this.clauses = []
    this.values = []
  }

  /* Two type parameters' worth of work in one signature.

     `K extends keyof T & string` picks a single real key. The `& string` matters: `keyof T`
     on a `Record<string, unknown>`-constrained type can include `number` and `symbol`, and
     neither interpolates into SQL sensibly.

     `value: T[K]` is an indexed access type — course 3, lesson 4 — and it is what ties the
     two arguments together. `where('id', 42)` on a builder whose `id` is a `string` is a
     compile error, because `K` was fixed to `'id'` by the first argument and `T['id']` is
     then `string`. One signature, and the second argument is checked against the first. */
  where<K extends keyof T & string>(column: K, value: T[K]): this {
    this.clauses.push(`${column} = ?`)
    this.values.push(value)
    return this
  }

  whereRaw(fragment: string): this {
    this.clauses.push(fragment)
    return this
  }

  build(): Query {
    const where = this.clauses.length > 0 ? ` WHERE ${this.clauses.join(' AND ')}` : ''
    return { text: `SELECT * FROM ${this.table}${where}`, params: [...this.values] }
  }

  /* Returning `this` from a *factory* is a promise the compiler cannot verify, and this is
     where the one unavoidable cast lives.

     `this.constructor` is the real class — `PagedQuery` when called on a `PagedQuery` — so
     the object produced genuinely is the right type. But `constructor` is declared `Function`
     in the standard library, because TypeScript has no way to know that every subclass's
     constructor takes a single `string`. Nothing checks that; a subclass declaring
     `constructor(table: string, db: Db)` would break this at run time. The cast is where
     that assumption is written down, which is the most you can do about it.

     Note what the cast is *not* hiding: the identity of the class. That part is real. */
  clone(): this {
    const Self = this.constructor as new (table: string) => this
    const copy = new Self(this.table)

    /* `copy.clauses` is reachable despite being `protected`, because visibility is per
       class rather than per object — the same rule that lets a static factory reach a
       private field. And `push(...)` rather than assignment, because the field is
       `readonly`. */
    copy.clauses.push(...this.clauses)
    copy.values.push(...this.values)
    return copy
  }
}

export class PagedQuery<T extends Row> extends QueryBuilder<T> {
  /* `#limit` and `#offset`, not redeclarations of anything inherited. A redeclared
     inherited field would run after `super()` and overwrite it with `undefined` — lesson
     4.3's trap. */
  #limit: number
  #offset: number

  constructor(table: string) {
    super(table)
    this.#limit = 0
    this.#offset = 0
  }

  /* `this` again, and here it earns its keep in the other direction: `limit` is declared on
     the subclass, so a chain that has already gone through the *base's* `where` must still
     be a `PagedQuery` for this to be reachable. Which is exactly what `where(): this`
     bought. */
  limit(count: number): this {
    if (!Number.isInteger(count) || count < 1) {
      throw new RangeError(`limit expects a positive integer, got ${count}`)
    }

    this.#limit = count
    return this
  }

  offset(count: number): this {
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError(`offset expects a non-negative integer, got ${count}`)
    }

    this.#offset = count
    return this
  }

  override build(): Query {
    const base = super.build()
    const limit = this.#limit > 0 ? ` LIMIT ${this.#limit}` : ''
    const offset = this.#offset > 0 ? ` OFFSET ${this.#offset}` : ''

    return { text: `${base.text}${limit}${offset}`, params: base.params }
  }

  /* The bill for promising `this`. The inherited `clone` produces a `PagedQuery` — that
     part is handled — but it has never heard of `#limit`, so the copy would come back
     unset. Every subclass that adds state has to extend the copy, and forgetting is a
     silent bug rather than a compiler error. Worth weighing before adding `clone` to a
     class you expect people to subclass.

     `super.clone()` is typed `this`, and `copy.#limit` is legal because this code is inside
     `PagedQuery`. */
  override clone(): this {
    const copy = super.clone()
    copy.#limit = this.#limit
    copy.#offset = this.#offset
    return copy
  }
}

/* Asks for the capability, not the class. A `PagedQuery`, a `QueryBuilder` and a
   hand-written `{ build: () => … }` all qualify, and none of them had to be planned for. */
export function explain(builder: { build(): Query }): string {
  const { text, params } = builder.build()
  return `${text} [${params.join(', ')}]`
}
