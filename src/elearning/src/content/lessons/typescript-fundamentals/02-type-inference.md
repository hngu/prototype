---
title: Labels TypeScript writes for you
course: typescript-fundamentals
order: 2
summary: TypeScript picks a type for nearly every value you write, and it does not always pick the most specific one. Learning which label it reaches for removes most of the confusion of your first week.
duration: 9
exercise: true
draft: false
---

Picture two label makers on your desk. One prints on plastic and laminates it — that label is
never coming off. The other is a whiteboard marker, because you already know you will change your
mind.

TypeScript is holding both, and it picks one for you every time you create a value. Which one it
picks is the whole of this lesson.

## The label it writes for you

You rarely have to tell TypeScript what type something is. It looks at the value and writes the
label itself. That is called **inference**, and it is happening constantly, on almost every line
you write.

```ts
const name = 'ada' // "ada"
let count = 5 // number
const active = true // boolean
```

Look hard at the first two, because they are not the same shape of answer. `name` is not typed
`string` — it is typed `"ada"`, a type with exactly one allowed value. That is a **literal type**:
the laminated label. But `count` is typed `number`, not `5`.

The reason is the keyword. A `const` can never be reassigned, so the only value it will ever hold
is the one it was born with, and TypeScript keeps the narrowest label that is true. A `let` is
expected to change; a label saying `5` would make the very next line an error. So TypeScript
deliberately reaches for the marker and writes something broader. That broadening has a name:
**widening**.

```quiz
id: typescript-fundamentals-type-inference-q1
q: What type does TypeScript infer for `const x = 5`?
- [x] `5`
- [ ] `number`
- [ ] `any`
- [ ] `unknown`
explain: A `const` can never be reassigned, so the narrowest true label is the literal type `5` — the laminated one. Write `let x = 5` and you get `number` instead, because the binding is expected to change.
```

## Objects get whiteboard labels too

Now the bit that catches everybody. `const` protects the *box*, not what is inside it:

```ts
const config = { mode: 'dark' }
// config.mode is string, not "dark"
```

You cannot reassign `config` itself — but `config.mode = 'light'` is perfectly legal JavaScript,
and TypeScript knows it. The property is a whiteboard even though the binding is laminated, so
`mode` widens to `string`. Hand `config.mode` to a function that wants `'dark' | 'light'` and it is
rejected, which feels absurd until you remember what the compiler is protecting against.

Three ways to laminate it, and they are not interchangeable:

```ts
// 1. Say what you meant, on the binding
const config: { mode: 'dark' | 'light' } = { mode: 'dark' }

// 2. Pin the one property
const config = { mode: 'dark' as const }

// 3. Laminate the whole object
const config = { mode: 'dark' } as const
```

Option 3 also makes every property `readonly`, which is usually exactly right for a configuration
object and occasionally more than you wanted. Option 1 is the one to reach for when the type is
part of your design and you want it written down where a reader will see it.

```quiz
id: typescript-fundamentals-type-inference-q2
q: Which of these give `mode` the type `"dark"` rather than `string`?
- [ ] `const config = { mode: 'dark' }`
- [x] `const config = { mode: 'dark' as const }`
- [x] `const config = { mode: 'dark' } as const`
- [x] `const config: { mode: 'dark' } = { mode: 'dark' }`
explain: Properties are mutable even on a `const` binding, so the bare literal widens `mode` to `string`. The other three all pin it — on the property, on the whole object, or by annotating the binding.
```

## A wide label is still a label

It is tempting to lump widening in with giving up. It is not the same thing at all.

A widened type is still a real type that still says no. `number` rejects `"five"`. A misspelled
method on it is still an error. Widening loses **precision** and never loses **safety** — it is
TypeScript making a sensible guess about a value you are likely to change.

`any` is a different thing entirely. It switches checking off for that value, and it spreads:
anything you pull out of an `any` is also `any`, so one of them in the wrong place quietly
disables checking across a whole call chain. Widening is the compiler guessing; `any` is the
compiler being told to stop looking.

```quiz
id: typescript-fundamentals-type-inference-q3
type: true-false
q: Widening a literal type to `number` disables type checking for that value.
answer: false
explain: Widening only makes the label less specific. `number` still rejects a string, a boolean and a misspelled method — it is a real type doing real work. Only `any` switches the checking off.
```

## What to take away

- TypeScript labels nearly everything itself; most annotations exist to *correct* a guess it
  already made.
- `const` keeps literal types and `let` widens them, because one can be reassigned and one cannot.
- Object properties widen even under `const`, which is the entire reason `as const` exists.
- A widened type is still checked. Only `any` opts out, and it spreads.
