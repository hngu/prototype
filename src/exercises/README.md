# Exercises

Runnable solutions and unit tests for every coding exercise in the
[elearning](../elearning) courses. Every lesson that ends in a `Practice` card
renders its files from here, and links back to this directory on GitHub.

The point is verifiability. A TypeScript tutorial you cannot execute asks you to
take its word for things; this one ships the tests.

```bash
pnpm --filter exercises attempt     # grade your starter.ts — what a learner runs
pnpm --filter exercises verify      # manifest + typecheck + tests — what CI runs

pnpm --filter exercises manifest    # are the directories complete and claimed?
pnpm --filter exercises typecheck   # tsc --noEmit
pnpm --filter exercises test        # grade the reference solutions
```

`attempt` uses inline env-var syntax, which Windows `cmd` does not understand. The
portable form is `EXERCISE_TARGET=starter pnpm --filter exercises test` under any
POSIX shell, including Git Bash and WSL.

---

## Layout

One directory per exercise, named **exactly** after the lesson id — the site joins
the path straight from it, so there is no second string to keep in sync:

```
src/exercises/<course-id>/<lesson-slug>/
  README.md         the brief. H1 + intro + `## Goal` render on the lesson page;
                    `## Run it` and `## Hints` are GitHub-only
  starter.ts        what the learner edits. Stubs `throw new Error('TODO: …')`
  solution.ts       the reference answer
  solution.test.ts  one set of assertions, grading either file
```

Note the lesson *file* carries an `NN-` order prefix and the directory does not —
`01-type-inference.md` has id `typescript-fundamentals/type-inference`, and that
id is the directory name.

All four files are required. A directory missing one, a lesson with
`exercise: true` and no directory, or a directory no lesson renders all fail
`pnpm manifest` — in both directions, so an orphan cannot sit here quietly going
stale while CI stays green.

**Extra files are tolerated, and needed exactly once.** The manifest checks that the
four required files are *present*, not that nothing else is, so an exercise may add a
fifth. `typescript-functions-objects/symbols` does: `unique symbol` is TypeScript's
only nominal type, so `starter.ts` and `solution.ts` cannot each declare their own
keys — the API-parity check fails with TS2322, correctly, because they really would be
different keys. They share `keys.ts` instead. Note the lesson page only renders
`starter.ts`, `solution.ts` and `solution.test.ts`, so a fifth file needs explaining
in the brief; the "view on GitHub" link goes to the whole directory.

## The three invariants

1. **`manifest` is green, and never counts zero.**
2. **`typecheck` is green on a fresh clone.** Every stub body is
   `throw new Error('TODO: …')`, which satisfies any return type, so a learner
   never has to fight the toolchain before starting.
3. **`test` is green** (it grades `solution.ts`) and **`attempt` is red** until you
   implement `starter.ts`.

> **`node --test` exits 0 when it finds no test files** — and also when handed a
> path that does not exist. "Green" and "graded something" are therefore different
> facts, and `tools/check-manifest.ts` is the only thing that checks the second
> one. That is why `verify` runs `manifest` **first**. Do not simplify it out; a
> renamed directory would turn CI into a badge that certifies nothing.

## Writing an exercise

Write the exercise *before* the lesson prose. It is what forces you to be concrete
about what the lesson actually teaches.

- **The types in `starter.ts` are the contract**, not the puzzle. `solution.test.ts`
  asserts `typeof starter` and `typeof solution` are mutually assignable, so both
  files must expose the same API — which means the learner's work is the
  implementations. Say so in the brief.
- **Make type-level correctness observable.** A predicate should be *used* in a
  narrowing position inside the test, so the test only compiles if the signature is
  honest. See `typescript-fundamentals/type-inference/solution.test.ts`.
- **Assert behaviour, not implementation.** The learner's answer will not look like
  the reference one, and it does not need to.
- Put the interesting *why* in `solution.ts` comments. Learners read the solution;
  it is the last thing they see and the best place for the insight.

## The erasable-syntax rule

Node **deletes** types; it does not compile them. Anything needing code generation
parses fine and then fails at runtime, so `tsconfig.json` sets
**`erasableSyntaxOnly: true`** and **`verbatimModuleSyntax: true`** to move that
failure to authoring time, where it is a tsc error on the offending line.

| Not usable in exercise code | Why | Enforced by |
| --- | --- | --- |
| `enum Direction { Up }` | the object never exists at run time | `TS1294` |
| `namespace Foo {}` | same | `TS1294` |
| `constructor(private x: number)` | `x` is never assigned — a silent `undefined`, the worst failure mode | `TS1294` |
| `import Foo = require('…')`, `export =` | not valid ESM | `TS1294` |
| `import { SomeType }` unmarked | `does not provide an export named 'SomeType'` | `verbatimModuleSyntax` |
| decorators | need codegen | **nothing** — see below |
| `accessor x = 0` | V8 does not implement auto-accessors | **nothing** — see below |
| `.tsx` / JSX | not stripped at all | `include: ["**/*.ts"]` |

**Prose is unaffected.** Fenced ` ```ts ` blocks in a lesson are highlighted, never
executed, so the courses teach enums, decorators and parameter properties in full,
with real syntax. Only the code in *this* package avoids them, and several lessons
turn the constraint into the point: the enums lesson exercises replacing an `enum`
with `as const` + `keyof typeof`, and the namespaces lesson exercises converting one
to a module. Two lessons (decorators, JSX) get no exercise at all and say why on the
page.

