---
title: One recipe, any ingredient
course: typescript-type-manipulation
order: 1
summary: A generic is one implementation that works for any type and remembers which type it was given. Getting the type parameters right is a design decision, and inference means callers almost never write them.
duration: 10
exercise: true
draft: false
---

A recipe for jam is the same recipe whichever fruit you use. Weigh it, add sugar, boil. Using plums
does not make it a different recipe — but the label on the jar has to say *plum*, because you have
not made "some kind of jam".

That gap between the recipe and the label is what this whole course is about, and generics are where
it starts.

## The blank in the recipe

Without generics you have two bad options. Write the function once per type, or widen it until it
forgets:

```ts
function firstNumber(items: readonly number[]): number | undefined
function firstString(items: readonly string[]): string | undefined

function first(items: readonly unknown[]): unknown // forgets what went in
```

A **type parameter** is a blank the caller fills in:

```ts
function first<T>(items: readonly T[]): T | undefined {
  return items[0]
}
```

`T` is a variable that holds a *type*. Read the signature as: given an array of some type, you get
back that same type or nothing. One implementation, and the label survives.

The part people miss is that you almost never write the type argument:

```ts
first([1, 2]) // number | undefined
first(['a']) // string | undefined
first<number>([1, 2]) // legal, and unnecessary noise
```

TypeScript **infers** `T` from the argument. If you find yourself writing type arguments regularly,
the signature is usually the thing to fix. And note what did *not* happen: `first([1, 2])` is not a
`string | undefined`. Generic is not loose.

```quiz
id: typescript-type-manipulation-generics-q1
q: What is the type of `first(['a', 'b'])` where `first<T>(items: readonly T[]): T | undefined`?
- [x] `string | undefined`
- [ ] `unknown | undefined`
- [ ] `T | undefined`
- [ ] `'a' | 'b' | undefined`
explain: `T` is inferred as `string` from the argument, so the return type is `string | undefined`. `T` is not a type in its own right — it is a blank, and by the time the call is checked it has been filled in.
```

## How many blanks

The number of type parameters is a design decision, and getting it wrong is the most common generic
mistake:

```ts
function pairUp<T>(left: readonly T[], right: readonly T[]) // one blank: both lists must match
function pairUp<A, B>(left: readonly A[], right: readonly B[]) // two blanks: independent
```

The first version forces `pairUp(['a'], [1])` to unify `string` and `number`, and what you get is an
error or a union you did not ask for. The second infers each side separately and hands back
`readonly [string, number]`.

The rule that usually decides it: **one type parameter per thing that can vary independently.** Two
lists whose element types have nothing to do with each other need two.

The same reasoning applies to a generic *type*. `Cache<T>` is a family of types, one per `T`:

```ts
interface Cache<T> {
  get(key: string): T | undefined
  set(key: string, value: T): void
}

const strings = makeCache<string>()
strings.set('a', 42) // Error: Argument of type 'number' is not assignable to 'string'.
```

`Cache<string>` and `Cache<number>` are unrelated types. That is the entire point — without the
parameter you would have `Cache<unknown>` and that line would be fine.

```quiz
id: typescript-type-manipulation-generics-q2
q: `pairUp<T>(left: readonly T[], right: readonly T[])` — what goes wrong with `pairUp(['a'], [1])`?
- [x] One parameter forces both lists to the same type, so `T` cannot satisfy both
- [ ] Nothing; `T` becomes `string | number` and both lists are accepted
- [ ] Tuples cannot be built from two different types
- [ ] It needs an explicit `pairUp<string>` to compile
explain: A single blank has to be filled by a single type, and here two candidates disagree. Two independent parameters — `<A, B>` — is the fix, and "one parameter per thing that varies independently" is the rule that tells you so up front.
```

## Where generics stop paying

Two habits are worth adopting early, because the failure mode of generics is not error messages, it is
unreadable code that nobody wants to touch.

**A type parameter used only once is not doing anything.** If `T` appears in exactly one position, it
is a `unknown` in a costume:

```ts
function log<T>(value: T): void {} // T buys nothing over `value: unknown`
```

The value of a type parameter comes from *relating* two or more positions — an argument to a return
type, two arguments to each other, a container to what goes in it. `cached(cache: Cache<T>, compute:
() => T): T` earns it three times over: the cache, the function that fills it and the result cannot
drift apart.

**Generic bodies are ordinary bodies.** In the exercise for this lesson, `T` barely appears in any
implementation except as an argument to `Map`. That is normal and it is the goal. If a generic
implementation starts needing casts to satisfy its own signature, the signature is usually the thing
that is wrong — a lesson worth remembering before you spend an afternoon fighting one.

```quiz
id: typescript-type-manipulation-generics-q3
type: true-false
q: `function log<T>(value: T): void {}` is more type-safe than `function log(value: unknown): void {}`.
answer: false
explain: They are equivalent, and the generic version is worse for being misleading. `T` appears in one position and relates nothing to anything, so it constrains nothing. A type parameter pays for itself only by tying two or more positions together.
```

## What to take away

- A type parameter is a blank the caller fills in, and inference means they rarely fill it in by
  hand.
- Generic is not loose: the type that went in is the type that comes out.
- One type parameter per thing that varies independently — two unrelated lists need two.
- A parameter used in only one position buys nothing; the value comes from relating positions to each
  other.
