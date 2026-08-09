# Relabel every jar

A cupboard full of jars, and a job: put a *maybe* sticker on every lid. You do not
decide jar by jar. You state the rule once and walk along the shelf.

A mapped type is that rule. `{ [K in keyof T]?: T[K] }` says "walk every key of `T` and
make it optional", and it is — genuinely, exactly — how `Partial` is implemented. Half
this exercise is writing that half of the standard library yourself.

## Goal

This exercise has two halves, and they are graded by different commands.

**Half one: write three mapped types.** `MyPartial`, `MyRequired` and `MyReadonly` each
currently delegate to the built-in they are meant to reimplement. Replace the delegation
with a real mapped type.

These are graded by **`pnpm --filter exercises typecheck`**, not by `attempt`. Under each
one is a line like:

```ts
type _partial = Expect<Equals<MyPartial<Draft>, Partial<Draft>>>
```

Get it wrong and tsc stops with the file and line. The message itself is terse — *Type
'false' does not satisfy the constraint 'true'* — so the line number is the useful part.
Try `{ [K in keyof T]: T[K] | undefined }` and watch it fire: that is the classic wrong
answer, and `?:` versus `| undefined` is exactly the distinction `Equals` exists to catch.

**Half two: write a runtime counterpart.** `Getters<T>` is given; `makeGetters` is not.
Graded by `attempt` as usual.

> **Honest limitation of half one.** The assertion tells you whether what you wrote is
> *correct*; it cannot tell whether you wrote anything, because the delegating placeholder
> is itself a correct answer. It is a fast, precise oracle for type authorship, not a
> proctor. Nobody is watching — do the exercise.

## The modifiers

| Written | Does |
| --- | --- |
| `?` | add the optional marker |
| `-?` | remove it — **and** strip `undefined` from the property type |
| `readonly` | add it |
| `-readonly` | remove it (no built-in exists; every codebase writes `Mutable` once) |

The `-?` row is the one that surprises people. `Required<Draft>['beta']` is `boolean`, not
`boolean | undefined`, and a property declared `beta: boolean | undefined` with no `?`
survives `Required` unchanged. The `?` and the `undefined` are related and not the same —
lesson 1.8's point, arriving again at the type level.

## Homomorphic mapping, and why the key expression matters

Mapping straight over `keyof T` makes the type **homomorphic**: TypeScript recognises the
shape and preserves the modifiers already present. So a `readonly` property stays
`readonly` through `MyPartial`. Write `{ [K in keyof T & string]?: T[K] }` instead and you
quietly lose that, because the key expression is no longer plain `keyof T`.

The tests pin both behaviours down, so a version that gets `Draft` right and `Settings`
wrong will not pass.

## `as`, which changes the shape

```ts
type Getters<T> = { readonly [K in keyof T & string as `get${Capitalize<K>}`]: () => T[K] }
```

The `as` clause rewrites the key on the way through — that is what turns a mapped type
from "same shape, new modifiers" into a genuinely different shape. `keyof T & string`
drops number and symbol keys, because a template literal type needs a string. And mapping
a key to `never` in an `as` clause **removes** it, which is how `Omit` is built.

`makeGetters` needs one cast, because `Object.fromEntries` cannot know which keys it just
built. What makes the cast honest is that the loop produces exactly the keys the mapped
type describes, by the same rule. Write the transformation twice — once in the type, once
in the code — and keep them next to each other.

## Run it

```bash
pnpm --filter exercises typecheck  # grades half one
pnpm --filter exercises attempt    # grades half two
pnpm --filter exercises verify     # both, and what CI runs
```

Work in `starter.ts`. `solution.ts` is the reference answer, and the same tests
grade both — which is what keeps the answer and the tests honest.

## Hints

<details>
<summary>Hint 1 — the shape of a mapped type</summary>

```ts
type Example<T> = { [K in keyof T]: T[K] }
```

That is the identity — same keys, same types, nothing changed. All three of your answers
are that with one character added.

</details>

<details>
<summary>Hint 2 — MyRequired</summary>

The minus goes before the `?`, not after the `K`. And check what it did to `beta`'s type,
not just its marker.

</details>

<details>
<summary>Hint 3 — makeGetters, the keys</summary>

`Object.keys(source)` gives the names. Upper-case the first character and concatenate the
rest — `key.charAt(0).toUpperCase() + key.slice(1)` — which leaves an already-capitalised
key like `URL` alone, as the tests require. `toUpperCase()` on the whole key would not.

</details>

<details>
<summary>Hint 4 — makeGetters, the values</summary>

`() => source[key as keyof T]`, not `() => value`. The tests mutate the source afterwards
and expect the getter to notice — that is what makes it a getter. The `as keyof T` is the
same `Object.keys` widening as lesson 3.3.

</details>
