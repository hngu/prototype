---
title: A sticky note on a method
course: typescript-classes
order: 5
summary: A decorator is a function that wraps a class member at the moment the class is defined, and modern TypeScript implements the JavaScript standard rather than its own old design. You will be able to read one, write a method decorator, and tell the two incompatible flavours apart from a single line of code.
duration: 12
exercise: false
draft: false
---

Somebody sticks a note on the office kettle: *check the water first*. The kettle has not changed. But
from now on, everyone who reaches for it does one extra thing.

A decorator is that note, attached to a class member, and read once when the class is defined rather
than every time somebody uses it.

## A function that wraps a member

At heart a decorator is a plain function that the runtime calls for you. Here is a complete one that
logs every call to a method:

```ts
function logged<This, Args extends unknown[], R>(
  target: (this: This, ...args: Args) => R,
  context: ClassMethodDecoratorContext,
) {
  return function (this: This, ...args: Args): R {
    console.log(`calling ${String(context.name)}`)
    return target.call(this, ...args)
  }
}

class Greeter {
  @logged
  greet(name: string): string {
    return `hi ${name}`
  }
}
```

Two arguments in, one function out. `target` is the method as written; `context` describes what is
being decorated — its `name`, its `kind`, whether it is `static`, and an `addInitializer` hook. Return
a replacement and it takes the original's place; return nothing and the original stands.

The timing is the part to get straight: `logged` runs **once**, when the class is evaluated. The
wrapper it returned runs on every call. So a decorator's own work is setup, not per-call work, and
anything expensive belongs in the outer function rather than the inner one.

Note also that `@logged` is not applied to `Greeter` — it is applied to `greet`. There are decorators
for classes, methods, getters, setters, fields and auto-accessors, each with its own context type and
its own rules about what a useful return value is.

```quiz
id: typescript-classes-decorators-q1
q: How many times does the *outer* `logged` function run for `class Greeter { @logged greet() {} }`, given ten calls to `greet`?
- [x] Once, when the class is defined
- [ ] Ten times, once per call
- [ ] Eleven times — once at definition and once per call
- [ ] Once per instance of `Greeter`
explain: A decorator is applied while the class is being constructed as a value, before any instance exists. The function it *returns* is what runs per call. Getting this backwards is the standard performance mistake: expensive setup written inside the returned wrapper instead of around it, paid on every invocation for no reason.
```

## Configuring one, and the extra layer

Most decorators you meet take arguments, and that changes the shape by one function:

```ts
function retry(times: number) {
  return function <This, Args extends unknown[], R>(
    target: (this: This, ...args: Args) => Promise<R>,
    _context: ClassMethodDecoratorContext,
  ) {
    return async function (this: This, ...args: Args): Promise<R> {
      let last: unknown
      for (let attempt = 0; attempt < times; attempt++) {
        try {
          return await target.call(this, ...args)
        } catch (error) {
          last = error
        }
      }
      throw last
    }
  }
}

class Api {
  @retry(3)
  async fetchUser(id: string): Promise<User> {
    /* … */
  }
}
```

`@retry(3)` is a **call**, and what it returns is the decorator. So there are three layers: the
factory that takes configuration, the decorator that takes the method, and the replacement that takes
the arguments. Recognising which layer you are in is most of reading decorator code, and the
convention is worth leaning on — `@logged` bare, `@retry(3)` called.

The other tool on `context` is `addInitializer`, which registers work to run when each instance is
built. That is how a decorator binds a method to its instance, or registers it in a table:

```ts
function bound(_target: unknown, context: ClassMethodDecoratorContext): void {
  context.addInitializer(function (this: unknown) {
    const self = this as Record<string, unknown>
    self[context.name as string] = (self[context.name as string] as Function).bind(this)
  })
}
```

```quiz
id: typescript-classes-decorators-q2
q: What is the difference between `@logged` and `@retry(3)` as written above?
- [x] `retry` is a factory that is called first, and returns the actual decorator
- [ ] `retry` decorates the class while `logged` decorates the method
- [ ] `@retry(3)` runs three times and `@logged` runs once
- [ ] `retry` must return a value while `logged` may return nothing
explain: A decorator *factory* takes configuration and returns a decorator, which is why the parentheses are there — `@retry(3)` evaluates `retry(3)` at class-definition time and applies the result. Both decorate methods, and both are free to return a replacement or nothing at all; the layering is the only difference.
```

