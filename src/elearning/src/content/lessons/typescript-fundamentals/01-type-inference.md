---
title: Inference and widening
course: typescript-fundamentals
order: 1
summary: TypeScript picks a type for almost every value you write. Knowing which one it picks — and when it deliberately picks a broader one — removes most day-one confusion.
duration: 8
draft: false
---

You rarely need to tell TypeScript what type something is. It reads the value and decides.
The interesting part is that it does not always pick the most specific type available.

## Inference from a value

Given a literal, TypeScript infers the obvious thing:

```ts
const name = 'ada' // "ada"
let count = 5 // number
const active = true // boolean
```

Look closely at the first two. `name` is a `const`, and its type is not `string` — it is the
**literal type** `"ada"`, a type with exactly one possible value. But `count` is a `let`, and its
type is the much broader `number`, not `5`.

That difference is not arbitrary. A `const` binding can never be reassigned, so the only value it
will ever hold is the one it was created with; TypeScript keeps the narrowest type it can. A `let`
binding is expected to change, so keeping the type as `5` would make the very next assignment an
error. TypeScript **widens** the literal to its base type.

```quiz
id: ts-inference-const-literal
q: What type does TypeScript infer for `const x = 5`?
- [x] `5`
- [ ] `number`
- [ ] `any`
- [ ] `unknown`
explain: A `const` binding can never be reassigned, so TypeScript keeps the narrowest possible type — the literal type `5`. Writing `let x = 5` instead would widen it to `number`.
```

## Where widening bites

Widening is helpful right up until it isn't. The classic case is an object literal:

```ts
const config = { mode: 'dark' }
// config.mode is string, not "dark"
```

Even though `config` is a `const`, its *properties* are mutable — you can write `config.mode =
'light'` perfectly legally. So TypeScript widens `mode` to `string`. If a function expects
`'dark' | 'light'`, passing `config.mode` now fails.

There are three standard fixes, and they trade off differently:

```ts
// 1. Annotate the target type
const config: { mode: 'dark' | 'light' } = { mode: 'dark' }

// 2. Assert the single property
const config = { mode: 'dark' as const }

// 3. Freeze the whole literal
const config = { mode: 'dark' } as const
```

Option 3 makes every property `readonly` as well as narrow, which is usually what you want for
configuration objects but occasionally more than you asked for.

```quiz
id: ts-widening-object-props
q: Which of these produce a `mode` property typed as `"dark"` rather than `string`?
- [ ] `const config = { mode: 'dark' }`
- [x] `const config = { mode: 'dark' as const }`
- [x] `const config = { mode: 'dark' } as const`
- [x] `const config: { mode: 'dark' } = { mode: 'dark' }`
explain: Object properties are mutable even on a `const` binding, so a bare object literal widens `mode` to `string`. All three of the other forms pin it — `as const` on the property, `as const` on the whole literal, or an explicit annotation on the binding.
```

## Widening is not the same as `any`

A widened type is still a real type. `number` rejects `"five"`, and the compiler will still catch
a typo'd property. Widening only loses *precision*, never safety.

`any`, by contrast, switches checking off entirely for that value — and it is contagious, since
anything derived from an `any` is also `any`. This is the distinction worth internalising early:
widening is TypeScript making a reasonable guess, while `any` is TypeScript being told to stop
looking.

```quiz
id: ts-widening-vs-any
type: true-false
q: Widening a literal type to `number` disables type checking for that value.
answer: false
explain: Widening only makes the type less specific. `number` still rejects a string, a boolean, or a misspelled method. It is `any` that switches checking off entirely.
```

## What to take away

- TypeScript infers a type for nearly everything; annotations mostly *correct* that inference.
- `const` keeps literal types, `let` widens them — because one can be reassigned and one cannot.
- Object properties widen even under `const`, which is why `as const` exists.
- A widened type is still checked. Only `any` opts out.

Next we look at what happens when a value could be one of several types, and how TypeScript
narrows it back down as your code rules possibilities out.
