import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Equals, Expect } from '../../tools/type-assert.ts'
import * as solution from './solution.ts'
import * as starter from './starter.ts'
import { WORD_SEPARATOR, parseJsonHeader } from './text-utils.js'
import type { Frontmatter } from './types.ts'

const _starterMatchesSolution: typeof solution = starter
const _solutionMatchesStarter: typeof starter = solution
void _starterMatchesSolution
void _solutionMatchesStarter

const subject = process.env['EXERCISE_TARGET'] === 'starter' ? starter : solution

/* ── The declaration file is load-bearing ───────────────────────────────────────────── */

test('the declarations describe a real JavaScript module', () => {
  // `text-utils.js` has no annotations and the compiler never opens it — `allowJs` is off.
  // Everything below is typed purely by `text-utils.d.ts`, and it runs, which is the whole
  // claim a declaration file makes.
  assert.ok(WORD_SEPARATOR instanceof RegExp)
  assert.deepEqual('a-b_c d'.split(WORD_SEPARATOR), ['a', 'b', 'c', 'd'])

  // And the facade built on top of those declarations runs too, which is the part that
  // matters: a label nobody can act on proves nothing.
  assert.equal(subject.slug('a b'), 'a-b')
})

test('the declared types are enforced on the way in', () => {
  // @ts-expect-error — `slugify` is declared to take a `string`. The JavaScript would cope
  // with a number, and the declaration deliberately does not bless that.
  void subject.slug(42)

  assert.equal(subject.slug('Hello There World'), 'hello-there-world')
})

/* ── The facade ─────────────────────────────────────────────────────────────────────── */

test('slug passes through', () => {
  assert.equal(subject.slug('A Post About TypeScript!'), 'a-post-about-typescript')
  assert.equal(subject.slug('  spaced  out  '), 'spaced-out')
})

test('preview defaults to 40 characters, and the default is ours', () => {
  const short = 'Short enough'
  assert.equal(subject.preview(short), short)

  const long = 'x'.repeat(60)
  const previewed = subject.preview(long)

  assert.equal(previewed.length, 40)
  assert.ok(previewed.endsWith('…'))
})

test('preview honours an explicit length', () => {
  assert.equal(subject.preview('abcdefghij', 5), 'abcd…')
  assert.equal(subject.preview('abcdefghij', 10), 'abcdefghij')
})

test('tags lower-cases and de-duplicates, keeping first-seen order', () => {
  assert.deepEqual(subject.tags('TypeScript, testing, typescript, Modules'), [
    'typescript',
    'testing',
    'modules',
  ])

  assert.deepEqual(subject.tags(''), [])
  assert.deepEqual(subject.tags('  a ,, b  ,'), ['a', 'b'])
})

test('tags narrows a mutable array to a readonly one at the boundary', () => {
  const result = subject.tags('a, b')

  type _readonly = Expect<Equals<typeof result, readonly string[]>>

  // `void result.push` rather than `result.push('c')`: the directive silences the type error
  // and the call would still run, because `readonly` is erased and this is an ordinary array.
  // Naming the method is enough to prove it is not on the type.
  //
  // @ts-expect-error — `parseList` hands back a `string[]` that its caller owns; this array
  // is ours, and the facade is where that changes.
  void result.push

  assert.deepEqual(result, ['a', 'b'])
})

test('slugViaDefault reaches the same function through the default export', () => {
  assert.equal(subject.slugViaDefault('Hello There'), 'hello-there')
  assert.equal(subject.slugViaDefault('X Y'), subject.slug('X Y'))
})

/* ── The `unknown` boundary ─────────────────────────────────────────────────────────── */

test('parseJsonHeader really is unknown, and that is the declaration being honest', () => {
  const parsed = parseJsonHeader('{"title":"A"}\nbody')

  type _unknown = Expect<Equals<typeof parsed, unknown>>

  // @ts-expect-error — nothing can be read off it until somebody checks.
  void parsed.title

  assert.deepEqual(parsed, { title: 'A' })

  // Which is the job `isFrontmatter` exists to do: same value, now known.
  assert.equal(subject.isFrontmatter(parsed), true)
})

test('isFrontmatter accepts the shapes it should', () => {
  assert.equal(subject.isFrontmatter({ title: 'A', tags: ['x'] }), true)
  assert.equal(subject.isFrontmatter({ title: 'A', tags: [] }), true)
  assert.equal(subject.isFrontmatter({ title: 'A' }), true, 'absent tags is a valid header')
  assert.equal(subject.isFrontmatter({ title: 'A', extra: 1 }), true, 'extra keys are fine')
})

test('isFrontmatter rejects everything else, including the plausible ones', () => {
  assert.equal(subject.isFrontmatter(null), false)
  assert.equal(subject.isFrontmatter(undefined), false)
  assert.equal(subject.isFrontmatter(42), false)
  assert.equal(subject.isFrontmatter('title'), false)
  assert.equal(subject.isFrontmatter([]), false, 'an array has no string title')
  assert.equal(subject.isFrontmatter({}), false)
  assert.equal(subject.isFrontmatter({ title: 42 }), false)

  // The one a shallow check misses: `Array.isArray` narrows to `any[]`, so the elements have
  // to be checked too or `tags: [1, 2]` sails straight through.
  assert.equal(subject.isFrontmatter({ title: 'A', tags: [1, 2] }), false)
  assert.equal(subject.isFrontmatter({ title: 'A', tags: 'x,y' }), false)
})

test('isFrontmatter narrows, so it is a check rather than a comment', () => {
  const value: unknown = { title: 'A', tags: ['x'] }

  assert.ok(subject.isFrontmatter(value))

  // Compile-only, and the reason the predicate has a `value is` signature at all.
  type _narrowed = Expect<Equals<typeof value, Frontmatter>>
  assert.equal(value.title, 'A')
})

test('readFrontmatter parses, checks and normalises', () => {
  assert.deepEqual(subject.readFrontmatter('{"title":"A","tags":["x","y"]}\nbody'), {
    title: 'A',
    tags: ['x', 'y'],
  })

  // Normalised: `tags` is always present in the result even when the header omitted it, so
  // callers do not inherit the uncertainty the facade was given.
  assert.deepEqual(subject.readFrontmatter('{"title":"A"}\nbody'), { title: 'A', tags: [] })
})

test('readFrontmatter returns undefined rather than guessing', () => {
  assert.equal(subject.readFrontmatter('not json at all'), undefined)
  assert.equal(subject.readFrontmatter('{"title":42}'), undefined)
  assert.equal(subject.readFrontmatter('[1,2,3]'), undefined)
  assert.equal(subject.readFrontmatter('null'), undefined)
  assert.equal(subject.readFrontmatter(''), undefined)

  // Only the first line is a header, which is `parseJsonHeader`'s contract and not ours.
  assert.equal(subject.readFrontmatter('body\n{"title":"A"}'), undefined)
})

test('readFrontmatter hands back something fully known', () => {
  const result = subject.readFrontmatter('{"title":"A"}')

  type _result = Expect<Equals<typeof result, Frontmatter | undefined>>

  assert.ok(result !== undefined)
  assert.equal(result.title.toUpperCase(), 'A')
  assert.equal(result.tags.length, 0)
})
