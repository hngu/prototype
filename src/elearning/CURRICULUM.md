# TypeScript track — curriculum

**6 courses · 46 lessons · 37 exercises.** Derived from the official documentation at
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
3. **The authoring spec.** The lesson template at the bottom, so courses 2–6 are
   mechanical rather than a fresh judgement call each time.

---

## Progress

| # | Course | id | Level | Lessons | Exercises | `draft` |
|---|---|---|---|---|---|---|
| 1 | TypeScript Fundamentals | `typescript-fundamentals` | beginner | **8 / 8** | **8 / 8** | `false` |
| 2 | Functions and Objects | `typescript-functions-objects` | beginner | **8 / 8** | **8 / 8** | `false` |
| 3 | Type Manipulation | `typescript-type-manipulation` | intermediate | **9 / 9** | **9 / 9** | `false` |
| 4 | Classes and Object-Oriented TypeScript | `typescript-classes` | intermediate | **6 / 6** | **5 / 5** | `false` |
| 5 | Modules and Declaration Files | `typescript-modules-declarations` | advanced | **8 / 8** | **5 / 5** | `false` |
| 6 | Tooling and Config | `typescript-tooling-config` | advanced | **7 / 7** | **2 / 2** | `false` |

**The track is complete.** All six courses are published, and every lesson and exercise
box below is ticked. What remains useful in this file is the coverage audit, the decisions
recorded per course, and the authoring spec — a seventh course, or a rewrite after a
`TYPESCRIPT_VERSION` bump, starts from those.

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

**Complete.** Course published (`draft: false`). Titles below are the shipped ones.

| # | Slug | L | E | Docs source | ELI5 angle | Exercise |
|---|---|---|---|---|---|---|
| 1 | `what-typescript-does` | [x] | [x] | `typescript-from-scratch`, `typescript-in-5-minutes`, `2/basic-types` | A friend who is good at spelling: they read the letter, circle the mistakes, and go home. Their circles are not in the envelope. | **Trust nothing at the door** — `toFahrenheit`, `hottest`, and a `parseReading(raw: unknown)` that validates at the boundary |
| 2 | `type-inference` | [x] | [x] | `type-inference`, `variable-declarations` | Two label makers on the desk: one laminates, one is a whiteboard marker. `const` gets the first, `let` the second. | **Pin a theme config** — `as const` tuple, readonly config, `isMode` predicate |
| 3 | `everyday-types` | [x] | [x] | `2/everyday-types` | A three-year-old gets a long way on fifty words, because they are the right fifty. | **Say it in nine words** — `symbolFor` over a literal union, `normaliseQuantity(string \| number)`, an optional `note` |
| 4 | `narrowing` | [x] | [x] | `2/narrowing` | A closed box holding either a kitten or a hammer. You would look first. | **Look before you reach in** — `describe(string \| number \| Date)`, `in`-narrowing, and a `default`-less exhaustive switch |
| 5 | `type-predicates` | [x] | [x] | `2/narrowing#using-type-predicates`, `#assertion-functions` | A bouncer on the door. Once they wave you through, nobody inside asks again. | **Sign your name to the check** — `isNonEmptyString`, `isRecord`, `assertDefined`, `requireField`, `nameOf` |
| 6 | `structural-typing` | [x] | [x] | `type-compatibility`, `typescript-in-5-minutes-oop`, `typescript-in-5-minutes-func` | *Wanted: someone who can make coffee.* Nobody turns up with a certificate. Make a coffee, you are hired. | **Do the job, you're hired** — `greet(Named)`, `auditLine` over an intersection, and one object doing three unrelated jobs |
| 7 | `any-unknown-never` | [x] | [x] | `2/everyday-types#any`, `2/narrowing#the-never-type`, `do-s-and-don-ts` | A parcel nobody has opened. Assume it is a kettle, refuse to use it until somebody looks, or insist there is no parcel. | **Three ways to say I don't know** — `parseJson(): unknown`, a narrowing gate in `countFrom`, and `assertNever` in a `default` arm |
| 8 | `null-and-strictness` | [x] | [x] | `2/everyday-types#null-and-undefined`, `/tsconfig/#strictNullChecks`, `#noUncheckedIndexedAccess` | "It's empty" and "there is no tin" are different sentences. | **An empty box and no box** — `firstWord(text?)`, `??` vs `\|\|` in `pageSize`, and a `pick` that survives `noUncheckedIndexedAccess` |

Lesson 6 is where the two audience-specific Get Started pages land — "coming from
Java/C#" is really a lesson about structural vs nominal typing, and "coming from FP" is
really about types as sets. Neither needs its own lesson; both need a paragraph. The FP
paragraph also sets up `never` as the empty set, which lesson 7 then collects.

### Decisions made while writing course 1

Recorded because they are the kind of thing that gets re-litigated from scratch six
months later.

