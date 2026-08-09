---
title: One switch that flips eight
course: typescript-tooling-config
order: 3
summary: "`strict: true` turns on eight separate checks, and knowing what each one catches is the difference between keeping it and turning it back off. You will be able to explain every flag inside `strict`, decide which of the extras to add, and turn strictness on in an existing codebase without stopping work for a week."
duration: 12
exercise: true
draft: false
---

A car with no warning lights is not a reliable car. It is a car that has stopped telling you things.

`strict: true` is the dashboard. It is one line in `tsconfig.json` that turns on eight separate checks,
and people turn it off again because nobody told them which light was which.

## What `strict` actually contains

Eight flags, and they are worth knowing individually because they fail differently:

| Flag | Catches |
| --- | --- |
| `strictNullChecks` | reading a property off something that might be `null` |
| `noImplicitAny` | a parameter nobody gave a type, silently accepting anything |
| `strictFunctionTypes` | passing a handler that accepts less than the caller will send |
| `strictBindCallApply` | `fn.call(this, wrong, args)` |
| `strictPropertyInitialization` | a class field the constructor never assigns |
| `useUnknownInCatchVariables` | assuming a thrown value is an `Error` |
| `noImplicitThis` | a function using `this` where `this` is unknown |
| `alwaysStrict` | emitting non-strict-mode JavaScript |

**`strictNullChecks` is the one that matters.** Without it, `null` and `undefined` are members of every
type, so `user.name.toUpperCase()` compiles regardless of whether `user` exists — and the entire class of
bug TypeScript is best at preventing goes unprevented. If you adopt one flag, adopt this one; the other
seven are worth having and none of them is transformative on its own.

Two are worth a sentence each because they are less obvious. `useUnknownInCatchVariables` makes
`catch (error)` give you `unknown` rather than `any`, which matters because **anyone can `throw`
anything** — `throw 'nope'` is legal JavaScript, and code doing `error.message` on it throws a second
error on top of the first. And `strictFunctionTypes` catches the callback whose parameter is *narrower*
than what will be passed to it, which is the one variance rule that genuinely bites in practice.

```quiz
id: typescript-tooling-config-strictness-flags-q1
q: If you could only enable one flag from `strict`, which buys the most?
- [x] `strictNullChecks` — without it `null` and `undefined` are members of every type
- [ ] `noImplicitAny`, because untyped parameters defeat everything downstream
- [ ] `strictPropertyInitialization`, because unassigned fields fail at run time
- [ ] `alwaysStrict`, because strict-mode JavaScript catches more at run time
explain: Without `strictNullChecks` every type silently includes `null` and `undefined`, so the compiler cannot warn about the single most common run-time failure in JavaScript — and no other flag compensates. `noImplicitAny` is a good second: it stops holes appearing, but a fully annotated codebase without `strictNullChecks` is still blind to absence.
```

## The extras worth adding

`strict` is a floor, not a ceiling. Four more flags are worth considering, and they are genuinely
different propositions:

**`noUncheckedIndexedAccess`** — makes `array[0]` and `record[key]` return `T | undefined`. This one has
real friction: `split('\n')[0]` becomes possibly-`undefined` even though it never is. It is still worth
it, because the same rule applied to a genuinely empty array catches real bugs, and the fix is a `??`
rather than a redesign. It is on in this course's exercises.

**`noImplicitOverride`** — requires `override` on any method replacing a concrete inherited one. Cheap,
and it catches the expensive rename: change a base method's name and, without this, every subclass
override silently becomes a method nobody calls.

**`noFallthroughCasesInSwitch`** — catches a missing `break` or `return`. Almost free.

**`exactOptionalPropertyTypes`** — distinguishes `{ a?: string }` from `{ a?: string | undefined }`. With
it on, `{ a: undefined }` is no longer assignable to the first, because "absent" and "present and
undefined" become different states. It is *correct*, and it is the one with a real adoption cost, because
a great deal of existing code — and a great deal of `@types` — was written assuming the two are the same.

This site's own exercises make a good illustration. Turning `exactOptionalPropertyTypes` on produces
exactly **three** errors across thirty-five exercises, and all three are in tests that deliberately pass
`{ name: undefined }` to an optional property — because that is the distinction two of the lessons are
teaching. The flag would break content whose purpose is explaining what the flag changes. So it stays
off, and that is the honest shape of this decision: a strictness flag's cost is measured in real files,
not in principle.

```quiz
id: typescript-tooling-config-strictness-flags-q2
q: With `exactOptionalPropertyTypes: true`, is `{ a: undefined }` assignable to `{ a?: string }`?
- [x] No — "absent" and "present but undefined" become different states
- [ ] Yes, since `undefined` is what an absent property reads as
- [ ] Only if the target is `{ a?: string | undefined }`, which is the same type
- [ ] Only when the object is a fresh literal
explain: That distinction is the entire flag: `a?: string` means the key may be missing, and if present it is a `string`. To allow an explicit `undefined` you have to write `a?: string | undefined`, which under this flag is genuinely a different type rather than a longer spelling of the same one. It matters most for code doing `'a' in obj` or `Object.keys`, where absent and undefined behave differently at run time too.
```

## Turning it on in a codebase that is already large

The advice that does not work: flip `strict: true`, see four thousand errors, turn it off again. Two
approaches that do.

**One flag at a time.** `strict` is eight flags, so enable them individually, fix, commit, repeat.
`strictNullChecks` will be most of the work and is best done last, after the others have cleaned up the
easy noise.

**Strict for new files only.** Set `strict: true` at the root and add `// @ts-nocheck` to the files that
do not comply yet, or keep a second `tsconfig.strict.json` with a growing `include` list that CI also
runs. Either way the number of unchecked files only goes down, and nobody has to stop shipping.

Two things to know while doing it. `// @ts-expect-error` is better than `// @ts-ignore` everywhere,
because it *fails* when the error goes away — so your suppressions clean themselves up instead of
outliving the bug. And `strict` in `tsconfig.json` is not the same as the `"use strict"` directive in
JavaScript; `alwaysStrict` is the flag about that, and the naming overlap is unfortunate.

The mindset that makes this bearable: each of these flags is a **question the compiler is asking**, not a
rule it is imposing. `noUncheckedIndexedAccess` asks whether that index is really in range. Answering
with `??` is answering; answering with `!` is telling it to stop asking, which is occasionally right and
is how you end up back where you started.

```quiz
id: typescript-tooling-config-strictness-flags-q3
q: Why prefer `// @ts-expect-error` to `// @ts-ignore` when suppressing an error during a migration?
- [x] It errors when the line stops erroring, so the suppression cleans itself up
- [ ] It suppresses fewer kinds of error, so it is more precise
- [ ] It is required by `strict`
- [ ] It reports the suppressed error as a warning rather than hiding it
explain: `@ts-expect-error` asserts that the next line *does* have an error, so fixing the underlying problem turns the suppression itself into a failure and prompts its removal. `@ts-ignore` is silent forever and accumulates. Both suppress the same set of errors and neither reports anything — the difference is entirely about what happens when the code gets better.
```

## What to take away

- `strict` is eight flags; `strictNullChecks` is the one that changes what TypeScript can do for you, and
  the rest are worth having individually.
- Add `noUncheckedIndexedAccess`, `noImplicitOverride` and `noFallthroughCasesInSwitch` on top —
  `exactOptionalPropertyTypes` is correct and has a genuine adoption cost.
- Adopt one flag at a time, or strict-for-new-files, and prefer `@ts-expect-error` so suppressions expire
  by themselves.
- Every flag is a question rather than a rule. `??` answers it; `!` tells the compiler to stop asking.
