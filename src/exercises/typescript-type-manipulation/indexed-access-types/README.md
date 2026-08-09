# Reaching into a type

A recipe says *use the flour from the third jar on the second shelf*. It does not say
*use plain flour* — because if you reorganise the pantry, the recipe should follow, not
argue.

Indexed access types are those directions. `ApiResponse['user']['profile']['city']`
means "whatever the city is", read out of the one place it is declared. Rename the
field and the build breaks once, at the declaration, instead of quietly in the four
functions that hard-coded the old answer.

## Goal

The five types at the top of `starter.ts` are **given**. Read them, then implement the
five functions:

- **`cityOf(response)`** → the city.
- **`firstTag(response)`** → the first tag, or `undefined`.
- **`pagesVisited(response)`** → every visited page, in order.
- **`latestVisit(response)`** → the visit with the highest `at`, or `undefined`.
- **`fieldOf(response, key)`** → one field of the user, chosen by the caller.

## The bit that needs showing: `[number]`

```ts
type Tag = User['tags'][number] // string
```

`[number]` is not "index zero". It is the **index type** — "what do I get for any numeric
index?" — which on an array is the element type. Writing `User['tags'][0]` also compiles
and means something narrower that is rarely what you want.

On a **tuple** the two genuinely differ, and the tests pin both down:

```ts
type A = [string, number][0] // string
type B = [string, number][number] // string | number
```

## When to reach in, and when not to

For shapes **you own**, declaring `interface Visit { … }` separately and referring to it
is usually the better design — it gives the concept a name and a place to hang a
docstring.

Indexed access earns its keep on shapes you **do not** own: a generated API client, a
library's return type, a payload someone else defines. You cannot restructure those, and
copying a field's type out by hand produces a copy that will go stale without telling you.

Note `pagesVisited` returns `readonly Visit['page'][]` rather than `readonly string[]`.
Both compile today. Only one still means "whatever a page is" after somebody changes
`page` to a branded id type.

## Run it

```bash
pnpm --filter exercises attempt   # grade your starter.ts — start here
pnpm --filter exercises verify    # the full gate CI runs
```

Work in `starter.ts`. `solution.ts` is the reference answer, and the same tests
grade both — which is what keeps the answer and the tests honest.

## Hints

<details>
<summary>Hint 1 — three of them are one line</summary>

`cityOf`, `firstTag` and `fieldOf` are each a single property access. If one feels like it
needs a cast, look again at the declared return type — it was chosen to match.

</details>

<details>
<summary>Hint 2 — firstTag</summary>

`tags[0]` is already `string | undefined`, and the return type is `Tag | undefined`,
which *is* `string | undefined`. Nothing to reconcile.

</details>

<details>
<summary>Hint 3 — latestVisit</summary>

`reduce` with no initial value seeds from the first element and throws on an empty array,
so the length check comes first. Same shape as `hottest` in lesson 1.1.

</details>
