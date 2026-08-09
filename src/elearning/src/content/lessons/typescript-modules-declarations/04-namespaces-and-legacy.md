---
title: Filing cabinets and moving house
course: typescript-modules-declarations
order: 4
summary: "Namespaces and triple-slash directives are how TypeScript organised code before JavaScript had modules, and you will meet them in code you inherit. You will be able to read all three legacy forms, say which one is still the right tool, and migrate a namespace to modules without breaking its callers."
duration: 11
exercise: true
draft: false
---

Before buildings had folders, they had filing cabinets: one enormous cabinet, drawers inside drawers,
and a label on every drawer telling you what was nested where.

That was TypeScript in 2012. JavaScript had no modules, and something had to stop every script sharing
one global scope. This lesson is about what it built, and how to move out.

## What a namespace was for

A `namespace` is an object built by an IIFE, with a nice syntax over the top:

```ts
namespace Geometry {
  export namespace Area {
    export function circle(radius: number): number {
      return Math.PI * radius ** 2
    }
  }
}

Geometry.Area.circle(2)
```

Compiled, that is an object literal being progressively assigned to. Which explains its two real
features. It could **merge across files** — two files both declaring `namespace Geometry` contribute to
one object, because each just adds properties. And with `/// <reference path="./area.ts" />` at the top
of a file, `tsc` would concatenate an ordered pile of files into one script, with no module loader
anywhere. For a browser in 2013 with no bundler, that was the only game in town.

Note what the `export` keyword is doing there: inside a namespace it means "visible outside this
namespace", which is a different question from "visible outside this file". Both meanings of the same
word, in the same language, is a fair summary of why this feature is confusing.

```quiz
id: typescript-modules-declarations-namespaces-and-legacy-q1
q: Why could two files both declare `namespace Geometry` without conflicting?
- [x] A namespace compiles to an object that each file adds properties to
- [ ] TypeScript deduplicates identical namespace declarations at compile time
- [ ] Namespaces are types, and types merge by design
- [ ] Because `/// <reference />` renames one of them
explain: The compiled output is `var Geometry = Geometry || {}` followed by assignments, so a second file contributing more properties is just more assignment — merging is a consequence of the implementation rather than a designed feature. A namespace does declare a type as well as a value, but the merging happens to both for the same underlying reason, and nothing is deduplicated or renamed.
```

## Why modules replaced them

Once JavaScript had real modules, namespaces were solving a problem that no longer existed — and
solving it worse. Three concrete costs, none of them stylistic:

**Tree-shaking cannot work.** Reading one property off a nested object requires the whole object to
exist, so a bundler must keep all of it. A named import from a module tells the bundler exactly what was
used.

**Two mechanisms for one job.** `Geometry.Area.circle` encodes a hierarchy in a *name*, because in 2012
there was nowhere else to put it. Modules have a directory and a filename. Doing it both ways means
every reader has to learn your naming convention as well as your file layout.

**Fully qualified names glue everything together.** Namespace code refers to its own siblings through
the top-level object — `Geometry.Convert.FEET_PER_METRE` from inside `Geometry.Convert`. Nothing can be
moved without touching its callers, which is exactly the property you do not want in code you intend to
reorganise.

If what you want is one name to hang things off, modules already have it:

```ts
import * as geometry from './geometry.ts'
geometry.circleArea(2)
```

That reads the same and is a *view* over the module rather than a value inside it, so the bundler still
sees which members you touched. It is the modern spelling of the only nice thing about namespaces.

```quiz
id: typescript-modules-declarations-namespaces-and-legacy-q2
q: Which is the real technical cost of organising code with nested namespaces rather than modules?
- [x] A bundler cannot tell which members were used, so it must keep the whole object
- [ ] Namespaces are slower to type-check
- [ ] Namespaces cannot contain types, only values
- [ ] Namespace members are always public
explain: Property access on an object is not statically analysable in the way a named import is, so tree-shaking is impossible through a namespace — the real, measurable cost. Namespaces hold types perfectly well, and a member without `export` is genuinely private to the namespace, so the last two are simply false.
```

## The one legacy form that is still correct

Namespaces are not entirely dead, and the surviving use is worth knowing because it is not a hack.

**In a declaration file, describing something that really is a nested object.** A global script that
attaches `window.Stripe.elements` genuinely has that shape, and `declare namespace` is how you say so:

```ts
declare namespace Stripe {
  interface Elements {
    create(kind: string): unknown
  }
  function elements(): Elements
}
```

No code is generated — a `.d.ts` emits nothing at all — so none of the objections apply. This is
description, not organisation.

The other survivor is `declare module 'name'`, which is how you type a package that ships no types of
its own. Lesson 6 is about writing these properly.

`/// <reference types="…" />` also still has one job: pulling in a global type package from inside a
declaration file, where an `import` would change the file's meaning. `/// <reference path="…" />` for
ordering your own source files is the part that is genuinely obsolete — `import` does it better, and
`tsc`'s `outFile` concatenation mode should be treated as a museum piece.

```quiz
id: typescript-modules-declarations-namespaces-and-legacy-q3
q: When is `namespace` still the right tool in modern TypeScript?
- [x] In a declaration file, describing a global object that really is nested
- [ ] For grouping related helpers inside a module, to avoid long import lists
- [ ] For anything that needs to merge across two files
- [ ] Never — it is an error under modern compiler settings
explain: Describing the actual shape of `window.Stripe.elements` is description rather than organisation, and a declaration file generates no code, so none of the usual objections apply. Merging across files is better done with module augmentation, which the next lesson covers. And it is not an error — though it *is* rejected under `erasableSyntaxOnly`, because it needs code generation, which is why this course's exercises show the shape a namespace produces rather than the keyword itself.
```

## Moving out without breaking anyone

Nobody converts a codebase in one commit, and a migration that cannot be done gradually does not get
done. The sequence that works:

1. **Add the flat exports** beside the old shape. Nothing breaks, because nothing changed.
2. **Add a shim** presenting the old nested shape, built by *referencing* the new functions:

   ```ts
   /** @deprecated Use the named exports. */
   export function asLegacyShape(): LegacyShape {
     return { Area: { circle: circleArea }, /* … */ }
   }
   ```

3. **Move call sites** a few at a time, at whatever pace the team has.
4. **Delete the shim.** That commit is what proves the migration finished.

The discipline that makes step 4 reachable: the shim holds **references**, never copies. A shim with its
own logic is a second implementation to keep in step — and nothing new should call through it, or you
have replaced one nested object with a permanent one.

## What to take away

- A namespace is an object built by an IIFE; merging across files and `/// <reference path>`
  concatenation were its features, and both existed because JavaScript had no modules yet.
- Modules beat namespaces on tree-shaking, on not encoding a hierarchy twice, and on being moveable —
  `import * as ns` gives you the one thing worth keeping.
- `declare namespace` in a `.d.ts` is still correct, because describing a genuinely nested global object
  is not the same as organising your own code.
- Migrate with a deprecated shim that holds references rather than copies, and treat deleting it as the
  step that ends the job.
