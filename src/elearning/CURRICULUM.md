# TypeScript track — curriculum

**7 courses · 51 lessons · 39 exercises.** Derived from the official documentation at
<https://www.typescriptlang.org/docs/>.

> **Docs snapshot: 2026-08-08**, against the TypeScript **6.0** docs.
> Nothing automated re-checks the coverage matrix below — a page added upstream will
> not announce itself. **Re-walk it whenever `TYPESCRIPT_VERSION` is bumped** in
> `src/lib/typescript-version.ts`; a minor release is exactly when pages get added.

This file is three things at once:

1. **The state file.** Checkboxes per lesson and per exercise, so a course can be
   picked up months later without re-deriving where it stands.
2. **The coverage audit.** One row per docs page, mapped to the lesson that owns it.
   A page with no lesson is a visible hole rather than something you have to notice.
3. **The authoring spec.** The lesson template at the bottom, so courses 2–7 are
   mechanical rather than a fresh judgement call each time.

---

## Progress

| # | Course | id | Level | Lessons | Exercises | `draft` |
|---|---|---|---|---|---|---|
| 1 | TypeScript Fundamentals | `typescript-fundamentals` | beginner | 1 / 8 | 1 / 8 | `false` |
| 2 | Functions and Objects | `typescript-functions-objects` | beginner | 0 / 8 | 0 / 8 | `true` |
| 3 | Type Manipulation | `typescript-type-manipulation` | intermediate | 0 / 9 | 0 / 9 | `true` |
| 4 | Classes and Object-Oriented TypeScript | `typescript-classes` | intermediate | 0 / 6 | 0 / 5 | `true` |
| 5 | Modules and Declaration Files | `typescript-modules-declarations` | advanced | 0 / 8 | 0 / 5 | `true` |
| 6 | Tooling and Config | `typescript-tooling-config` | advanced | 0 / 7 | 0 / 2 | `true` |
| 7 | TypeScript in Practice | `typescript-in-practice` | intermediate | 0 / 5 | 0 / 2 | `true` |

**A course stays `draft: true` until every lesson in it is written and reviewed.**
Drafts are visible in `astro dev` and never built in production (`getPublishedCourses`
gates on `import.meta.env.DEV`), which is what makes it safe to ship from `main` at any
point mid-track.

