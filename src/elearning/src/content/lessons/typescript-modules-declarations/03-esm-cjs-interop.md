---
title: Two dialects, one phrasebook
course: typescript-modules-declarations
order: 3
summary: "CommonJS and ESM are two ways of saying the same thing, and the seam between them is where a green typecheck can still fail at load time. You will be able to read either dialect, choose an import form that survives a package you do not control, and explain what `esModuleInterop` actually does."
duration: 12
exercise: true
draft: false
---

Two people describe the same building. One starts at the front door, one at the car park. Both accounts
are correct, and neither can be followed by someone holding the other.

JavaScript has two module systems for historical reasons, and they will both be here for the rest of your
career. This lesson is the phrasebook.

## The older dialect

CommonJS came from Node in 2009, years before JavaScript had modules of its own:

```js
const { readFile } = require('node:fs')

function load(overrides) {
  /* … */
}

module.exports = { load, version: '1.4.2' }
```

Two things about it are worth naming precisely, because every difference that follows comes from them.

`require()` is **a function call**, so it happens when that line runs. You can call it inside an `if`,
build the specifier from a variable, or call it halfway down a function. And `module.exports` is **an
ordinary object you mutate**, so what a module exports is only settled once its code has finished running.

ESM inverted both:

```ts
import { readFile } from 'node:fs'
export function load(overrides: Overrides): Config {}
```

`import` and `export` are **declarations**, not statements. They are found by parsing, before a line of
the module runs. That is what makes tree-shaking, cyclic imports and top-level `await` work — the shape of
the module graph is known before execution — and it is also the source of every incompatibility, because a
static declaration cannot describe an object that is still being assembled.

```quiz
id: typescript-modules-declarations-esm-cjs-interop-q1
q: What is the fundamental difference that causes ESM/CJS interop problems?
- [x] CommonJS exports are decided while the module runs; ESM exports are known from parsing it
- [ ] CommonJS is synchronous and ESM is asynchronous
- [ ] ESM supports types and CommonJS does not
- [ ] CommonJS uses `module.exports` and ESM uses `export`, which are different keywords
explain: A static `import` has to know what a module exports before that module executes, and `module.exports` is not settled until it has. Everything else — the lexer, the `default` wrapper, why `require` of an ESM module was impossible for years — follows from that one mismatch. The synchrony difference is real but secondary, and the last option describes the syntax rather than the reason it matters.
```

## Going one way: an ESM file importing CommonJS

This mostly works, and the way it works is worth knowing because of how it fails.

The **default** import of a CommonJS module is `module.exports` itself:

```ts
import legacy from './legacy-config.cjs' // the whole exports object
```

**Named** imports also work, which is surprising given what we just said. Node manages it by running a
tool called `cjs-module-lexer` over the file *before* executing it, statically detecting which properties
get assigned to `module.exports`. When that detection succeeds you get real named imports.

When it fails, you get this — and it is the most instructive failure in the whole topic:

```js
// legacy-config.cjs
module.exports = { DEFAULTS, load, describe, version: '1.4.2' }
```

```ts
import { version } from './legacy-config.cjs'
// tsc: fine. The .d.cts declares `version`, and the property really does exist.
```

```text
SyntaxError: Named export 'version' not found. The requested module './legacy-config.cjs'
is a CommonJS module, which may not support all module.exports as named exports.
```

`load` and `describe` survive as named imports; `version` does not. The difference is that the first two
are **shorthand** properties whose values are identifiers the lexer can follow, and `version`'s value is
a string literal. Nothing is wrong with the declaration file, nothing is wrong with the module, and the
compiler has no way to know.

Which produces the one rule worth memorising from this lesson: **for a CommonJS package you do not
control, prefer the default import.** It is `module.exports`, whole, with no static analysis involved.

