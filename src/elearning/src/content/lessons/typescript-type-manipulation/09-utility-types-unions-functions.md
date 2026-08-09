---
title: Read the types off what exists
course: typescript-type-manipulation
order: 9
summary: Eight utilities that take a type apart rather than describing one — three over unions, five over functions and classes. Each is one line of what you learned in this course, and using them stops types being written down twice.
duration: 11
exercise: true
draft: false
---

A locksmith does not measure your hand. They look at the lock.

The last group of utilities works that way. Rather than writing down what a function takes and
returns, you read it off the function — and then changing the function changes everything downstream,
because nothing was ever written twice.

## Three over unions

Each of these is one distributive conditional, which you can now read:

```ts
type Exclude<T, U> = T extends U ? never : T
type Extract<T, U> = T extends U ? T : never
type NonNullable<T> = T & {}
```

That is the whole implementation of the first two. They rely entirely on lesson 5's rule — naked `T`
distributes, and `never` vanishes from a union — so:

```ts
type Endpoint = 'getUser' | 'listUsers' | 'deleteUser'

type Mutating = Extract<Endpoint, `delete${string}`> // 'deleteUser'
type Read = Exclude<Endpoint, Mutating> // 'getUser' | 'listUsers'
```

Note what that second line did: a template literal pattern from lesson 7 used as the *filter* for a
distributive conditional. "Which of my endpoints mutate?" answered from the names alone, with nothing
listed twice.

`NonNullable<T>` is `T & {}`, which looks odd until you remember that `null` and `undefined` are the
only two things not assignable to the empty object type. So intersecting with `{}` removes exactly
those two and nothing else.

```quiz
id: typescript-type-manipulation-utility-types-unions-functions-q1
q: What is `Exclude<'a' | 'b' | 'c', 'b' | 'z'>`?
- [x] `'a' | 'c'`
- [ ] `'a' | 'c' | 'z'`
- [ ] `never`
- [ ] An error, because `'z'` is not in the first union
explain: `Exclude` distributes over the first union and drops the members assignable to the second. `'z'` is simply not found and causes no error — like `Omit`, these utilities are filters rather than assertions, so a typo in the exclusion list silently excludes nothing.
```

## Five over functions and classes

All of these are `infer` in a different position:

```ts
type Parameters<F> = F extends (...args: infer A) => unknown ? A : never
type ReturnType<F> = F extends (...args: never) => infer R ? R : never
```

| Utility | Reads |
| --- | --- |
| `Parameters<F>` | the argument tuple, **with labels and optionality** |
| `ReturnType<F>` | what it returns |
| `ConstructorParameters<C>` | a constructor's argument tuple |
| `InstanceType<C>` | what `new C()` produces |
| `Awaited<T>` | the value inside, promises peeled recursively |

`Parameters` giving a *labelled tuple* is nicer than people expect —
`Parameters<(page: number, size?: number) => void>` is `[page: number, size?: number | undefined]`,
which drops straight into a rest parameter and keeps the names in a caller's tooltip.

The move worth learning is nesting:

```ts
type ResultOf<E extends Endpoint> = Awaited<ReturnType<ApiClient[E]>>
```

"What a caller actually gets after awaiting." `ReturnType` alone would hand back `Promise<User>`,
which is almost never the type you want to talk about. And `Awaited` is the `Unwrap` you wrote in
lesson 5, done properly.

One trap. A class name used as a type means **an instance**; the constructor is a different type, and
`typeof` is how you name it:

```ts
ConstructorParameters<typeof ApiError> // [status: number, detail: string]
InstanceType<typeof ApiError> // ApiError
```

Leave the `typeof` out and the error is about `ApiError` not satisfying `abstract new (...args: any) =>
any`, which is not a helpful way to be told you meant the constructor.

```quiz
id: typescript-type-manipulation-utility-types-unions-functions-q2
q: `class ApiError { constructor(status: number, detail: string) {} }`. Which gives `[status: number, detail: string]`?
- [x] `ConstructorParameters<typeof ApiError>`
- [ ] `ConstructorParameters<ApiError>`
- [ ] `Parameters<typeof ApiError>`
- [ ] `Parameters<ApiError>`
explain: `ApiError` as a type is an *instance*; `typeof ApiError` is the constructor, which is what has construct signatures to read. And `Parameters` reads call signatures rather than construct signatures — the two are separate capabilities, as lesson 2.2 showed.
```

## Where this stops being a good idea

Deriving types is addictive, and there is a line.

`Awaited<ReturnType<ApiClient[E]>>` is worth it: it means adding an endpoint requires no other edit
anywhere. But a signature like `Parameters<typeof handler>[0]['options']['retries']` has stopped
communicating and started encoding a path through somebody else's data. When it breaks — and it will,
one refactor upstream — the error is four types deep and says nothing about what you meant.

The rule that holds up: **derive across a boundary you do not control, name things inside one you
do.** If you own the handler, give its options an interface. If it comes from a library, read it off.

And when a derived type needs a comment to explain what it is, it wanted to be a named type with a
docstring instead. That applies to everything in this course, and it is the note to end on: nine
lessons of tools, all of which are worth less than a reader being able to tell what your code means.

```quiz
id: typescript-type-manipulation-utility-types-unions-functions-q3
type: true-false
q: `Awaited<ReturnType<F>>` and `ReturnType<F>` differ only when `F` returns a promise.
answer: true
explain: `Awaited<T>` leaves a non-promise unchanged, so for a synchronous function the two are identical. For an `async` one, `ReturnType` gives `Promise<X>` and `Awaited<ReturnType<…>>` gives `X` — which is the type a caller actually handles, and why the nesting is worth writing.
```

## What to take away

- `Exclude`, `Extract` and `NonNullable` are one distributive conditional each, and combine with
  template literal patterns to filter unions by shape.
- `Parameters` returns a labelled tuple that drops straight into a rest parameter.
- `Awaited<ReturnType<F>>` is the type a caller actually gets; `typeof` before a class name is how you
  reach the constructor.
- Derive across boundaries you do not control; name things inside the ones you do.
