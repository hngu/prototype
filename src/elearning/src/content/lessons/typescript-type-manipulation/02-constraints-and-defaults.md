---
title: Must fit through this door
course: typescript-type-manipulation
order: 2
summary: A constraint says what a type parameter must be, without flattening it into that. Understanding the difference between a constraint and a parameter type is worth more than any other single idea in this course.
duration: 11
exercise: true
draft: false
---

A fairground ride has a sign: *you must be taller than this line*. It does not turn everyone into
someone exactly that tall. You get on the ride as yourself.

That sentence is the whole lesson, and it is the thing most people get wrong about constraints.

## The sign on the door

`<T>` on its own means "any type at all", which is often too generous — you cannot do anything with a
value you know nothing about. `extends` adds a requirement:

```ts
function longest<T extends { length: number }>(a: T, b: T): T {
  return a.length >= b.length ? a : b
}

longest('abc', 'de') // string
longest([1], [2, 3]) // number[]
longest(1, 2) // Error: number has no 'length'
```

Inside the function, `T` is known to have a `length`. Outside, it is still whatever the caller passed.
The constraint is structural like everything else, so strings, arrays, `NodeList`s and your own types
all qualify without opting in.

Note that both parameters are the same `T`, which is why `longest('abc', [1, 2])` is refused. If you
wanted to allow that, you would need two parameters — the question from the previous lesson, asked
again.

```quiz
id: typescript-type-manipulation-constraints-and-defaults-q1
q: `longest<T extends { length: number }>(a: T, b: T): T`. What is the type of `longest([1], [2, 3])`?
- [x] `number[]`
- [ ] `{ length: number }`
- [ ] `number[] | { length: number }`
- [ ] `unknown`
explain: The constraint decides what may be *passed*; it does not replace what was passed. `T` is inferred as `number[]` and the return type is `number[]`, so you can go straight on to `.map()` — which is the entire reason to write a constraint rather than a plain parameter type.
```

## A floor, not a ceiling

Here is the same idea again, in the form that actually costs people time. These two accept exactly the
same arguments:

```ts
function byId(items: readonly { id: string }[]): Map<string, { id: string }>
function byId<T extends { readonly id: string }>(items: readonly T[]): Map<string, T>
```

The first one **discards every other field**. Put users in, get `{ id: string }` out, and the next line
that reads `.name` is an error. The second hands your users back as users.

A parameter type is a floor that also becomes the ceiling. A constraint is a floor that lets the real
type through. Whenever a function takes something in and gives something *related* back, that is the
signal to reach for a constraint.

The most useful form of it in practice is over keys:

```ts
function pluck<T, K extends keyof T>(items: readonly T[], key: K): readonly T[K][] {
  return items.map((item) => item[key])
}

pluck(users, 'name') // readonly string[]
pluck(users, 'age') // readonly number[]
pluck(users, 'nmae') // Error: not assignable to 'keyof User'
```

`K extends keyof T` keeps `K` pinned to the one key that was passed, so `T[K]` is that field's type.
Write `key: keyof T` instead and the best return type available is `T[keyof T][]` —
`(string | number)[]` for a user — and every caller narrows a union that was never uncertain. Same
number of characters; different amount of work for everybody downstream.

```quiz
id: typescript-type-manipulation-constraints-and-defaults-q2
q: Why is `key: K` with `K extends keyof T` better than `key: keyof T`?
- [x] `K` stays the specific key passed, so `T[K]` is that field's exact type
- [x] A misspelled key is a compile error rather than an array of `undefined`
- [ ] `keyof T` does not exist as a type
- [ ] Only the `K` version can be called without a type argument
explain: Both reject bad keys, but only the `K` version remembers *which* key, and that is what makes the return type precise instead of a union of every field type. Both are inferred at the call site with no type arguments written.
```

## Defaults are a different question

`T = string` looks like a constraint and is not related to one:

```ts
function makeBucket<T = string>(label: string, items?: readonly T[]): Bucket<T>

makeBucket('empty') // Bucket<string> — nothing to infer from, so the default decides
makeBucket('counts', [1, 2]) // Bucket<number> — inference wins
makeBucket<number>('counts') // Bucket<number> — explicit wins
```

A **constraint** restricts what may be passed. A **default** decides what happens when nobody says.
Without the default, `makeBucket('empty')` would infer `unknown` and hand back a bucket nothing can be
read out of.

They combine freely — `<T extends Named = User>` is legal and occasionally exactly right. And a default
does not constrain: `makeBucket<number>('counts', ['a'])` is still an error, because the explicit
argument fixed `T` to `number`.

One more thing you will meet and should mostly leave alone. `const` type parameters —
`<const T>` — tell inference to keep literal types instead of widening, which is `as const` moved from
the call site into the signature. Useful for a function whose whole job is to preserve a literal shape;
noise everywhere else.

```quiz
id: typescript-type-manipulation-constraints-and-defaults-q3
type: true-false
q: `<T = string>` prevents a caller from passing a `number` as the type argument.
answer: false
explain: That is what a constraint does. A default only fills the blank when inference has no candidate and the caller wrote nothing — `<T extends string>` is the restriction, and the two are independent enough to be used together.
```

## What to take away

- A constraint says what a type parameter must satisfy and leaves it as itself; use one whenever a
  function returns something related to what it took in.
- A parameter type is a floor that becomes the ceiling; that is the difference that discards your
  fields.
- `K extends keyof T` remembers which key, making `T[K]` exact rather than a union.
- A default fills the blank when nobody says; it restricts nothing.
