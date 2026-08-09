import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import type { Equals, Expect } from '../../tools/type-assert.ts'
import * as solution from './solution.ts'
import * as starter from './starter.ts'
import type { DbConfig } from './legacy-config.cjs'

/* Ordinary bidirectional parity: nothing here is nominal. */
const _starterMatchesSolution: typeof solution = starter
const _solutionMatchesStarter: typeof starter = solution
void _starterMatchesSolution
void _solutionMatchesStarter

const subject = process.env['EXERCISE_TARGET'] === 'starter' ? starter : solution

/* ── The phrasebook entry ───────────────────────────────────────────────────────────── */

test('unwrapDefault takes one layer off a wrapped module', () => {
  assert.deepEqual(subject.unwrapDefault({ default: { load: 1 } }), { load: 1 })
  assert.equal(subject.unwrapDefault({ default: 42 }), 42)
})

test('unwrapDefault leaves an unwrapped module alone', () => {
  const bare = { load: 1, describe: 2 }
  assert.equal(subject.unwrapDefault(bare), bare, 'the same object, not a copy')
})

test('unwrapDefault takes exactly one layer, never two', () => {
  // Recursing here would be a bug rather than a convenience: this is a module whose default
  // export happens to be an object with a `default` key, and eating the second layer
  // corrupts real data.
  assert.deepEqual(subject.unwrapDefault({ default: { default: 1 } }), { default: 1 })
})

test('unwrapDefault survives the values that make `in` throw', () => {
  // `'default' in null` is a TypeError, not `false`, and the same goes for a primitive. All
  // of these mean "no wrapper".
  assert.equal(subject.unwrapDefault(null), null)
  assert.equal(subject.unwrapDefault(undefined), undefined)
  assert.equal(subject.unwrapDefault(5), 5)
  assert.equal(subject.unwrapDefault('legacy'), 'legacy')
  assert.equal(subject.unwrapDefault(true), true)
})

test('unwrapDefault handles a function carrying a default', () => {
  // What a transpiled ESM module looks like, so `typeof mod === 'object'` alone is not
  // enough of a guard.
  const inner = (): string => 'called'
  const wrapped = Object.assign(() => 'outer', { default: inner })

  assert.equal(subject.unwrapDefault(wrapped), inner)

  // And a bare function with no `default` comes back untouched and still callable.
  const plain = (): string => 'plain'
  assert.equal(subject.unwrapDefault(plain)(), 'plain')
})

/* ── Talking to a real CommonJS module ──────────────────────────────────────────────── */

test('a static named import of a CommonJS module just works', () => {
  assert.deepEqual(subject.loadConfig(), { host: 'localhost', port: 5432, ssl: false })
  assert.deepEqual(subject.loadConfig({ port: 6000 }), {
    host: 'localhost',
    port: 6000,
    ssl: false,
  })
  assert.equal(subject.describeConfig(subject.loadConfig({ ssl: true })), 'localhost:5432 (ssl)')
})

test('the types come through the .d.cts, and that is a compile-time claim', () => {
  const config: DbConfig = subject.loadConfig({ host: 'db' })
  type _config = Expect<Equals<typeof config.port, number>>

  assert.equal(config.host, 'db')

  // @ts-expect-error — `port` is a number, and the declaration file is what says so.
  subject.loadConfig({ port: '6000' })

  // @ts-expect-error — and there is no such option.
  subject.loadConfig({ timeout: 30 })
})

test('an `export =` module is reached through a default import', () => {
  // `single-export.cjs` assigns a function to `module.exports`. `import * as slugify` would
  // give a namespace object, which is not callable.
  assert.equal(subject.slug('Hello There World!'), 'hello-there-world')
  assert.equal(subject.slug('  Trailing --- dashes -- '), 'trailing-dashes')
  assert.equal(subject.slug('ALLCAPS'), 'allcaps')
})

/* ── The trap ───────────────────────────────────────────────────────────────────────── */

test('legacyVersion reaches a property the lexer could not see', () => {
  assert.equal(subject.legacyVersion(), '1.4.2')
})

test('the lexer really does miss it, which is why a named import would not have worked', async () => {
  // This is the whole lesson, asserted rather than described. `legacy-config.cjs` ends with
  // `module.exports = { DEFAULTS, load, describe, version: '1.4.2' }`. The three shorthand
  // properties become named exports; `version`, whose value is a string literal, does not.
  const mod = await import('./legacy-config.cjs')

  assert.deepEqual(Object.keys(mod).sort(), [
    'DEFAULTS',
    'default',
    'describe',
    'load',
    'module.exports',
  ])

  assert.equal('version' in mod, false, 'not a named export…')
  assert.equal(mod.default.version, '1.4.2', '…but plainly there on module.exports')

  // Which is the route `legacyVersion` has to take.
  assert.equal(subject.legacyVersion(), mod.default.version)

  // `import { version } from './legacy-config.cjs'` would typecheck — the declaration file
  // is correct, the property does exist — and Node would refuse to load the file:
  //   SyntaxError: Named export 'version' not found.
  // A static import cannot be tested for failure here, because the failure happens at load
  // time and would take this whole file down with it. Verified by hand instead.
})

test('the default import is module.exports, whole and without guesswork', async () => {
  const mod = await import('./legacy-config.cjs')

  assert.deepEqual(Object.keys(mod.default).sort(), [
    'DEFAULTS',
    'describe',
    'load',
    'version',
  ])

  // Same functions, reached two ways.
  assert.equal(mod.default.load, mod.load)

  // And whichever route the exercise took, it is the same underlying function doing the work.
  assert.deepEqual(subject.loadConfig({ port: 1 }), mod.default.load({ port: 1 }))
})

/* ── Dynamic import ─────────────────────────────────────────────────────────────────── */

test('loadConfigDynamically works through the namespace object', async () => {
  assert.deepEqual(await subject.loadConfigDynamically(), {
    host: 'localhost',
    port: 5432,
    ssl: false,
  })
  assert.deepEqual(await subject.loadConfigDynamically({ host: 'db', ssl: true }), {
    host: 'db',
    port: 5432,
    ssl: true,
  })
})

test('createRequire gets the value and throws away every type', () => {
  // Worth seeing once, because it looks like the obvious way to load a CommonJS module and
  // it is a total type hole. `require()` is declared to return `any`, so the `.d.cts` next
  // door is never consulted.
  const require = createRequire(import.meta.url)
  const legacy = require('./legacy-config.cjs')

  type _isAny = Expect<Equals<typeof legacy, any>>

  // All of this compiles. None of it is checked.
  assert.equal(legacy.load({ port: 1 }).port, 1)
  assert.equal(legacy.nonsense, undefined)
  assert.equal(typeof legacy.load('not a config object'), 'object')

  // A real `import` of the same file is checked, which is the entire argument for preferring
  // one. `createRequire` is for reaching things a specifier cannot name — a `package.json`,
  // a file resolved at run time — not for ordinary imports.
  //
  // Same call, same answer, and only one of the two was type-checked on the way.
  assert.deepEqual(subject.loadConfig({ port: 1 }), legacy.load({ port: 1 }))
})
