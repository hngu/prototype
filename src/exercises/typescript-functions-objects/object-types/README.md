# A form with optional rows

Every form has three kinds of row. The ones you must fill in. The ones you may
leave blank. And, at the bottom, a note saying *use the space below for anything
else* — because whoever printed the form could not list everything in advance.

Object types have all three. This exercise is an HTTP options bag, which is the
place they all show up at once.

## Goal

Implement the four functions in `starter.ts`:

- **`resolveOptions(options?)`** turns a `RequestOptions` — almost everything
  optional — into a `ResolvedOptions`, where nothing is. Defaults: `GET`, `{}`,
  `5000`, no body, `0` retries. A `timeoutMs` of `0`, a `retries` of `0` and a body
  of `''` are all real answers and must survive.
- **`headerValue(headers, name)`** looks a header up **ignoring case**, because HTTP
  header names are case-insensitive and object keys are not.
- **`withHeader(headers, name, value)`** returns a **copy** with the header set,
  lowercased, replacing any existing spelling. `HeaderBag` is `readonly`, so a copy is
  not a stylistic choice.
- **`describeRequest(url, options?)`** → `'GET /users (5000ms)'`, or
  `'POST /users (5000ms, body 2 chars)'`, or
  `'PUT /users (5000ms, body 0 chars, 2 retries)'`. Retries appear only when above
  zero, and `1 retry` is singular.

## Optional in, required out

This is the shape worth taking away from the whole lesson:

```ts
interface RequestOptions {
  readonly timeoutMs?: number
} // what a caller writes
interface ResolvedOptions {
  readonly timeoutMs: number
} // what the code reads
```

Resolve once, at the entrance. Then no function downstream contains a `?? 5000`, the
defaults live in exactly one place, and adding a field to `ResolvedOptions` without
handling it in `resolveOptions` is a compile error. The alternative — threading
`options?.timeoutMs ?? 5000` through fifteen functions — restates the default fifteen
times and enforces nothing.

Note that `body` changes shape on the way through, from `body?: string` to
`body: string | null`. On the way in, "I did not mention a body" is what a caller
says. On the way out, "there is no body" is a fact, and every reader can rely on the
property being there.

## What the index signature tests pin down

`HeaderBag` is `{ readonly [name: string]: string }`, and three `@ts-expect-error`
comments hold down what that means:

- **Reading gives `string | undefined`**, even for a key visible one line above.
  `noUncheckedIndexedAccess` is right about this: an index signature says which keys
  are *allowed*, never which are *present*.
- **Every value must be a `string`** — `{ 'content-length': 12 }` is rejected under a
  key nobody listed, because the signature covers all of them.
- **`readonly` covers every property**, so nothing in the bag can be written. Worth
  reading the test after that one: the write still lands at run time, because
  `readonly` is erased. The compiler is the only thing stopping you.

And one in the other direction: `RequestOptions` has *no* index signature, so
`resolveOptions({ timeoutMS: 250 })` is caught as a typo. Loose bags cannot do that
for you, which is the reason not to reach for an index signature by default.

## Run it

```bash
pnpm --filter exercises attempt   # grade your starter.ts — start here
pnpm --filter exercises verify    # the full gate CI runs
```

Work in `starter.ts`. `solution.ts` is the reference answer, and the same tests
grade both — which is what keeps the answer and the tests honest.

## Hints

<details>
<summary>Hint 1 — reaching into a possibly-absent options object</summary>

`options` is itself optional, so `options.method` will not compile. `options?.method
?? 'GET'` handles both layers in one expression: the `?.` for "no options at all"
and the `??` for "options, but not that field".

</details>

<details>
<summary>Hint 2 — case-insensitive lookup</summary>

`headers[name]` cannot work — the keys have whatever case the caller used.
`Object.entries` gives you `[key, value]` pairs to compare lowercased.

</details>

<details>
<summary>Hint 3 — replacing regardless of case</summary>

Filter the entries down to the ones whose lowercased key is *not* the one you are
setting, then append yours. `Object.fromEntries` turns the result back into an
object. Doing it the other way round — set first, then dedupe — is harder to get
right.

</details>

<details>
<summary>Hint 4 — assembling the description</summary>

Collect the optional fragments into an array and `join(', ')` at the end. Building
the string with `+=` and conditional separators is where the stray commas live.

</details>
