import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Equals, Expect } from '../../tools/type-assert.ts'
import * as solution from './solution.ts'
import * as starter from './starter.ts'
import type { Query, Row } from './solution.ts'

/**
 * The API declared once, because `protected` members make the two files' classes nominal.
 * See `classes-and-members` for the details.
 *
 * Note that `clauses` and `values` are absent: they are `protected`, so they are not part
 * of the public surface, and leaving them out is also what stops the nominality biting.
 */
interface BuilderApi<T extends Row> {
  readonly table: string
  where<K extends keyof T & string>(column: K, value: T[K]): this
  whereRaw(fragment: string): this
  build(): Query
  clone(): this
}

interface PagedApi<T extends Row> extends BuilderApi<T> {
  limit(count: number): this
  offset(count: number): this
}

interface ExerciseModule {
  readonly QueryBuilder: new <T extends Row>(table: string) => BuilderApi<T>
  readonly PagedQuery: new <T extends Row>(table: string) => PagedApi<T>
  explain(builder: { build(): Query }): string
}

const subject: ExerciseModule = process.env['EXERCISE_TARGET'] === 'starter' ? starter : solution

const { QueryBuilder, PagedQuery, explain } = subject

/**
 * A **type alias**, not an interface, and the difference is load-bearing.
 *
 * `Row` is `Record<string, unknown>`, so `T extends Row` requires an index signature. An
 * object type alias gets an *implicit* one and satisfies the constraint; an `interface`
 * does not, and `QueryBuilder<UserInterface>` would not compile.
 *
 * The reason to care is what it does to `keyof T`. Writing `interface User extends Row`
 * would have inherited the index signature outright, making `keyof User` include all of
 * `string` — and every column check in this file would silently pass.
 */
type User = {
  id: string
  name: string
  age: number
}

/* ── The generic half ───────────────────────────────────────────────────────────────── */

test('a builder with no clauses omits WHERE entirely', () => {
  const query = new QueryBuilder<User>('users').build()

  assert.equal(query.text, 'SELECT * FROM users')
  assert.deepEqual(query.params, [])
})

test('where records a fragment and a parameter, in order', () => {
  const query = new QueryBuilder<User>('users').where('id', 'u1').where('age', 33).build()

  assert.equal(query.text, 'SELECT * FROM users WHERE id = ? AND age = ?')
  assert.deepEqual(query.params, ['u1', 33])
})

test('whereRaw adds a fragment with no parameter', () => {
  const query = new QueryBuilder<User>('users')
    .where('name', 'ada')
    .whereRaw('deleted_at IS NULL')
    .build()

  assert.equal(query.text, 'SELECT * FROM users WHERE name = ? AND deleted_at IS NULL')
  assert.deepEqual(query.params, ['ada'])
})

test('the column and the value are checked against each other', () => {
  const builder = new QueryBuilder<User>('users')

  /* Compile-time assertions, in a closure that is never invoked. `@ts-expect-error`
     silences the *type* error and leaves the call in place — and these calls work fine at
     run time, quietly adding a nonsense clause that would corrupt the assertion below.
     The compiler stopping you is the entire protection. */
  const rejected = (): void => {
    // @ts-expect-error — `age` is a number on `User`, so a string is refused. `K` was fixed
    // to `'age'` by the first argument, which made the second argument's type `T['age']`.
    builder.where('age', 'thirty-three')

    // @ts-expect-error — and there is no `email` column on `User`.
    builder.where('email', 'a@b.c')
  }
  void rejected

  // The correct calls, which do run. Both arguments checked by one signature.
  assert.deepEqual(builder.where('age', 33).where('id', 'u1').build().params, [33, 'u1'])
})

test('a builder over a different row type is checked against that one', () => {
  type Post = {
    slug: string
    views: number
  }

  const posts = new PagedQuery<Post>('posts')

  const rejected = (): void => {
    // @ts-expect-error — `id` belongs to `User`, not to `Post`. One class, specialised twice.
    posts.where('id', 'p1')
  }
  void rejected

  assert.equal(
    posts.where('slug', 'hello').limit(5).build().text,
    'SELECT * FROM posts WHERE slug = ? LIMIT 5',
  )
})

test('build returns a snapshot, not a live view of the parameters', () => {
  const builder = new QueryBuilder<User>('users').where('id', 'u1')
  const first = builder.build()

  builder.where('age', 40)

  assert.deepEqual(first.params, ['u1'], 'the earlier query must not have changed')
  assert.deepEqual(builder.build().params, ['u1', 40])
})

/* ── The `this` half ────────────────────────────────────────────────────────────────── */

