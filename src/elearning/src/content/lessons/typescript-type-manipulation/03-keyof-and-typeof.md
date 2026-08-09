---
title: Two X-rays
course: typescript-type-manipulation
order: 3
# Quoted: YAML treats a leading backtick as a reserved indicator character.
summary: "`keyof` reads the key names off a type and `typeof` reads the type off a value. Together they let a union of allowed strings be derived from real data rather than copied from it."
duration: 10
exercise: true
draft: false
---

A hospital has two machines. One photographs the label on the jar, the other photographs what is
inside. Between them, nobody has to write out the contents of the cupboard by hand — so the list can
never go out of date.

Those two machines are `keyof` and `typeof`, and this lesson is the first of several where you stop
writing types and start computing them.

## The two operators

**`keyof T`** takes a *type* and gives a union of its property names:

```ts
interface User {
  id: string
  name: string
  age: number
}

type UserKey = keyof User // 'id' | 'name' | 'age'
```

**`typeof value`** takes a *value* and gives its type:

```ts
const settings = { retries: 3, verbose: false }
type Settings = typeof settings // { retries: number; verbose: boolean }
```

That is the **type** `typeof`, not the runtime one that returns the string `'object'`. They share a
spelling and nothing else, and you can always tell which is which by where it appears: in a type
position it is this one.

Together they solve a problem you have almost certainly had:

```ts
const MODES = { dark: 'Dark', light: 'Light', auto: 'Follow system' } as const

type Mode = keyof typeof MODES // 'dark' | 'light' | 'auto'
```

Read it right to left: take the value `MODES`, get its type, get that type's keys. Compare the
alternative, which is to write `type Mode = 'dark' | 'light' | 'auto'` next to the object and hope
that somebody updating one remembers the other. **Derived, not copied** — that is the whole point,
and adding a fourth mode now needs exactly one edit.

`as const` is doing quiet but essential work there. Without it the object's type is
`{ dark: string; … }`, so the *keys* still come out right but the values collapse to `string`, and
anything reading a label back loses all precision.

```quiz
id: typescript-type-manipulation-keyof-and-typeof-q1
q: `const MODES = { dark: 'Dark', light: 'Light' } as const`. What is `keyof typeof MODES`?
- [x] `'dark' | 'light'`
- [ ] The values rather than the keys
- [ ] The whole object type, unchanged
- [ ] `string`
explain: `typeof MODES` is the object's type and `keyof` takes its *key* names, so you get the union of the left-hand sides — `'dark' | 'light'`, not `'Dark' | 'Light'`. The values are reachable too, with an indexed access, which the next lesson is about.
```

## Details that catch people

**`keyof` on an index signature** gives you the index type, not a list of what happens to be in there:

```ts
type Bag = { [key: string]: number }
type BagKey = keyof Bag // string | number
```

The `number` is not a mistake. JavaScript object keys are strings, and `obj[0]` works by coercing, so
a string index signature admits numeric keys too. Surprising once, then never again.

**`keyof any`** is `string | number | symbol`, which is the type you will see written `PropertyKey`.

**`keyof` on a union** gives only the keys *common to all members*, which is the correct answer and
usually not the one people expect:

```ts
type A = { id: string; a: number }
type B = { id: string; b: number }
type Key = keyof (A | B) // 'id' — and nothing else
```

That follows from what the union means: given a value that might be either, `id` is the only property
you can safely ask for.

**`typeof` works on more than object literals.** `typeof someFunction` gives the function's type,
which you can then take apart with `Parameters` and `ReturnType` in lesson 9. And `typeof SomeClass`
is the type of the *constructor* rather than an instance — a distinction that has confused everybody
at least once.

```quiz
id: typescript-type-manipulation-keyof-and-typeof-q2
q: `type A = { id: string; a: number }`, `type B = { id: string; b: number }`. What is `keyof (A | B)`?
- [x] `'id'`
- [ ] `'id' | 'a' | 'b'`
- [ ] `never`
- [ ] `'a' | 'b'`
explain: A value of type `A | B` might be either, so the only property you can safely read is the one both have. Taking the *union* of the keys would be unsound — it would let you read `a` off a `B`.
```

## Where the honesty runs out

There is one wrinkle worth meeting now, because it comes up the first time you use this for real:

```ts
Object.keys(MODES) // string[] — not Mode[]
```

That is not laziness in the type definitions. `Object.keys` accepts any object, and structural typing
means a value typed `{ dark: … }` may genuinely have more properties at run time — so `string[]` is
the only sound answer.

Which leaves you with a cast:

```ts
export function allModes(): readonly Mode[] {
  // Safe here: MODES is a `const` literal in this file with `as const` applied, so
  // nothing can have added a key to it.
  return Object.keys(MODES) as Mode[]
}
```

The cast is fine. What makes it fine is the sentence above it, and being able to write that sentence
is the difference between a justified cast and a hopeful one. If `MODES` later gets built by spreading
in another object, that line becomes a lie and nothing will tell you — so casts belong at boundaries
you control, with a comment saying why.

One related habit: to test membership, use `Object.hasOwn(MODES, value)` rather than `value in MODES`.
`in` walks the prototype chain, so `'toString' in MODES` is `true` — which stops being a curiosity the
moment the value came from a query string.

```quiz
id: typescript-type-manipulation-keyof-and-typeof-q3
type: true-false
q: `Object.keys` returns `string[]` rather than `(keyof T)[]` because of a limitation nobody has got round to fixing.
answer: false
explain: It is the sound answer. Structural typing means a value typed `{ a: string }` can genuinely have more properties at run time, so the key list cannot be promised to be exactly `keyof T`. Casting is correct where *you* can see the object cannot have extras — with a comment saying so.
```

## What to take away

- `keyof` reads key names off a type; the type-level `typeof` reads a type off a value.
- `keyof typeof someObject` derives a union from real data, so it cannot drift — and `as const` is
  what keeps the values precise too.
- `keyof` on a union gives only the shared keys, which is the sound answer rather than a limitation.
- `Object.keys` returns `string[]` for good reasons; cast it only where you can state why the object
  has no extra keys.