- **Lesson 1's exercise is not the one this file originally specified.** "Fix three
  files so `tsc` goes quiet" is impossible under the exercises package's second
  invariant — `typecheck` must be **green on a fresh clone**, and an exercise whose
  starting state is a type error breaks that for the whole package, not just itself.
  A per-directory opt-out would need a second tsconfig. The lesson teaches the same
  thing from the other side instead: the compiler checks what you wrote and then
  vanishes, so a value arriving at run time was never checked by anyone. See
  `src/exercises/typescript-fundamentals/what-typescript-does/`.
- **Assertion functions need an explicitly annotated call target.** Lesson 5's test
  file declares `const subject: typeof solution = …` rather than letting the type be
  inferred, because `subject.assertDefined(…)` is otherwise TS2775: "Assertions
  require every name in the call target to be declared with an explicit type
  annotation." Verified by deleting the annotation — five lines stop compiling. Any
  later exercise exporting an `asserts` function needs the same annotation.
- **`@ts-expect-error` is the tool for testing a *flag*.** Three lessons use it to
  assert that something is refused: excess property checking on a fresh literal (6),
  a property read on an `unknown` (7), and indexed access under
  `noUncheckedIndexedAccess` (8). It is self-enforcing in both directions — the build
  fails if the line stops erroring — so these claims cannot quietly go stale. Prefer
  it to prose whenever the claim is "this does not compile".
- **Every exercise carries at least one test whose point is that it compiles**, named
  so a reader can tell (`isMode narrows, not just checks`, `assertDefined narrows
  everything after the call`). Runtime assertions alone cannot tell an honest
  signature from a lucky one.
- **YAML frontmatter: quote any `summary` starting with a backtick.** A leading
  backtick is a reserved indicator in YAML and fails `astro check` with "bad
  indentation of a mapping entry", which does not sound like a quoting problem at
  all. Lesson 7 carries a comment saying so.

## Course 2 — Functions and Objects

**Complete.** Course published (`draft: false`).

| # | Slug | L | E | Docs source | ELI5 angle | Exercise |
|---|---|---|---|---|---|---|
| 1 | `function-signatures` | [x] | [x] | `2/functions` | A vending machine has a slot and a tray. The two openings tell you everything. | **What fits in, what drops out** — rest params, optional vs default, and a `void` callback |
| 2 | `overloads-and-call-signatures` | [x] | [x] | `2/functions#call-signatures`, `#construct-signatures`, `#function-overloads` | One box-office window with three signs above it. Which sign you stand under decides what you get. | **One door, several labelled ways through** — `parseDate` overloaded *and* as a union, side by side |
| 3 | `this-and-callbacks` | [x] | [x] | `2/functions#declaring-this-in-a-function`, `utility-types` (`ThisParameterType`, `OmitThisParameter`, `ThisType` — prose only) | "Pass me that" works across a table and means nothing down the phone. | **Whoever is holding the tool** — an emitter whose handlers see it as `this`, plus `OmitThisParameter` |
| 4 | `object-types` | [x] | [x] | `2/objects` | Every form has rows you must fill in, rows you may leave blank, and a space at the bottom for anything else. | **A form with optional rows** — an HTTP options bag, and optional-in/required-out |
| 5 | `extending-and-intersections` | [x] | [x] | `2/objects#extending-types`, `#intersection-types` | Staple an extra page on, or hand over two forms and say fill in both. | **Staple a page on, or demand both** — `WithId<T>` and `Timestamped<T>`, and the conflict `&` hides |
| 6 | `tuples-and-readonly` | [x] | [x] | `2/objects#tuple-types`, `#readonly-tuple-types` | A bag holds any number of apples. A cutlery tray holds one knife, one fork, one spoon. | **A labelled tray, not a bag** — `zip`, a tuple return, a non-empty tuple, a `useState`-style pair |
| 7 | `iterators-and-generators` | [x] | [x] | `iterators-and-generators` | A book with a bookmark: read a page, close it, carry on tomorrow. Nobody photocopied the book. | **A book with a bookmark** — `range`, an infinite `naturals`, a lazy `take`, a `Symbol.iterator` |
| 8 | `symbols` | [x] | [x] | `symbols` | Two flats can both have a door labelled 3B. The labels match and the keys do not. | **A key cut just for you** — a metadata store on `unique symbol` keys |

### Decisions made while writing course 2

- **Course 2 uses simple generics, deliberately, ahead of course 3.** `WithId<T>`,
  `Iterable<T>`, `Generator<T, …>` and `OmitThisParameter<T>` all appear. Avoiding them
  would have meant a `retry` that only returns strings and a `zip` fixed to two concrete
  element types — worse teaching examples for the sake of a rule. Every appearance is
  **applied, never authored**: the reader consumes a generic type and never writes one,
  and each first use carries a one-line "course 3 is about these". Course 3 still owns
  declaring them.
- **`unique symbol` broke the four-file contract, and the reason is the lesson.**
  `unique symbol` is TypeScript's only *nominal* type, so `starter.ts` and `solution.ts`
  cannot each declare their own keys — the API-parity check fails with TS2322, correctly,
  because they really are different keys. Lesson 2.8's exercise therefore has a fifth
  file, `keys.ts`, shared by all three. Verified: the manifest gate only checks that the
  four required files are *present*, so extras pass. `REQUIRED_FILES` did not need
  changing. Any future exercise exporting a `unique symbol` needs the same shape.
