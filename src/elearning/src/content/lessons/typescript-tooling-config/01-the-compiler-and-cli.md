---
title: Meet the compiler
course: typescript-tooling-config
order: 1
summary: "`tsc` does two jobs that are worth thinking about separately: checking your types and writing JavaScript, and you will often want only the first. You will be able to run it usefully from a terminal, read its output, and explain why `tsc --noEmit` is the command most projects actually need."
duration: 10
exercise: false
draft: false
---

A spellchecker reads your letter and circles the mistakes. A typewriter produces the letter. It happens
that TypeScript ships both in one program, and most of the confusion about `tsc` comes from not noticing
they are separate jobs.

This course is about the settings. It starts with the tool they configure.

## Two jobs in one command

`tsc` type-checks, and `tsc` emits JavaScript. You almost always want the first, and in 2026 you very
often do not want the second — because a bundler, or Node itself, is already removing your types faster
than `tsc` can.

Which makes this the most useful invocation in the whole course:

```bash
tsc --noEmit
```

Check everything, write nothing. That is what belongs in CI, and it is what `pnpm --filter exercises
typecheck` runs in this repo. When people say "TypeScript is slow", they usually mean they are asking it
to emit files somebody else is going to emit anyway.

The handful of other invocations worth knowing:

```bash
tsc                    # check and emit, using ./tsconfig.json
tsc --watch            # stay running, re-check on save
tsc -p packages/api    # use a specific project's tsconfig
tsc --build            # project references mode — see lesson 5
tsc --init             # write a commented starter tsconfig
tsc file.ts            # ← the trap: ignores tsconfig.json entirely
```

That last one catches everybody once. **Naming files on the command line makes `tsc` ignore your
`tsconfig.json` completely** — no `strict`, no `paths`, none of it. The result is a wall of errors that
have nothing to do with your code, or worse, silence where there should be errors. Use `-p` and let the
config choose the files.

```quiz
id: typescript-tooling-config-the-compiler-and-cli-q1
q: You run `tsc src/index.ts` and get errors you do not get from `tsc`. Why?
- [x] Naming files on the command line makes `tsc` ignore `tsconfig.json` entirely
- [ ] `tsc` only reads `tsconfig.json` in watch mode
- [ ] The file list in `tsconfig.json` conflicts with the argument
- [ ] Command-line invocations default to `strict: true`
explain: File arguments and `tsconfig.json` are mutually exclusive — supplying the former discards the latter, including every compiler option in it. So you are compiling with defaults, which have no `strict`, no `paths` and no `lib` choices. It is a genuine design wart, and `-p` is the answer whenever you want to point at a particular project.
```

## Reading what it tells you

A `tsc` error has four parts, and knowing they are separable makes them much less alarming:

```text
src/invoice.ts(42,16): error TS2345: Argument of type 'string | undefined'
  is not assignable to parameter of type 'string'.
```

File and position, then a **stable error code**, then the message. The code is the useful part: `TS2345`
is always "argument not assignable", and searching the code rather than the message skips past everyone
whose variables happened to be named differently from yours.

Two flags change how much you are told. `--pretty` (on by default in a terminal) draws the source excerpt
with a caret; turn it off in CI where the colour codes just clutter the log. And when an error is about
resolution rather than types, `--traceResolution` prints every path the compiler tried, which turns
"cannot find module" into a list of places it looked.

There is one number worth knowing about `--watch`: it is fast because it keeps the whole program in
memory and re-checks only what changed. A cold `tsc` on a large project re-reads every `.d.ts` in
`node_modules`, which is why the first run is so much slower than the tenth and why `--watch` is not
merely a convenience.

```quiz
id: typescript-tooling-config-the-compiler-and-cli-q2
q: Which part of a `tsc` error message is the most useful thing to search for?
- [x] The error code, like `TS2345` — it is stable and identifies the diagnostic exactly
- [ ] The full message text, since it describes your specific problem
- [ ] The file and line number
- [ ] The type names involved
explain: Error codes are stable across releases and identical for everyone hitting the same diagnostic, so they find explanations rather than other people's variable names. The message text is worth reading and poor for searching, precisely because it is interpolated with types specific to your code.
```

## What it writes, when you let it

Four things, controlled by four options that are worth knowing as a set:

| Option | Produces |
| --- | --- |
| `outDir` | where the `.js` goes |
| `declaration` | `.d.ts` files, so consumers get types |
| `declarationMap` | `.d.ts.map`, so *go to definition* lands in your source |
| `sourceMap` | `.js.map`, so a stack trace names your `.ts` line |

If you publish a library, you want all four. If you are building an app that a bundler will handle, you
may want none of them — and `noEmit: true` in the config says so permanently rather than relying on
everyone remembering the flag.

One thing `tsc` will never do, deliberately: **it does not bundle, and it does not rewrite your import
specifiers.** `import './money.js'` stays exactly that in the output. This surprises people constantly
and it is the right call — a compiler that rewrote module paths would be making decisions that belong to
whatever loads the result.

Two smaller mechanisms worth a mention now and a lesson later. `tsc --build` is a different mode
entirely, for project references (lesson 5). And `incremental: true` writes a `.tsbuildinfo` file so the
next run can skip what has not changed (lesson 6).

```quiz
id: typescript-tooling-config-the-compiler-and-cli-q3
q: Your library's consumers report that *go to definition* takes them into a `.d.ts` file rather than your source. What is missing?
- [x] `declarationMap: true`, which emits `.d.ts.map` alongside the declarations
- [ ] `sourceMap: true`
- [ ] `declaration: true` — the declarations are being inferred rather than emitted
- [ ] Nothing; jumping to `.d.ts` is the only possible behaviour
explain: `declarationMap` links each declaration back to the source that produced it, which is what lets an editor jump past the generated file. `sourceMap` does the analogous job for *runtime* stack traces, mapping emitted `.js` back to `.ts` — a different problem with a similarly named solution, which is why the two get mixed up.
```

## What to take away

- `tsc` checks and `tsc` emits, and those are separable jobs — `tsc --noEmit` is what most projects
  actually want in CI.
- Naming files on the command line discards `tsconfig.json` entirely. Use `-p`.
- Search the error **code**, not the message; the code is stable and the message is interpolated with
  your types.
- `declaration` plus `declarationMap` plus `sourceMap` is the publishing set; `tsc` never bundles and
  never rewrites an import specifier.
