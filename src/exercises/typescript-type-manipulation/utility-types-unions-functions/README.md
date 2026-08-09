# Read the types off what exists

A locksmith does not measure your hand. They look at the lock.

The utilities in this lesson all work that way: instead of writing down what a function
takes and returns, you read it off the function. Change the function and everything
downstream follows, because nothing was ever written twice.

## Goal

The types at the top of `starter.ts` are **given** — and the point is that not one of them
restates anything. `ApiClient` declares three methods; every argument list, result type and
subset of endpoint names is derived from it. Implement the three functions:

- **`callEndpoint(client, endpoint, ...args)`** calls the named method. The arguments are
  checked against *that* endpoint and the result is *that* endpoint's resolved type. Two
  casts are needed; working out why is the exercise.
- **`firstDefined(values)`** returns the first value that is neither `null` nor `undefined`.
  **No cast should be necessary here** — that contrast is the other half of the exercise.
- **`makeError(...args)`** builds an `ApiError` from a tuple of its own constructor
  arguments. One line.

## The eight utilities

**Over unions** — each is one distributive conditional from lesson 5:

| Utility | Is | Does |
| --- | --- | --- |
| `Exclude<T, U>` | `T extends U ? never : T` | drop matching members |
| `Extract<T, U>` | `T extends U ? T : never` | keep matching members |
| `NonNullable<T>` | `T & {}` | drop `null` and `undefined` |

**Over functions** — each is `infer` in a different position:

| Utility | Reads |
| --- | --- |
| `Parameters<F>` | the argument tuple, **with labels and optionality** |
| `ReturnType<F>` | what it returns |
| `ConstructorParameters<C>` | a constructor's argument tuple |
| `InstanceType<C>` | what `new C()` produces |
| `Awaited<T>` | the value inside, promises peeled recursively |

The useful move is nesting them. `Awaited<ReturnType<F>>` is "what a caller actually gets
after awaiting", which is almost always the type you want rather than `ReturnType` alone.

## `typeof` before a class name

```ts
ConstructorParameters<typeof ApiError> // [status: number, detail: string]
InstanceType<typeof ApiError> // ApiError
```

A class name used as a type means **an instance**. The constructor is a different type, and
`typeof` is how you name it. Getting this backwards is the standard mistake with both of
those utilities, and the error message is not especially helpful about it.

## Why two casts, and why the third function needs none

`client[endpoint]` is a *union* of the three method types, because `E` is unresolved. You
cannot call a union of functions with different parameter lists — the compiler would have to
intersect the parameters, and `string & number` is `never`. So the function has to be
narrowed to "something accepting exactly `ArgsOf<E>`": true for every concrete `E`, and
unprovable in general. Lesson 5's problem again.

`firstDefined` needs nothing, because `NonNullable<T>` is `T & {}` and comparing against
both `null` and `undefined` narrows a generic `T` to exactly that. Real checking, real
narrowing, no assertion. Note a truthiness check would *not* do — it would also drop `0`,
`''` and `false`, which are perfectly good non-null values.

## One thing about the tests

The `@ts-expect-error` calls in `callEndpoint checks arguments…` sit inside a function that
is **never invoked**. `@ts-expect-error` silences the type error and the call would still
run — and `'patchUser'` would throw. When a compile-time assertion would misbehave at run
time, put it somewhere that never runs.

## Run it

```bash
pnpm --filter exercises attempt   # grade your starter.ts — start here
pnpm --filter exercises verify    # the full gate CI runs
```

Work in `starter.ts`. `solution.ts` is the reference answer, and the same tests
grade both — which is what keeps the answer and the tests honest.

## Hints

<details>
<summary>Hint 1 — callEndpoint</summary>

Pull the method out into a local, cast it to
`(...callArgs: ArgsOf<E>) => Promise<ResultOf<E>>`, then `.apply(client, args)`.

Use `.apply` rather than calling the bare function: a method that reads `this` breaks
otherwise, and one of the tests has one. Lesson 2.3.

</details>

<details>
<summary>Hint 2 — firstDefined</summary>

A `for…of` and one condition. Compare against `null` **and** `undefined` explicitly — that
is what narrows `T` to `NonNullable<T>`, and it is also the only version that keeps `0`.

</details>

<details>
<summary>Hint 3 — makeError</summary>

A rest parameter typed `ApiErrorArgs`, spread into `new ApiError(...)`. If the constructor
gains a third argument, this signature follows on its own.

</details>