```quiz
id: typescript-modules-declarations-esm-cjs-interop-q2
q: `import { version } from './legacy.cjs'` typechecks and then Node throws `Named export 'version' not found`. What is wrong?
- [x] Nothing is wrong — Node's lexer could not statically detect that property, so the named export does not exist
- [ ] The declaration file is inaccurate and should not list `version`
- [ ] `.cjs` files cannot be imported with named imports at all
- [ ] The import needs `assert { type: 'commonjs' }`
explain: The property genuinely exists on `module.exports`, so the declaration file is telling the truth — the named export is a convenience Node synthesises when it can see the assignment, and here it could not. Named imports from CommonJS do generally work, which is exactly what makes this trap sharp: it works for three properties in the same object literal and not the fourth.
```

## Going the other way, and what `esModuleInterop` is for

A CommonJS file `require()`-ing an ESM one was impossible for years, because `require` is synchronous and
ESM may contain top-level `await`. Node 22 added `require(esm)` for modules that have none, which quietly
removed most of the pain — but it is recent, so plenty of tooling still assumes the old rule.

That leaves the transpiler-shaped half of the problem. When TypeScript or Babel turns ESM into CommonJS,
`export default x` becomes `exports.default = x`. So a transpiled module and a hand-written one look
different from the outside, and importing either needed a different spelling. `esModuleInterop` — on by
default under `module: nodenext` — fixes that by generating a small helper at each import site:

```js
function _interopRequireDefault(mod) {
  return mod && mod.__esModule ? mod : { default: mod }
}
```

A hand-written CommonJS module gets wrapped so its `module.exports` appears as `default`; a transpiled one
is marked `__esModule` and passes through untouched. Either way, `import x from '…'` means the same thing.
The flag also stops you *calling* a namespace import, which is the other half of its job:

```ts
import * as slugify from './slugify.cjs'
slugify('text') // error: a namespace is not callable
import slugify from './slugify.cjs' // ✓
```

That second form is what `export = slugify` in a declaration file describes — and `export =` is the piece
of TypeScript that exists solely for this dialect, being the only way to say "`module.exports` **is** this
function". Note it is banned in ordinary code under `erasableSyntaxOnly`, because it cannot be erased, and
legal in a `.d.ts` because a declaration file emits nothing at all.

You will write this unwrapping by hand often enough to know it:

```ts
function unwrapDefault<T>(mod: T | { default: T }): T {
  if (mod !== null && (typeof mod === 'object' || typeof mod === 'function') && 'default' in mod) {
    return (mod as { default: T }).default
  }
  return mod
}
```

One layer, never two — a module whose default export is an object with a `default` key is a real thing, and
recursing corrupts it. And the guards matter: `'default' in null` throws a `TypeError` rather than
returning `false`.

```quiz
id: typescript-modules-declarations-esm-cjs-interop-q3
q: What does `esModuleInterop` do?
- [x] Wraps a CommonJS module's exports so its `module.exports` arrives as `default`, and forbids calling a namespace import
- [ ] Converts CommonJS modules to ESM before they are loaded
- [ ] Allows `require()` of an ESM module
- [ ] Adds `__esModule` to your own compiled output only
explain: It normalises the *import* side, so a hand-written CommonJS module and a transpiled ESM one can be imported the same way — plus the namespace-callability rule, which stops the workaround people used before the flag existed. It converts nothing and loads nothing; `require(esm)` is a Node 22 runtime feature and unrelated. It does also set `__esModule` on your output, but that is not the part that helps you consume other people's code.
```

## What to take away

- CommonJS decides its exports while it runs; ESM's are known from parsing. Every interop rule follows
  from that mismatch.
- Named imports from CommonJS depend on Node's lexer spotting the assignment, so they can typecheck and
  then fail at load time — prefer the default import for packages you do not control.
- `esModuleInterop` normalises the import side so hand-written and transpiled modules look the same, and
  stops you calling a namespace import.
- `export =` is the declaration-file spelling of `module.exports = fn`; unwrap a `default` one layer at a
  time, with guards, because `'default' in null` throws.
