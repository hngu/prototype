import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Equals, Expect } from '../../tools/type-assert.ts'
import * as solution from './solution.ts'
import * as starter from './starter.ts'

/**
 * The API declared once, because a class with private members is nominal and the two
 * files' `Counter`s are therefore unrelated types. See `classes-and-members` for the
 * long version. Note what is *absent* from this contract: neither `#count` nor `label`
 * appears, because neither is part of the class's public surface.
 */
interface CounterApi {
  readonly value: number
  readonly name: string
  increment(by?: number): this
  reset(): this
}

interface CounterCtor {
  new (label: string): CounterApi
  readonly created: number
  from(value: number, label?: string): CounterApi
  isCounter(value: unknown): value is CounterApi
}

const subject: { readonly Counter: CounterCtor } =
  process.env['EXERCISE_TARGET'] === 'starter' ? starter : solution

const { Counter } = subject

test('a new counter starts at zero and keeps its label', () => {
  const counter = new Counter('visits')

  assert.equal(counter.value, 0)
  assert.equal(counter.name, 'visits')
})

test('increment adds, chains, and returns the same instance', () => {
  const counter = new Counter('visits')

  const returned = counter.increment().increment(5).increment()

  assert.equal(returned, counter)
  assert.equal(counter.value, 7)
})

test('increment refuses anything that is not a positive integer', () => {
  const counter = new Counter('visits')

  assert.throws(() => counter.increment(0), RangeError)
  assert.throws(() => counter.increment(-1), RangeError)
  assert.throws(() => counter.increment(1.5), RangeError)
  assert.throws(() => counter.increment(Number.NaN), RangeError)

  assert.equal(counter.value, 0, 'a rejected increment must not have landed')
})

test('reset goes back to zero and chains', () => {
  const counter = new Counter('visits').increment(9)

  assert.equal(counter.reset().increment(2).value, 2)
})

test('the name is readable and not writable', () => {
  const counter = new Counter('visits')

  // A getter with no setter is enforced twice over, and both are worth seeing. The
  // compiler refuses the assignment; and because `@ts-expect-error` silences the type
  // error without removing the code, the write still runs — and throws, because modules
  // are always strict mode.
  assert.throws(() => {
    // @ts-expect-error — `name` is a getter with no setter.
    counter.name = 'something else'
  }, TypeError)

  assert.equal(counter.name, 'visits')
})

/* ── The two kinds of hiding, side by side ─────────────────────────────────────────── */

test('a `#private` field is invisible at run time, and `private` is not', () => {
  const counter = new Counter('visits').increment(3)

  // This is the whole lesson in two assertions. `label` was declared `private` and is
  // still an ordinary enumerable property; `#count` is not a property at all.
  assert.deepEqual(Object.keys(counter), ['label'])
  assert.equal(JSON.stringify(counter), '{"label":"visits"}')

  // Nor does it appear under any name, spelled any way.
  assert.equal(Object.getOwnPropertyNames(counter).includes('count'), false)
  assert.equal(Object.getOwnPropertyNames(counter).includes('#count'), false)
})

test('`private` stops honest mistakes, not determined callers', () => {
  const counter = new Counter('visits')

  // @ts-expect-error — the compiler enforces `private` inside TypeScript.
  void counter.label

  // And a cast walks straight past it, because there is nothing there to enforce: the
  // modifier was erased before this code ran. `private` is a sign; `#` is a lock.
  const unlocked = counter as unknown as { label: string }
  assert.equal(unlocked.label, 'visits')

  // There is no equivalent move for `#count`. `counter.#count` is not merely disallowed —
  // outside the class body it is not a name that parses, so no cast can express it.
})

/* ── Statics ───────────────────────────────────────────────────────────────────────── */

test('the class counts its own instances, without exposing the tally', () => {
  // A delta rather than an absolute: `created` is shared by the whole file, so asserting
  // `=== 2` here would make this test depend on which tests ran before it.
  const before = Counter.created

  new Counter('a')
  new Counter('b')
  Counter.from(5)

  assert.equal(Counter.created - before, 3, 'from() builds a counter too')

  // @ts-expect-error — a static member is on the class, not on instances.
  void new Counter('c').created

  // And the tally cannot be forged: `created` is a static *getter*, so the write is a
  // type error and, since it runs anyway, a `TypeError` as well.
  assert.throws(() => {
    // @ts-expect-error — no setter.
    Counter.created = 0
  }, TypeError)
})

test('from() builds a counter already standing at a value', () => {
  const counter = Counter.from(42, 'restored')

  assert.equal(counter.value, 42)
  assert.equal(counter.name, 'restored')

  // It is a fully working counter, not a frozen snapshot.
  assert.equal(counter.increment(8).value, 50)

  // And the label is optional.
  assert.equal(Counter.from(1).value, 1)
})

test('from() validates before it builds', () => {
  assert.throws(() => Counter.from(-1), RangeError)
  assert.throws(() => Counter.from(2.5), RangeError)
})

/* ── The brand check ───────────────────────────────────────────────────────────────── */

test('isCounter is true only for something this class built', () => {
  assert.equal(Counter.isCounter(new Counter('a')), true)
  assert.equal(Counter.isCounter(Counter.from(3)), true)

  // A shape check would have said yes to this. A private field cannot be faked.
  assert.equal(Counter.isCounter({ value: 3, name: 'a' }), false)

  // Including one that copies every public member it can see.
  const impostor = { value: 0, name: 'a', increment: () => impostor, reset: () => impostor }
  assert.equal(Counter.isCounter(impostor), false)
})

test('isCounter survives the values that would crash a naive `in` check', () => {
  // `#count in value` throws a TypeError on a primitive, so the narrowing has to come
  // first. These are the inputs that catch a check written in the wrong order.
  for (const value of [null, undefined, 0, '', 'counter', true, Symbol('x'), 7n]) {
    assert.equal(Counter.isCounter(value), false, `isCounter(${String(value)})`)
  }

  assert.equal(Counter.isCounter([]), false)
  assert.equal(
    Counter.isCounter(() => 0),
    false,
  )
})

test('isCounter narrows, so the compiler trusts it afterwards', () => {
  const value: unknown = new Counter('visits').increment(4)

  assert.ok(Counter.isCounter(value))

  // Compile-only: inside this block `value` is a counter rather than `unknown`, which is
  // only true because the signature says `value is Counter` and not `boolean`.
  type _narrowed = Expect<Equals<typeof value, CounterApi>>
  assert.equal(value.value, 4)
})