- **Overloads, construct signatures and call-signature interfaces are all erasable.**
  Probed before writing lesson 2.2 rather than assumed: overload signatures with no body,
  `new (v: number) => T`, and an interface carrying both a call signature and properties
  all pass `erasableSyntaxOnly` and run under Node's type stripping.
- **`@ts-expect-error` is now the standard way this track pins down a *cost*.** Course 2
  uses it for the things that are supposed to be refused — an overloaded function rejecting
  the union its body handles, an arrow function failing a construct signature, `headline([])`
  on a non-empty tuple, writing through a `readonly` index signature, a forged `unique symbol`.
  Several tests then assert the runtime *did* the thing the compiler forbade, because
  `readonly` is erased; that pairing is worth keeping.
- **A draft course's lesson pages are not built in production**, so `loadExerciseFor` and
  `check:build` never see them. Authoring a draft course therefore needs a temporary
  `draft: false` flip around each `verify` to check the exercise card actually renders —
  otherwise the first real validation is the publish flip at the end of the phase. Done at
  every lesson boundary in this phase.
- **Every test must touch `subject`.** A purely type-level test passes under
  `attempt`, which makes the learner's red run confusing ("why did one pass?"). Fold
  compile-only assertions into a test that also exercises the implementation.
- **YAML frontmatter, again:** a `summary` starting with a backtick needs quoting — a
  leading backtick is a reserved YAML indicator and the error reads "bad indentation of a
  mapping entry", which sounds like anything but a quoting problem. By contrast a
  malformed quiz option (`- []` for `- [ ]`) is caught cleanly by `check:content` with the
  file and line — verified.
- **`ThisType<T>` is covered in prose only** (lesson 2.3), not exercised. A realistic use
  needs a generic `ObjectDescriptor<D, M>`-shaped helper, which is course 3 material, and
  the utility is one you read far more often than you write. `ThisParameterType` and
  `OmitThisParameter` are both exercised.

## Course 3 — Type Manipulation

**Complete.** Course published (`draft: false`).

| # | Slug | L | E | Docs source | ELI5 angle | Exercise |
|---|---|---|---|---|---|---|
| 1 | `generics` | [x] | [x] | `2/generics`, `2/types-from-types` | A recipe for jam is the same recipe whichever fruit you use — but the label has to say *plum*. | **One recipe, any ingredient** — `first`/`last`, a two-parameter `pairUp`, a `Cache<T>` and `cached` |
| 2 | `constraints-and-defaults` | [x] | [x] | `2/generics#generic-constraints`, `#generic-parameter-defaults` | *You must be taller than this line.* It does not make you exactly that tall — you get on the ride as yourself. | **Must fit through this door** — `pluck<T, K>`, `byId`, `longest`, a parameter default |
| 3 | `keyof-and-typeof` | [x] | [x] | `2/keyof-types`, `2/typeof-types` | Two machines: one photographs the label, one photographs the contents. | **Two X-rays** — a `Mode` union derived from a `const` object, plus the justified `Object.keys` cast |
| 4 | `indexed-access-types` | [x] | [x] | `2/indexed-access-types` | *Use the flour from the third jar on the second shelf* — so reorganising the pantry updates the recipe. | **Reaching into a type** — nested access, `[number]`, and `User[K]` |
| 5 | `conditional-types` | [x] | [x] | `2/conditional-types` | You cannot ask "was it raining?" about a whole week and get one answer. | **An if-statement for types** — recursive `Unwrap`, `infer`, and distributive vs non-distributive |
| 6 | `mapped-types` | [x] | [x] | `2/mapped-types` | A cupboard of jars and one rule: put a *maybe* sticker on every lid. | **Relabel every jar** — hand-rolled `Partial`/`Required`/`Readonly`, then `Getters<T>` and its runtime counterpart |
| 7 | `template-literal-types` | [x] | [x] | `2/template-literal-types`, `utility-types` (the four string intrinsics) | A postcode is not just text. `CB1 2AB` fits and `banana` does not. | **A type made of string** — a `Route` pattern, `Handlers<T>`, and all four intrinsics |
| 8 | `utility-types-objects` | [x] | [x] | `utility-types` (`Partial`, `Required`, `Readonly`, `Record`, `Pick`, `Omit`) | A toolbox holds nothing you could not have made — just the six things worth not making again. | **The standard-issue toolkit** — hand-rolled `Pick`/`Omit`/`Record`, and the `Partial`-spread bug |
| 9 | `utility-types-unions-functions` | [x] | [x] | `utility-types` (`Exclude`, `Extract`, `NonNullable`, `Parameters`, `ConstructorParameters`, `ReturnType`, `InstanceType`, `Awaited`) | A locksmith does not measure your hand. They look at the lock. | **Read the types off what exists** — an API client whose args and results are all derived |

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

### Decisions made while writing course 3

