# Two dialects, one phrasebook

Two people describing the same building, one starting from the front door and one from the
car park. Both are right. You still need a phrasebook.

## Goal

Four files are given: two **real** CommonJS modules and a `.d.cts` for each. This file is
ESM, so every import below is a genuine interop boundary rather than a simulation of one.

| Fixture | Shape |
| --- | --- |
| `legacy-config.cjs` | `module.exports = { DEFAULTS, load, describe, version: '1.4.2' }` |
| `single-export.cjs` | `module.exports = function slugify(…)` |

- **`unwrapDefault(mod)`** — take **one** layer of `default` off, if there is one. Anything
  else comes back untouched, including `null`, `undefined` and primitives.
- **`loadConfig` / `describeConfig`** — delegate to `legacy-config.cjs` through a static
  named import.
- **`slug(text)`** — reach the function in `single-export.cjs`.
- **`legacyVersion()`** — return `'1.4.2'`. This one is a trap; see below.
- **`loadConfigDynamically(overrides?)`** — the same config via `await import()`, going
  through `unwrapDefault` rather than reaching for `.default`.

## unwrapDefault, and why it is four lines

This is the function every bundler ships as `interopRequireDefault`. The edge cases are all
about what `in` does to things that are not objects:

- `'default' in null` is a **TypeError**, not `false`. Same for a string or a number.
- A **function** can legitimately carry a `default` property — that is what a transpiled ESM
  module looks like — so `typeof mod === 'object'` alone is not enough of a guard.
- **One layer only.** `{ default: { default: 1 } }` unwraps to `{ default: 1 }`. Recursing
  would corrupt a module whose default export happens to be an object with a `default` key.

## The trap, and it is a real one

`legacy-config.d.cts` declares `version`, and the property genuinely exists at run time. So
this typechecks:

```ts
import { version } from './legacy-config.cjs'
```

And Node refuses to load the file:

```text
SyntaxError: Named export 'version' not found. The requested module './legacy-config.cjs'
is a CommonJS module, which may not support all module.exports as named exports.
```

Why `load` and `describe` survive and `version` does not: Node runs `cjs-module-lexer` over
a CommonJS file before executing it, statically detecting what lands on `module.exports`.
The three **shorthand** properties have identifier values it can follow. `version`, whose
value is a string literal, it does not report. Verified —
`Object.keys(await import('./legacy-config.cjs'))` is
`['DEFAULTS', 'default', 'describe', 'load', 'module.exports']`.

A compile-time green light and a load-time failure, decided by how a property happened to be
written. That is not worth reasoning about per property. It is a reason to prefer the
**default import** for any CommonJS package you do not control: the default is
`module.exports` itself, whole, with no lexer guesswork involved.

## `export =`, legal in exactly one place

`single-export.d.cts` describes its module with `export = slugify`, which is the only way to
say "`module.exports` *is* this function". Worth noticing that `export =` is banned in every
`.ts` file in this package by `erasableSyntaxOnly` — and legal here, because the flag skips
files that emit nothing. Checked against tsc 6.0.3.

Lesson 5.6 is about writing these files. For now, note only that without a `.d.cts` the
import is `TS7016: Could not find a declaration file for module …`, which is the compiler
declining to guess rather than silently handing you `any`.

## One thing the tests demonstrate

`createRequire(import.meta.url)` returns a `require` whose return type is `any`, so the
`.d.cts` is never consulted and nothing is checked. The last test asserts that with
`Expect<Equals<typeof legacy, any>>` and then calls it with deliberate nonsense that
compiles. `createRequire` is for reaching things a specifier cannot name — a `package.json`,
a path resolved at run time — not for ordinary imports.

## Run it

```bash
pnpm --filter exercises attempt   # grade your starter.ts — start here
pnpm --filter exercises verify    # the full gate CI runs
```

Work in `starter.ts`. `solution.ts` is the reference answer, and the same tests
grade both — which is what keeps the answer and the tests honest.

## Hints

<details>
<summary>Hint 1 — unwrapDefault</summary>

```ts
if (mod !== null && (typeof mod === 'object' || typeof mod === 'function') && 'default' in mod) {
  return (mod as { readonly default: T }).default
}
return mod as T
```

Both casts are unavoidable: `MaybeDefault<T>` is a union, and narrowing a union by a property
check tells the compiler the property exists without telling it which arm you are in.

</details>

<details>
<summary>Hint 2 — the two static imports</summary>

`legacy-config.cjs` gives you named imports for the shorthand properties:

```ts
import { load as loadLegacy, describe as describeLegacy } from './legacy-config.cjs'
```

`single-export.cjs` is `export =` a function, so the **default** import is the function.
`import * as slugify` would give you a namespace object, which is not callable.

</details>

<details>
<summary>Hint 3 — legacyVersion</summary>

A second import of the same module, this time the default one. `import legacyApi from
'./legacy-config.cjs'` is `module.exports`, and `version` is right there on it.

Two imports of one module is not a smell here — it is the point. One route is checked by the
lexer and one is not.

</details>

<details>
<summary>Hint 4 — loadConfigDynamically</summary>

```ts
const mod = await import('./legacy-config.cjs')
return unwrapDefault(mod).load(overrides)
```

Use `unwrapDefault` rather than `mod.default` even though both work today. When this module
is eventually converted to ESM there will be no `default` wrapper, and only one of those two
lines will still be correct.

</details>
