---
title: A labelled tray, not a bag
course: typescript-functions-objects
order: 6
summary: A tuple is an array whose length and slot types are known, which lets the compiler promise things an array type cannot — including that a list is not empty.
duration: 10
exercise: true
draft: false
---

A bag holds any number of apples. A cutlery tray holds exactly one knife, one fork and one spoon, in
that order, and you know which slot is which without looking.

`string[]` is the bag. `[string, number]` is the tray. The difference is not cosmetic — it changes what
the compiler is able to promise you.

## Exactly this many, exactly these

A tuple type fixes the length and gives each position its own type:

```ts
type Entry = [name: string, score: number]

const entry: Entry = ['ada', 90]
const wrong: Entry = ['ada'] // Error: Source has 1 element(s) but target requires 2.
```

The `name:` and `score:` are **labels**. They appear in editor tooltips and destructuring
suggestions, they are erased with everything else, and `entry[0]` is still how you index. On a
two-slot tuple holding different types they are most of the reason to prefer a tuple over an object.

The payoff arrives when you read one:

```ts
const name: string = entry[0] // string. Not string | undefined.
const nope = entry[2] // Error: Tuple type has no element at index '2'.
```

Compare the same reads on a `string[]`, where index `0` is `string | undefined` under
`noUncheckedIndexedAccess` and index `2` is a perfectly reasonable thing to ask for. The tuple knows
its own length, so there is nothing to warn about and nothing to guess. This is the sharpest practical
difference between the two, and it is why `useState` returns a tuple rather than an object.

```quiz
id: typescript-functions-objects-tuples-and-readonly-q1
q: `entry` is typed `[name: string, score: number]` with `noUncheckedIndexedAccess` on. What is the type of `entry[0]`?
- [x] `string`
- [ ] `string | undefined`
- [ ] `string | number`
- [ ] An error, because tuples must be indexed by destructuring
explain: The length is part of the type, so index 0 definitely exists and no `undefined` is added. That is exactly what the flag cannot know about a plain `string[]` — and it is why converting an array to a tuple often deletes a pile of defensive checks.
```

## How to say "at least one"

A tuple may end with a **rest element**, and this turns out to be one of the most useful types in
everyday TypeScript:

```ts
function headline(parts: readonly [string, ...string[]]): string {
  const [first, ...rest] = parts
  return rest.length === 0 ? first : `${first} (${rest.join(', ')})`
}
```

One required slot, then any number more — which is how you spell **non-empty list**. Look at what the
body does *not* contain: no `?? ''`, no `!`, no early return for the empty case. `first` is a `string`
because the type guarantees it.

The impossible case has not been handled; it has been made unrepresentable. The error moves to the
caller, where the information is:

```ts
headline([]) // Error: Source has 0 element(s) but target requires 1.

const parts: readonly string[] = load()
headline(parts) // Error: Target requires 1 element(s) but source may have fewer.
```

That second one is worth noticing. A plain array is rejected because its length is *unknown*, and
unknown includes zero. So a caller has to check, once, where the array came from — which is where the
check belonged.

```quiz
id: typescript-functions-objects-tuples-and-readonly-q2
q: Why can `headline` read `parts[0]` with no check when `parts: readonly [string, ...string[]]`?
- [x] The type guarantees a first element exists, so there is no missing case
- [ ] Rest elements disable `noUncheckedIndexedAccess` for the whole tuple
- [ ] `readonly` implies the array is non-empty
- [ ] Destructuring always narrows away `undefined`
explain: The first slot is required by the type, so index 0 cannot be missing and nothing is widened. This is the general move: make the bad state unrepresentable and the defensive code disappears rather than being written more carefully.
```

## `readonly`, and where tuples stop being the answer

`readonly [string, number]` does two things. Writing to a slot is an error, and the mutating methods —
`push`, `pop`, `sort`, `splice` — are not on the type at all, rather than being present and quietly
wrong.

It is still a compile-time promise. `readonly` is erased, so a `@ts-expect-error`'d write really does
land at runtime; `Object.freeze` is the version with teeth. But as a signal between authors it is
excellent, and `readonly` on a parameter costs a caller nothing.

There is also a pleasing connection back to inference. `as const` on an array literal produces a
`readonly` tuple, which is why it works for lookup tables:

```ts
const MODES = ['dark', 'light'] as const // readonly ['dark', 'light']
```

Finally, when *not* to use one. At two elements of different types a tuple reads beautifully and
destructures naturally. At three, nobody remembers which slot is which:

```ts
const [passes, fails, skipped] = summarise(results) // which order was that?
const { passes, fails, skipped } = summarise(results) // fine at any size
```

Destructuring by position is the feature and it is also the limit. Labels help a reader hovering the
type; they do not help the person reading the call site in a diff.

```quiz
id: typescript-functions-objects-tuples-and-readonly-q3
type: true-false
q: `as const` on an array literal produces a `readonly` tuple type rather than an array type.
answer: true
explain: `['dark', 'light'] as const` is `readonly ['dark', 'light']` — fixed length, literal element types, no mutating methods. That is why it is the standard way to declare a small set of allowed values, and why `MODES[0]` is `'dark'` rather than `string | undefined`.
```

## What to take away

- A tuple fixes length and per-slot types, so indexing is not widened and an out-of-range index is an
  error.
- Labels are documentation for tooltips and destructuring; they are erased and do not change indexing.
- `readonly [T, ...T[]]` is how you say "non-empty", and it deletes the defensive code instead of
  tidying it.
- Prefer an object once there are three or more slots — position stops being memorable well before
  the type does.
