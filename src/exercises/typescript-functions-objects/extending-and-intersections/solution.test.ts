import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as solution from './solution.ts'
import * as starter from './starter.ts'
import type { Note, StoredNote, StoredNoteByExtends, Timestamps, WithId } from './solution.ts'

/**
 * Compile-time API parity, both directions, so neither file can grow, drop or
 * retype an export without tsc saying so.
 */
const _starterMatchesSolution: typeof solution = starter
const _solutionMatchesStarter: typeof starter = solution
void _starterMatchesSolution
void _solutionMatchesStarter

const subject = process.env['EXERCISE_TARGET'] === 'starter' ? starter : solution

const note: Note = { title: 'Shopping', body: 'milk, bread' }

test('store adds the id and starts both clocks together', () => {
  assert.deepEqual(subject.store(note, 'n1', 1000), {
    title: 'Shopping',
    body: 'milk, bread',
    id: 'n1',
    createdAt: 1000,
    updatedAt: 1000,
  })
})

test('touch bumps only updatedAt', () => {
  const stored = subject.store(note, 'n1', 1000)

  assert.deepEqual(subject.touch(stored, 2000), { ...stored, updatedAt: 2000 })
  // And leaves the original alone, which `readonly` made unavoidable.
  assert.equal(stored.updatedAt, 1000)
})

test('summarise asks for the minimum and takes more', () => {
  const stored = subject.store(note, 'n1', 1000)
  const draft: WithId<Note> = { ...note, id: 'draft' }

  // A `StoredNote` has timestamps as well, and is accepted anyway — a parameter type
  // is a floor, not a ceiling.
  assert.equal(subject.summarise(stored), 'n1: Shopping')
  assert.equal(subject.summarise(draft), 'draft: Shopping')
})

test('ageMs asks for the timestamps and nothing else', () => {
  const stored = subject.store(note, 'n1', 1000)

  assert.equal(subject.ageMs(stored, 5000), 4000)
  // Which means a bare pair of timestamps works too, with no note in sight.
  const bare: Timestamps = { createdAt: 100, updatedAt: 100 }
  assert.equal(subject.ageMs(bare, 400), 300)
})

test('the two routes to StoredNote produce the same type', () => {
  // The point of this test is that it COMPILES, in both directions. `StoredNote` is
  // built from two intersections; `StoredNoteByExtends` is an interface listing the
  // members. Same type — `extends` and `&` are two ways of writing one idea.
  const fromIntersection: StoredNote = subject.store(note, 'n1', 1000)

  const asExtended: StoredNoteByExtends = fromIntersection
  const backAgain: StoredNote = asExtended

  assert.equal(subject.summarise(asExtended), 'n1: Shopping')
  assert.deepEqual(backAgain, fromIntersection)

  // They are the same type here because the members agree. Where they stop being
  // interchangeable is a conflict, and that is the one real reason to prefer
  // `extends`:
  interface HasStringX {
    readonly x: string
  }
  interface HasNumberX {
    readonly x: number
  }

  // @ts-expect-error — TS2320: "Interface 'Both' cannot simultaneously extend types
  // 'HasStringX' and 'HasNumberX'." Reported here, on the declaration, which is
  // exactly where you want to hear about it.
  interface Both extends HasStringX, HasNumberX {}
  void ({} as Both)

  // `&` says nothing at all. It cheerfully produces `x: string & number`, which is
  // `never` — a type with no values — and reports no error whatsoever.
  type BothByIntersection = HasStringX & HasNumberX

  // @ts-expect-error — the bill arrives here instead: "Type 'string' is not
  // assignable to type 'never'." Once per attempt to build one, at every call site,
  // rather than once at the declaration.
  const impossible: BothByIntersection = { x: 'a' }
  void impossible
})

test('a stored note is still a note', () => {
  // Also compile-only. An intersection is assignable *up* to either side, which is
  // why every function that takes a `Note` keeps working once you start storing them.
  const stored = subject.store(note, 'n1', 1000)

  const asNote: Note = stored
  const withId: WithId<Note> = stored

  assert.equal(asNote.title, 'Shopping')
  assert.equal(withId.id, 'n1')
})
