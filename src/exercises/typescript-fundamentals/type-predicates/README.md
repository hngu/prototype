# Sign your name to the check

A bouncer checks IDs at the door. Once they have waved you through, nobody inside
asks again — the whole room is running on the bouncer having done the job
properly.

A type predicate is you volunteering to be that bouncer. You write a function
whose return type says "if this returned true, the value **is** a string", and from
then on the compiler stops asking. It cannot verify the claim. It believes you.

Which is the deal: you get to teach TypeScript a check it could never have worked
out by itself, and in exchange the body has to be right.

## Goal

Implement the five functions in `starter.ts`. **No casts and no `any`.**

- **`isNonEmptyString(value)`** → `value is string`. True for a string with at
  least one non-whitespace character. So `'0'` and `' x '` are true; `''`, `'   '`,
  `'\n\t'`, `42`, `null` and an object with a `toString` are all false.
- **`isRecord(value)`** → `value is Record<string, unknown>`. True for a non-null
  object that is not an array. Two traps: `typeof null === 'object'`, and arrays are
  objects. A `Date` **does** pass — this guard is about shape, not class.
- **`assertDefined(value, label)`** → `asserts value is T`. Throws
  `` `${label} is missing` `` for `null` and `undefined`, and does nothing at all
  otherwise. Note "otherwise" includes `0`, `''` and `false` — a truthiness check
  here would be a bug.
- **`requireField(source, field)`** uses both guards to pull a required string out
  of untrusted data. Throws `'expected an object'` when `source` is not a record,
  and `` `field "${field}" is not a non-empty string` `` when the value is missing
  or blank. Returns the string.
- **`nameOf(users, id)`** finds the user and returns its name. `find` gives you
  `User | undefined`, so use `assertDefined` rather than `!` — the error message the
  tests expect is the one `assertDefined` produces.

Three of the tests are compile-time tests in disguise. `the predicates narrow, not
just answer` calls `.trim()` on something that was `unknown` a line earlier, which
is legal only if your return types are predicates rather than `boolean`. And
`assertDefined narrows everything after the call` reads `.name` off a
`User | undefined` with no `if` and no reassignment anywhere.

### One gotcha worth reading before you hit it

Assertion functions are fussy about how they are called. TypeScript only honours
`asserts` when it can see, at the call site, that the callee is an assertion
function — which means every name in the call target needs an explicit type
annotation:

```ts
const check = assertDefined // inferred type
check(value, 'thing') // TS2775, and no narrowing
```

That is why `solution.test.ts` declares `const subject: typeof solution = …`
rather than letting the type be inferred like every other exercise here. Delete
that annotation and five lines stop compiling.

## Run it

```bash
pnpm --filter exercises attempt   # grade your starter.ts — start here
pnpm --filter exercises verify    # the full gate CI runs
```

Work in `starter.ts`. `solution.ts` is the reference answer, and the same tests
grade both — which is what keeps the answer and the tests honest.

## Hints

<details>
<summary>Hint 1 — "non-empty" is doing more work than it says</summary>

`''.length > 0` is false, but `'   '.length > 0` is true. The tests want the
second one rejected too, so measure the length of something with the whitespace
already removed.

</details>

<details>
<summary>Hint 2 — the array</summary>

`typeof [] === 'object'`, so the object check alone lets arrays through. There is
a built-in specifically for this, and it has been on `Array` since 2009.

</details>

<details>
<summary>Hint 3 — assertDefined and the falsy values</summary>

`if (!value) throw` would reject `0`, `''` and `false`, and the tests assert that
all three are fine. Compare against the two values you actually mean.

</details>

<details>
<summary>Hint 4 — requireField, after isRecord</summary>

`isRecord` promises `Record<string, unknown>`, and it means the `unknown` part —
`source[field]` is still a value nobody has checked. Which is convenient, because
you have just written the function that checks it.

</details>
