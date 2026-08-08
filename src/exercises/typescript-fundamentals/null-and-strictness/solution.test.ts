import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as solution from './solution.ts'
import * as starter from './starter.ts'
import type { Profile } from './solution.ts'

/**
 * Compile-time API parity, both directions, so neither file can grow, drop or
 * retype an export without tsc saying so.
 */
const _starterMatchesSolution: typeof solution = starter
const _solutionMatchesStarter: typeof starter = solution
void _starterMatchesSolution
void _solutionMatchesStarter

const subject = process.env['EXERCISE_TARGET'] === 'starter' ? starter : solution

const ada: Profile = { name: 'Ada', bio: null }

test('firstWord finds the first word', () => {
  assert.equal(subject.firstWord('hello'), 'hello')
  assert.equal(subject.firstWord('hello world'), 'hello')
  assert.equal(subject.firstWord('  hello   world  '), 'hello')
  assert.equal(subject.firstWord('hello\tworld'), 'hello')
})

test('firstWord copes with nothing at all', () => {
  assert.equal(subject.firstWord(), undefined)
  assert.equal(subject.firstWord(undefined), undefined)
  assert.equal(subject.firstWord(''), undefined)
  assert.equal(subject.firstWord('   '), undefined)
  assert.equal(subject.firstWord('\n\t'), undefined)
})

test('displayName prefers a nickname with content in it', () => {
  assert.equal(subject.displayName(ada), 'Ada')
  assert.equal(subject.displayName({ ...ada, nickname: 'Addy' }), 'Addy')
  assert.equal(subject.displayName({ ...ada, nickname: '  Addy  ' }), 'Addy')
})

test('displayName falls back when the nickname is absent or blank', () => {
  assert.equal(subject.displayName({ ...ada, nickname: undefined }), 'Ada')
  // `nickname ?? name` would return '' for both of these, and the page would
  // render a profile with no name on it.
  assert.equal(subject.displayName({ ...ada, nickname: '' }), 'Ada')
  assert.equal(subject.displayName({ ...ada, nickname: '   ' }), 'Ada')
})

test('bioOrDefault treats null and empty differently', () => {
  assert.equal(subject.bioOrDefault(ada, 'No bio yet'), 'No bio yet')
  assert.equal(subject.bioOrDefault({ ...ada, bio: 'Mathematician' }, 'No bio yet'), 'Mathematician')
  // An empty bio is a bio the user saved. `||` would have collapsed it into the
  // fallback and quietly invented content that nobody wrote.
  assert.equal(subject.bioOrDefault({ ...ada, bio: '' }, 'No bio yet'), '')
})

test('pageSize defaults only when nothing was configured', () => {
  assert.equal(subject.pageSize(), 20)
  assert.equal(subject.pageSize(undefined), 20)
  assert.equal(subject.pageSize(50), 50)
  // The one that catches everybody: `configured || 20` returns 20 here.
  assert.equal(subject.pageSize(0), 0)
})

test('pick returns the item, or undefined when there is none', () => {
  const items = ['a', 'b', 'c']

  assert.equal(subject.pick(items, 0), 'a')
  assert.equal(subject.pick(items, 2), 'c')
  assert.equal(subject.pick(items, 3), undefined)
  assert.equal(subject.pick(items, -1), undefined)
  assert.equal(subject.pick(items, 1.5), undefined)
  assert.equal(subject.pick([], 0), undefined)
})

test('indexing is honest about being able to miss', () => {
  const items = ['a', 'b']

  // @ts-expect-error — `noUncheckedIndexedAccess` types `items[0]` as
  // `string | undefined`, even though you and I can see the array literal three
  // lines up. That is the flag doing its job: `['a'][7]` has been `undefined` in
  // every JavaScript engine ever shipped, and this is the first version of the
  // type that admits it.
  const first: string = items[0]
  void first

  assert.equal(subject.pick(items, 0), 'a')
})

test('a possibly-missing result has to be dealt with', () => {
  // @ts-expect-error — `pick` returns `string | undefined`, so a method call on it
  // is refused until the `undefined` is ruled out. The expected error is the test:
  // widen `pick` to return `string` and this line stops failing, and the build
  // breaks here.
  void subject.pick(['a'], 0).toUpperCase()

  const item = subject.pick(['a'], 0)
  assert.ok(item !== undefined)
  assert.equal(item.toUpperCase(), 'A')
})
