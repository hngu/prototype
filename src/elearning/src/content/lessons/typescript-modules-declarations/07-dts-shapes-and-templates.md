---
title: Six shapes a library can have
course: typescript-modules-declarations
order: 7
summary: "Before you can describe a library you have to work out what shape it is, and there are only about six. You will be able to identify which one you are looking at from its usage, pick the matching declaration template, and recognise the two shapes that are traps."
duration: 10
exercise: false
draft: false
---

A locksmith cutting a key for a door they have never seen starts by working out what kind of lock it is.
There are not many kinds. Once you know which, the rest is mechanical.

Declaration files are the same. The previous lesson was about writing the label; this one is about
identifying the exhibit first, because getting the shape wrong means everything after it is wrong too.

## Reading the shape off the usage

You do not need the source. How people *use* a library tells you what it exports:

| Usage in the wild | Shape |
| --- | --- |
| `import { readFile } from 'x'` | **Module with named exports** |
| `import x from 'x'; x(…)` | **Callable default** |
| `import x from 'x'; new x(…)` | **Constructable default** |
| `import x from 'x'; x.method(…)` | **Object with members** |
| `x.thing(…)` with no import at all | **Global** |
| `import 'x'` for the side effect | **Plugin / augmenting module** |

That is the whole taxonomy. Six shapes, and the first one covers most modern packages, which is worth
saying plainly — the elaborate cases below are mostly the pre-2015 ecosystem, and you meet them when
maintaining rather than when starting.

Two of them look alike and are not. A **callable default** is `export = function` territory; an **object
with members** is a plain object. Something that is both — callable *and* carrying properties, like the
classic `$('div')` plus `$.ajax()` — is a real shape and it is written as a function type with extra
members bolted on.

```quiz
id: typescript-modules-declarations-dts-shapes-and-templates-q1
q: A package is used as `import chalk from 'chalk'; chalk.red('hi')` and also `chalk('hi')`. What shape is it?
- [x] A callable object with members — an interface with a call signature plus properties
- [ ] A module with named exports
- [ ] A class, since it has both behaviour and members
- [ ] Two separate packages sharing a name
explain: An interface can carry a call signature *and* properties, which is exactly how you describe something used both as a function and as a namespace — the jQuery shape, and still common in CLI-adjacent packages. A class would be wrong because callers never write `new`, and named exports would not explain the direct call.
```

## The templates, in one place

**Module with named exports** — the default assumption:

```ts
export declare function readFile(path: string): Promise<string>
export declare const VERSION: string
export interface Options {
  encoding?: string
}
```

**Callable, ESM-style default:**

```ts
declare function slugify(text: string): string
export default slugify
```

**Callable, CommonJS-style** — for `module.exports = fn`:

```ts
declare function slugify(text: string): string
export = slugify
```

Those last two are not interchangeable, and picking wrong is the most common mistake in this whole area.
`export =` describes a module whose entire exports object *is* the thing; `export default` describes a
module with a `default` property. Get it backwards and consumers need a spurious `.default` — or lose
one. When the package is CommonJS, use `export =`; and note it is legal in a `.d.ts` even under
`erasableSyntaxOnly`, because declaration files emit nothing.

**Callable with members:**

```ts
interface Chalk {
  (text: string): string
  red(text: string): string
  level: 0 | 1 | 2 | 3
}
declare const chalk: Chalk
export default chalk
```

**Constructable:**

```ts
declare class Parser {
  constructor(options?: Parser.Options)
  parse(input: string): unknown
}
declare namespace Parser {
  interface Options {
    strict?: boolean
  }
}
export = Parser
```

That pairing of a `declare class` with a `declare namespace` of the same name is **declaration merging**
from lesson 5, and it is the idiomatic way to hang types off a constructor — `Parser.Options` as a type,
`new Parser()` as a value, one name.

**Global** — a script tag, no import anywhere:

```ts
declare global {
  interface Window {
    analytics: { track(event: string): void }
  }
}
export {}
```

The `export {}` is load-bearing: without it the file is a script rather than a module, and `declare
global` is only valid inside a module. Leave it off and the error is about `global` augmentation being
misplaced, which does not point at the missing line.

**Plugin** — a package that adds to another package's types:

```ts
import 'express'

declare module 'express' {
  interface Request {
    user?: { id: string }
  }
}
```

```quiz
id: typescript-modules-declarations-dts-shapes-and-templates-q2
q: A CommonJS package does `module.exports = parse`. Its declaration file uses `export default parse`. What do consumers see?
- [x] A module whose `default` property is the function, so they need an extra `.default` that does not exist at run time
- [ ] Exactly the right thing — `export default` and `export =` are equivalent
- [ ] A type error in the declaration file itself
- [ ] Nothing unusual, because `esModuleInterop` normalises it
explain: `export =` says the exports object *is* the function; `export default` says the module has a `default` property that is the function. Describing the first as the second puts a level of nesting into the types that is not there at run time, so the code that typechecks fails and the code that works does not. `esModuleInterop` normalises how a *correctly described* CommonJS module is imported — it cannot rescue a declaration that describes the wrong shape.
```

## The two shapes that are traps

**UMD globals.** A UMD library works as a module *and* as a global script tag, and `export as namespace
Chart` is how you say so. The trap is that the global is only available in a file that is not a module —
in a module you must import it, and TypeScript enforces that with `'Chart' refers to a UMD global, but
the current file is a module`. The error is correct and reads like an accusation.

**Packages with subpath exports.** `import { z } from 'lib/utils'` needs `lib/utils` to be declared, and
a modern package does that through the `exports` map in `package.json` with `types` first in each
condition — lesson 2's ordering trap. Writing a matching `.d.ts` per subpath is the mechanical part; the
part people miss is that adding `exports` makes every *unlisted* path private, so a declaration file for
a path the map does not expose is unreachable no matter how correct it is.

And the advice that saves the most time: **check whether the work is already done.** Look for a `types`
field in the package's `package.json`, then for `@types/<name>` on npm, and only then start writing.
DefinitelyTyped has around eight thousand packages in it. Writing a declaration file for one of them is a
commitment to tracking someone else's release schedule, and it is worth ten seconds of checking to avoid.

```quiz
id: typescript-modules-declarations-dts-shapes-and-templates-q3
q: A `.d.ts` uses `declare global { … }` and TypeScript reports that global augmentation is misplaced. What is usually missing?
- [x] A top-level `import` or `export` — `declare global` is only valid inside a module
- [ ] A `/// <reference types="node" />` at the top
- [ ] The `global` keyword needs `declare namespace global` instead
- [ ] The file must be listed in `typeRoots`
explain: A file with no top-level import or export is a script, whose declarations are already global — so `declare global` inside one is meaningless and rejected. Adding `export {}` makes it a module and fixes it. This is the same script-versus-module rule from lesson 1, and it is the single most common reason a global declaration file does not work.
```

## What to take away

- There are about six library shapes, and you can identify which from how people call the thing rather
  than from its source.
- `export =` and `export default` describe genuinely different modules; using the wrong one puts a level
  of nesting into the types that does not exist at run time.
- `declare class` merged with `declare namespace` of the same name is how you hang types off a
  constructor.
- `declare global` needs the file to be a module, so it needs an `export {}` — and before writing any of
  this, check whether `@types/<name>` already exists.
