# Chains that remember what they are

A chain of method calls is a conversation, and it goes wrong the moment one of the
replies forgets who it was talking to.

## Goal

Build a small query builder that is generic over its row type and chainable without
losing the receiver's own class.

- **`QueryBuilder<T extends Row>`** — `where(column, value)` adds `column = ?` and records
  the value; `whereRaw(fragment)` adds a fragment with no parameter; `build()` renders
  `SELECT * FROM <table>` plus ` WHERE …` joined with ` AND `, omitting `WHERE` entirely
  when there is nothing.
- **`clone()`** returns `this` — a copy of whatever class it was actually called on.
- **`PagedQuery<T>`** adds `limit` and `offset` (validated, `RangeError` otherwise), an
  `override build()` that appends ` LIMIT n` then ` OFFSET n` when set, and an
  `override clone()` that carries the extra state.
- **`explain(builder)`** takes anything with a `build()` and renders
  `<text> [<params joined with ", ">]`.

## Two features, meeting

**Generic over the row type.** `where<K extends keyof T & string>(column: K, value: T[K])`
ties the two arguments together: the first fixes `K`, and that makes the second's type
`T[K]`. So `where('age', 'thirty-three')` is a compile error on a `User` whose `age` is a
number, and `where('email', …)` is one because there is no such column. One signature,
and the second argument is checked against the first.

The `& string` earns its place — `keyof T` can include `number` and `symbol`, and neither
interpolates into SQL sensibly.

**Chainable via `this`.** Every chaining method returns `this`, not `QueryBuilder<T>`. That
is what lets

```ts
new PagedQuery<User>('users').where('id', 'u1').limit(10)
```

compile. `where` is declared on the base and knows nothing about pagination, but `this`
means the chain is still a `PagedQuery` when it arrives at `.limit`. Had `where` returned
`QueryBuilder<T>`, the chain would have widened and stopped there.

## Why `clone()` needs one cast

`this.constructor` really is the right class — `PagedQuery` when called on a `PagedQuery` —
so the object produced genuinely is the right type. But `constructor` is declared
`Function` in the standard library, because nothing guarantees that every subclass's
constructor takes a single `string`. That assumption is real and unchecked, and the cast is
where you write it down:

```ts
const Self = this.constructor as new (table: string) => this
```

A subclass declaring `constructor(table: string, db: Db)` would break this at run time, and
no one would be told. Which is a fair reason to think twice before putting a `this`-returning
factory on a class you expect people to subclass.

The same promise has a second bill: the inherited `clone` gets the *class* right and knows
nothing about `#limit`, so `PagedQuery` has to extend the copy. Forgetting is a silent bug
rather than a compiler error, so the tests check it separately.

## One thing about the tests

`User` in `solution.test.ts` is a **type alias**, not an interface, and that is deliberate.
`Row` is `Record<string, unknown>`, so `T extends Row` requires an index signature: an
object type alias gets an *implicit* one and satisfies the constraint, while an `interface`
does not and would not compile.

Writing `interface User extends Row` to fix that would be much worse than a compile error.
It inherits the index signature outright, so `keyof User` becomes all of `string` — and
every column check in the file silently passes, including the ones asserting a bad column
is rejected. A test that cannot fail is worse than no test.

## Run it

```bash
pnpm --filter exercises attempt   # grade your starter.ts — start here
pnpm --filter exercises verify    # the full gate CI runs
```

Work in `starter.ts`. `solution.ts` is the reference answer, and the same tests
grade both — which is what keeps the answer and the tests honest.

## Hints

<details>
<summary>Hint 1 — build</summary>

```ts
const where = this.clauses.length > 0 ? ` WHERE ${this.clauses.join(' AND ')}` : ''
```

Return `params: [...this.values]` rather than the array itself, so an earlier query does
not change when the builder does.

</details>

<details>
<summary>Hint 2 — clone</summary>

```ts
const Self = this.constructor as new (table: string) => this
const copy = new Self(this.table)
copy.clauses.push(...this.clauses)
```

`copy.clauses` is reachable despite being `protected`, because visibility is per class
rather than per object. And `push` rather than assignment, because the field is `readonly`.

</details>

<details>
<summary>Hint 3 — PagedQuery.build</summary>

Start from `super.build()` and append to its `text`, passing its `params` through
unchanged. Two conditionals, each `''` when the value is `0`.

</details>

<details>
<summary>Hint 4 — PagedQuery.clone</summary>

`const copy = super.clone()`, then assign `copy.#limit` and `copy.#offset`. Reaching a
private field on another object is legal because this code is inside the class that
declared it.

</details>
