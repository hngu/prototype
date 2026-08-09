import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Equals, Expect } from '../../tools/type-assert.ts'
import * as solution from './solution.ts'
import * as starter from './starter.ts'
import type { ApiResponse, City, Tag, User, Visit } from './solution.ts'

/**
 * Compile-time API parity, both directions, so neither file can grow, drop or
 * retype an export without tsc saying so.
 */
const _starterMatchesSolution: typeof solution = starter
const _solutionMatchesStarter: typeof starter = solution
void _starterMatchesSolution
void _solutionMatchesStarter

const subject = process.env['EXERCISE_TARGET'] === 'starter' ? starter : solution

/**
 * The given types are this exercise's subject, so they are asserted directly. These are
 * the lines that let the lesson page claim an indexed access produces what it says.
 */
type _city = Expect<Equals<City, string>>
type _tag = Expect<Equals<Tag, string>>
type _visit = Expect<Equals<Visit, { readonly at: number; readonly page: string }>>
type _page = Expect<Equals<Visit['page'], string>>
type _profile = Expect<Equals<User['profile'], { readonly city: string; readonly postcode: string }>>

/* `[number]` gives the element type, not the array. Getting this wrong is the whole
   reason the assertion above is worth having. */
type _tagIsNotArray = Expect<Equals<Equals<Tag, readonly string[]>, false>>

/* On a tuple, `[0]` and `[number]` genuinely differ — worth pinning so the distinction
   in `solution.ts`'s comment is checked rather than merely claimed. */
type _tupleAtZero = Expect<Equals<[string, number][0], string>>
type _tupleAtNumber = Expect<Equals<[string, number][number], string | number>>

const response: ApiResponse = {
  user: {
    id: 'u1',
    profile: { city: 'Cambridge', postcode: 'CB1' },
    tags: ['beta', 'staff'],
    visits: [
      { at: 300, page: '/pricing' },
      { at: 100, page: '/' },
      { at: 200, page: '/docs' },
    ],
  },
}

const empty: ApiResponse = {
  user: { id: 'u2', profile: { city: 'Ely', postcode: 'CB7' }, tags: [], visits: [] },
}

test('cityOf reaches in', () => {
  assert.equal(subject.cityOf(response), 'Cambridge')
  assert.equal(subject.cityOf(empty), 'Ely')
})

test('firstTag copes with no tags', () => {
  assert.equal(subject.firstTag(response), 'beta')
  assert.equal(subject.firstTag(empty), undefined)
})

test('pagesVisited maps in order', () => {
  assert.deepEqual(subject.pagesVisited(response), ['/pricing', '/', '/docs'])
  assert.deepEqual(subject.pagesVisited(empty), [])
})

test('latestVisit picks the highest at', () => {
  assert.deepEqual(subject.latestVisit(response), { at: 300, page: '/pricing' })
  assert.equal(subject.latestVisit(empty), undefined)
})

test('fieldOf returns the field, not a union of every field', () => {
  assert.equal(subject.fieldOf(response, 'id'), 'u1')
  assert.deepEqual(subject.fieldOf(response, 'profile'), { city: 'Cambridge', postcode: 'CB1' })
  assert.deepEqual(subject.fieldOf(response, 'tags'), ['beta', 'staff'])
})

test('fieldOf keeps the key it was given', () => {
  // Half the point of this test is that it COMPILES. `.postcode` is only reachable
  // because the return type is `User['profile']` rather than a union of all four field
  // types — the `K extends keyof User` payoff from lesson 3.2, arriving again.
  const profile = subject.fieldOf(response, 'profile')
  type _profileField = Expect<Equals<typeof profile, User['profile']>>
  assert.equal(profile.postcode, 'CB1')

  const id = subject.fieldOf(response, 'id')
  type _idField = Expect<Equals<typeof id, string>>
  assert.equal(id.toUpperCase(), 'U1')

  // @ts-expect-error — and a field the user does not have is refused.
  subject.fieldOf(response, 'email')
})

test('the derived types are usable as ordinary types', () => {
  // Compile-only. A `Visit` built by hand is accepted by everything that produces one,
  // which is what makes an indexed-access type worth naming rather than inlining.
  const handMade: Visit = { at: 999, page: '/new' }
  const city: City = subject.cityOf(response)
  const tags: readonly Tag[] = response.user.tags

  assert.equal(handMade.page, '/new')
  assert.equal(city, 'Cambridge')
  assert.deepEqual(tags, ['beta', 'staff'])

  // @ts-expect-error — `Visit` is a real type with real requirements, not a loose bag.
  const wrong: Visit = { at: 'soon', page: '/new' }
  void wrong
})

test('pagesVisited output is a list of pages, precisely', () => {
  const pages = subject.pagesVisited(response)
  type _pages = Expect<Equals<typeof pages, readonly Visit['page'][]>>
  type _pagesAreStrings = Expect<Equals<typeof pages, readonly string[]>>

  assert.equal(pages.join(','), '/pricing,/,/docs')
})
