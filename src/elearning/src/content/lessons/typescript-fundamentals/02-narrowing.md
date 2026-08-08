---
title: Narrowing and control flow
course: typescript-fundamentals
order: 2
summary: A union type is a promise that a value is one of several things. Narrowing is how TypeScript follows your own checks to work out which one it is on any given line.
duration: 9
draft: false
---

A union says a value could be one of several types:

```ts
function format(input: string | number) {
  // input is string | number here
}
```

Inside that function you cannot call `.toUpperCase()` yet — it exists on `string` but not on
`number`, and TypeScript only lets you use what is available on *every* member of the union.

## The checks you already write

The fix is not a cast. It is the same runtime check you would write anyway:

```ts
function format(input: string | number) {
  if (typeof input === 'string') {
    return input.toUpperCase() // input: string
  }
  return input.toFixed(2) // input: number
}
```

TypeScript follows the control flow. Inside the `if`, the only surviving member of the union is
`string`. After the `if` returns, `string` has been eliminated, so the remaining type is `number` —
no `else` required. This is **narrowing**, and it is why idiomatic TypeScript tends to look like
ordinary defensive JavaScript.

```quiz
id: ts-narrowing-after-return
q: After the `if (typeof input === 'string') { return ... }` block returns, what is the type of `input`?
- [ ] `string | number`
- [x] `number`
- [ ] `string`
- [ ] `unknown`
explain: The `if` branch returns, so any code after it is only reachable when the check was false. TypeScript removes `string` from the union, leaving `number`. You do not need an `else`.
```

## The narrowing operators

Several everyday constructs narrow, each suited to a different shape of type:

| Construct | Narrows | Best for |
| --- | --- | --- |
| `typeof x === 'string'` | primitives | `string`, `number`, `boolean`, `symbol` |
| `x instanceof Date` | class instances | anything constructed with `new` |
| `'radius' in shape` | object shape | unions of object types |
| `x === null` | exact values | `null` / `undefined` checks |
| `Array.isArray(x)` | arrays | `T[] | T` |

The `in` operator is the one people reach for least and probably should reach for more:

```ts
type Shape = { kind: 'circle'; radius: number } | { kind: 'square'; side: number }

function area(shape: Shape) {
  if ('radius' in shape) {
    return Math.PI * shape.radius ** 2 // circle
  }
  return shape.side ** 2 // square
}
```

```quiz
id: ts-narrowing-operators
q: Which of these will narrow a `string | number | Date` union?
- [x] `typeof value === 'string'`
- [x] `value instanceof Date`
- [x] `typeof value === 'number'`
- [ ] `value.length > 0`
explain: `typeof` handles the primitives and `instanceof` handles the class instance. Reading `.length` is not a narrowing check — and it will not even compile, because `length` does not exist on every member of the union.
```

## Discriminated unions

When each member of a union carries a shared literal-typed field, that field becomes a
*discriminant*, and narrowing gets much sharper:

```ts
type Result =
  | { status: 'ok'; data: string }
  | { status: 'error'; message: string }

function show(result: Result) {
  switch (result.status) {
    case 'ok':
      return result.data // only exists on the ok branch
    case 'error':
      return result.message
  }
}
```

This is the pattern worth designing *toward*. Because the discriminant is a literal type, one
comparison collapses the union to exactly one member, and TypeScript can tell you when a `switch`
has missed a case.

```quiz
id: ts-discriminant-requirement
type: true-false
q: A discriminated union requires every member to share a field whose type is a literal.
answer: true
explain: The shared field must be literal-typed — `'ok'` and `'error'`, not `string`. If the field were typed `string`, comparing it could not eliminate any member, and no narrowing would happen.
```

## What to take away

- Narrowing follows the checks you would write anyway; it is rarely worth reaching for a cast.
- A returning `if` narrows the code after it, so `else` is often unnecessary.
- `typeof`, `instanceof`, `in` and `===` each narrow a different shape of type.
- Design unions with a shared literal discriminant and narrowing becomes almost automatic.