- **The two exercise patterns worked, and both are now proven.** Pattern A (learner
  authors the type, `starter.ts` carries an `Expect<Equals<…>>` self-check, placeholder
  delegates to the built-in) was verified by replacing `MyPartial` with the classic wrong
  answer `{ [K in keyof T]: T[K] | undefined }` — `typecheck` failed at `starter.ts:41`.
  Its honest limitation is stated in the exercise README: it tells the learner whether
  what they wrote is *correct*, not whether they wrote anything, because the delegating
  placeholder is itself a correct answer.
- **`tools/type-assert.ts` is new**, holding `Equals`, `Expect` and `Extends`. Shared
  rather than copied because `Equals` is easy to get subtly wrong — a version that passes
  vacuously would stop checking anything, silently. Imported by nine exercises.
- **`assert.deepEqual` narrows its first argument.** It is declared `asserts actual is T`
  in `@types/node`, so a `type _x = Expect<Equals<typeof value, …>>` placed *after* it
  checks the narrowed type rather than the returned one. Type assertions go before the
  runtime ones. Cost one debugging round on 3.2.
- **`@ts-expect-error` silences the type error and the code still runs.** A rejected call
  that would throw — `callEndpoint(client, 'patchUser', …)` — has to live in a closure that
  is never invoked. Same for anything whose runtime effect would break a later assertion:
  3.4's `readonly` write lands, because `readonly` is erased.
- **`parseBrief` requires an exact `## Goal` heading.** `## Goal, in two halves` failed the
  build with a clear message from `loadExerciseFor` — the gate working, but worth knowing
  before writing a two-part brief.
- **Two build gates were changed this phase, both deliberately:**
  - `scripts/check-content.ts` gained a **frontmatter lint** for values starting with a
    YAML-reserved character. An unquoted `summary: \`keyof\` reads …` fails `astro check`
    with "bad indentation of a mapping entry", which sounds like anything but a quoting
    problem. It had cost time twice by then. Tested both ways.
  - `quiz-parse.ts`'s duplicate-choice check is now **case-sensitive**. It was folding case,
    which is a reasonable heuristic in prose and wrong on a site about a case-sensitive
    language: a quiz contrasting `Uppercase<'fontSize'>` with `Capitalize<'fontSize'>`
    *needs* options differing only in case. Real accidental duplicates are byte-identical,
    so nothing was lost; whitespace is still normalised, and a negative test confirms a
    genuine duplicate still fails. (A first false positive in 3.3 was worked around by
    rewording; the second, in 3.7, could not be reworded without gutting the question.)

## Course 4 — Classes and Object-Oriented TypeScript

**Complete.** Course published (`draft: false`).

Every exercise here is authored under `erasableSyntaxOnly`. The prose still teaches the
banned forms in full; only the runnable code avoids them.

| # | Slug | L | E | Docs source | ELI5 angle | Exercise |
|---|---|---|---|---|---|---|
| 1 | `classes-and-members` | [x] | [x] | `2/classes` | A cookie cutter makes cookies the same shape every time. You do not inspect each one to find out whether it came out star-shaped. | **A cutter and a checklist** — a bounded `Stack<T>` with fields declared then assigned, getters, `snapshot()` and `static of<U>()` |
| 2 | `visibility-and-static` | [x] | [x] | `2/classes#member-visibility`, `#static-members` | A door marked *staff only* keeps out everyone who reads the signs. A lock keeps out everyone. | **A sign and a lock** — a `Counter` with `#count`, a `private label`, `static #created`, `static from()` and an `isCounter` brand check |
| 3 | `inheritance-and-abstract` | [x] | [x] | `2/classes#class-heritage` | Inheriting a bakery gets you the ovens. Signing a form saying you can bake gets you an obligation. | **Inherit the machine, sign the form** — `abstract class Shape`, `Square`/`Circle`, `largestFirst` and a `Describable`-only consumer |
| 4 | `generic-classes-and-this` | [x] | [x] | `2/classes#generic-classes`, `#this-types` | A conversation goes wrong the moment one reply forgets who was talking. | **Chains that remember what they are** — a generic `QueryBuilder<T>`/`PagedQuery<T>` returning `this`, plus `clone()` |
| 5 | `decorators` | [x] | — | `decorators` | Somebody sticks a note on the office kettle. The kettle has not changed, but everyone who reaches for it does one extra thing. | **No exercise** — decorators need code generation and Node's type stripping refuses to parse them. The lesson says so on the page, and says that no compiler flag warns you |
| 6 | `mixins` | [x] | [x] | `mixins` | You cannot fit a second engine in a car with one engine bay. You can bolt on a roof rack. | **Bolt an ability on** — `withSerializable` and `withTimestamp` composed onto `Note`, consumed through their interfaces |

The plan named the two mixins `Serializable` and `Comparable`. `Comparable` was replaced by
`Timestamped`, because a comparison mixin has nothing to do at construction time and so
demonstrates the one thing a plain function genuinely cannot do — participate in `this`,
`super`, construction and `instanceof`. Lesson 6's closing argument is that most abilities
should *not* be mixins, and it needed an example that earns it.

### Decisions made while writing course 4

