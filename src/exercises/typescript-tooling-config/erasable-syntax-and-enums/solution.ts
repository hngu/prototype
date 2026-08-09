/**
 * Reference solution: Peel it off, or weld it on
 * Lesson: typescript-tooling-config/erasable-syntax-and-enums
 */

import type { Equals, Expect } from '../../tools/type-assert.ts'

/* `as const` is the whole foundation, and getting it wrong is quiet rather than loud.

   Without it, TypeScript infers `{ Queued: string, … }` — property values in a mutable object
   could be reassigned, so widening is correct — and then `Status` below is just `string`.
   Everything still compiles. `isStatus` accepts `'banana'`. `describe` needs a `default` arm.
   The exhaustiveness that is the entire point of this exercise silently does not exist.

   With `as const` every property is `readonly` and its type is the literal, which is what
   makes the derived unions worth having. */
export const STATUS = {
  Queued: 'queued',
  Running: 'running',
  Done: 'done',
  Failed: 'failed',
} as const

/* `keyof typeof STATUS` — `typeof` moves from the value world to the type world, `keyof`
   photographs the labels. Course 3, lesson 3. */
export type StatusKey = keyof typeof STATUS

type _statusKey = Expect<Equals<StatusKey, 'Queued' | 'Running' | 'Done' | 'Failed'>>

/* And an indexed access over that key union gives the values. `(typeof STATUS)[StatusKey]`
   reads as "the type of every value in STATUS", which distributes over the union
   automatically — course 3, lesson 4.

   Note what this buys over an enum: **two separate types**. An enum member is a name and a
   value at once, so code that wants only the values, or only the keys, cannot ask. Here both
   exist and neither was written out by hand. */
export type Status = (typeof STATUS)[StatusKey]

type _status = Expect<Equals<Status, 'queued' | 'running' | 'done' | 'failed'>>

/* Win 1: the values are just strings, so this is a plain array of strings.

   With a string enum you would write `Object.values(Status)` and get `string[]`, needing a
   cast — because the enum object also carries its reverse mapping for numeric members, and
   the type of `Object.values` cannot know this one has none. Here `Object.values` on an
   `as const` object gives the union array directly. */
export function allStatuses(): readonly Status[] {
  return Object.values(STATUS)
}

/* Win 2: a run-time check that narrows, with no cast on the value being checked.

   The cast on `allStatuses()` is only widening `readonly Status[]` to `readonly string[]` so
   that `includes` will accept a `string` argument — a well-known and entirely safe piece of
   friction in the standard library's typing of `includes`, not a claim about `value`. */
export function isStatus(value: string): value is Status {
  return (allStatuses() as readonly string[]).includes(value)
}

/* Win 3: the mapping between keys and values is inspectable at run time in both directions,
   because `STATUS` is an ordinary object.

   One cast is genuinely unavoidable: `Object.entries` is typed to return `[string, string][]`
   and throws away the literal types, because its signature cannot express "the keys of the
   thing you passed me". The cast is the justified kind — the value really is a `StatusKey`,
   and only the standard library's typing cannot say so. Course 3's lesson 3 makes the same
   point about `Object.keys`. */
export function keyOf(value: string): StatusKey | undefined {
  const found = Object.entries(STATUS).find(([, candidate]) => candidate === value)
  return found?.[0] as StatusKey | undefined
}

/* Win 4, and the one worth the whole exercise: exhaustiveness.

   No `default` arm. Every arm returns, all four members are handled, so `status` is `never` at
   the bottom and `assertNever` compiles. Add `'cancelled'` to `STATUS` and **this function
   stops compiling** — which is exactly what you want, because it is the function that would
   otherwise have quietly returned the wrong thing.

   A string enum gives you this too. What it does not give you is any of the three wins above,
   and it costs you an object in the emitted JavaScript. */
export function describe(status: Status): string {
  switch (status) {
    case 'queued':
      return 'waiting to start'
    case 'running':
      return 'in progress'
    case 'done':
      return 'finished'
    case 'failed':
      return 'gave up'
  }

  return assertNever(status)
}

function assertNever(value: never): never {
  throw new Error(`unhandled status: ${String(value)}`)
}

/* The table-shaped version of the same guarantee, and for a pure mapping it is the better
   one: shorter, and a reader can see the whole relation at once.

   `Record<Status, string>` with no cast is what makes it exhaustive — delete a line and it is
   `Property 'failed' is missing`. The `as` cast in the starter had to go for exactly that
   reason: a cast turns this from a checked table into a wish. */
export const DESCRIPTIONS: Record<Status, string> = {
  queued: 'waiting to start',
  running: 'in progress',
  done: 'finished',
  failed: 'gave up',
}

/* Same technique, and the reason to prefer it here is that the answer is data rather than
   logic. Adding a status to `STATUS` breaks this line until somebody decides whether the new
   status is cancellable — which is the decision you want a human making. */
const CANCELLABLE: Record<Status, boolean> = {
  queued: true,
  running: true,
  done: false,
  failed: false,
}

export function isCancellable(status: Status): boolean {
  return CANCELLABLE[status]
}
