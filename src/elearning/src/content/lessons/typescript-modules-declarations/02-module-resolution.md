---
title: How the compiler finds things
course: typescript-modules-declarations
order: 2
summary: "Module resolution is the compiler answering one question — which file is `./thing`? — and it answers it differently depending on four settings. You will be able to read a resolution error, choose between `nodenext` and `bundler`, and explain why the file extension stopped being optional."
duration: 12
exercise: false
draft: false
---

You ask someone to fetch the blue folder. They come back and say there isn't one. There are three, and
one of them is more green, and the one you meant is in a different building.

`Cannot find module './thing'` is that conversation. This lesson is about the search they were actually
doing.

## Two questions, not one

Every import raises two separate questions, and keeping them apart is most of the skill:

1. **Which file does this specifier name?** — resolution. Answered by `moduleResolution`, and it depends
   on where the importing file is, what its `package.json` says, and what is on disk.
2. **What module syntax will the output use?** — emit. Answered by `module`.

They interact, which is why they are usually set together. In 2026 there are only two combinations worth
choosing between:

```jsonc
// Code that Node runs, directly or after tsc
{ "module": "nodenext", "moduleResolution": "nodenext" }

// Code a bundler owns — Vite, esbuild, webpack
{ "module": "preserve", "moduleResolution": "bundler" }
```

Everything else — `node10`, `classic`, `commonjs` with `node` resolution — exists for projects older than
the choice. If you are starting today, the question is only ever "does Node resolve this, or does a
bundler?"

The difference that bites is strictness. `bundler` allows extensionless relative imports, because bundlers
guess. `nodenext` does not, because Node does not guess. So `moduleResolution: "bundler"` in a project Node
actually runs is the setup that typechecks perfectly and then throws `ERR_MODULE_NOT_FOUND` at run time —
the compiler was answering a question about a world you are not living in.

```quiz
id: typescript-modules-declarations-module-resolution-q1
q: A project sets `moduleResolution: "bundler"` but its output is run directly by Node. What is the likely symptom?
- [x] `tsc` is happy and Node fails at run time with `ERR_MODULE_NOT_FOUND`
- [ ] `tsc` reports missing modules that exist
- [ ] Types resolve but values do not, so every import is `undefined`
- [ ] Nothing — the two settings describe the same search
explain: `bundler` permits extensionless relative specifiers because a bundler will resolve them; Node requires the extension and refuses. So the mismatch is invisible until run time, which is the worst place to find it. This is the single most common module-resolution misconfiguration, and `nodenext` is the setting that makes the compiler model the runtime honestly.
```

## Why the extension came back

`import './money'` was normal for a decade, and under ESM on Node it is an error. That feels like a
regression until you see what it bought.

CommonJS `require('./money')` did a filesystem search: try `money.js`, then `money.json`, then
`money/index.js`, and so on. That is several stat calls per import, and it cannot be done at all without a
synchronous filesystem — which a browser does not have. ESM specifiers are **URLs**, resolved by string
manipulation, so `./money.js` is one unambiguous answer and the same algorithm works over HTTP.

Which produces the wrinkle everyone hits. In a `.ts` file compiled to `.js`, you write the **output**
extension:

```ts
import { money } from './money.js' // yes — even though the file on disk is money.ts
```

That looks wrong and is right: the specifier survives into the emitted JavaScript untouched, and by then
the file next door really is `money.js`. TypeScript has never rewritten specifiers, deliberately — doing so
would make it a bundler.

Two escapes exist. `allowImportingTsExtensions` lets you write `./money.ts`, and is only for projects that
never emit — this course's exercises use it, because Node runs the `.ts` files directly and there is no
output step to think about. And `rewriteRelativeImportExtensions` (TypeScript 5.7+) makes tsc rewrite
`.ts` → `.js` on the way out, for people who find the `.js` convention intolerable.

```quiz
id: typescript-modules-declarations-module-resolution-q2
q: You are writing `src/invoice.ts`, which imports from `src/money.ts`, and `tsc` emits JavaScript. What specifier goes in the import?
- [x] `'./money.js'` — the extension describes the emitted file, not the source
- [ ] `'./money.ts'` — always name the file that exists
- [ ] `'./money'` — TypeScript adds the extension when it emits
- [ ] `'./money.mjs'` — ESM output always uses `.mjs`
explain: TypeScript copies specifiers into the output verbatim, so the string has to be correct *there* — and there, the neighbour is `money.js`. `'./money.ts'` needs `allowImportingTsExtensions`, which is restricted to `noEmit` projects precisely because the specifier would otherwise be wrong in the output. The `.mjs` option is a real extension but not a general rule; it is how you mark a single ESM file inside a CommonJS package.
```

## What `package.json` decides

For a bare specifier — `import { z } from 'zod'` — the search walks up through `node_modules`
directories, and then the package's own `package.json` decides what you get. The modern field is
`exports`:

```jsonc
{
  "name": "acme",
  "type": "module",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./config": { "types": "./dist/config.d.ts", "import": "./dist/config.js" }
  }
}
```

Two consequences worth knowing. `exports` is an **allowlist**: once present, `import 'acme/internal/thing'`
fails even though the file is right there, which is a feature — a package can finally have private files.
And **`types` must come first** in each condition object; conditions are matched in order, so a `types` key
after `import` is never reached.

The other field that changes everything is one line: `"type": "module"` makes every `.js` in the package
ESM. Without it they are CommonJS. The per-file overrides are `.mts`/`.mjs` (always ESM) and `.cts`/`.cjs`
(always CommonJS), which is how you put one file of the other dialect in a package without a second
`package.json`.

Then there is `moduleResolution: "nodenext"`'s most-complained-about behaviour: **`.d.ts` files resolve
according to where they sit, not who imports them.** A declaration file in a folder with no
`"type": "module"` is treated as CommonJS, so its `import` statements mean something different than the
author intended. When a package's types work under `node10` and break under `nodenext`, this is usually
why — and `arethetypeswrong.net` exists specifically to diagnose it.

Two flags help when a real project fights you. `traceResolution: true` prints every path the compiler
tried, which turns "cannot find module" into a list of places it looked. And `paths` remaps specifiers for
the **compiler only** — it does not affect the runtime, so a `paths` alias without a matching runtime alias
is the `bundler`-versus-`nodenext` mistake wearing a different hat.

```quiz
id: typescript-modules-declarations-module-resolution-q3
q: A package's `package.json` has `"exports": { ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" } }`. Consumers get `any`. Why?
- [x] Conditions match in order, so `import` is chosen first and `types` is never reached
- [ ] `types` is not a valid condition inside `exports`
- [ ] The package also needs a top-level `"types"` field
- [ ] `.d.ts` files cannot be referenced from `exports`
explain: The conditions object is ordered and the first match wins, so `types` must be listed first — a genuine footgun, because the file paths are all correct and nothing warns you. A top-level `"types"` field does work as a fallback for older resolvers, which is worth including for compatibility, but it does not rescue a badly ordered `exports` map for a modern one.
```

## What to take away

- `moduleResolution` answers "which file is this?" and `module` answers "what syntax do I emit?" — set
  them together, and only `nodenext` or `bundler` are worth choosing in a new project.
- `bundler` resolution in a project Node runs is the classic misconfiguration: green typecheck, run-time
  `ERR_MODULE_NOT_FOUND`.
- ESM specifiers are URLs, so the extension is required and it describes the **emitted** file — `./money.js`
  from `money.ts` is correct, not a typo.
- In `exports`, put `types` first, and remember it is an allowlist: adding it makes every unlisted path
  private.