- **Classes broke the whole-module parity check, and the fix is now the course's pattern.**
  A class with a `private` or `protected` member is nominal, so two identical `Stack`s
  declared in two files are never mutually assignable — `#items` in one "refers to a
  different member". The usual `const _a: typeof solution = starter` fails in both
  directions. Four of the five exercises therefore declare the API **once** in the test
  file (`StackApi`/`StackCtor`, `CounterApi`, `ShapeApi`, `BuilderApi`) and check both files
  against it with a single annotation on `subject`. That annotation is doubly load-bearing:
  without it `subject` is a union of two module types and `new subject.Stack(…)` is a call on
  a union of construct signatures, which is not allowed. A dropped or retyped member still
  fails to compile, which is what parity was for. `mixins` is the one exercise with no
  hidden members, and it keeps the original bidirectional check.
- **Contract members must use method syntax.** `largestFirst: (shapes: readonly ShapeApi[])
  => …` is checked contravariantly under `strictFunctionTypes` and fails; the method form
  `largestFirst(shapes: readonly ShapeApi[]): …` is bivariant and passes. Same trick needed
  for `isLargerThan`.
- **A derived-class constructor stub cannot be a bare `throw`.** `TS2377` requires a `super`
  call, so 4.3's subclass stubs ship with `super('square')` already in them and a comment
  saying why. Definite assignment is still satisfied, because a constructor that always
  throws has no completing path.
- **Three corrections to `src/exercises/README.md`, all verified rather than reasoned:**
  - **`declare` on a class field is legal under `erasableSyntaxOnly` and runs correctly.**
    The README claimed it was banned and "erased, then read". Neither is true on tsc 6.0.3 /
    Node 24.9: it is not `TS1294`, the whole declaration is erased, and an inherited value
    survives. Its hazard is real but different in kind — an unchecked promise, like a type
    assertion — so it moved out of the enforcement table into its own note.
  - **`erasableSyntaxOnly` does not catch decorators.** `tsc --noEmit` is completely silent
    on a standard decorator; Node then fails at the parser with `SyntaxError: Invalid or
    unexpected token`. The plan's §5 assumed the flag moved this to authoring time. It does
    not, and lesson 4.5 says so on the page.
  - **`accessor x = 0` typechecks and will not parse.** Auto-accessors are a JavaScript
    proposal rather than TypeScript syntax, so the flag has no opinion, and V8 in Node 24.9
    rejects the keyword. Prose only, like decorators.
  The table is now headed "Not usable in exercise code / Why / Enforced by", with the last
  column naming `TS1294`, `verbatimModuleSyntax`, `include`, or **nothing**. Four rows are
  enforced and three are conventions, which the old framing hid.
- **`T extends Record<string, unknown>` is a weaker constraint than it looks**, and it cost
  two `@ts-expect-error` directives in 4.4 before it was spotted. A caller satisfying it the
  obvious way — `interface User extends Row` — inherits the index signature, `keyof User`
  widens to all of `string`, and every column check silently passes. An object **type alias**
  satisfies the constraint through an *implicit* index signature that never becomes part of
  the type, so `keyof` stays narrow. This is now 4.4's third concept section and its quiz;
  the same rule explains why `{ ...this }` needs a cast to `Record<string, unknown>` in 4.6.
- **Redeclaring an inherited field wipes it, and tsc catches it.** Verified: the bare
  redeclaration runs after `super()` and resets the field to `undefined`, and `TS2612` reports
  it with the fix — "add an initializer, add a 'declare' modifier, or remove the redundant
  declaration". Worth noting that of those three, `declare` is the one that reintroduces the
  silent-`undefined` risk it just prevented. Lesson 4.3's third section.
- **Writing to a getter-only or frozen property throws.** Modules are always strict mode, so
  an `@ts-expect-error`'d assignment does not fail quietly — it is a `TypeError`. Three tests
  across 4.1 and 4.2 assert the throw rather than the silent no-op, after the first drafts
  claimed the wrong thing and failed. Related and now four phases old: `@ts-expect-error`
  silences the type error and the code still runs, so anything with a runtime effect goes in
  a never-invoked closure.
- **One `attempt`-green test had to be folded in.** 4.6's "outermost mixin wins" test used
  only the given `Note` and local mixins, so it passed under `attempt` and muddied the
  learner's red run. It now also exercises `withSerializable`.
- **Mixin composition order does not change `serialize()` output**, contrary to the first
  draft of the exercise. `{ ...this }` reflects own enumerable properties at call time, and
  by then every field exists whichever mixin ran first — checked both ways. Order matters
  only when two mixins define the same member, and that is what the test demonstrates.
- **`Constructor<T>` is `new`, not `abstract new`.** Widening it would allow abstract bases,
  but `TS2797` then requires the returned class to be `abstract` too, and an abstract class
  cannot be constructed — so the composed result needs a further concrete wrapper. Documented
  in the exercise rather than paid for.

## Course 5 — Modules and Declaration Files

**Complete.** Course published (`draft: false`).

