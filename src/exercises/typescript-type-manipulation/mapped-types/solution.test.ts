import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Equals, Expect } from '../../tools/type-assert.ts'
import * as solution from './solution.ts'
import * as starter from './starter.ts'
import type { Draft, Getters, Mutable, MyPartial, MyReadonly, MyRequired, Settings } from './solution.ts'

/**
 * Compile-time API parity, both directions. Note it says nothing about the mapped types
 * in this exercise — type-only exports are not part of `typeof module`, which is exactly
 * why `starter.ts` has to carry its own assertions.
 */
const _starterMatchesSolution: typeof solution = starter
const _solutionMatchesStarter: typeof starter = solution
void _starterMatchesSolution
void _solutionMatchesStarter

const subject = process.env['EXERCISE_TARGET'] === 'starter' ? starter : solution

/* ── The reference types, asserted against the built-ins ──────────────────────── */

type _partial = Expect<Equals<MyPartial<Draft>, Partial<Draft>>>
type _required = Expect<Equals<MyRequired<Draft>, Required<Draft>>>
type _readonly = Expect<Equals<MyReadonly<Draft>, Readonly<Draft>>>

/* `-?` strips the `undefined` along with the marker. Pinning it because it is the part of
   `Required` people do not expect. */
type _requiredDropsUndefined = Expect<Equals<MyRequired<Draft>['beta'], boolean>>
type _optionalKeepsUndefined = Expect<Equals<Draft['beta'], boolean | undefined>>

/* Homomorphic: mapping straight over `keyof T` preserves the modifiers already there, so
   a readonly property survives `MyPartial` still readonly. */
type _partialKeepsReadonly = Expect<Equals<MyPartial<Settings>, Partial<Settings>>>
type _settingsStayReadonly = Expect<Equals<MyReadonly<Draft>, Settings>>

/* `-readonly` in the other direction. */
type _mutable = Expect<Equals<Mutable<Settings>, Draft>>
type _mutableRoundTrip = Expect<Equals<Mutable<MyReadonly<Draft>>, Draft>>

/* And the key remapping. */
interface Point {
  x: number
  y: string
}
type _getters = Expect<
  Equals<Getters<Point>, { readonly getX: () => number; readonly getY: () => string }>
>

/* ── Runtime ──────────────────────────────────────────────────────────────────── */

test('makeGetters builds one getter per key', () => {
  const getters = subject.makeGetters({ theme: 'dark', fontSize: 14 })

  assert.equal(getters.getTheme(), 'dark')
  assert.equal(getters.getFontSize(), 14)
  assert.deepEqual(Object.keys(getters), ['getTheme', 'getFontSize'])
})

test('makeGetters capitalises only the first letter', () => {
  const getters = subject.makeGetters({ fontSize: 14, URL: 'x', a: 1 })

  // `fontSize` → `getFontSize`, not `getFontsize`. And an already-capitalised key is left
  // alone rather than lower-cased.
  assert.deepEqual(Object.keys(getters), ['getFontSize', 'getURL', 'getA'])
})

test('makeGetters copes with an empty object', () => {
  assert.deepEqual(Object.keys(subject.makeGetters({})), [])
})

test('the getters read the source live', () => {
  const source: Draft = { theme: 'dark', fontSize: 14 }
  const getters = subject.makeGetters(source)

  assert.equal(getters.getTheme(), 'dark')

  source.theme = 'light'

  // A getter, not a snapshot. `() => value` would have returned 'dark' here.
  assert.equal(getters.getTheme(), 'light')
})

test('the built object has exactly the type the mapped type describes', () => {
  // Half the point of this test is that it COMPILES, and it is what the cast inside
  // `makeGetters` is standing behind.
  const getters = subject.makeGetters({ theme: 'dark', fontSize: 14 })

  type _shape = Expect<
    Equals<typeof getters, { readonly getTheme: () => string; readonly getFontSize: () => number }>
  >

  // Each getter's return type is the original property's type, not a union of all of them.
  const theme: string = getters.getTheme()
  const size: number = getters.getFontSize()
  assert.equal(`${theme} ${size}`, 'dark 14')

  // @ts-expect-error — the original key names are gone; they were remapped, not added to.
  void getters.theme

  // @ts-expect-error — and a key that was never there is still not there.
  void getters.getMissing
})

test('the result is readonly, as the mapped type declares', () => {
  const getters = subject.makeGetters({ theme: 'dark' })

  // @ts-expect-error — "Cannot assign to 'getTheme' because it is a read-only property."
  getters.getTheme = () => 'light'

  // Erased at run time, of course, so the write above lands. The compiler was the only
  // thing stopping you.
  assert.equal(getters.getTheme(), 'light')
})
