---
title: A type made of string
course: typescript-type-manipulation
order: 7
summary: A template literal type gives a string a shape, so a malformed one is a compile error rather than a runtime check. It also comes with four built-in string transformations and one performance trap.
duration: 11
exercise: true
draft: false
---

A postcode is not just text. `CB1 2AB` fits and `banana` does not, and you knew that without looking
anything up, because a postcode has a shape.

TypeScript can give a string type that shape, which turns a whole category of runtime validation into
something the compiler does before you run anything.

## A pattern, not a description

The syntax is a template literal, in a type position:

```ts
type Method = 'GET' | 'POST' | 'DELETE'
type Route = `${Method} /${string}`

const a: Route = 'GET /users' // fine
const b: Route = 'PATCH /users' // Error
const c: Route = 'GET users' // Error — the slash is part of the type
const d: Route = 'GETusers' // Error — so is the space
```

The interesting consequence is what happens to the function that takes one:

```ts
function parseRoute(route: Route) {
  const space = route.indexOf(' ')
  return { method: route.slice(0, space) as Method, path: route.slice(space + 1) }
}
```

No validation. No error branch. No `undefined` in the return type. The malformed cases were rejected
at the call site, so they cannot arrive here — **push the check into the type and the runtime code gets
shorter rather than more careful.**

One honest limit, and it is the first thing you will hit. A plain `string` is refused even when it
happens to fit:

```ts
const fromConfig: string = readConfig()
parseRoute(fromConfig) // Error: string is not assignable to Route
```

Which is correct: nobody checked it. A pattern protects literals you wrote, not strangers that arrived
at run time — those still need a real check, or an honest cast at the boundary.

```quiz
id: typescript-type-manipulation-template-literal-types-q1
q: `type Route = ` + "`${'GET' | 'POST'} /${string}`" + `. Which values fit?
- [x] `'GET /users'`
- [x] `'POST /'`
- [ ] `'GET users'`
- [ ] A variable declared `const r: string = 'GET /users'`
explain: The space and the slash are part of the pattern, so `'GET users'` fails. And a `string` variable is refused however it happens to be spelled — the pattern constrains literal types, and a value that arrived at run time has to be checked before it can claim to fit.
```

## The four intrinsics

Four string transformations ship with the compiler:

| Type | Affects | Runtime twin |
| --- | --- | --- |
| `Uppercase<S>` | the whole string | `s.toUpperCase()` |
| `Lowercase<S>` | the whole string | `s.toLowerCase()` |
| `Capitalize<S>` | the first character | `s.charAt(0).toUpperCase() + s.slice(1)` |
| `Uncapitalize<S>` | the first character | `s.charAt(0).toLowerCase() + s.slice(1)` |

They are **intrinsic**: implemented natively rather than written in TypeScript, which is why there is
no fifth one and you cannot add one.

`Capitalize` is the one you will reach for, because it is what turns a property name into an event
name:

```ts
type Handlers<T> = {
  readonly [K in keyof T & string as `on${Capitalize<K>}Change`]: (next: T[K]) => void
}

type H = Handlers<{ theme: string; fontSize: number }>
// { readonly onThemeChange: (next: string) => void
//   readonly onFontSizeChange: (next: number) => void }
```

That is last lesson's `as` clause with a template literal in it, and it is the single most common real
use of both features. Note each handler's parameter is its *own* property's type, not a union of all of
them.

```quiz
id: typescript-type-manipulation-template-literal-types-q2
q: What is `Uppercase<'fontSize'>` and what is `Capitalize<'fontSize'>`?
- [x] `'FONTSIZE'` and `'FontSize'`
- [ ] `'FontSize'` and `'FONTSIZE'`
- [ ] `'FONTSIZE'` and `'fontsize'`
- [ ] Both `'FONTSIZE'`
explain: `Uppercase` transforms the whole string; `Capitalize` only the first character. Mixing them up is the standard mistake, and it produces `onFONTSIZEChange` — which compiles perfectly and is wrong.
```

## Distribution, and the trap that follows

A template literal type distributes over a union in **any** slot:

```ts
type Route = `${'GET' | 'POST' | 'DELETE'} /${string}`
// really: `GET /${string}` | `POST /${string}` | `DELETE /${string}`
```

Three patterns, not one pattern containing a union. That is what lets the compiler give a precise
error, and it is also the performance trap: two unions of ten members produce **a hundred** string
literals, and the compiler materialises all of them. Three slots of ten is a thousand. This is the
main way people accidentally make a project slow to typecheck, and the fix is always to stop being
clever with one slot rather than to optimise.

The other thing worth knowing is that patterns can **infer**, which is where this stops being a
labelling tool and becomes parsing:

```ts
type MethodOf<R> = R extends `${infer M} /${string}` ? M : never
type M = MethodOf<'GET /users'> // 'GET'
```

Combine that with recursion and you can split a string into a tuple of its parts, which is how typed
route params and typed `printf` formats are done in libraries. It is also where you should stop for
your own code. A type that parses strings is a type somebody else has to debug, and the error messages
when it goes wrong are among the worst TypeScript produces.

```quiz
id: typescript-type-manipulation-template-literal-types-q3
type: true-false
q: `` `${A}-${B}` `` where `A` and `B` are unions of 10 members each produces 20 string literal types.
answer: false
explain: It produces 100 — the cross product, because the template distributes over both slots. This is the most common cause of a suddenly-slow typecheck, and the reason to keep unions in template literal types small rather than to look for a compiler flag.
```

## What to take away

- A template literal type gives a string a shape, so the function receiving one needs no validation.
- A `string` variable never fits a pattern, however it is spelled — run-time values need a real check.
- `Uppercase` and `Lowercase` change the whole string; `Capitalize` and `Uncapitalize` change one
  character.
- Patterns distribute over unions in every slot, so the literal count multiplies — the usual cause of a
  slow typecheck.