| # | Slug | L | E | Docs source | ELI5 angle | Exercise |
|---|---|---|---|---|---|---|
| 1 | `modules` | [x] | [x] | `2/modules`, `modules/introduction` | A house has rooms. It also has a front door, and the front door is not a list of every room. | **One door onto three rooms** — write a barrel over three given submodules, with `export type` where `verbatimModuleSyntax` demands it, plus a default re-exported under a name |
| 2 | `module-resolution` | [x] | — | `modules/theory`, `modules/reference` | You ask for the blue folder. There are three, one is more green, and the one you meant is in another building. | **No exercise** — config-shaped; annotated `tsconfig` and `package.json` samples in prose |
| 3 | `esm-cjs-interop` | [x] | [x] | `modules/appendices/esm-cjs-interop` | Two people describing the same building, one from the front door and one from the car park. | **Two dialects, one phrasebook** — `unwrapDefault`, plus a facade over two **real** `.cjs` fixtures with their own `.d.cts` |
| 4 | `namespaces-and-legacy` | [x] | [x] | `namespaces`, `namespaces-and-modules`, `triple-slash-directives` | Before buildings had folders they had filing cabinets: drawers inside drawers, a label on each. | **Moving house** — flatten a namespace-shaped object into modules, then a deprecated shim holding references so the migration can be incremental |
| 5 | `declaration-merging` | [x] | [x] | `declaration-merging` | Two people write on the same page and the page keeps both. | **Two people, one page** — augment a library's `PluginContext`, merge a local interface, then supply the values the claims promised |
| 6 | `writing-declaration-files` | [x] | [x] | `declaration-files/introduction`, `by-example`, `do-s-and-don-ts`, `deep-dive` | A museum label. Nobody checks it against the exhibit, and everyone believes it. | **A label on something you cannot touch** — consume a real untyped `.js` through a worked-example `.d.ts`, narrowing its honest `unknown` at the boundary |
| 7 | `dts-shapes-and-templates` | [x] | — | `declaration-files/library-structures`, all six `templates/*` | A locksmith works out what kind of lock it is first. There are not many kinds. | **No exercise** — 5.6 carries the writing exercise; this is the reference tour |
| 8 | `publishing-and-consuming-types` | [x] | — | `declaration-files/publishing`, `consumption` | The labels have to survive being boxed up and unpacked by someone whose museum is arranged differently. | **No exercise** — publishing is a registry action, and the failure modes are `package.json` shaped |

### Decisions made while writing course 5

Probed before designing anything, because four of the five exercises needed mechanisms this
package had never used. All five worked, so no lesson had to be reshaped — but two probe
results changed what got written.

- **Everything course 5 needed is possible here.** Verified against tsc 6.0.3 / Node 24.9: a
  real `.cjs` import with a `.d.cts` beside it; `declare module './x.ts'` merging across
  files; a `.d.ts` describing a plain `.js` **without** `allowJs`; and `declare global`. The
  exercises use genuine CommonJS and genuine untyped JavaScript rather than simulations.
- **`export =` is legal in a `.d.ts` under `erasableSyntaxOnly`.** The flag skips files that
  emit nothing. That is what makes it possible to describe `module.exports = fn` properly, and
  it is the one place in this package where the banned syntax is correct. Noted in the
  tsconfig comment as well, since that is where someone will look.
- **`createRequire`'s `require()` returns `any`.** The `.d.cts` is never consulted, so it is a
  total type hole — asserted in 5.3 with `Expect<Equals<typeof legacy, any>>` and a call with
  deliberate nonsense that compiles. Worth knowing before reaching for it as "the easy way to
  load CommonJS".
- **The 5.3 fixture reproduced the real interop hazard by accident, and it was kept.**
  `module.exports = { DEFAULTS, load, describe, version: '1.4.2' }` — Node's `cjs-module-lexer`
  reports the three shorthand properties and **not** `version`, whose value is a literal. So
  `import { version }` typechecks (the `.d.cts` is correct, the property does exist) and Node
  refuses to load the file: `SyntaxError: Named export 'version' not found`. `legacyVersion`
  was added to the exercise specifically to force the default-import route.
- **An augmentation with required members breaks the library's own code**, discovered by doing
  it: `core.ts` stopped compiling with `TS2739` because it could no longer construct its own
  `PluginContext`. `core.ts` was restructured into the shape real libraries use — a concrete
  `PluginContextBase` the host builds, and an empty `PluginContext extends PluginContextBase`
  for consumers to add to — and lesson 5.5 teaches that as the fix.
- **A mistyped augmentation specifier is completely silent.** `declare module './core-typo.ts'`
  produces no error on that line at all; TypeScript reads it as declaring a new ambient module.
  The only symptom is `Property … does not exist` at every use site. A *conflicting type* is
  caught properly. Both verified.
- **Module augmentation is program-global**, so `solution.ts`'s augmentation applies to
  `starter.ts` too and the type half of 5.5 part 1 is not graded per-file. Stated in the
  exercise README rather than papered over — the leakage is the lesson.
