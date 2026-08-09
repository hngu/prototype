import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Equals, Expect } from '../../tools/type-assert.ts'
import * as solution from './solution.ts'
import * as starter from './starter.ts'
import type { Snapshot } from './solution.ts'

/**
 * API parity, in the form classes force on us.
 *
 * Every other exercise in this repo asserts `typeof solution = starter` and back. That
 * cannot work here: a class with a `#private` field — or a TypeScript `private` one — is
 * **nominal**. Two `Stack`s declared in two files are never assignable to each other even
 * if they are identical character for character, because `#items` in one "refers to a
 * different member that cannot be accessed from within type 'Stack'". Correctly so: they
 * really are different private fields.
 *
 * So the API is declared *once*, here, and both files are checked against it by the one
 * assignment on `subject` below. A dropped or retyped member still fails to compile,
 * which is what the parity check was for.
 */
interface StackApi<T> {
  readonly capacity: number
  readonly size: number
  readonly isEmpty: boolean
  push(item: T): this
  pop(): T | undefined
  peek(): T | undefined
  snapshot(): Snapshot<T>
}

interface StackCtor {
  new <T>(capacity: number, initial?: readonly T[]): StackApi<T>
  of<U>(items: Iterable<U>): StackApi<U>
}

/* Both branches must satisfy the contract, so this single annotation type-checks both
   files — and it is load-bearing for a second reason. Without it, `subject` would be
   `typeof starter | typeof solution`, and `new subject.Stack(…)` would be a call on a
   union of construct signatures, which is not allowed. */
const subject: { readonly Stack: StackCtor } =
  process.env['EXERCISE_TARGET'] === 'starter' ? starter : solution

const { Stack } = subject

test('the constructor refuses a capacity it cannot honour', () => {
  assert.throws(() => new Stack(0), RangeError)
  assert.throws(() => new Stack(-3), RangeError)
  assert.throws(() => new Stack(1.5), RangeError)

  // And accepts the smallest legal one.
  assert.equal(new Stack<string>(1).capacity, 1)
})

test('a new stack is empty and knows its capacity', () => {
  const stack = new Stack<string>(3)

  assert.equal(stack.capacity, 3)
  assert.equal(stack.size, 0)
  assert.equal(stack.isEmpty, true)
  assert.equal(stack.peek(), undefined)
  assert.equal(stack.pop(), undefined)
})

test('initial items are kept, newest first out', () => {
  const stack = new Stack(3, ['a', 'b'])

  assert.equal(stack.size, 2)
  assert.equal(stack.isEmpty, false)
  assert.equal(stack.peek(), 'b')
  assert.equal(stack.pop(), 'b')
  assert.equal(stack.pop(), 'a')
  assert.equal(stack.size, 0)
})

test('initial items past capacity are trimmed, keeping the newest', () => {
  const stack = new Stack(2, ['a', 'b', 'c', 'd'])

  assert.equal(stack.size, 2)
  assert.deepEqual(stack.snapshot().items, ['c', 'd'])
})

test('the constructor copies the array it was handed', () => {
  // `readonly T[]` is a compile-time promise about what *this* code does with the
  // reference, and it is erased at run time. It says nothing about the caller, who still
  // holds a live array.
  const initial = ['a', 'b']
  const stack = new Stack(4, initial)

  initial.push('c')

  assert.equal(stack.size, 2, 'mutating the caller’s array must not reach inside')
})

test('push chains, and keeps the receiver’s own type', () => {
  const stack = new Stack<number>(4)

  const returned = stack.push(1).push(2).push(3)

  // `push` returns `this`, not `Stack<T>` — so a chain never widens. Lesson 4.4.
  type _chained = Expect<Equals<typeof returned, StackApi<number>>>

  assert.equal(returned, stack, 'push must return the same instance, not a copy')
  assert.equal(stack.size, 3)
  assert.equal(stack.peek(), 3)
})

test('pushing past capacity drops the oldest, and never grows', () => {
  const stack = new Stack(3, ['a'])

  stack.push('b').push('c').push('d').push('e')

  assert.equal(stack.size, 3)
  assert.deepEqual(stack.snapshot().items, ['c', 'd', 'e'])

  // Which is the invariant worth stating: whatever you do, size <= capacity.
  assert.ok(stack.size <= stack.capacity)
})

test('peek looks without removing', () => {
  const stack = new Stack(2, ['a', 'b'])

  assert.equal(stack.peek(), 'b')
  assert.equal(stack.peek(), 'b')
  assert.equal(stack.size, 2)
})

test('snapshot is a frozen copy, not a live view', () => {
  const stack = new Stack<string>(3).push('a').push('b')
  const before = stack.snapshot()

  assert.deepEqual(before, { size: 2, items: ['a', 'b'] })

  stack.push('c')

  assert.deepEqual(before.items, ['a', 'b'], 'the snapshot must not follow the stack')
  assert.equal(before.size, 2)
  assert.deepEqual(stack.snapshot().items, ['a', 'b', 'c'])

  // Frozen at run time as well as `readonly` at compile time. The two are independent:
  // `readonly` is gone by the time this runs, and would not have stopped a caller who
  // never saw the types.
  assert.ok(Object.isFrozen(before))
  assert.ok(Object.isFrozen(before.items))
})

test('snapshot’s type refuses a write, and its run-time freeze refuses one too', () => {
  const stack = new Stack<string>(2).push('a')
  const snap = stack.snapshot()

  // @ts-expect-error — `items` is `readonly string[]`, so there is no `push` to call.
  void snap.items.push

  // `@ts-expect-error` silences the *type* error; the code still runs. Modules are always
  // strict mode, so writing to a frozen property throws rather than failing quietly —
  // which is the run-time half of the protection doing its job.
  assert.throws(() => {
    // @ts-expect-error — and `size` is a `readonly` property.
    snap.size = 99
  }, TypeError)

  assert.equal(snap.size, 1)
})

test('static of() sizes a stack to fit whatever it was given', () => {
  const fromArray = Stack.of([1, 2, 3])

  assert.equal(fromArray.capacity, 3)
  assert.equal(fromArray.size, 3)
  assert.equal(fromArray.peek(), 3)

  // Any iterable, not just an array — a `Set` and a string both work.
  const fromSet = Stack.of(new Set(['a', 'b']))
  assert.deepEqual(fromSet.snapshot().items, ['a', 'b'])

  const fromString = Stack.of('hey')
  assert.deepEqual(fromString.snapshot().items, ['h', 'e', 'y'])
})

test('static of() copes with an empty iterable', () => {
  // The trap: sizing to fit an empty iterable asks for capacity 0, which the constructor
  // rightly refuses. A valid empty stack has to have room for at least one item.
  const empty = Stack.of<number>([])

  assert.equal(empty.size, 0)
  assert.ok(empty.capacity >= 1)
  assert.equal(empty.push(7).peek(), 7)
})

test('the element type follows through the factory', () => {
  const numbers = Stack.of([1, 2])
  type _numbers = Expect<Equals<typeof numbers, StackApi<number>>>

  assert.equal(numbers.pop(), 2)

  // @ts-expect-error — a `Stack<number>` does not take a string, and `of` inferred
  // `number` from the argument without anyone writing it down.
  numbers.push('three')
})
