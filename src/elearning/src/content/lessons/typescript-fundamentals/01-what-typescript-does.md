---
title: What TypeScript actually does
course: typescript-fundamentals
order: 1
summary: TypeScript is a program that reads your program before anyone runs it, and then vanishes. Knowing exactly when it is watching — and when it has stopped — explains most of what beginners find surprising.
duration: 9
exercise: true
draft: false
---

Imagine you write a letter and hand it to a friend who is very good at spelling. They read it,
circle the mistakes, and give it back. Then they go home. The letter you post is the letter you
wrote — their circles are not in the envelope.

That is the whole job. TypeScript reads your code, tells you what looks wrong, and then removes
itself completely before the code runs.

## A reader that goes first

Your friend cannot un-post a letter. They have to read it *before* it goes in the postbox, or
they are no help at all.

TypeScript works the same way, and this is what people mean when they call it a **static** type
checker: "static" just means "without running it". You run a program called `tsc`, it reads every
file, and it reports what it does not believe. JavaScript on its own has no such step — it finds
out that `user.nmae` is undefined at the moment some real person clicks the button.

```ts
const total = 5
total.toUpperCase()
//    ^^^^^^^^^^^ Property 'toUpperCase' does not exist on type 'number'.
```

Nothing has run here. No browser is open. TypeScript worked out that `total` holds a number, knows
numbers have no `toUpperCase`, and said so — in your editor, seconds after you typed it.

```quiz
id: typescript-fundamentals-what-typescript-does-q1
q: When does TypeScript report a type error?
- [x] Before the program runs, when the compiler reads the code
- [ ] The first time the faulty line is reached at runtime
- [ ] Whenever a value of the wrong type is assigned at runtime
- [ ] Only when you explicitly call a validation function
explain: TypeScript is a *static* checker — it works entirely by reading source code, with nothing running. That is also its limitation: it can only catch what is visible in the code it reads.
```

## Then it gets out of the way

Here is the part that surprises almost everyone. The types are not merely *ignored* at runtime —
they are **gone**. Deleted. Compiling TypeScript is mostly an exercise in erasing things.

This file:

```ts
interface User {
  name: string
  age: number
}

function greet(user: User): string {
  return `Hello, ${user.name}`
}
```

becomes this one, and this is genuinely all of it:

```js
function greet(user) {
  return `Hello, ${user.name}`
}
```

The `interface` produced nothing at all, because an interface is a note to the compiler, not a
thing that exists. The annotations were snipped out. Node and the browser never see a single type,
which is why TypeScript adds nothing to your bundle and cannot slow your program down.

It is also why `typeof` is your only option at runtime. There is no `user instanceof User` for an
interface — by the time that line runs, `User` has not existed for some time.

```quiz
id: typescript-fundamentals-what-typescript-does-q2
q: Which of these still exist in the JavaScript that actually runs?
- [ ] An `interface User { … }` declaration
- [ ] The `: string` on a function parameter
- [x] A `function greet(user) { … }` declaration
- [x] A `const MODES = ['dark', 'light']` array
explain: Interfaces and annotations are erased — they were only ever instructions to the compiler. Functions and arrays are ordinary JavaScript values that happen to have been written in a `.ts` file, so they survive untouched.
```

## Where the reading stops

Your spelling-checking friend can only check the letter you showed them. If a stranger posts
something through your door tomorrow, it has not been checked by anyone.

Every value that enters your program from outside is that stranger: a `fetch` response, a parsed
JSON file, a form field, a command-line argument, a database row. TypeScript was not there when it
arrived. So an annotation on incoming data is not a check — it is a **promise you make to the
compiler**, and the compiler takes your word for it:

```ts
const user: User = JSON.parse(text) // compiles happily
console.log(user.name.toUpperCase()) // may explode at runtime
```

`JSON.parse` is typed as returning `any`, which is TypeScript's way of saying "I have no idea, do
what you like". You promised the result was a `User`. If the file actually contained
`{"name": 42}`, nobody ever disagreed with you, and the crash lands three functions away from the
lie.

The fix is not a better annotation. It is a function that looks:

```ts
function parseUser(raw: unknown): User | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const { name, age } = raw as Partial<User>
  if (typeof name !== 'string' || typeof age !== 'number') return undefined
  return { name, age }
}
```

That is real code, it survives erasure because it is just `if` statements, and it is the only kind
of check that works on a value the compiler never saw. Writing one is the exercise below.

```quiz
id: typescript-fundamentals-what-typescript-does-q3
type: true-false
q: Annotating a `fetch` result as `User[]` makes TypeScript verify the response at runtime.
answer: false
explain: The annotation is erased before the program runs, so there is nothing left to do any verifying. It tells the compiler what to *assume* from that point on — if the server sends something else, the first thing you learn is a crash somewhere downstream.
```

## What to take away

- TypeScript runs before your program and produces nothing but complaints; `tsc` is a reader, not
  a runtime.
- Types are erased entirely, so they cost nothing at runtime and cannot be inspected there.
- An annotation on data from outside is a promise, not a check — and the compiler always believes
  you.
- Validate at the boundary with ordinary runtime code, and everything inside the boundary is
  genuinely as safe as the compiler claims.