- **Two exercises needed a non-standard parity check**, and both say so in their briefs:
  - **5.1** grades the module's *surface*, which is the deliverable, so `starter.ts` legitimately
    starts with no exports. A compile-time parity assertion would be red on a fresh clone, so
    the shape is checked at run time by the first test and `subject` is cast.
  - **5.5** uses one-directional parity only. `describeMeta` takes a `PluginMeta` that the
    starter has not merged yet, so requiring the reverse direction would require the exercise
    to be finished before it compiled.
- **5.6 grades the consuming half only, and this is a deviation from the row above.** A
  declaration file must sit beside the `.js` it describes and be named after it, so there can
  be exactly **one** — `starter.ts` and `solution.ts` cannot each own a version to be graded
  against, and shipping an incomplete one breaks the fresh-clone invariant, since a missing
  declaration is `TS7016` under `strict` rather than a silent `any`. The authoring is taught by
  the lesson page and by `text-utils.d.ts`, which is written as a worked example with its four
  judgement calls argued in the comments.

## Course 6 — Tooling and Config

**Complete.** Course published (`draft: false`). **This completes the track.**

| # | Slug | L | E | Docs source | ELI5 angle | Exercise |
|---|---|---|---|---|---|---|
| 1 | `the-compiler-and-cli` | [x] | — | `typescript-tooling-in-5-minutes`, `compiler-options` | A spellchecker reads your letter and circles the mistakes. A typewriter produces the letter. TypeScript ships both in one program. | **No exercise** — a CLI tour |
| 2 | `tsconfig-tour` | [x] | — | `tsconfig-json`, `/tsconfig/` | A washing machine has thirty programmes. You use three. Nobody tells you which three. | **No exercise** — annotated `tsconfig.json` walkthrough |
| 3 | `strictness-flags` | [x] | [x] | `/tsconfig/#strict`, `#noUncheckedIndexedAccess`, `#exactOptionalPropertyTypes`, `#noImplicitOverride` | A car with no warning lights is not reliable. It has stopped telling you things. | **Every flag is a question you have to answer** — `firstLine`, `cellAt`, `sumOf`, `parseJson` over an `unknown` catch, an exhaustive `labelFor`, `isLevel`/`parseLines` |
| 4 | `erasable-syntax-and-enums` | [x] | [x] | `enums`, `/tsconfig/#erasableSyntaxOnly` | A sticker comes off a laptop and the laptop still works. A welded bracket does not. | **Peel it off, or weld it on** — replace an `enum` with `as const` + `keyof typeof`, derive both unions, and prove exhaustiveness twice (switch and `Record`) |
| 5 | `project-references` | [x] | — | `project-references`, `/tsconfig/#isolatedModules` | A restaurant does not re-prep the kitchen because one order changed. | **No exercise** — needs multiple tsconfigs, the wrong shape for one directory |
| 6 | `watch-and-incremental` | [x] | — | `configuring-watch`, `/tsconfig/#incremental` | Someone who has read the whole manuscript can tell you what one changed paragraph broke. | **No exercise** — config-shaped |
| 7 | `build-tools-and-transpilers` | [x] | — | `integrating-with-build-tools`, `babel-with-typescript`, `modules/guides/choosing-compiler-options`, `nightly-builds` | Two people work on the letter. One reads it for mistakes, one retypes and posts it. They never speak. | **No exercise** — config-shaped |

Lesson 4 is the best exercise in the track, and it exists *because* of the constraint the
exercises are authored under. See `src/exercises/README.md`.

### Decisions made while writing course 6

- **`exactOptionalPropertyTypes` stays off, and the reason became the lesson.** The row above
  promised 6.3 would exercise it. Turning it on produces exactly **three** errors across all 37
  exercises — and all three are in tests that *deliberately* pass `{ name: undefined }` to an
  optional property, because that distinction is what lessons 1.8 and 3.8 teach. The flag would
  break content whose purpose is explaining what the flag changes. So 6.3 exercises the five
  flags that **are** on (`strictNullChecks`, `noUncheckedIndexedAccess`,
  `useUnknownInCatchVariables`, `noFallthroughCasesInSwitch`, `noImplicitAny`) and the lesson
  teaches `exactOptionalPropertyTypes` in prose, using that three-error measurement as the
  illustration: a strictness flag's cost is counted in real files, not in principle.
- **6.3 is inverted relative to its row.** "Fix a deliberately sloppy module" is impossible
  here for the same reason lesson 1.1's original brief was: a fresh clone has to typecheck, so
  the package cannot contain sloppy code. The exercise instead puts the learner at each point
  where a flag *stops them writing the obvious thing*, which teaches the same content and is
  gradeable. Same fix as course 1 lesson 1, arriving for the same reason.
- **6.4 uses Pattern A for its two type-level TODOs**, with the unions written out longhand as
  the legal placeholder and an `Expect<Equals<…>>` under each. The honest limitation applies —
  it grades correctness, not effort — so three tests were tightened to also call a function the
  placeholders cannot fake.
