---
title: Two people, one page
course: typescript-modules-declarations
order: 5
summary: "Two declarations of one interface become a single type, and that is how you add a field to a library's types without forking it. You will be able to augment a module, extend a global, and recognise the two ways it goes wrong — one loud, one completely silent."
duration: 12
exercise: true
draft: false
---

Two people write on the same page. The page keeps both notes.

That is declaration merging, and it is the machinery behind every "how do I add a user field to Express's
`Request`?" answer you have ever pasted. Worth understanding rather than pasting, because the failure
modes are unusually confusing.

## The rule

Two declarations of the same interface name in the same scope become one interface:

```ts
interface PluginMeta {
  title: string
}

interface PluginMeta {
  author: string
}

const meta: PluginMeta = { title: 'Charts', author: 'ada' } // both required
```

Merging is **additive**. There is no way to remove a member, loosen one, or make one optional this way.
Two declarations of the same property with *different* types is an error — `Subsequent property
declarations must have the same type` — not a resolution.

The exception is methods, where a second declaration adds an **overload** rather than conflicting. That
is how a library can add a method to `Array<T>` without knowing what else is on it.

This is also the sharpest practical answer to "interface or type?". Merging is exactly what `interface`
can do and `type` cannot: a second `type PluginMeta` is `Duplicate identifier`. **If a consumer might
need to extend it, it has to be an interface.** For everything else the choice is mostly taste.

```quiz
id: typescript-modules-declarations-declaration-merging-q1
q: Two `interface Options` declarations in one file both declare `timeout`, one as `number` and one as `string`. What happens?
- [x] An error — merged declarations of the same property must have the same type
- [ ] The type becomes `number | string`
- [ ] The second declaration wins
- [ ] The property becomes `never`, since nothing satisfies both
explain: Merging is additive, not negotiated: a conflict is reported rather than resolved, which is what stops one file quietly changing another's meaning. The union answer is the tempting one because merging *feels* like combining — but it combines the sets of members, not the types of a shared member. Methods are the one case where a second declaration is accepted, and there it adds an overload.
```

## Reaching into somebody else's module

The version that earns its keep crosses a file boundary. `declare module` with a specifier reopens
another module's declarations:

```ts
import type { PluginContext } from './core.ts'

declare module './core.ts' {
  interface PluginContext {
    readonly requestId: string
    warn(message: string): void
  }
}
```

Now every file in the program sees a `PluginContext` with four members, including the library's own.
For a package you would write `declare module 'express'`, matching the specifier you import.

Two requirements, and both produce bad errors when missed. **The specifier must match how the file
imports the module.** And **the augmenting file must already be a module** — it needs a top-level
`import` or `export`, because in a script `declare module 'x'` means "declare a brand-new ambient
module called x", which is a different feature wearing the same syntax.

The sibling form is `declare global`, for genuinely global things:

```ts
declare global {
  interface Window {
    __APP_VERSION__: string
  }
}
```

Same caveat, same power. And the same thing to keep hold of, which is the most important sentence in
this lesson: **a merged interface is a claim about a value, and nothing checks it.** Adding
`requestId: string` does not create a request id. It stops the compiler complaining when you read one.
If no code actually supplies it, every read is `undefined` and the compiler has told you otherwise —
an augmentation with nothing behind it is a type assertion spread across two files.

```quiz
id: typescript-modules-declarations-declaration-merging-q2
q: You augment `Express.Request` with `user: User` and deploy. Requests arrive and `req.user` is `undefined`. What went wrong?
- [x] Nothing supplies the value — the augmentation is a claim, and middleware still has to set it
- [ ] The augmentation needs `declare global` to take effect at run time
- [ ] The property should have been declared optional for the assignment to work
- [ ] Express strips unknown properties from the request object
explain: Declaration merging is a type-level operation with no run-time component whatsoever, so it describes a value somebody else has to provide — here, authentication middleware assigning `req.user`. This is the single most common way the pattern is misused, and the reason to declare such fields optional unless you can guarantee the code path that sets them.
```

## The failure that points everywhere except at itself

Two ways this goes wrong, and they are worth knowing apart because only one of them tells you.

**A conflicting type is caught properly.** Declare `requestId: number` while your code assigns a string
and you get `TS2322` at the assignment.

**A mistyped specifier is silent.** Write `declare module './core-typo.ts'` and there is **no error on
that line at all** — TypeScript reads it as declaring a new ambient module that nobody imports, which is
a legitimate thing to do. The only symptom is `Property 'requestId' does not exist on type
'PluginContext'` at every use site, pointing at everywhere except the typo.

Then there is the one that bites hardest, and it is the library's fault rather than yours. If a library
declares a single interface that it also *constructs*, adding a required member to it breaks the
library's own code:

```text
error TS2739: Type '{ appName: string; log(…): void }' is missing the following
properties from type 'PluginContext': requestId, warn
```

A library that expects to be extended keeps two names — a concrete one it builds and guarantees, and an
empty extending one for consumers:

```ts
export interface PluginContextBase { appName: string; log(m: string): void }
export interface PluginContext extends PluginContextBase {}
```

When you are augmenting something that did not anticipate you, declare your additions **optional**. It
is the difference between extending a type and breaking one.

```quiz
id: typescript-modules-declarations-declaration-merging-q3
q: What is the effect of `declare module './core.ts' { … }` on files other than the one containing it?
- [x] Every file in the program sees the merged interface, including the library's own
- [ ] Only files that import the augmenting module see it
- [ ] Only the augmenting file, unless it is re-exported
- [ ] Every file, but the library's own code keeps the original
explain: An augmentation modifies the declaration itself, so it is program-global and unconditional — which is what makes it powerful and what makes it a poor fit for anything conditional or per-consumer. It is also why a monorepo with two packages augmenting the same interface differently has a genuine problem, and why the second option is such a tempting wrong answer: import graphs have nothing to do with it.
```

## What to take away

- Two declarations of one interface merge additively; conflicting property types are an error, and a
  second method declaration adds an overload.
- Merging is the one thing `interface` does that `type` cannot — if consumers might extend it, it has to
  be an interface.
- `declare module './x.ts'` and `declare global` reopen someone else's declarations, and the effect is
  program-global rather than scoped to importers.
- A merged member is a promise nothing verifies. Supply the value, or declare it optional — and expect a
  mistyped specifier to produce errors everywhere except where the mistake is.