Fully erasable and used freely: `abstract`, `implements`, `override`, generics,
`satisfies`, `#private` fields, and type-only everything.

### Three things the flag does not catch

**Decorators typecheck cleanly.** `erasableSyntaxOnly` has no opinion on them — verified
against tsc 6.0.3, which accepts a standard (Stage 3) decorator with no flags and reports
nothing. Node then refuses to parse the `@`: `SyntaxError: Invalid or unexpected token`.
So this one is a convention rather than a gate, and the reason the decorators lesson has no
exercise at all.

**`accessor x = 0` typechecks and then will not parse.** Auto-accessors are a JavaScript
proposal rather than TypeScript syntax, so the flag has nothing to say and `tsc --noEmit`
is silent — but V8 in Node 24.9 rejects the keyword with `SyntaxError: Unexpected
identifier`, which is a confusing way to find out. Prose only, like decorators.

**`declare` on a class field is legal here, and it runs correctly.** Checked against
tsc 6.0.3 and Node 24.9: it is not `TS1294`, Node erases the whole declaration, and an
inherited value survives. It is on this list only because its hazard is a different
kind — `declare` is a *promise* that something assigns the field, unchecked, exactly
like a type assertion. Nothing warns you when the promise is broken and you read
`undefined`. Use it when something outside the constructor really does the assigning,
and prefer deleting the redundant declaration when the base class already assigns.

## Notes

- **`@types/node` is pinned exactly**, to the version already in the workspace
  lockfile. The root `pnpm-workspace.yaml` sets `minimumReleaseAge: 10080`, and a
  range would let a re-resolve pick a different aged version — bumping
  `src/frontend` as a side effect. It is the only dependency here besides the
  compiler.
- **`typescript` matches `src/elearning` byte for byte.** `tools/parity.test.ts`
  enforces that, plus agreement with the `TYPESCRIPT_VERSION` the site displays.
  Without it the lesson pages could advertise a compiler the exercises were never
  graded with.
- **No linter here.** Exercise code is teaching material, and a linter objecting to
  a deliberately naive implementation is a net negative. CI lints the site.
- **`astro dev` does not watch this directory.** Vite's watcher covers the Astro
  project root only, so after editing an exercise you need to touch the lesson `.md`
  or restart the dev server.