- **`as const` is not `Object.freeze`, and finding that out cost a debugging round.** 6.4's test
  writes to `STATUS.Queued` behind a `@ts-expect-error` to show the compiler refusing it. The
  write **lands** — `readonly` is erased — and it corrupted `STATUS` for every later test in the
  file, failing six of them. The test now restores the value in a `finally` and asserts
  `Object.isFrozen(STATUS) === false`, which turns the accident into the point.
- **The `assert.deepEqual` narrowing trap recurred** in 6.3, on the `parseJson` result: a
  `Expect<Equals<typeof result.value, unknown>>` placed after the `deepEqual` was checking the
  narrowed literal type. Type assertions before runtime ones, as established in course 3.

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

### Tutorials

| Docs page | Lesson |
|---|---|
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
| All of **JavaScript** — JS Projects Utilizing TypeScript, Type Checking JavaScript Files, JSDoc Reference — plus **Creating .d.ts Files from .js files** and the **Migrating from JavaScript** tutorial | Course 7 was cut. This track teaches people who write `.ts` files, and `allowJs` / `checkJs` / JSDoc-as-types is a migration concern rather than a TypeScript one |
| JSX | Was 7.4, cut with the course. Also had no possible exercise: `.tsx` is not type-stripped by Node |
| DOM Manipulation | Was 7.5, cut with the course. Also had no possible exercise: no DOM in `lib: ["es2024"]` |

## Exercise gaps

37 of 46 lessons carry a runnable exercise. The nine that do not, grouped by reason:

- **Cannot run under Node's type stripping** — 4.5 decorators, which need code
  generation. Taught fully in prose with real syntax, and the lesson explains on the page
  why the code it just showed you cannot be run here. Note that no compiler flag catches
  this: `erasableSyntaxOnly` has no opinion on decorators, verified against tsc 6.0.3.
- **Config-shaped** — 5.2, 6.1, 6.2, 6.5, 6.6, 6.7. Annotated configuration samples in
  prose instead; 6.5 would additionally need several tsconfigs.
- **Nothing runnable to assert** — 5.7 (5.6 carries the writing exercise) and 5.8,
  publishing being a registry action.

## Open questions

Both are now resolved. Kept as a record, because the reasoning is the kind of thing
that gets re-derived from scratch otherwise.

**~~Type-level exercises~~ — SETTLED at the start of Phase 3.** No new machinery, no
relaxed parity check, no second tsconfig. Three facts, each verified against tsc 6.0.3
before any of Course 3 was written:

1. **Type-only exports are not part of `typeof module`.** The API-parity check compares
   the module's *value* namespace, so `starter.ts` and `solution.ts` may export
   genuinely different type aliases and parity still holds. The premise of the original
   question was wrong.
2. **The `Equals` trick works**, and rejects wrong answers rather than passing
   vacuously — including telling `{ a?: string }` apart from `{ a: string | undefined }`,
   which is the check people usually get wrong:
   ```ts
   type Equals<A, B> = (<G>() => G extends A ? 1 : 2) extends <G>() => G extends B ? 1 : 2
     ? true
     : false
   type Expect<T extends true> = T
   ```
3. **A type assertion referencing `starter` cannot live in `solution.test.ts`.** It would
   be red on a fresh clone, breaking the second invariant. It has to live in `starter.ts`
   itself, where the placeholder can satisfy it.

That gives two patterns, and every Course 3 lesson uses one of them:

**Pattern A — re-derive a type, graded by `typecheck`.** The learner authors the type in
`starter.ts`, which carries its own `Expect<Equals<…>>` self-check. The placeholder is a
legal *cheat* that satisfies the assertion, so a fresh clone is green:

```ts
// TODO: express this as a mapped type instead of delegating.
export type MyPartial<T> = Partial<T>
type _check = Expect<Equals<MyPartial<Settings>, Partial<Settings>>>
```

Replace the cheat with a real mapped type and the assertion still has to hold — so
`pnpm --filter exercises typecheck` is the grader, and it names the file and line. Used
where a built-in or a concrete target exists to check against: **3.6** and **3.8**,
which are exactly the lessons whose point is "you already know how these are built".

**Pattern B — write the runtime counterpart, graded by `attempt`.** The type is given
identically in both files and the exercise is the code that produces a value of exactly
that shape. This is what real code does — a mapped type is usually the reason a
`Object.fromEntries` cast is safe — and it cannot be written without understanding the
type precisely. `solution.test.ts` proves the given type is right with `Equals` against
`solution`. Used in **3.3, 3.4, 3.5, 3.7, 3.9**.

**3.1 and 3.2 need neither.** A generic *function* has its signature given and its body
as the work, which the existing machinery already grades.

**~~`allowJs` / `checkJs`~~ — MOOT.** This existed only for Course 7, whose two
JavaScript-interop exercises would have wanted a `.js` file in a package whose tsconfig
includes `**/*.ts` and nothing else. Course 7 was cut, so no exercise needs `allowJs` and
the flag stays off. Worth keeping the note: turning it on affects *every* exercise's
typecheck, so it was never a per-directory decision.

---

## Lesson template

Copy this shape. It is what keeps 46 lessons consistent without re-deciding structure
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
