import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as solution from './solution.ts'
import * as starter from './starter.ts'
import { AUDIT, TRACE } from './keys.ts'
import type { Doc } from './solution.ts'

/**
 * Compile-time API parity, both directions, so neither file can grow, drop or
 * retype an export without tsc saying so.
 */
const _starterMatchesSolution: typeof solution = starter
const _solutionMatchesStarter: typeof starter = solution
void _starterMatchesSolution
void _solutionMatchesStarter

const subject = process.env['EXERCISE_TARGET'] === 'starter' ? starter : solution

const doc: Doc = { title: 'Annual report' }

test('tag and readTag round-trip', () => {
  const tagged = subject.tag(doc, AUDIT, 'ada')

  assert.equal(subject.readTag(tagged, AUDIT), 'ada')
  assert.equal(subject.readTag(tagged, TRACE), undefined)
  assert.equal(subject.readTag(doc, AUDIT), undefined)
})

test('tag leaves the public data alone', () => {
  const tagged = subject.tag(doc, AUDIT, 'ada')

  assert.equal(tagged.title, 'Annual report')
  // And the original is untouched, because `tag` copies.
  assert.equal(subject.readTag(doc, AUDIT), undefined)
})

test('the two keys do not interfere', () => {
  const both = subject.tag(subject.tag(doc, AUDIT, 'ada'), TRACE, 'req-7')

  assert.equal(subject.readTag(both, AUDIT), 'ada')
  assert.equal(subject.readTag(both, TRACE), 'req-7')
})

test('tag overwrites the same key', () => {
  const once = subject.tag(doc, AUDIT, 'ada')
  const twice = subject.tag(once, AUDIT, 'grace')

  assert.equal(subject.readTag(twice, AUDIT), 'grace')
})

test('symbol keys are invisible to enumeration', () => {
  const tagged = subject.tag(subject.tag(doc, AUDIT, 'ada'), TRACE, 'req-7')

  assert.deepEqual(subject.publicKeys(tagged), ['title'])
  assert.deepEqual(Object.keys(tagged), ['title'])
  assert.equal(JSON.stringify(tagged), '{"title":"Annual report"}')

  const seen: string[] = []
  for (const key in tagged) seen.push(key)
  assert.deepEqual(seen, ['title'])

  // This is the whole reason to use them for metadata: everything that walks or
  // serialises the object carries on as if the annotations were not there.
  assert.deepEqual(Object.getOwnPropertySymbols(tagged), [AUDIT, TRACE])
})

test('but symbol keys ARE copied by spread', () => {
  const tagged = subject.tag(doc, AUDIT, 'ada')

  const spread = { ...tagged }
  const assigned = Object.assign({}, tagged)

  // "Symbols are hidden" is only half true: invisible to enumeration, perfectly
  // visible to copying. Which is usually what you want, and is a genuine surprise the
  // first time it is not.
  assert.equal(subject.readTag(spread, AUDIT), 'ada')
  assert.equal(subject.readTag(assigned, AUDIT), 'ada')

  // So dropping them has to be deliberate.
  assert.equal(subject.readTag(subject.withoutMeta(tagged), AUDIT), undefined)
  assert.equal(subject.withoutMeta(tagged).title, 'Annual report')
})

test('metaKeys reports only the keys that are present', () => {
  assert.deepEqual(subject.metaKeys(doc), [])
  assert.deepEqual(subject.metaKeys(subject.tag(doc, TRACE, 'req-7')), [TRACE])
  assert.deepEqual(subject.metaKeys(subject.tag(doc, AUDIT, 'ada')), [AUDIT])
  assert.deepEqual(subject.metaKeys(subject.tag(subject.tag(doc, TRACE, 'r'), AUDIT, 'a')), [
    AUDIT,
    TRACE,
  ])
})

test('two symbols with the same description are different keys', () => {
  const forged = Symbol('audit')

  assert.notEqual(forged, AUDIT)
  assert.notEqual(Symbol('audit'), Symbol('audit'))

  // The description is for your debugger and carries no identity whatsoever.
  assert.equal(AUDIT.description, 'audit')
  assert.equal(forged.description, 'audit')

  // Which means a second module cannot reach this property even by guessing the name.
  const tagged = subject.tag(doc, AUDIT, 'ada')
  assert.equal(Reflect.get(tagged, forged), undefined)
  assert.equal(Reflect.get(tagged, AUDIT), 'ada')
})

test('the type system knows a forged key is a different key', () => {
  const tagged = subject.tag(doc, AUDIT, 'ada')
  const forged: unique symbol = Symbol('audit')

  // @ts-expect-error — `typeof forged` is its own `unique symbol` type, not
  // `typeof AUDIT`, so it is not assignable to `MetaKey`. The collision is impossible
  // at compile time as well as at run time.
  subject.readTag(tagged, forged)

  // A plain `symbol` is refused too: "some symbol, who knows which" cannot identify a
  // property.
  const anySymbol: symbol = AUDIT
  // @ts-expect-error — Argument of type 'symbol' is not assignable to 'MetaKey'.
  subject.readTag(tagged, anySymbol)
})

test('Symbol.for is the one that CAN collide, on purpose', () => {
  // The global registry: same string, same symbol, across every module and even across
  // realms. Useful for protocols everybody must agree on, and exactly the wrong choice
  // for private metadata.
  assert.equal(Symbol.for('app.audit'), Symbol.for('app.audit'))
  assert.notEqual(Symbol.for('app.audit'), AUDIT)
  assert.equal(Symbol.keyFor(Symbol.for('app.audit')), 'app.audit')

  // A locally created symbol is not in the registry at all.
  assert.equal(Symbol.keyFor(AUDIT), undefined)

  assert.equal(subject.readTag(subject.tag(doc, AUDIT, 'ada'), AUDIT), 'ada')
})
