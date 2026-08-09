---
title: Twelve switches that matter
course: typescript-tooling-config
order: 2
summary: "`tsconfig.json` has over a hundred options and about twelve change how you write code. You will be able to write one from scratch for a new project, explain what each line is for, and recognise the four settings that cause most of the confusion."
duration: 12
exercise: false
draft: false
---

A washing machine has thirty programmes. You use three. The other twenty-seven are not useless — somebody
washes curtains — they are just not decisions you make every day.

`tsconfig.json` is like that, except nobody tells you which three. This lesson is the shortlist.

## The whole file, annotated

Here is a `tsconfig.json` for a Node project in 2026. Every line is doing something:

```jsonc
{
  "compilerOptions": {
    /* What JavaScript may I emit, and what may I assume exists? */
    "target": "es2024",
    "lib": ["es2024"],

    /* How do imports resolve, and what syntax comes out? */
    "module": "nodenext",
    "moduleResolution": "nodenext",

    /* Am I checking, or also building? */
    "noEmit": true,

    /* The one that matters most. */
    "strict": true,
    "noUncheckedIndexedAccess": true,

    /* Single-file-transform safety. */
    "verbatimModuleSyntax": true,
    "isolatedModules": true,

    /* Speed and sanity. */
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

That is a complete, defensible config, and the four groups are worth thinking about separately.

**`target` and `lib` are different questions.** `target` is "what syntax may I emit" — it decides whether
`async/await` becomes a state machine or stays as written. `lib` is "what may I assume the runtime
provides" — the type declarations for `Array.prototype.at`, `structuredClone`, and so on. Setting `target`
gives you a matching `lib` by default, and you override `lib` when the two genuinely differ: a browser app
adds `"DOM"`, and a library targeting older runtimes may compile down while still assuming a polyfill
exists.

**`module` and `moduleResolution` were lesson 2 of the previous course.** The short version: `nodenext`
for code Node runs, `preserve` + `bundler` for code a bundler owns, and nothing else in a new project.

```quiz
id: typescript-tooling-config-tsconfig-tour-q1
q: What is the difference between `target` and `lib`?
- [x] `target` decides what syntax may be emitted; `lib` decides which runtime APIs the compiler believes exist
- [ ] `target` is for the browser and `lib` is for Node
- [ ] `lib` is a subset of `target`, for when you need fewer features
- [ ] They are aliases; setting either sets both
explain: One is about downlevelling output syntax, the other about which type declarations are loaded — so you can target ES2015 syntax while still assuming a `fetch` polyfill exists, which is exactly why they are separate. Setting `target` does give you a matching default `lib`, which is why they are so often confused, but it is a default rather than an equivalence.
```

## `include`, `exclude`, and the one that is not their opposite

`include` and `exclude` are globs, and `exclude` only removes things `include` picked up — it does not
stop a file being pulled in by an `import`. That surprises people: excluding `legacy/` does nothing if
`src/index.ts` imports from it, because the compiler follows imports regardless.

`files` is the third option, an explicit list rather than a glob, and it is for the rare project where
you want to name every entry point exactly.

Then there is `extends`, which is how a monorepo avoids repeating itself:

```jsonc
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "outDir": "./dist" } }
```

One gotcha worth knowing: relative paths in the *inherited* file resolve relative to that file, not to
yours. So a base config saying `"outDir": "./dist"` puts output next to the base config, which is almost
never what anyone wanted.

```quiz
id: typescript-tooling-config-tsconfig-tour-q2
q: You add `"exclude": ["legacy"]` but files under `legacy/` are still being type-checked. Why?
- [x] `exclude` only filters what `include` collected — an `import` still pulls a file in
- [ ] `exclude` needs a glob like `legacy/**/*`
- [ ] `exclude` is ignored when `include` is also present
- [ ] Excluded files are checked but not emitted
explain: The include/exclude globs decide the *root* set of files; the compiler then follows imports from those roots wherever they go, because it cannot check a file without checking what it depends on. To genuinely keep code out you have to stop importing it — or move it to its own project, which is what lesson 5 is about.
```

## The four that cause the most confusion

**`skipLibCheck: true`** — do not type-check inside `.d.ts` files. Almost everyone sets it, because one
badly typed dependency should not fail your build. The cost is real and worth stating: **a genuine error
in a declaration file will not be reported**, including in declarations you publish yourself. It is a
sensible default and not a free one.

**`allowJs` and `checkJs`** — the first lets `.js` files into the program, the second type-checks them.
These are for migrations, and turning `allowJs` on affects *every* file's resolution, so it is not a
per-directory decision. This site's exercises deliberately leave both off, which is why a declaration
file is required to describe a `.js` helper rather than the compiler just reading it.

**`paths`** — remaps specifiers **for the compiler only**. `"@app/*": ["src/*"]` makes `tsc` happy and
changes nothing at run time, so it needs a matching alias in your bundler or Node loader or you get the
classic green-typecheck-then-`ERR_MODULE_NOT_FOUND`. Node's own `imports` field in `package.json` (the
`#internal/thing` convention) is the version that actually works at run time, and is usually the better
tool.

**`types`** — restricts which `@types/*` packages are loaded globally. By default *every* package in
`node_modules/@types` is included, which is how a stray `@types/jest` starts declaring `describe` in a
project that uses Node's test runner. Setting `"types": ["node"]` fixes that class of mystery, and is
worth doing early.

```quiz
id: typescript-tooling-config-tsconfig-tour-q3
q: Your editor autocompletes a global `describe()` in a project that does not use Jest. What is the likely cause, and the fix?
- [x] Every package in `node_modules/@types` is loaded by default — set `"types": ["node"]` to restrict it
- [ ] A stale `.tsbuildinfo` file; delete it
- [ ] `skipLibCheck` is hiding a conflict; turn it off
- [ ] The editor is using a different TypeScript version from the project
explain: Global type packages are included wholesale unless `types` narrows the list, so a transitive `@types/jest` — pulled in by something else entirely — contributes its globals to your project. Restricting `types` is the fix and is worth setting deliberately rather than discovering. The editor-version answer causes real problems, but different ones: mismatched diagnostics rather than extra globals.
```

## What to take away

- Twelve options matter: `target`, `lib`, `module`, `moduleResolution`, `noEmit`, `strict`,
  `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `isolatedModules`, `skipLibCheck`,
  `forceConsistentCasingInFileNames`, and `include`.
- `target` is emitted syntax, `lib` is assumed APIs — related by default, not the same question.
- `exclude` filters the root set only; an `import` still pulls a file in, and `extends` resolves relative
  paths against the *inherited* file.
- `skipLibCheck` silences errors in declarations including your own; `paths` fools only the compiler; and
  `types` is what stops stray `@types` packages adding globals.
