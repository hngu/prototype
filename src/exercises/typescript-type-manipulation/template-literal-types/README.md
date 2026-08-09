# A type made of string

A postcode is not just text. `CB1 2AB` fits and `banana` does not, and you know that
without looking anything up, because a postcode has a *shape*.

Template literal types give a type that shape. `` `${Method} /${string}` `` accepts
`'GET /users'` and rejects `'PATCH /users'`, `'GET users'` and `'GETusers'` — and the
function taking one needs no validation at all, because a malformed route was refused at
the call site.

## Goal

The types at the top of `starter.ts` are **given**. Implement the four functions:

- **`handlerNameFor(key)`** — `'theme'` → `'onThemeChange'`. The return type is a template
  literal over `K`, so the result is the exact literal rather than `string`.
- **`envNameFor(key)`** — `'fontSize'` → `'SETTING_FONTSIZE'`.
- **`parseRoute(route)`** — `'GET /users'` → `{ method: 'GET', path: '/users' }`. **No
  validation and no error path**; see below.
- **`makeHandlers(record)`** — one handler per setting, each reporting its own name.
  Derive the names with `handlerNameFor` rather than writing them out.

## The four intrinsics

| Type | Does | Runtime twin |
| --- | --- | --- |
| `Uppercase<S>` | the whole string | `s.toUpperCase()` |
| `Lowercase<S>` | the whole string | `s.toLowerCase()` |
| `Capitalize<S>` | the first character only | `s.charAt(0).toUpperCase() + s.slice(1)` |
| `Uncapitalize<S>` | the first character only | `s.charAt(0).toLowerCase() + s.slice(1)` |

`Uppercase` and `Capitalize` are the pair people mix up, and the tests pin the difference
down with `Equals<Equals<Uppercase<'theme'>, Capitalize<'theme'>>, false>`.

These four are **intrinsic**: the compiler implements them natively rather than in
TypeScript, which is why you cannot write a fifth one yourself.

## Distribution, and the size warning that comes with it

A template literal type distributes over a union in *any* slot, so

```ts
type Route = `${'GET' | 'POST' | 'DELETE'} /${string}`
```

is three patterns, not one pattern containing a union — the tests assert exactly that. It
is also the reason these can get slow: two unions of ten members each produce a hundred
string literals, and the compiler builds all of them.

## What `parseRoute` does not contain

No validation. No `undefined` in the return type. No error branch. The `Route` type
guaranteed there is a space and that what precedes it is a `Method`, so the malformed cases
were rejected before the function was entered.

That is the pattern worth taking away: **push the check into the type and the runtime code
gets shorter**, not more careful. The tests include four `@ts-expect-error` calls showing
each rejected shape.

The honest limitation, also in the tests: a plain `string` is refused even when it happens
to fit. A route read from config at run time has to be *checked* before it can be used as a
`Route`. Patterns protect literals, not strangers.

## Why two of the functions need a cast

`handlerNameFor` builds its result from a `K` the compiler has not resolved, so
`` `on${…}Change` `` cannot be checked against `` `on${Capitalize<K>}Change` `` even though
it is the same transformation. That is lesson 5's generic-conditional problem in a new
costume, and the fix is the same: write the runtime transformation to match the type, keep
them next to each other, and test both.

## Run it

```bash
pnpm --filter exercises attempt   # grade your starter.ts — start here
pnpm --filter exercises verify    # the full gate CI runs
```

Work in `starter.ts`. `solution.ts` is the reference answer, and the same tests
grade both — which is what keeps the answer and the tests honest.

## Hints

<details>
<summary>Hint 1 — Capitalize's twin</summary>

`key.charAt(0).toUpperCase() + key.slice(1)`. Not `toUpperCase()` on the whole thing —
that is `Uppercase`, and the tests can tell.

</details>

<details>
<summary>Hint 2 — parseRoute without reintroducing uncertainty</summary>

`split(' ')` gives `string[]`, and `noUncheckedIndexedAccess` then makes both halves
`string | undefined` — putting back exactly the doubt the type had removed. `indexOf(' ')`
and two `slice` calls keep it.

</details>

<details>
<summary>Hint 3 — makeHandlers</summary>

`SETTING_KEYS.map(…)` producing `[name, handler]` pairs, then `Object.fromEntries` and one
cast. Call `handlerNameFor` for the name — writing `onThemeChange:` by hand passes every
test in the file today and drifts the moment a third setting appears.

</details>
