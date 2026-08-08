# Three ways to say I don't know

There is a parcel on the doorstep and nobody knows what is in it.

You have three honest responses. **Stop asking** — shake it, assume it is a
kettle, and plug it in. **Ask me later** — bring it inside unopened, and refuse to
use it as a kettle until somebody has actually looked. Or **that can't happen** —
insist there is no parcel, which is only worth saying if you are certain, because
you will look very silly otherwise.

Those are `any`, `unknown` and `never`. This exercise uses the last two and bans
the first.

## Goal

Implement the four functions in `starter.ts`. **The word `any` must not appear in
your answer.**

- **`parseJson(text)`** returns a `ParseResult`:
  - `'{"count":3}'` → `{ ok: true, value: { count: 3 } }`
  - `'nope'` → `{ ok: false, error: 'invalid JSON' }`

  Note `value` is `unknown`, not `any`. `JSON.parse` is declared as returning
  `any` — a promise the standard library cannot possibly keep — and this function's
  job is to stop that spreading any further. The error string is a fixed
  `'invalid JSON'` rather than the exception's message, because that message is not
  specified anywhere and differs between engines.
- **`assertNever(value, context)`** throws
  `` `unexpected ${context}: ${JSON.stringify(value)}` ``. Its parameter type is
  `never`, so the only way to call it is to have persuaded the compiler that the
  argument cannot exist.
- **`statusLabel(status)`** — `'queued'` → `'waiting to start'`, `'running'` →
  `'in progress'`, `'done'` → `'finished'`. Write a `switch` **with** a `default`
  that returns `assertNever(status, 'status')`. Inside the default, the three cases
  have eliminated every member of `Status`, so `status` is `never` there and the
  call type-checks. Add a fourth status later and it stops compiling on that exact
  line.
- **`countFrom(text)`** parses the text and digs a finite `count` out of it, or
  returns `undefined`. `3` from `'{"count":3}'`; `undefined` from `'{"count":"3"}'`,
  `'[3]'`, `'42'`, `'{}'`, `'{"count":1e999}'` and anything unparseable.

The test called `unknown refuses to be used until something checks it` contains a
`@ts-expect-error` on a plain property read. That is the whole argument for
`unknown` in one line: had `parseJson` returned `any`, the line would have compiled
and failed at run time instead. And because `@ts-expect-error` fails the build when
the line *stops* erroring, the claim cannot quietly become false.

## Run it

```bash
pnpm --filter exercises attempt   # grade your starter.ts — start here
pnpm --filter exercises verify    # the full gate CI runs
```

Work in `starter.ts`. `solution.ts` is the reference answer, and the same tests
grade both — which is what keeps the answer and the tests honest.

## Hints

<details>
<summary>Hint 1 — parseJson without throwing</summary>

`try` / `catch`, and you never need to look at the caught value — `catch {}` with
no binding is valid and says what you mean.

You will also need to stop `any` at the door: `JSON.parse(text) as unknown`
narrows the declared type rather than widening it, which is one of the few
genuinely virtuous uses of `as`.

</details>

<details>
<summary>Hint 2 — the default arm</summary>

Do not annotate anything. Write the three cases, then
`default: return assertNever(status, 'status')`, and let the compiler work out that
`status` is `never` by then. If it complains that your argument is not assignable
to `never`, you are missing a case above — which is the feature working.

</details>

<details>
<summary>Hint 3 — countFrom, one check at a time</summary>

Four gates in a row, each one making the next possible: parsed at all? an object
and not `null`? a `count` that is a number? a number that is finite?

Every one of those has to be written out because `value` is `unknown`. Notice how
much of it `any` would have let you skip, and what you would have lost.

</details>

<details>
<summary>Hint 4 — 1e999</summary>

`JSON.parse('{"count":1e999}')` gives you `Infinity`, and `typeof Infinity` is
`'number'`. `Number.isFinite` is the check that cares about the difference.

</details>
