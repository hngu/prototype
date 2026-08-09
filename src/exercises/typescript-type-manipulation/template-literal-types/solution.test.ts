import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Equals, Expect } from '../../tools/type-assert.ts'
import * as solution from './solution.ts'
import * as starter from './starter.ts'
import type { EnvName, Handlers, Route, Settings } from './solution.ts'

/**
 * Compile-time API parity, both directions, so neither file can grow, drop or
 * retype an export without tsc saying so.
 */
const _starterMatchesSolution: typeof solution = starter
const _solutionMatchesStarter: typeof starter = solution
void _starterMatchesSolution
void _solutionMatchesStarter

const subject = process.env['EXERCISE_TARGET'] === 'starter' ? starter : solution

/* ── The four intrinsics, so the lesson's table is checked rather than claimed ─── */

type _upper = Expect<Equals<Uppercase<'fontSize'>, 'FONTSIZE'>>
type _lower = Expect<Equals<Lowercase<'FontSize'>, 'fontsize'>>
type _capitalize = Expect<Equals<Capitalize<'fontSize'>, 'FontSize'>>
type _uncapitalize = Expect<Equals<Uncapitalize<'FontSize'>, 'fontSize'>>

/* The mistake these two exist to prevent: `Uppercase` is the whole string, `Capitalize`
   is the first character. */
type _notTheSame = Expect<Equals<Equals<Uppercase<'theme'>, Capitalize<'theme'>>, false>>

/* ── The given types ──────────────────────────────────────────────────────────── */

type _envName = Expect<Equals<EnvName<'theme'>, 'SETTING_THEME'>>
type _envNameCamel = Expect<Equals<EnvName<'fontSize'>, 'SETTING_FONTSIZE'>>

/* A template literal type distributes over a union in any slot, so `Route` is three
   patterns rather than one containing a union. */
type _routeDistributes = Expect<
  Equals<Route, `GET /${string}` | `POST /${string}` | `DELETE /${string}`>
>

type _handlers = Expect<
  Equals<
    Handlers<Settings>,
    {
      readonly onThemeChange: (next: string) => void
      readonly onFontSizeChange: (next: number) => void
    }
  >
>

/* Each handler's parameter is the *original property's* type, not a union of both. */
type _handlerNames = Expect<Equals<keyof Handlers<Settings>, 'onThemeChange' | 'onFontSizeChange'>>

/* ── Runtime ──────────────────────────────────────────────────────────────────── */

test('handlerNameFor builds the name', () => {
  assert.equal(subject.handlerNameFor('theme'), 'onThemeChange')
  assert.equal(subject.handlerNameFor('fontSize'), 'onFontSizeChange')
})

test('handlerNameFor returns the exact literal, not string', () => {
  // Half the point of this test is that it COMPILES. The return type is a template
  // literal over `K`, so the result is usable as a key — which `string` would not be.
  const name = subject.handlerNameFor('fontSize')
  type _name = Expect<Equals<typeof name, 'onFontSizeChange'>>

  const key: keyof Handlers<Settings> = name
  assert.equal(key, 'onFontSizeChange')

  // @ts-expect-error — and a key that is not a setting is refused at the call site.
  subject.handlerNameFor('nope')
})

test('envNameFor upper-cases the whole key', () => {
  assert.equal(subject.envNameFor('theme'), 'SETTING_THEME')
  assert.equal(subject.envNameFor('fontSize'), 'SETTING_FONTSIZE')

  const name = subject.envNameFor('theme')
  type _name = Expect<Equals<typeof name, 'SETTING_THEME'>>
  void name
})

test('parseRoute splits a route', () => {
  assert.deepEqual(subject.parseRoute('GET /users'), { method: 'GET', path: '/users' })
  assert.deepEqual(subject.parseRoute('POST /users/1/tags'), {
    method: 'POST',
    path: '/users/1/tags',
  })
  assert.deepEqual(subject.parseRoute('DELETE /'), { method: 'DELETE', path: '/' })
})

test('parseRoute needs no validation because the type did it', () => {
  // The pattern is enforced at the call site, so the body has no error path and the
  // return type has no `undefined`. These four are all compile errors:

  // @ts-expect-error — 'PATCH' is not a Method.
  subject.parseRoute('PATCH /users')

  // @ts-expect-error — no space.
  subject.parseRoute('GET/users')

  // @ts-expect-error — the path must start with a slash.
  subject.parseRoute('GET users')

  const fromConfig: string = 'GET /users'
  // @ts-expect-error — and a plain string is not known to fit the pattern, even when it
  // happens to.
  subject.parseRoute(fromConfig)

  // Which is the honest limitation: a route read at run time has to be *checked* before
  // it can be used as a `Route`. The pattern protects literals, not strangers.
  const checked = fromConfig as Route
  assert.deepEqual(subject.parseRoute(checked), { method: 'GET', path: '/users' })
})

test('makeHandlers builds one handler per setting', () => {
  const calls: [string, unknown][] = []
  const handlers = subject.makeHandlers((name, next) => calls.push([name, next]))

  assert.deepEqual(Object.keys(handlers), ['onThemeChange', 'onFontSizeChange'])

  handlers.onThemeChange('dark')
  handlers.onFontSizeChange(16)

  assert.deepEqual(calls, [
    ['onThemeChange', 'dark'],
    ['onFontSizeChange', 16],
  ])
})

test('each handler takes the type its own setting has', () => {
  // Compile-only, and the payoff for `(next: T[K])` in the mapped type: the handlers do
  // not share one parameter type.
  const handlers = subject.makeHandlers(() => {})

  type _theme = Expect<Equals<Parameters<typeof handlers.onThemeChange>, [next: string]>>
  type _size = Expect<Equals<Parameters<typeof handlers.onFontSizeChange>, [next: number]>>

  // @ts-expect-error — a number is not a theme.
  handlers.onThemeChange(16)

  // @ts-expect-error — nor is a string a font size.
  handlers.onFontSizeChange('16')

  // @ts-expect-error — and the original key names were remapped away.
  void handlers.theme
})
