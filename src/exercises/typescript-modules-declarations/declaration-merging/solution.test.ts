import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Equals, Expect } from '../../tools/type-assert.ts'
import type { PluginContextBase } from './core.ts'
import * as solution from './solution.ts'
import * as starter from './starter.ts'
import type { PluginMeta } from './solution.ts'

/**
 * Parity in **one** direction only, and the missing direction is the exercise.
 *
 * `typeof solution = starter` says the starter fulfils the contract, which is the half that
 * matters. The reverse cannot hold: `describeMeta` takes a `PluginMeta`, and until the second
 * declaration is added the starter's `PluginMeta` lacks `author` — so `solution.describeMeta`
 * is not assignable to `starter.describeMeta`'s narrower parameter. Requiring it would mean
 * requiring the exercise to be finished before it compiles.
 */
const _starterFulfilsTheContract: typeof solution = starter
void _starterFulfilsTheContract

const subject = process.env['EXERCISE_TARGET'] === 'starter' ? starter : solution

/**
 * Worth stating plainly, because it is the sharpest thing about this feature: **module
 * augmentation is program-global.** `solution.ts`'s `declare module './core.ts'` block
 * applies to every file in the compilation, including `starter.ts` and this one.
 *
 * So the type half of part 1 is not graded per-file — a starter with no augmentation still
 * compiles, because the solution's is already in effect. A *wrong* augmentation is caught
 * (`requestId: number` conflicts with `requestId: string`), and the runtime half is graded
 * normally. That is the honest limit, and the leakage is itself the lesson: augmenting a
 * shared interface is not a local decision.
 */

/* ── The augmented members ──────────────────────────────────────────────────────────── */

test('buildContext supplies what the augmentation promised', () => {
  const logs: string[] = []
  const base: PluginContextBase = { appName: 'demo', log: (m) => void logs.push(m) }

  const context = subject.buildContext(base, 'req-1')

  assert.equal(context.requestId, 'req-1')
  assert.equal(typeof context.warn, 'function')
})

test('buildContext keeps everything the base already provided', () => {
  // `...base` first. Losing `log` here is the easy mistake, and it would only show up as a
  // missing line much further away.
  const logs: string[] = []
  const base: PluginContextBase = { appName: 'demo', log: (m) => void logs.push(m) }

  const context = subject.buildContext(base, 'req-1')

  assert.equal(context.appName, 'demo')
  context.log('direct')
  assert.deepEqual(logs, ['direct'])
})

test('warn routes through the host log rather than somewhere invisible', () => {
  // A `warn` that wrote to the console would satisfy the type and be unobservable, which is
  // why the format is specified.
  const logs: string[] = []
  const base: PluginContextBase = { appName: 'demo', log: (m) => void logs.push(m) }

  subject.buildContext(base, 'req-1').warn('disk almost full')

  assert.deepEqual(logs, ['WARN: disk almost full'])
})

/* ── Through the host ───────────────────────────────────────────────────────────────── */

test('a plugin using only core members works', () => {
  const result = subject.runPlugins('demo', [subject.corePlugin()], (base) =>
    subject.buildContext(base, 'req-7'),
  )

  assert.deepEqual(result.outputs, ['core:demo'])
  assert.deepEqual(result.logs, [])
})

test('a plugin using the augmented members works too', () => {
  const result = subject.runPlugins('demo', [subject.tracePlugin()], (base) =>
    subject.buildContext(base, 'req-7'),
  )

  assert.deepEqual(result.outputs, ['trace:req-7'])
  assert.deepEqual(result.logs, ['WARN: late'])
})

test('both plugins see the same context', () => {
  // The host builds one context and hands it to everybody, which is what makes an
  // augmentation worth having rather than a parameter.
  const result = subject.runPlugins('demo', [subject.corePlugin(), subject.tracePlugin()], (base) =>
    subject.buildContext(base, 'req-9'),
  )

  assert.deepEqual(result.outputs, ['core:demo', 'trace:req-9'])
  assert.deepEqual(result.logs, ['WARN: late'])
})

/* ── The local merge ────────────────────────────────────────────────────────────────── */

test('the two PluginMeta declarations are one type', () => {
  const meta: PluginMeta = { title: 'Charts', author: 'ada' }

  // Merging is additive: the result requires *both* members. If the declarations had stayed
  // separate types, neither this annotation nor `describeMeta` would compile.
  type _merged = Expect<Equals<PluginMeta, { readonly title: string; readonly author: string }>>

  assert.equal(subject.describeMeta(meta), 'Charts by ada')
})

test('a merged interface requires every member, from every declaration', () => {
  // @ts-expect-error — `author` came from the second declaration and is not optional.
  const missingAuthor: PluginMeta = { title: 'Charts' }
  void missingAuthor

  // @ts-expect-error — and merging never adds members you did not declare.
  const extra: PluginMeta = { title: 'Charts', author: 'ada', licence: 'MIT' }
  void extra

  assert.equal(subject.describeMeta({ title: 'A', author: 'b' }), 'A by b')
})

/* ── What the compiler refuses ──────────────────────────────────────────────────────── */

test('the augmented context is type-checked like any other', () => {
  const logs: string[] = []
  const base: PluginContextBase = { appName: 'demo', log: (m) => void logs.push(m) }
  const context = subject.buildContext(base, 'req-1')

  type _requestId = Expect<Equals<typeof context.requestId, string>>

  // @ts-expect-error — and the augmentation added exactly two members, not a free-for-all.
  void context.traceId

  assert.equal(context.requestId, 'req-1')

  // `readonly` on an augmented member is enforced exactly as it is anywhere else — by the
  // compiler, and only by the compiler. The directive silences the error and the write still
  // happens, because `readonly` is erased and the context is an ordinary object literal.
  // Worth seeing: an augmentation's modifiers are as real, and as unreal, as any other
  // interface's.
  // @ts-expect-error — `requestId` was declared `readonly`.
  context.requestId = 'req-2'

  assert.equal(context.requestId, 'req-2', 'the write landed; nothing at run time stopped it')
})
