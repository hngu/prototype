---
title: Checking only what changed
course: typescript-tooling-config
order: 5
summary: "Project references split one enormous typecheck into several that know how they depend on each other, so touching one package does not re-check the whole repository. You will be able to set them up, explain what `composite` requires, and judge whether you need them at all."
duration: 11
exercise: false
draft: false
---

A restaurant does not re-prep the entire kitchen because one order changed. It knows the sauce is already
made, and it knows which dishes use it.

A large TypeScript repository re-checks everything on every keystroke unless you tell it the same thing.
That is what project references are.

## The problem they solve

One `tsconfig.json` covering a hundred packages means every check is a check of all of them. Editing a leaf
package re-checks the root. Your editor gets slower in a way that feels like a mystery rather than a
consequence.

Project references cut the program into pieces with declared dependencies:

```jsonc
// packages/api/tsconfig.json
{
  "compilerOptions": {
    "composite": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*.ts"],
  "references": [{ "path": "../core" }]
}
```

`references` says "this project depends on that one". Then:

```bash
tsc --build            # build every referenced project, in order, skipping what is current
tsc --build --watch    # the same, staying resident
tsc --build --force    # ignore the up-to-date checks
tsc --build --clean    # delete the outputs
```

`--build` is a genuinely different mode from plain `tsc`. It reads the reference graph, topologically
sorts it, and skips any project whose inputs are older than its outputs. That skipping is the entire point.

The mechanism is worth understanding because it explains every constraint: **a referenced project is
consumed through its emitted `.d.ts` files, not its source.** `packages/api` importing from
`packages/core` type-checks against `core/dist/*.d.ts`. So `core` must have been built first, and the
compiler can check `api` while knowing nothing about `core`'s implementation.

```quiz
id: typescript-tooling-config-project-references-q1
q: How does one project consume a project it references?
- [x] Through the referenced project's emitted `.d.ts` files, which must be built first
- [ ] By reading its source files directly, as a single program
- [ ] Through the `paths` mapping in the root tsconfig
- [ ] By re-checking it in memory on every build
explain: Consuming declarations rather than source is what lets a project be skipped when nothing changed — its `.d.ts` is a stable summary that does not need recomputing. It also explains why `composite` forces `declaration: true`, and why a stale build produces confusing errors about types that look correct in the source you are reading.
```

## What `composite` forces on you

`composite: true` is the switch that makes a project referenceable, and it brings requirements. They are
not arbitrary — each one exists so the up-to-date check can be trusted.

- **`declaration: true`** is implied. Consumers need the `.d.ts`, so it has to be emitted.
- **Every input file must be matched by `include`/`files`.** No relying on imports to drag files in,
  because the file list has to be knowable without compiling.
- **`rootDir` becomes significant**, since output paths must be predictable.
- **`.tsbuildinfo` is written**, holding the fingerprints that let the next build skip work.

The failure mode to recognise: a **stale `.d.ts`**. You change `core`, forget to rebuild, and get errors in
`api` about types that look perfectly correct in the source in front of you. `tsc --build` handles this
when you use it; a bare `tsc` in a composite setup does not, which is why mixing the two commands in one
repository causes so much confusion.

The other thing worth knowing is that editors handle this well now. TypeScript's language server follows
project references and will jump to the *source* rather than the generated declaration, so the developer
experience is no longer the argument against.

```quiz
id: typescript-tooling-config-project-references-q2
q: Why does `composite: true` require every input file to be listed by `include` or `files`?
- [x] The file list must be knowable without compiling, so the up-to-date check can be computed
- [ ] Because `composite` disables module resolution
- [ ] To stop two projects claiming the same file
- [ ] Because `.tsbuildinfo` stores absolute paths
explain: Deciding whether a project needs rebuilding means comparing input timestamps to output timestamps, which requires knowing the inputs *before* doing any work — and discovering files by following imports would mean compiling first. It is a constraint that follows directly from the caching, which is the pattern with most of `composite`'s requirements.
```

## Whether you want them

This is a real decision rather than a best practice, and the honest answer for most projects is no.

**Reach for project references when** a single typecheck has become slow enough to notice, packages have
genuinely different compiler options, or you want the dependency graph *enforced* — a project can only
import from what it references, which is a real architectural boundary rather than a convention.

**Do not bother when** the repo checks in a few seconds, or when your build tool already handles the
splitting. This is the part that has changed: a Turborepo or Nx setup running `tsc --noEmit` per package
with its own caching gets most of the benefit with none of the `composite` requirements. And Bun and Deno
sidestep the question differently again.

There is a middle path that is often the right one: **`tsc --noEmit` per package, orchestrated by your task
runner, with no `composite` and no references.** You lose the enforced dependency graph and the
`.d.ts`-level caching, and you keep the ability to reason about your build.

One related flag, since this is where it belongs. `isolatedModules` guarantees every file can be
transformed on its own without consulting another — which is what makes esbuild, swc and Node's stripping
possible. It is a promise about your code rather than a build feature, and it is worth turning on
everywhere regardless of how you build, because it stops you writing the two things that break single-file
transforms: `const enum`, and re-exporting a type without `export type`.

```quiz
id: typescript-tooling-config-project-references-q3
q: In 2026, what is the most common reason a monorepo does *not* need project references?
- [x] A task runner already caches per-package `tsc --noEmit`, giving most of the benefit without `composite`
- [ ] Project references were deprecated in TypeScript 5
- [ ] Modern editors cannot follow project references
- [ ] `isolatedModules` replaces them
explain: Per-package checks orchestrated and cached by Turborepo, Nx or similar cover the incremental-work problem without any of `composite`'s constraints, which is why references are now a narrower tool than they were. They are not deprecated and editors follow them well; `isolatedModules` is a promise about individual files and solves a different problem entirely.
```

## What to take away

- Project references split one program into several with declared dependencies, consumed through emitted
  `.d.ts` files — which is what makes skipping unchanged projects possible.
- `composite: true` implies `declaration: true` and requires a fully enumerated file list, because the
  up-to-date check must be computable before any work happens.
- `tsc --build` is a distinct mode; mixing it with bare `tsc` in the same repo produces stale-declaration
  errors that look like nonsense.
- Most repos are better served by per-package `tsc --noEmit` under a caching task runner. Turn on
  `isolatedModules` either way.