## Two incompatible flavours, and one line that tells them apart

This is where decorators get genuinely confusing, and it is historical rather than technical.
TypeScript shipped decorators years before JavaScript standardised them, and the two designs are
**not compatible**. Modern TypeScript implements the standard; the old design lives on behind
`experimentalDecorators: true`.

| | Standard (TypeScript 5.0+) | Legacy (`experimentalDecorators`) |
| --- | --- | --- |
| Method decorator signature | `(target, context)` | `(target, key, descriptor)` |
| Parameter decorators | **not supported** | supported |
| Metadata | `context.metadata` / `Symbol.metadata` | `emitDecoratorMetadata` + `reflect-metadata` |
| Status | in the language | frozen, still widely deployed |

The single line that identifies which you are reading: **a legacy method decorator takes three
arguments and the third is a `PropertyDescriptor`.** If you see `descriptor.value = …`, it is legacy.

The practical consequence is that the two do not mix, and if you use Angular or NestJS or TypeORM you
are using legacy decorators whether you meant to or not — those frameworks lean on parameter
decorators and `emitDecoratorMetadata`, and the standard design deliberately has neither. That is not
a bug in your setup; it is why the flag still exists.

The advice that follows: **write new decorators against the standard, and do not reach for one just
because it fits.** A decorator moves behaviour away from the code it affects, which is exactly what
you want for logging or authorisation and exactly what you do not want for anything a reader needs to
see to understand the method. A higher-order function is usually clearer and always easier to test.

### Why this lesson has no exercise

Every other coding lesson in this track ships a runnable exercise with tests you can execute. This
one cannot, and the reason is the subject of the lesson.

The exercises run on Node directly, which executes TypeScript by **erasing** types rather than
compiling them. Decorators are not types — `@logged` has to be turned into a real function call
wrapping a real method, which is code generation. So Node refuses at the parser:

```text
@logged
^
SyntaxError: Invalid or unexpected token
```

Worth knowing precisely: `erasableSyntaxOnly`, the compiler flag that catches `enum` and parameter
properties for us, has **no opinion** on decorators. `tsc --noEmit` reports nothing at all, and the
first sign of trouble is the runtime failing to parse the file. Same story for the `accessor` keyword.
That is a genuine gap in the toolchain rather than something we chose.

Turning that into the lesson beats pretending it is not there. Decorators are the clearest example in
the language of the seam this course keeps returning to: most TypeScript is a sticker you peel off,
and a few features are welded on. Anything welded on needs a build step, and needing a build step is a
real cost to weigh before adopting it.

```quiz
id: typescript-classes-decorators-q3
q: Why can Node run most TypeScript directly but not a file containing a decorator?
- [x] Node erases type syntax, and a decorator has to be compiled into a real function call
- [ ] Decorators are only supported with `experimentalDecorators`, which Node does not read
- [ ] Node needs `--experimental-decorators` to be passed explicitly
- [ ] Decorators work, but their metadata is missing without a compiler
explain: Type stripping deletes annotations and leaves the JavaScript underneath; there is no JavaScript underneath `@logged` until something generates the call that applies it. This is the same reason `constructor(private x)` fails — both are syntax that means "generate code", not "ignore me". The distinction between erasable and generated syntax decides what any type-stripping runtime can execute, and Course 6 gives it a lesson of its own.
```

## What to take away

- A decorator is a function applied once, when the class is defined; the function it returns is what
  runs per call, and putting expensive work in the wrong one of those is the usual mistake.
- `@name` is a decorator and `@name(args)` is a factory call that returns one — three layers, and
  knowing which you are in is most of reading the code.
- Standard and legacy decorators are incompatible designs: three arguments with a
  `PropertyDescriptor` means legacy, and frameworks like Angular and NestJS still require it.
- Decorators need code generation, so a runtime that only erases types cannot run them at all — and
  no compiler flag will warn you, which makes it a cost to weigh deliberately.
