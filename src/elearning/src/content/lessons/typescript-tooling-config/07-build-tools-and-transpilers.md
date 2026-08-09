---
title: Who removes your types
course: typescript-tooling-config
order: 7
summary: "In almost every modern project the tool that removes your types is not the tool that checks them, and it never looks at them. You will be able to name what strips your code, explain why \"but it compiled\" is sometimes false, and set up a project where checking and building are separate jobs on purpose."
duration: 11
exercise: false
draft: false
---

Two people work on the letter. One reads it for mistakes. The other retypes it neatly and posts it.

If the second one never talks to the first, the letter goes out with the mistakes in it. That is the shape
of almost every TypeScript build in 2026, and it explains a whole category of bug that otherwise looks
impossible.

## The split

Once upon a time `tsc` did both jobs. Now the work is almost always divided:

| Tool | Checks types? | Removes types |
| --- | --- | --- |
| `tsc` | **yes** | yes |
| esbuild / Vite | no | erases per file |
| swc / Next.js / Rspack | no | erases per file |
| Babel + preset-typescript | no | erases per file |
| Node's built-in stripping | no | erases per file |
| Bun, Deno | no | erases per file |

Everything in that table except `tsc` throws your types away **without reading them**. They are far
faster for exactly that reason: no type graph, no cross-file analysis, one file at a time.

The consequence is the sentence worth taking from this whole course: **your build succeeding says nothing
about your types being correct.** A file full of type errors bundles perfectly and ships. "But it
compiled" is not evidence of anything unless the thing that compiled it was `tsc`.

So a modern project runs two commands, and both belong in CI:

```jsonc
{
  "scripts": {
    "check": "tsc --noEmit",
    "build": "vite build"
  }
}
```

This site's own repository does exactly that, and its exercises package does the same thing one level
down: `tsc --noEmit` for checking, `node --test` for running, and the running never checks anything. That
is why `verify` runs both.

```quiz
id: typescript-tooling-config-build-tools-and-transpilers-q1
q: Your Vite build succeeds. What does that tell you about your types?
- [x] Nothing — esbuild strips types without reading them
- [ ] That they are valid, since the build would fail otherwise
- [ ] That they are valid in the files that were bundled
- [ ] That they are valid unless `strict` is on
explain: esbuild removes type syntax without any type analysis, which is precisely why it is fast — so a file full of errors bundles happily. This is the single most important consequence of the checking/building split, and it is why `tsc --noEmit` has to be a separate CI step rather than something you assume the bundler covers.
```

## What single-file transforms cannot do

A tool erasing one file at a time cannot know anything about another file, and that has consequences you
have to write your code around. Three flags exist to make those consequences visible at authoring time
rather than at run time:

**`isolatedModules`** — rejects the constructs that need cross-file knowledge. `const enum` is the main
one: inlining `Level.Debug` as `0` means reading the file that declared it.

**`verbatimModuleSyntax`** — makes imports and exports emit exactly as written, so you must say
`import type`. A stripper cannot tell a type import from a value import, so an unmarked one survives and
throws `does not provide an export named …` at run time.

**`erasableSyntaxOnly`** — rejects `enum`, `namespace`, parameter properties and `export =`. Lesson 4.

Turn all three on in any project that is not built by `tsc`. They cost nothing and they convert a class of
run-time failure into a compile error.

There is one more consequence worth knowing, because it is genuinely surprising. **A single-file transform
cannot emit declaration files.** Producing a `.d.ts` requires resolving types across the whole program,
which is the thing these tools deliberately do not do. So a library still needs `tsc` — or a wrapper like
`tsup`, `unbuild` or `vite-plugin-dts`, all of which call `tsc` underneath for exactly this step. If you
publish a package, `tsc` is in your build whether you see it or not.

```quiz
id: typescript-tooling-config-build-tools-and-transpilers-q2
q: Why can esbuild not generate `.d.ts` files for your library?
- [x] Emitting declarations requires whole-program type resolution, which it deliberately does not do
- [ ] Because declaration files are a TypeScript-only format
- [ ] Because it would require `composite: true`
- [ ] It can, with the `--declaration` flag
explain: A declaration file states the resolved public types of a module, which means following types across every file that contributes to them — the exact cross-file analysis a single-file transform skips in order to be fast. That is why `tsup` and friends shell out to `tsc` for the declarations while using esbuild for the JavaScript.
```

## Choosing, and the version question

The choice is simpler than the number of options suggests. **Something fast for building, `tsc --noEmit`
for checking**, and the fast thing is usually whatever your framework already ships — Vite's esbuild, Next's
swc, Bun's own transpiler. Reaching for Babel now really only makes sense when you need a plugin nothing
else has, or you are already deep in a Babel pipeline; `@babel/preset-typescript` erases types per file
like the others, and needs `isolatedModules` for the same reasons.

Two smaller settings that come up constantly. `target` in `tsconfig.json` does not control your bundler's
output target — esbuild and swc have their own, and if the two disagree the bundler wins. And source maps
have to be enabled in **both** places to survive to production, which is why a stack trace sometimes names
a `.js` line despite `sourceMap: true` in your tsconfig.

On versions: **pin TypeScript exactly, not with a range.** Minor releases add checks, so `~5.9.0` can make
CI fail on an untouched codebase — a genuine surprise rather than a theoretical one. This repository pins
it and stores the pinned version in code, with a build-time assertion that the installed compiler matches
what the lessons were written against. Nightly builds (`typescript@next`) are worth knowing about for
testing an upcoming release against your codebase, and are not worth being on.

The rule underneath all of it, and the note to end the course on: **know which tool is making each
promise.** `tsc` promises your types are consistent. The bundler promises the output runs. Node promises
nothing about types at all. Every confusing build problem in this area is somebody expecting a guarantee
from a tool that never offered it.

```quiz
id: typescript-tooling-config-build-tools-and-transpilers-q3
q: Why pin TypeScript to an exact version rather than a caret or tilde range?
- [x] Minor releases add new checks, so a range can fail CI on code nobody touched
- [ ] TypeScript does not follow semantic versioning at all
- [ ] Ranges break `skipLibCheck`
- [ ] Because `@types` packages require an exact match
explain: New minor versions legitimately report errors the previous one did not, which under a range means an unrelated dependency update turning a green build red. Pinning makes the compiler upgrade a deliberate commit with its own diff. TypeScript's versioning is well documented and consistent; it simply does not treat new checks as breaking, which is reasonable and is why the pin is on you.
```

## What to take away

- In almost every modern project the tool that removes your types never reads them, so a successful build
  says nothing about type correctness — `tsc --noEmit` must be its own CI step.
- Single-file transforms need `isolatedModules`, `verbatimModuleSyntax` and `erasableSyntaxOnly` to make
  their limitations visible at authoring time.
- They cannot emit `.d.ts` files, so any published library has `tsc` in its build somewhere, whether or not
  you invoke it yourself.
- Pin TypeScript exactly. And whenever a build behaves impossibly, ask which tool was supposed to be making
  the promise you are relying on.
