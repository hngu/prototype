---
title: Relabel every jar
course: typescript-type-manipulation
order: 6
summary: A mapped type states one rule and applies it to every key of a type. It is how most of the standard library's utility types are implemented, and writing two of them yourself is the fastest way to stop finding them mysterious.
duration: 12
exercise: true
draft: false
---

A cupboard full of jars, and a job: put a *maybe* sticker on every lid. You do not decide jar by jar.
You state the rule once and walk along the shelf.

Types can be built the same way, and once you have seen it, a good half of the standard library stops
looking like magic.

## One rule, every key

```ts
type Partial<T> = { [K in keyof T]?: T[K] }
```

That is not a simplified illustration. That is `Partial`, as shipped. Read it as: for each `K` in the
keys of `T`, produce a property named `K`, optional, whose type is `T[K]`.

`[K in keyof T]` is the loop. `T[K]` is last lesson's indexed access, doing the work. And four
modifiers decide what happens on the way through:

| Written | Does |
| --- | --- |
| `?` | add the optional marker |
| `-?` | remove it — **and** strip `undefined` from the property's type |
| `readonly` | add it |
| `-readonly` | remove it |

`-readonly` has no built-in equivalent, which is why every codebase eventually grows this:

```ts
type Mutable<T> = { -readonly [K in keyof T]: T[K] }
```

The `-?` row is the one that catches people. `Required<T>` does not only delete a question mark:

```ts
interface Draft {
  beta?: boolean
} // beta: boolean | undefined
type R = Required<Draft> // beta: boolean   — the undefined went too
```

And a property declared `beta: boolean | undefined`, with no `?`, survives `Required` unchanged. The
optional marker and the `undefined` in the type are related and not the same thing — lesson 1.8's
point, arriving again one level up.

```quiz
id: typescript-type-manipulation-mapped-types-q1
q: `interface Draft { beta?: boolean }`. What is the type of `Required<Draft>['beta']`?
- [x] `boolean`
- [ ] `boolean | undefined`
- [ ] `never`
- [ ] `undefined`
explain: `-?` removes the optional marker *and* the `undefined` it implied, so the property becomes a plain `boolean`. That asymmetry is why `Required` is not simply the inverse of `Partial` in all respects — a property typed `boolean | undefined` without a `?` comes out of `Required` untouched.
```

## Homomorphic, which sounds worse than it is

There is one piece of jargon worth learning here, because it explains a bug you would otherwise find
baffling.

When a mapped type maps directly over `keyof T`, TypeScript recognises the shape and treats it as
**homomorphic**: it preserves the modifiers already on each property rather than starting fresh. So a
`readonly` property stays `readonly` through `Partial`:

```ts
interface Settings {
  readonly theme: string
}
type P = Partial<Settings> // { readonly theme?: string }  — readonly survived
```

Change the key expression at all and you lose that:

```ts
type Broken<T> = { [K in keyof T & string]?: T[K] } // no longer homomorphic
type B = Broken<Settings> // { theme?: string }  — readonly gone
```

The `& string` is a reasonable thing to want — it drops number and symbol keys — and it silently
discards modifiers as a side effect. If a mapped type of yours is mysteriously stripping `readonly`,
this is why.

```quiz
id: typescript-type-manipulation-mapped-types-q2
q: Why does `{ [K in keyof T]?: T[K] }` keep `readonly` markers while `{ [K in keyof T & string]?: T[K] }` loses them?
- [x] Only the first maps directly over `keyof T`, so only it is homomorphic
- [ ] `& string` explicitly removes modifiers
- [ ] The second one is not a valid mapped type
- [ ] `readonly` is only preserved when the mapped type also writes `readonly`
explain: TypeScript gives special treatment to the exact shape `[K in keyof T]` — it copies existing modifiers through. Any other key expression, `& string` included, is treated as building a fresh type, and modifiers are not carried over. It is a pattern match on the syntax, which is why such a small edit changes the behaviour.
```

## `as`, which changes the shape rather than the labels

Everything so far keeps the same keys. The `as` clause rewrites them:

```ts
type Getters<T> = {
  readonly [K in keyof T & string as `get${Capitalize<K>}`]: () => T[K]
}

type G = Getters<{ theme: string; fontSize: number }>
// { readonly getTheme: () => string; readonly getFontSize: () => number }
```

That is a genuinely different type, not a modifier change — and note the `& string`, needed because a
template literal type has to have a string to work with. (`Capitalize` is the next lesson's; it does
what it says.)

The trick worth remembering: **mapping a key to `never` removes it.** That is how `Omit` and every
"filter the keys" helper is built:

```ts
type WithoutTheme<T> = { [K in keyof T as K extends 'theme' ? never : K]: T[K] }
```

A conditional type inside an `as` clause, using `never` to drop things, is three lessons composing —
and it is the point at which people start writing types that nobody can read. Which is the note to end
on. A mapped type that saves a reader from restating six properties has earned its place. One that
needs a paragraph of explanation to justify saving four lines has not.

```quiz
id: typescript-type-manipulation-mapped-types-q3
type: true-false
q: Mapping a key to `never` in an `as` clause removes that property from the resulting type.
answer: true
explain: It is the standard way to filter keys, and how `Omit` is implemented. Combined with a conditional inside the `as` clause it gives you arbitrary key selection — powerful, and the fastest route to a type nobody on your team wants to touch.
```

## What to take away

- `{ [K in keyof T]?: T[K] }` is not an illustration of `Partial`, it *is* `Partial` — the standard
  library is doing nothing you cannot.
- `-?` removes the `undefined` as well as the marker; `-readonly` has no built-in and everybody writes
  it once.
- Mapping directly over `keyof T` is homomorphic and preserves existing modifiers; adding `& string`
  silently stops that.
- `as` rewrites keys, and mapping one to `never` deletes it — which is how `Omit` works, and where
  readability starts to be at risk.