test('a chain through an inherited method still reaches the subclass', () => {
  // This is the whole point of `this` as a return type. `where` is declared on
  // `QueryBuilder` and knows nothing about pagination — but it returns `this`, so the chain
  // is still a `PagedQuery` when it arrives at `.limit`.
  const chained = new PagedQuery<User>('users').where('id', 'u1').offset(20).limit(10)

  type _stillPaged = Expect<Equals<typeof chained, PagedApi<User>>>

  assert.equal(chained.build().text, 'SELECT * FROM users WHERE id = ? LIMIT 10 OFFSET 20')
  assert.deepEqual(chained.build().params, ['u1'])
})

test('had `where` returned QueryBuilder<T>, the chain would have stopped there', () => {
  // The failure `this` prevents, written down. Never invoked: `@ts-expect-error` silences
  // the type error and the call would still run, and a base builder has no `limit`.
  const wouldNotCompile = (): void => {
    const base = new QueryBuilder<User>('users').where('id', 'u1')

    // @ts-expect-error — `limit` is on `PagedQuery`, and this is a `QueryBuilder`.
    base.limit(10)
  }
  void wouldNotCompile

  assert.equal(new QueryBuilder<User>('users').where('id', 'u1').build().params.length, 1)
})

test('limit and offset only appear when set, and LIMIT comes first', () => {
  const table = 'users'

  assert.equal(new PagedQuery<User>(table).build().text, 'SELECT * FROM users')
  assert.equal(new PagedQuery<User>(table).limit(5).build().text, 'SELECT * FROM users LIMIT 5')
  assert.equal(new PagedQuery<User>(table).offset(5).build().text, 'SELECT * FROM users OFFSET 5')
  assert.equal(
    new PagedQuery<User>(table).limit(5).offset(10).build().text,
    'SELECT * FROM users LIMIT 5 OFFSET 10',
  )
})

test('limit and offset validate their arguments', () => {
  const builder = new PagedQuery<User>('users')

  assert.throws(() => builder.limit(0), RangeError, 'a limit of 0 selects nothing')
  assert.throws(() => builder.limit(-1), RangeError)
  assert.throws(() => builder.limit(1.5), RangeError)

  assert.throws(() => builder.offset(-1), RangeError)
  assert.throws(() => builder.offset(2.5), RangeError)

  // Zero is a legal offset, and the boundary the two differ on.
  assert.equal(builder.offset(0).build().text, 'SELECT * FROM users')
})

/* ── clone, and the promise `this` makes ────────────────────────────────────────────── */

test('clone copies the clauses and the two are then independent', () => {
  const base = new QueryBuilder<User>('users').whereRaw('deleted_at IS NULL')

  const adults = base.clone().where('age', 18)
  const named = base.clone().where('name', 'ada')

  assert.equal(base.build().text, 'SELECT * FROM users WHERE deleted_at IS NULL')
  assert.equal(adults.build().text, 'SELECT * FROM users WHERE deleted_at IS NULL AND age = ?')
  assert.deepEqual(adults.build().params, [18])
  assert.deepEqual(named.build().params, ['ada'])
})

test('clone produces the actual class, not the one that declared it', () => {
  const paged = new PagedQuery<User>('users').where('id', 'u1').limit(3)
  const copy = paged.clone()

  // `clone` is declared on `QueryBuilder` and returns `this`. Hard-coding
  // `new QueryBuilder(…)` inside it would satisfy nothing here — the copy must still have
  // `limit`, both to the compiler and at run time.
  type _stillPaged = Expect<Equals<typeof copy, PagedApi<User>>>

  assert.equal(copy.limit(9).build().text, 'SELECT * FROM users WHERE id = ? LIMIT 9')
})

test('clone carries the subclass’s own state as well as the inherited state', () => {
  // The bill for promising `this`: the inherited `clone` gets the class right and knows
  // nothing about `#limit`, so `PagedQuery` has to extend the copy. Forgetting is a silent
  // bug, which is why this is tested separately from the line above.
  const original = new PagedQuery<User>('users').where('id', 'u1').limit(7).offset(14)
  const copy = original.clone()

  assert.equal(copy.build().text, 'SELECT * FROM users WHERE id = ? LIMIT 7 OFFSET 14')
  assert.deepEqual(copy.build().params, ['u1'])

  // And still independent afterwards.
  copy.limit(1)
  assert.equal(original.build().text, 'SELECT * FROM users WHERE id = ? LIMIT 7 OFFSET 14')
})

/* ── Asking for the capability rather than the class ────────────────────────────────── */

test('explain takes anything that can build', () => {
  assert.equal(
    explain(new QueryBuilder<User>('users').where('id', 'u1')),
    'SELECT * FROM users WHERE id = ? [u1]',
  )

  assert.equal(
    explain(new PagedQuery<User>('users').limit(2)),
    'SELECT * FROM users LIMIT 2 []',
  )

  // Including something with no relationship to either class. `explain` never named a
  // class, so nothing had to be planned for.
  assert.equal(
    explain({ build: () => ({ text: 'SELECT 1', params: [1, 'a'] }) }),
    'SELECT 1 [1, a]',
  )
})
