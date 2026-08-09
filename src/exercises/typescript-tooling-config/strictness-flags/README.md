# Every flag is a question you have to answer

A strictness flag does not make your code better. It makes the compiler ask you a question
it used to answer for you, badly.

## Goal

There is no sloppy code to fix here, because this package could not contain any — a fresh
clone has to typecheck. So the exercise runs the other way round: every function below is a
place where a flag **stops you writing the obvious thing**, and the work is answering the
question.

- **`firstLine(text)`** — `text.split('\n')[0]` is `string | undefined`. Return `''` when
  there is no first line.
- **`cellAt(rows, row, col)`** — two levels of indexed access, so two `undefined`s.
- **`sumOf(config, keys)`** — a `Record<string, number>` lookup is `number | undefined`.
  Missing key counts as `0`, and a real `0` still counts as `0`.
- **`parseJson(text)`** — `catch (error)` gives you `unknown`. On failure return the thrown
  value's `message` if it was an `Error`, else `String(thrown)`.
- **`labelFor(level)`** — an exhaustive `switch` with **no `default`** and an exhaustiveness
  check at the end.
- **`isLevel(value)` / `parseLines(text)`** — a real predicate, then use it.

Every signature is already correct. **Not one needs a cast, a `!`, or an `any`** — reaching
for one is how you find out you have not answered the question.

## The flags actually doing the work

All on in this package's `tsconfig.json`:

| Flag | What it asks |
| --- | --- |
| `strictNullChecks` | is this thing possibly absent? |
| `noUncheckedIndexedAccess` | is that index definitely in range? |
| `useUnknownInCatchVariables` | do you know what was thrown? |
| `noFallthroughCasesInSwitch` | did you mean to fall through? |
| `noImplicitAny` | what type is that parameter? |

## Three things worth getting right rather than past

**`??`, not `||`.** `text.split('\n')[0] || ''` gives the same answer as `?? ''` here and is a
habit that breaks the first time the default is not the falsy value. `sumOf` is where it shows
— `config[key] || 0` cannot tell a missing key from a key whose value is genuinely `0`.

**No `default` arm in `labelFor`.** Because every arm returns and all four levels are handled,
`level` is `never` at the bottom, so `assertNever(level)` compiles today and stops compiling
the moment somebody adds a fifth level. A `default: return 'unknown'` is shorter and hides
that change forever. That is the whole trade.

**`isLevel`, not `as Level`.** The cast compiles and lets `banana: hello` through as a valid
level. The predicate is a claim you sign for, which is why its body has to be a real check.

## The flag this exercise does *not* use

The curriculum row for this lesson also named `exactOptionalPropertyTypes`. It is off in this
package, and the reason is worth more than the exercise would have been.

Turning it on produces exactly **three** errors across all 35 exercises — and all three are in
tests that *deliberately* pass `{ name: undefined }` to an optional property, because that is
the distinction lesson 1.8 and lesson 3.8 are teaching. The flag would break two lessons whose
point is the pre-flag semantics.

So it is taught on the lesson page instead, with that as the illustration: enabling a
strictness flag has a cost measured in real files, and here the cost is content that exists to
explain the thing the flag changes.

## Run it

```bash
pnpm --filter exercises attempt   # grade your starter.ts — start here
pnpm --filter exercises verify    # the full gate CI runs
```

Work in `starter.ts`. `solution.ts` is the reference answer, and the same tests
grade both — which is what keeps the answer and the tests honest.

## Hints

<details>
<summary>Hint 1 — cellAt</summary>

`rows[row]?.[col]` is the whole function. If `rows[row]` is `undefined` the expression
short-circuits and `[col]` is never evaluated, which is exactly what `?.` is for.

</details>

<details>
<summary>Hint 2 — parseJson</summary>

```ts
catch (thrown) {
  return { ok: false, error: thrown instanceof Error ? thrown.message : String(thrown) }
}
```

`throw 'nope'` is legal JavaScript and people do it, which is why the fallback is not
paranoia.

</details>

<details>
<summary>Hint 3 — labelFor's exhaustiveness check</summary>

Declare a local helper taking `never`:

```ts
function assertNever(value: never): never {
  throw new Error(`unhandled level: ${String(value)}`)
}
```

Then `return assertNever(level)` after the switch. It only compiles while every case is
handled, because only then is `level` `never`.

</details>

<details>
<summary>Hint 4 — parseLines and colons</summary>

`parts.slice(1).join(':')` rather than `parts[1]`, or a message containing a timestamp gets
truncated at the second colon. Skip a line when the level is missing, empty, unrecognised, or
the message is empty.

</details>
