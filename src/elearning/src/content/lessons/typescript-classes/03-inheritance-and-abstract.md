---
title: Inherit the machine, sign the form
course: typescript-classes
order: 3
summary: "`extends` hands down working code and `implements` only promises a shape, and knowing which one you want is most of designing a hierarchy. You will be able to use `abstract` members to make the compiler collect on a promise, and explain the two ordering rules in a subclass constructor."
duration: 11
exercise: true
draft: false
---

Inheriting a bakery gets you the ovens, the recipes and the staff. Signing a form saying you can bake
gets you nothing except an obligation to actually bake.

Both are useful. They are not the same, and TypeScript spells them `extends` and `implements`.

## The form, and the bakery

`implements` is a checked promise and nothing else:

```ts
interface Describable {
  describe(): string
}

class Version implements Describable {
  describe(): string {
    return 'v6.0.3'
  }
}
```

Not one line of behaviour arrives from `Describable`. If `describe` were missing the compiler would
complain, and that is the entire effect. Remember from course 1 that TypeScript is structural, so
`implements` is not even required for a `Version` to be usable as a `Describable` — it is a way of
being *told at the declaration* rather than at every call site, which is worth having.

`extends` is different: the subclass gets everything, working:

```ts
class TimestampedVersion extends Version {
  override describe(): string {
    return `${super.describe()} at ${new Date().toISOString()}`
  }
}
```

`super.describe()` reaches the implementation this one replaced. That is the move worth reaching for —
extend the inherited behaviour rather than restating it, so its details stay in one place.

The practical difference: a class may implement any number of interfaces and extend exactly **one**
class. So keep contracts as interfaces, and spend the single inheritance slot on the thing that
actually has code to share.

```quiz
id: typescript-classes-inheritance-and-abstract-q1
q: A class needs to satisfy three unrelated contracts and share code with one base. What shape does that take?
- [x] `class C extends Base implements A, B, D`
- [ ] `class C extends Base, A, B, D`
- [ ] Three separate classes, one per contract
- [ ] `interface C extends A, B, D` and a class implementing `C`
explain: One `extends` and any number of `implements` — which is exactly why contracts belong in interfaces. The last option is not wrong so much as incomplete: merging three interfaces into one is a fine thing to do when they genuinely travel together, but it does not address the base class, and it hides which of the three a given member came from.
```

## A promise the compiler collects on

An `abstract` member is a base class saying "I need this and cannot provide it":

```ts
abstract class Shape {
  protected readonly name: string

  constructor(name: string) {
    this.name = name
  }

  abstract area(): number

  describe(): string {
    return `${this.name} with area ${this.area().toFixed(2)}`
  }
}
```

Look at `describe`. It calls `this.area()`, which has no implementation anywhere in this class — and
it compiles, because `abstract` is a promise the compiler will collect from every subclass. So the
format is written once and every present and future shape gets it.

This is strictly better than a method whose body throws `new Error('not implemented')`. A subclass
that forgets is a compiler error rather than a bug found by a test, or by a user. And `abstract
class` cannot be constructed at all — `new Shape('x')` is refused — which stops the meaningless
object existing.

That last check is worth being precise about: it is the **compiler's** and nothing else's. `abstract`
is erased, so at run time `Shape` is an ordinary class, and a cast that gets past the compiler will
happily construct an object missing every method it promised.

```quiz
id: typescript-classes-inheritance-and-abstract-q2
q: What is the advantage of `abstract area(): number` over a concrete `area(): number { throw new Error('not implemented') }`?
- [x] A subclass that fails to supply it is a compile error rather than a run-time failure
- [ ] The abstract version is faster, because there is no method to look up
- [ ] Only the abstract version can be called from other methods of the base class
- [ ] The abstract version makes the base class impossible to instantiate
explain: The throwing version compiles perfectly and fails whenever the untested path finally runs; the abstract one is checked at every subclass declaration. The last option confuses two features — it is the `abstract` modifier on the **class** that blocks `new`, not the abstract member, and a class can be marked abstract without having any abstract members at all.
```

## Two ordering rules, and a field that vanishes

A subclass constructor must call `super(…)`, and there are two separate rules about where:

```ts
class Square extends Shape {
  readonly side: number

  constructor(side: number) {
    if (!Number.isFinite(side) || side <= 0) throw new RangeError('bad side')
    super('square')
    this.side = side
  }
}
```

You **may** run code before `super(…)`, as long as it does not touch `this` — validating an argument
is the usual reason, and doing it first means nothing half-built exists when the argument is bad. You
**may not** touch `this` before it, because the base constructor is what brings `this` into being.

Then there is a trap that is pure JavaScript, and TypeScript is unusually good about it. Field
declarations run *after* `super()` returns. So:

```ts
class Base {
  value = 'from base'
}

class Child extends Base {
  value: string // ← declared again, "just for the type"
}

new Child().value // undefined
```

The redeclaration is not a comment. It is a field definition, it runs after `super()` has already set
`value`, and it overwrites it with `undefined`. Under `strict` the compiler catches this and says so
precisely: *Property 'value' will overwrite the base property in 'Base'. If this is intentional, add
an initializer. Otherwise, add a 'declare' modifier or remove the redundant declaration.*

Both of those fixes are right in different situations. **Remove the declaration** when the base
already assigns the field — which is usually the case, and re-narrowing a type is not a good enough
reason to reintroduce the bug. Use `declare value: string` when something other than a constructor
does the assigning; it emits nothing at all, so nothing gets overwritten. It is also an unchecked
promise, exactly like a type assertion — nobody warns you if the assignment never happens.

```quiz
id: typescript-classes-inheritance-and-abstract-q3
q: A base class initialises `items = []`. A subclass redeclares `items: string[]` to narrow the type. What goes wrong?
- [x] The redeclaration runs after `super()` and resets the field to `undefined`
- [ ] Nothing — a redeclaration with a compatible type is erased
- [ ] The subclass field shadows the base one, so both exist and the base's is unreachable
- [ ] `tsc` allows it but the field becomes read-only in the subclass
explain: A field declaration is real JavaScript that runs on construction, in declaration order, after `super()` returns — so a bare redeclaration defines the property again with no value and wipes what the base assigned. This is the silent-`undefined` failure mode again, and the same one parameter properties cause under a runtime that only erases types. `strict` does report it, and the fix is almost always to delete the redundant line.
```

## What to take away

- `extends` hands down working code and you get one; `implements` is a checked promise and you get as
  many as you like. Put contracts in interfaces and spend the inheritance slot on shared code.
- An `abstract` member lets a base class write a method in terms of something it cannot compute, and
  the compiler collects that promise from every subclass — earlier and more reliably than a throwing
  stub.
- In a subclass constructor you may run code before `super(…)` but not touch `this`; validating
  arguments first means a bad argument never produces a half-built object.
- Redeclaring an inherited field overwrites it with `undefined`, because field declarations are code
  that runs after `super()`. Delete the redundant declaration.
