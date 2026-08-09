# What fits in, what drops out

A vending machine has a slot and a tray. The slot says exactly what fits — a coin
of this size, and nothing else. The tray says what drops out. You do not need to
know anything about the mechanism to use one correctly, because the two openings
tell you everything.

A function signature is those two openings. This exercise is six of them, each a
different shape, so you can feel where each shape is the right one.

## Goal

Implement the five functions in `starter.ts`.

- **`logLine(level, ...parts)`** — a **rest parameter**, so the arity is open.
  `logLine('info')` → `'[info]'`, `logLine('warn', 'disk', 'full')` →
  `'[warn] disk full'`.
- **`truncate(text, limit?)`** — an **optional parameter**, meaning 20 when absent.
  `truncate('hello world', 5)` → `'hello…'`; `truncate('hello', 5)` → `'hello'`;
  `truncate('hello world', 0)` → `'…'`. That last one is why `?? 20` and not
  `|| 20`.
- **`pad(text, width = 8, fill = ' ')`** — two **defaults**, which is a different
  thing from optional: inside the body, `width` is `number`, never
  `number | undefined`. `pad('7')` → `'       7'`; `pad('7', 3, '0')` → `'007'`;
  `pad('12345', 3)` → `'12345'` (never truncates).
- **`retry(attempt, times = 3)`** calls `attempt` until it returns, and throws
  `` `failed after 3 attempts: <message>` `` after the last failure — singular
  `attempt` when `times` is 1. Note that `catch` hands you `unknown`, because
  `strict` includes `useUnknownInCatchVariables`, and one test throws a bare string
  to prove it.
- **`forEachLine(text, visit)`** calls `visit(line, index)` per line and returns the
  count. Splits on `'\n'` only, so `''` is one empty line.

## The `void` thing

`visit` is declared `(line: string, index: number) => void`, and that is a promise
about the *caller*, not the callback: `forEachLine` will ignore whatever comes back.
So this is legal, and it is why `items.forEach(x => list.push(x))` compiles:

```ts
forEachLine('a\nb', (line) => seen.push(line)) // push returns a number. Fine.
```

The half people confuse it with is the other direction — a value returned from a
`() => void` function is not available to whoever called it. The last test pins both
halves, the second one with a `@ts-expect-error`.

## Run it

```bash
pnpm --filter exercises attempt   # grade your starter.ts — start here
pnpm --filter exercises verify    # the full gate CI runs
```

Work in `starter.ts`. `solution.ts` is the reference answer, and the same tests
grade both — which is what keeps the answer and the tests honest.

## Hints

<details>
<summary>Hint 1 — optional versus default</summary>

`limit?: number` gives you `number | undefined` in the body and leaves the
resolving to you. `width = 8` does the resolving before the body starts. Neither is
better; they are answers to different questions, and one of these two functions
wants each.

</details>

<details>
<summary>Hint 2 — padding</summary>

`String.prototype.padStart` takes a target length and a fill string, and already
does nothing when the string is long enough. No branch required.

</details>

<details>
<summary>Hint 3 — the caught value</summary>

`catch (error)` types `error` as `unknown`, because JavaScript lets you `throw`
anything at all. `error instanceof Error ? error.message : String(error)` covers
both worlds in one expression.

</details>

<details>
<summary>Hint 4 — retry's loop</summary>

Return from inside the `try`, so success needs no flag and no accumulator. Keep the
last failure's message in a variable seeded with something sensible, and throw after
the loop — that way the throw needs no extra check, which a
`string | undefined` would have forced on you.

</details>