`L` = lesson written · `E` = exercise written · `—` = no exercise, by design (reasons
in [Exercise gaps](#exercise-gaps))

---

## Course 1 — TypeScript Fundamentals

Existing lesson URLs are preserved. `order` and the `NN-` filename prefixes change,
which is free: `order` is authoritative and the prefix is stripped from the id.

| # | Slug | L | E | Docs source | ELI5 angle | Exercise |
|---|---|---|---|---|---|---|
| 1 | `what-typescript-does` | [ ] | [ ] | `typescript-from-scratch`, `typescript-in-5-minutes`, `2/basic-types` | A spellchecker for code. It reads your program before it runs, then steps out of the way — the types are not in the JavaScript that ships. | Fix three files so `tsc` goes quiet, without changing any runtime behaviour |
| 2 | `type-inference` | [ ] | [x] | `type-inference`, `variable-declarations` | TypeScript reads over your shoulder and writes the label for you. A `const` gets a laminated label; a `let` gets a whiteboard one. | **Pin a theme config** — `as const` tuple, readonly config, `isMode` predicate |
| 3 | `everyday-types` | [ ] | [ ] | `2/everyday-types` | The vocabulary list. Nine words cover most of the code you will ever write. | Type an untyped `parseOrder`; replace an `any` with a union |
| 4 | `narrowing` | [ ] | [ ] | `2/narrowing` | A union is a labelled box that might hold one of two things. Narrowing is looking inside before you reach in. | `describe(value: string \| number \| Date)` — one branch per member, no casts |
| 5 | `type-predicates` | [ ] | [ ] | `2/narrowing#using-type-predicates`, `#assertion-functions` | Teaching TypeScript a check it does not know yet, by signing your name to it. | `isNonEmptyString`, `isRecord`, and an `assertDefined` assertion function |
| 6 | `structural-typing` | [ ] | [ ] | `type-compatibility`, `typescript-in-5-minutes-oop`, `typescript-in-5-minutes-func` | Types are job descriptions, not name badges. If you can do the job, you are hired. | `greet(entity: { name: string })` plus a fixture satisfying three unrelated shapes |
| 7 | `any-unknown-never` | [ ] | [ ] | `2/everyday-types#any`, `2/narrowing#the-never-type`, `do-s-and-don-ts` | Three ways to say "I don't know": stop asking (`any`), ask me later (`unknown`), that cannot happen (`never`). | `parseJson(text): unknown` with a narrowing gate; an `assertNever` helper |
| 8 | `null-and-strictness` | [ ] | [ ] | `2/everyday-types#null-and-undefined`, `/tsconfig/#strictNullChecks`, `#noUncheckedIndexedAccess` | An empty box and no box at all are different problems. | `firstWord(text?: string)`, and a `pick` that survives `noUncheckedIndexedAccess` |

Lesson 6 is where the two audience-specific Get Started pages land — "coming from
Java/C#" is really a lesson about structural vs nominal typing, and "coming from FP" is
really about types as sets. Neither needs its own lesson; both need a paragraph.

## Course 2 — Functions and Objects

| # | Slug | L | E | Docs source | ELI5 angle | Exercise |
|---|---|---|---|---|---|---|
| 1 | `function-signatures` | [ ] | [ ] | `2/functions` | A signature is the slot on a vending machine: it says exactly what fits in and what drops out. `void` means "nothing drops out", not "nothing happens". | `retry(fn, times)` with optional, default and rest params typed correctly |
| 2 | `overloads-and-call-signatures` | [ ] | [ ] | `2/functions#call-signatures`, `#construct-signatures`, `#function-overloads` | One door with several labelled ways through it — and why two doors is usually the better answer. | Overload `parseDate(input: string \| number)`, then rewrite it as a union and compare |
| 3 | `this-and-callbacks` | [ ] | [ ] | `2/functions#declaring-this-in-a-function`, `utility-types` (`ThisParameterType`, `OmitThisParameter`, `ThisType`) | `this` is whoever is holding the tool, and callbacks change hands constantly. | Type an `on(event, handler)` registry where the handler's `this` is the emitter |
| 4 | `object-types` | [ ] | [ ] | `2/objects` | A form with required fields, optional fields, and a note saying "you may add extra rows". | Model an HTTP options bag: optional props, `readonly`, and an index signature |
| 5 | `extending-and-intersections` | [ ] | [ ] | `2/objects#extending-types`, `#intersection-types` | Two ways to combine forms: staple a new page on (`extends`), or demand both at once (`&`). | Build `Timestamped<T>` and `WithId<T>`, then compose them three ways |
| 6 | `tuples-and-readonly` | [ ] | [ ] | `2/objects#tuple-types`, `#readonly-tuple-types` | An array is a bag. A tuple is a labelled tray with a fixed number of slots. | Type a `zip`, and a `useState`-style `[value, setValue]` return tuple |
| 7 | `iterators-and-generators` | [ ] | [ ] | `iterators-and-generators` | A generator is a book with a bookmark: it hands you one page and remembers where it stopped. | A `range()` generator, plus a collection with a custom `Symbol.iterator` |
| 8 | `symbols` | [ ] | [ ] | `symbols` | A symbol is a key cut just for you. Nobody else's key opens that door, even one with the same name written on it. | A registry keyed by `unique symbol`, so two modules cannot collide |

## Course 3 — Type Manipulation

| # | Slug | L | E | Docs source | ELI5 angle | Exercise |
|---|---|---|---|---|---|---|
| 1 | `generics` | [ ] | [ ] | `2/generics`, `2/types-from-types` | A recipe that works for any ingredient, and remembers which one you used. | `first<T>`, `last<T>`, and a typed `identityCache<T>` |
| 2 | `constraints-and-defaults` | [ ] | [ ] | `2/generics#generic-constraints`, `#generic-parameter-defaults` | "Any ingredient" is too generous. A constraint is the sign saying "must fit through this door". | `pluck<T, K extends keyof T>(items, key)` |
| 3 | `keyof-and-typeof` | [ ] | [ ] | `2/keyof-types`, `2/typeof-types` | Two X-rays: one shows an object's key names, the other shows a value's type. | Derive a `Mode` union from a config object using `keyof typeof` |
| 4 | `indexed-access-types` | [ ] | [ ] | `2/indexed-access-types` | Reaching into a *type* with square brackets, the same way you reach into a value. | Extract a nested field's type out of an API response type without redeclaring it |
| 5 | `conditional-types` | [ ] | [ ] | `2/conditional-types` | An if-statement that runs in the type system, at compile time, and produces a type. | `Unwrap<T>` with `infer`, plus a distributive `NonNullableDeep<T>` |
| 6 | `mapped-types` | [ ] | [ ] | `2/mapped-types` | Walk every key of a type and rewrite each one, like relabelling every jar in a cupboard. | Hand-roll `Partial` and `Readonly`, then a `Getters<T>` using `as` key remapping |
| 7 | `template-literal-types` | [ ] | [ ] | `2/template-literal-types`, `utility-types` (`Uppercase`, `Lowercase`, `Capitalize`, `Uncapitalize`) | String templates whose result is a *type*, so a typo becomes a compile error. | `EventName<T>` producing `` `on${Capitalize<K>}` `` for every key |
| 8 | `utility-types-objects` | [ ] | [ ] | `utility-types` (`Partial`, `Required`, `Readonly`, `Record`, `Pick`, `Omit`) | The standard-issue toolkit. You already know how each one is built. | Refactor a hand-written set of helper types down to `Pick` / `Omit` / `Record` |
| 9 | `utility-types-unions-functions` | [ ] | [ ] | `utility-types` (`Exclude`, `Extract`, `NonNullable`, `Parameters`, `ConstructorParameters`, `ReturnType`, `InstanceType`, `Awaited`) | X-rays for a union and for a function — read a type off something that already exists instead of writing it twice. | Derive an API client's argument and result types from its function types alone |

**Why utility types are two lessons.** `/docs/handbook/utility-types.html` documents 22
utilities; that does not fit one 8–12 minute lesson with three quizzes without becoming
a reference page. The split follows the mechanism each group is built from — mapped
types for lesson 8, conditional types and `infer` for lesson 9 — which is also the
order the reader met them in lessons 5 and 6.

`NoInfer` is named but not taught: genuinely rare. The four string intrinsics
(`Uppercase`, `Lowercase`, `Capitalize`, `Uncapitalize`) live in **lesson 7**, where the
docs themselves introduce them and where the exercise already uses `Capitalize` — do
not "close the gap" by duplicating them in lesson 8 or 9. The three `this` helpers live
in **2.3**, next to `this`.

## Course 4 — Classes and Object-Oriented TypeScript

Every exercise here is authored under `erasableSyntaxOnly`. The prose still teaches the
banned forms in full; only the runnable code avoids them.

| # | Slug | L | E | Docs source | ELI5 angle | Exercise |
|---|---|---|---|---|---|---|
| 1 | `classes-and-members` | [ ] | [ ] | `2/classes` | A cookie cutter with a checklist of what every cookie must have. | A `Stack<T>` — fields **declared, then assigned in the constructor body** (parameter properties are not erasable) |
| 2 | `visibility-and-static` | [ ] | [ ] | `2/classes#member-visibility`, `#static-members` | `private` is a "staff only" sign. `#private` is an actual lock. | A `Counter` with `#count` and a `static from()` — the lesson turns "why not `private`?" into the erasability point |
| 3 | `inheritance-and-abstract` | [ ] | [ ] | `2/classes#class-heritage` | `extends` inherits the machine; `implements` only signs the contract. | An `abstract class Shape` with two subclasses, under `noImplicitOverride` |
| 4 | `generic-classes-and-this` | [ ] | [ ] | `2/classes#generic-classes`, `#this-types` | `this` as a return type is how a chainable builder keeps its own identity through a subclass. | A chainable `QueryBuilder` returning `this` |
| 5 | `decorators` | [ ] | — | `decorators` | A sticky note on a method that the machine reads before running it. | **No exercise** — decorators need code generation; Node's type stripping cannot run them. The lesson says so on the page. |
| 6 | `mixins` | [ ] | [ ] | `mixins` | Bolting an extra ability onto a class without rewriting the class. | `Serializable` and `Comparable` mixins composed onto one base class |

## Course 5 — Modules and Declaration Files

| # | Slug | L | E | Docs source | ELI5 angle | Exercise |
|---|---|---|---|---|---|---|
| 1 | `modules` | [ ] | [ ] | `2/modules`, `modules/introduction` | A file is a room with a door. `export` decides what leaves. `import type` says "I only want the blueprint, not the furniture". | Split one file into three modules, with `import type` where `verbatimModuleSyntax` requires it |
| 2 | `module-resolution` | [ ] | — | `modules/theory`, `modules/reference` | How the compiler plays hide-and-seek to find `./thing`, and why the extension is not optional on Node. | **No exercise** — resolution is a config concern; the lesson uses annotated `tsconfig` samples |
| 3 | `esm-cjs-interop` | [ ] | [ ] | `modules/appendices/esm-cjs-interop` | Two dialects for the same idea, and the phrasebook between them. | A `loadConfig` that copes with both a `{ default: … }` shape and a bare export |
| 4 | `namespaces-and-legacy` | [ ] | [ ] | `namespaces`, `namespaces-and-modules`, `triple-slash-directives` | Filing cabinets from before folders existed — and how to move house. | Convert namespace-style nested code into modules (the `namespace` itself appears only in prose) |
| 5 | `declaration-merging` | [ ] | [ ] | `declaration-merging` | Two people writing on the same page, and the page keeping both. | Merge an interface across two files and implement both halves |
| 6 | `writing-declaration-files` | [ ] | [ ] | `declaration-files/introduction`, `by-example`, `do-s-and-don-ts`, `deep-dive` | A `.d.ts` is a museum label for something you are not allowed to touch. | Write a `.d.ts` for an untyped JS helper, then consume it type-safely |
| 7 | `dts-shapes-and-templates` | [ ] | — | `declaration-files/library-structures`, all six `templates/*` | Six shapes a library can have, and the label that fits each one. | **No exercise** — 5.6 already carries the writing exercise; this is a reference tour |
| 8 | `publishing-and-consuming-types` | [ ] | — | `declaration-files/publishing`, `consumption` | Getting your labels into somebody else's museum. | **No exercise** — publishing is a registry action, not something a test can assert |

## Course 6 — Tooling and Config

| # | Slug | L | E | Docs source | ELI5 angle | Exercise |
|---|---|---|---|---|---|---|
| 1 | `the-compiler-and-cli` | [ ] | — | `typescript-tooling-in-5-minutes`, `compiler-options` | Meet `tsc`: what it reads, what it writes, and the handful of flags you actually type. | **No exercise** — a CLI tour |
| 2 | `tsconfig-tour` | [ ] | — | `tsconfig-json`, `/tsconfig/` | The settings menu. Twelve switches matter; the rest is trivia. | **No exercise** — annotated `tsconfig.json` walkthrough in prose |
| 3 | `strictness-flags` | [ ] | [ ] | `/tsconfig/#strict`, `#noUncheckedIndexedAccess`, `#exactOptionalPropertyTypes`, `#noImplicitOverride` | `strict: true` is one switch that flips eight. Here is what each one buys you. | Fix a deliberately sloppy module so it survives `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` |
| 4 | `erasable-syntax-and-enums` | [ ] | [ ] | `enums`, `/tsconfig/#erasableSyntaxOnly` | Some TypeScript is a sticker you peel off. Some is a part welded on. Node can only peel. | Replace an `enum` with an `as const` object plus `keyof typeof`, and prove the union is exhaustive |
| 5 | `project-references` | [ ] | — | `project-references`, `/tsconfig/#isolatedModules` | Splitting one enormous typecheck into several that only rerun when they must. | **No exercise** — needs multiple tsconfigs, the wrong shape for one directory |
| 6 | `watch-and-incremental` | [ ] | — | `configuring-watch`, `/tsconfig/#incremental` | How `tsc` remembers what it already checked. | **No exercise** — config-shaped |
| 7 | `build-tools-and-transpilers` | [ ] | — | `integrating-with-build-tools`, `babel-with-typescript`, `modules/guides/choosing-compiler-options`, `nightly-builds` | Who strips your types in production, and why they do not check them on the way past. | **No exercise** — config-shaped |

Lesson 4 is the best exercise in the track, and it exists *because* of the constraint
the exercises are authored under. See `src/exercises/README.md`.

## Course 7 — TypeScript in Practice

| # | Slug | L | E | Docs source | ELI5 angle | Exercise |
|---|---|---|---|---|---|---|
| 1 | `type-checking-javascript` | [ ] | — | `intro-to-js-ts`, `type-checking-javascript-files` | You can turn the lights on in a `.js` file without renaming it. | **No exercise** — would need `allowJs` + `checkJs` in the shared exercises tsconfig. See [Open questions](#open-questions) |
| 2 | `jsdoc-and-dts-from-js` | [ ] | [ ] | `jsdoc-supported-types`, `declaration-files/dts-from-js` | Types written in comments still count. | Turn a JSDoc-annotated module's types into a `.d.ts` a `.ts` consumer can rely on |
| 3 | `migrating-js-to-ts` | [ ] | [ ] | `migrating-from-javascript` | You do not rewrite. You turn the lights on one room at a time. | Finish converting a half-migrated module so it passes under `strict` |
| 4 | `jsx-and-react-types` | [ ] | — | `jsx` | Your markup gets type-checked too. | **No exercise** — `.tsx` is not type-stripped by Node, so it cannot run under `node --test` |
| 5 | `dom-manipulation` | [ ] | — | `dom-manipulation` | The browser hands you things that might not be there, and TypeScript is right to be suspicious. | **No exercise** — no DOM in `lib: ["es2024"]`; a per-directory `lib` override for one exercise is not worth a second tsconfig |

---

## Coverage matrix

Every page in the docs navigation as of the snapshot date, and the lesson that owns it.

### Get Started

| Docs page | Lesson |
|---|---|
| TS for the New Programmer | 1.1 |
| TypeScript for JS Programmers | 1.1 |
| TS for Java/C# Programmers | 1.6 |
| TS for Functional Programmers | 1.6 |
| TypeScript Tooling in 5 minutes | 6.1 |

### Handbook

| Docs page | Lesson |
|---|---|
| The Basics | 1.1 |
| Everyday Types | 1.3 (`any` → 1.7, null → 1.8) |
| Narrowing | 1.4 (predicates → 1.5, `never` → 1.7) |
| More on Functions | 2.1, 2.2, 2.3 |
| Object Types | 2.4, 2.5, 2.6 |
| Creating Types from Types | 3.1 *(index page; its content is 3.1's opening)* |
| Generics | 3.1, 3.2 |
| Keyof Type Operator | 3.3 |
| Typeof Type Operator | 3.3 |
| Indexed Access Types | 3.4 |
| Conditional Types | 3.5 |
| Mapped Types | 3.6 |
| Template Literal Types | 3.7 |
| Classes | 4.1, 4.2, 4.3, 4.4 |
| Modules | 5.1 |

### Reference

| Docs page | Lesson |
|---|---|
| Utility Types | 3.8, 3.9 (string intrinsics → 3.7, `this` helpers → 2.3) |
| Decorators | 4.5 |
| Declaration Merging | 5.5 |
| Enums | 6.4 |
| Iterators and Generators | 2.7 |
| JSX | 7.4 |
| Mixins | 4.6 |
| Namespaces | 5.4 |
| Namespaces and Modules | 5.4 |
| Symbols | 2.8 |
| Triple-Slash Directives | 5.4 |
| Type Compatibility | 1.6 |
| Type Inference | 1.2 |
| Variable Declaration | 1.2 |

### Modules Reference

| Docs page | Lesson |
|---|---|
| Introduction | 5.1 |
| Theory | 5.2 |
| Guides: Choosing Compiler Options | 6.7 |
| Reference | 5.2 |
| Appendices: ESM/CJS Interoperability | 5.3 |

### Declaration Files

| Docs page | Lesson |
|---|---|
| Introduction | 5.6 |
| Declaration Reference (by-example) | 5.6 |
| Library Structures | 5.7 |
| .d.ts Templates (all six) | 5.7 |
| Do's and Don'ts | 5.6 (also cited in 1.7) |
| Deep Dive | 5.6 |
| Publishing | 5.8 |
| Consumption | 5.8 |
| Creating .d.ts Files from .js files | 7.2 |

### JavaScript

| Docs page | Lesson |
|---|---|
| JS Projects Utilizing TypeScript | 7.1 |
| Type Checking JavaScript Files | 7.1 |
| JSDoc Reference | 7.2 |

### Tutorials

| Docs page | Lesson |
|---|---|
| DOM Manipulation | 7.5 |
| Migrating from JavaScript | 7.3 |
| Using Babel with TypeScript | 6.7 |

### Project Configuration

| Docs page | Lesson |
|---|---|
| What is a tsconfig.json | 6.2 |
| TSConfig Reference | 6.2, 6.3 |
| tsc CLI Options | 6.1 |
| Project References | 6.5 |
| Integrating with Build Tools | 6.7 |
| Configuring Watch | 6.6 |
| Nightly Builds | 6.7 |

## Deliberate exclusions

Stated rather than silently dropped.

| Docs page | Why not |
|---|---|
| ASP.NET Core, Gulp | Walkthroughs that teach ASP.NET and Gulp rather than TypeScript, and both are effectively unmaintained |
| Compiler Options in MSBuild | Specific to the .NET build system; the flags themselves are covered in 6.2 |
| Cheat Sheets | A PNG/PDF download, not prose. Linked from the course pages instead |
| The TypeScript Handbook (intro) | An index page with no unique content |

## Exercise gaps

39 of 51 lessons carry a runnable exercise. The twelve that do not, grouped by reason:

- **Cannot run under Node's type stripping** — 4.5 decorators (needs code generation),
  7.4 JSX (`.tsx` is not stripped). Both are taught fully in prose with real syntax,
  and 4.5 explains on the page why the code it just showed you cannot be run here.
- **Config-shaped** — 5.2, 6.1, 6.2, 6.5, 6.6, 6.7. Annotated configuration samples in
  prose instead; 6.5 would additionally need several tsconfigs.
- **Nothing runnable to assert** — 5.7 (5.6 carries the writing exercise), 5.8
  (publishing is a registry action), 7.5 (no DOM in `lib: ["es2024"]`).
- **Blocked on a decision** — 7.1, see below.

## Open questions

Two things deliberately left undecided rather than settled speculatively.

**Type-level exercises (affects most of Course 3).** `solution.test.ts` asserts that
`typeof starter` and `typeof solution` are mutually assignable, which is what lets one
set of tests grade either file. The consequence is that `starter.ts` must already carry
the correct *types* — so the learner's work can only be implementations. That is fine
for Course 1, but a lesson whose entire point is a type (`Unwrap<T>`, a mapped type)
has no runtime behaviour to assert. Needs deciding at Course 3, with options including
a relaxed parity check, `// @ts-expect-error` assertions, or a separate
`tsc --noEmit` pass over starters. Do not invent machinery for it before then.

**`allowJs` / `checkJs` (affects 7.1, and would make it 40 exercises).** Course 7 is
about JavaScript interop, and two of its lessons would naturally exercise a `.js` file.
The exercises tsconfig deliberately includes only `**/*.ts`. Adding `allowJs` affects
every exercise's typecheck, so it is a Course 7 decision, not a Course 1 one.

---

## Lesson template

Copy this shape. It is what keeps 51 lessons consistent without re-deciding structure
each time.

````markdown
---
title: <5–7 words. No colon, no "Introduction to">
course: <course id>
order: <n>
summary: <Two sentences. Used as the meta description AND the syllabus blurb. Say what
  the reader will be able to do, not what the lesson "covers".>
duration: <8–12>
exercise: true
draft: false
---

<HOOK — 2 to 4 short sentences. One concrete, physical analogy. No TypeScript term
appears before the second sentence. Ends by naming what the lesson is actually about.>

## <Concept 1 — a plain-language noun phrase, never a keyword>

<Analogy first, one or two sentences. Then the precise technical statement. Then a
short code block — under 12 lines, and it must be code someone would really write.>

```quiz
id: <courseId>-<lessonSlug>-q1
q: <Tests the concept just taught, not recall of a sentence>
- [ ] …
- [x] …
explain: <Why the right answer is right AND why the tempting wrong one is tempting>
```

## <Concept 2 — the mechanism>

<Same shape. This is usually where the real explanation lives.>

```quiz
id: <courseId>-<lessonSlug>-q2
…
```

## <Concept 3 — where this bites, or the thing people get wrong>

<Same shape.>

```quiz
id: <courseId>-<lessonSlug>-q3
…
```

## What to take away

- <Four bullets. Each one a claim, not a topic.>
````

The exercise card is appended by `LessonLayout.astro` — do **not** write a `## Practice`
heading in the Markdown.

### Rules that are enforced, not suggested

- **Quiz ids are `<courseId>-<lessonSlug>-q<n>`,** numbered in document order.
  `scripts/check-content.ts` fails the build otherwise. The rule lives in
  `src/plugins/quiz-id.ts`.
- **`exercise: true` requires `src/exercises/<lesson id>/`** with all four files.
  `loadExerciseFor` fails the build otherwise, and
  `pnpm --filter exercises manifest` checks it in both directions.
- **The exercise directory name is the lesson id**, which has no `NN-` prefix even
  though the lesson filename does.

### Authoring order, per lesson

1. **Write the exercise first.** It is what forces the lesson to be concrete about what
   it actually teaches. Get `attempt` red and `test` green before writing any prose.
2. Write the prose around it.
3. `pnpm --filter exercises verify && pnpm --filter elearning verify`.
4. Commit. One lesson per commit, so a bad lesson is one revert.

When the whole course is done: tick its boxes above, then flip the course to
`draft: false`. That flip is the publish gate.
