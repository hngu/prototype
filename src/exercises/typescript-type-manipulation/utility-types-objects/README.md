# The standard-issue toolkit

A carpenter's toolbox does not contain anything a carpenter could not have made. It
contains the six things worth not making again.

`Partial`, `Required`, `Readonly`, `Pick`, `Omit` and `Record` are that toolbox. Every one
is a mapped type, and by now you have written mapped types — so this exercise reimplements
three of them, then uses them to build the types a real user API would need.

## Goal

**Half one: reimplement three utility types**, graded by
`pnpm --filter exercises typecheck`. `MyPick`, `MyOmit` and `MyRecord` currently delegate
to the built-ins; replace each with your own mapped type. The `Expect<Equals<…>>` line
under each is the grader.

**Half two: four functions**, graded by `attempt`:

- **`toPublic(user)`** — everything except `passwordHash`.
- **`toSummary(user)`** — `id` and `name` only.
- **`applyPatch(user, patch)`** — apply the patch, **ignoring** any property explicitly set
  to `undefined`. Not a one-liner; see below.
- **`indexUsers(users)`** — a `Record<string, User>` keyed by id, later duplicates winning.

## The three, and how they are actually built

```ts
type Pick<T, K extends keyof T> = { [P in K]: T[P] }
type Record<K extends keyof any, V> = { [P in K]: V }
type Omit<T, K extends keyof any> = Pick<T, Exclude<keyof T, K>>
```

`Pick` and `Record` are the two-token versions of what you already know. `Record` is the
odd one out in that it builds a shape from nothing rather than transforming one — `V` is
the same for every key rather than `T[P]`.

`Omit` is built out of `Pick` and `Exclude`, and `Exclude` is next lesson's. You can write
it with lesson 6's `as` clause instead, sending unwanted keys to `never`.

## One wart, kept on purpose

Note the constraint on `MyOmit`: **`keyof any`, not `keyof T`.** That is what the real
`Omit` uses, and it means this compiles:

```ts
type Oops = Omit<User, 'nmae'> // omits nothing. No error.
```

`Pick<User, 'nmae'>` is a clean error, because `Pick` constrains `K extends keyof T`. The
inconsistency is a compatibility decision from 2018 that cannot be changed now, and it is
worth knowing before it costs you an afternoon. Copy the looseness — a test asserts
`MyOmit<User, 'nope'>` equals `User`.

## The bug `applyPatch` exists to teach

```ts
return { ...user, ...patch } // wrong
```

`UserPatch` is a `Partial`, so every property is `T | undefined` — and an object spread
copies a property that is *present and undefined*, overwriting a real value with nothing.
`applyPatch(user, { name: undefined })` leaves the user nameless.

`{ name: undefined }` is a perfectly valid `Partial<User>`, so the type system cannot catch
this for you. It is one of the most common bugs in applied TypeScript. Filter the undefined
entries out before spreading.

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
<summary>Hint 1 — MyPick and MyRecord</summary>

One mapped type each, mapping over `K` rather than over `keyof T`. `Pick`'s value type is
`T[P]`; `Record`'s is the same `V` every time.

</details>

<details>
<summary>Hint 2 — MyOmit without Exclude</summary>

Map over `keyof T` and use an `as` clause to send the unwanted keys away:

```ts
{ [P in keyof T as P extends K ? never : P]: T[P] }
```

A key mapped to `never` is removed — lesson 6's last trick.

</details>

<details>
<summary>Hint 3 — toPublic</summary>

Destructure the hash out and spread the rest: `const { passwordHash: _hash, ...rest } = user`.
Listing the four fields you want instead compiles today and silently stops including new
ones as `User` grows, which is the whole reason `Omit` exists.

</details>

<details>
<summary>Hint 4 — applyPatch</summary>

`Object.entries(patch).filter(([, value]) => value !== undefined)`, then `fromEntries`, then
spread. One cast on the way back, for the usual `fromEntries` reason — safe because every
key came out of `patch`.

</details>
