# A label on something you cannot touch

A museum label tells you what the exhibit is. It does not touch it, and nobody checks the
label against the object — if it says *bronze, 400 BC* and the thing is plastic, the label is
simply wrong and everyone believes it anyway.

That is a `.d.ts`.

## Read these two first

| File | What it is |
| --- | --- |
| `text-utils.js` | Plain JavaScript, no annotations, off-limits |
| `text-utils.d.ts` | Its declarations — a **worked example**, with the reasoning in the comments |

`allowJs` is off in this package, so the compiler never opens the `.js`. Everything it
believes about that module comes from the `.d.ts`, unconditionally. Delete the declaration
file and the import becomes `TS7016: Could not find a declaration file for module
'./text-utils.js'` — a hard error under `strict`, not a silent `any`.

The four decisions the declaration file had to make are worth more than its syntax:

- **`slugify(text: string)`, not `string | number`.** The implementation calls `String(text)`
  and would survive a number. Describe the contract you want callers to rely on, not every
  input that happens not to crash.
- **`suffix?: string`.** Optional means "the caller may omit it". The default *value* lives in
  the JavaScript and is not the caller's business.
- **`parseList` returns `string[]`, mutable.** Honest — it builds a fresh array the caller
  owns. `readonly` would be a lie in the safe direction, which is still a lie.
- **`parseJsonHeader` returns `unknown`.** It genuinely can return anything. `any` gives the
  caller no help; a made-up `Frontmatter` is a lie the compiler will then vouch for. `unknown`
  is the truth, and the inconvenience it causes is exactly the check that was missing.

## Goal

Build a small typed facade over that module.

- **`slug`** — pass through.
- **`preview(text, maxLength?)`** — at most `maxLength` characters *including* the ellipsis.
  Defaults to 40, and that default is yours rather than the library's.
- **`tags(text)`** — comma-separated tags, lower-cased, de-duplicated, first-seen order,
  returned as `readonly string[]`.
- **`isFrontmatter(value)`** — a real type predicate. Non-null object, string `title`, and if
  `tags` is present at all it must be an array of **strings**. Absent `tags` is valid.
- **`readFrontmatter(text)`** — parse, check, normalise. `tags` is always present in the
  result, defaulting to `[]`.
- **`slugViaDefault`** — reach `slugify` through the default import instead.

## The two boundaries this exercise is really about

**Narrowing what you hand on.** `parseList` gives you a `string[]` you own; `tags` returns
`readonly string[]`, because that array is *yours* and you would rather callers not mutate it.
Widening and narrowing in the right direction at each boundary is most of what a facade is
for.

**Turning `unknown` into something known.** `readFrontmatter` is the payoff for the
declaration file's honesty. A cast would compile and move the failure to whichever line first
reads `.title.toUpperCase()`. And note `Array.isArray` narrows to `any[]`, so checking the
elements is not optional — `tags: [1, 2]` sails through a shallow check.

Normalising matters too: `isFrontmatter` accepts a header with no `tags`, so the facade fills
in `[]` rather than passing the uncertainty on. A facade that hands its callers the same
doubt it received has not done anything.

## What this exercise does not grade

The curriculum row for this lesson said "write a `.d.ts` for an untyped JS helper, then
consume it type-safely". It grades the second half.

The reason is structural: a declaration file has to sit next to the `.js` it describes and be
named after it, so there can only be **one** — `starter.ts` and `solution.ts` cannot each have
their own version to be graded against. Shipping a deliberately incomplete one would break
this package's rule that a fresh clone typechecks, since a missing declaration is `TS7016`.

So the authoring is taught by the lesson page and by `text-utils.d.ts`, which is written as a
worked example with its reasoning in the comments rather than as a file to skim.

## Run it

```bash
pnpm --filter exercises attempt   # grade your starter.ts — start here
pnpm --filter exercises verify    # the full gate CI runs
```

Work in `starter.ts`. `solution.ts` is the reference answer, and the same tests
grade both — which is what keeps the answer and the tests honest.

## Hints

<details>
<summary>Hint 1 — preview's default</summary>

`export function preview(text: string, maxLength = 40)`. The library's `truncate` also has a
default, for `suffix`, and you simply do not pass one — its default is its business and yours
is yours.

</details>

<details>
<summary>Hint 2 — tags</summary>

A `Set` does the de-duplication and preserves insertion order, so first-seen order comes free:

```ts
const seen = new Set<string>()
for (const tag of parseList(text)) seen.add(tag.toLowerCase())
return [...seen]
```

</details>

<details>
<summary>Hint 3 — isFrontmatter</summary>

Guard `typeof value !== 'object' || value === null` first, then cast to
`{ title?: unknown; tags?: unknown }` to read the two properties without fighting the
compiler. Check `title` is a string; return `true` early if `tags` is `undefined`; otherwise
`Array.isArray(tags) && tags.every((t) => typeof t === 'string')`.

</details>

<details>
<summary>Hint 4 — readFrontmatter</summary>

```ts
const parsed = parseJsonHeader(text)
if (!isFrontmatter(parsed)) return undefined
return { title: parsed.title, tags: parsed.tags ?? [] }
```

Three lines, and each is a different job: get it, check it, tidy it.

</details>
