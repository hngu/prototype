import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Equals, Expect } from '../../tools/type-assert.ts'
import * as solution from './solution.ts'
import * as starter from './starter.ts'
import type { Constructor, Serializable, Timestamped } from './solution.ts'

/**
 * Nothing here has a private or protected member, so the usual whole-module parity check
 * works — and this is the only exercise in the course where it does. `Note`'s fields are
 * all public, and the mixins add nothing hidden.
 */
const _starterMatchesSolution: typeof solution = starter
const _solutionMatchesStarter: typeof starter = solution
void _starterMatchesSolution
void _solutionMatchesStarter

const subject = process.env['EXERCISE_TARGET'] === 'starter' ? starter : solution

const { withSerializable, withTimestamp, Note, timestampedNote, describeRecord } = subject

/* A fixed clock, so the age assertions are not a race. */
const NOW = new Date('2026-08-09T12:00:00.000Z')
const at = (secondsLater: number): Date => new Date(NOW.getTime() + secondsLater * 1000)

/* ── Each mixin on its own ──────────────────────────────────────────────────────────── */

test('withSerializable adds serialisation to a class that knew nothing about it', () => {
  const SerializableNote = withSerializable(Note)
  const note = new SerializableNote('Shopping', 'milk and bread')

  assert.deepEqual(note.toRecord(), { title: 'Shopping', body: 'milk and bread' })
  assert.equal(note.serialize(), '{"title":"Shopping","body":"milk and bread"}')
})

test('the base class keeps everything it could already do', () => {
  const SerializableNote = withSerializable(Note)
  const note = new SerializableNote('Shopping', 'milk and bread')

  // `summary` came from `Note`, and the constructor arguments are still checked against it.
  assert.equal(note.summary(), 'Shopping: milk and b')
  assert.ok(note instanceof Note)
})

test('serialisation covers own properties only, so methods stay out of it', () => {
  const SerializableNote = withSerializable(Note)
  const record = new SerializableNote('a', 'b').toRecord()

  assert.deepEqual(Object.keys(record), ['title', 'body'])
  assert.equal('summary' in record, false, 'methods live on the prototype')
})

test('withTimestamp adds a construction time and an age', () => {
  const TimestampedNoteOnly = withTimestamp(Note)
  const note = new TimestampedNoteOnly('a', 'b')

  assert.ok(note.createdAt instanceof Date)
  assert.equal(note.ageInSeconds(new Date(note.createdAt.getTime() + 90_000)), 90)

  // Whole seconds, floored.
  assert.equal(note.ageInSeconds(new Date(note.createdAt.getTime() + 1_999)), 1)
})

test('an age is never negative, whatever clock it is handed', () => {
  const TimestampedNoteOnly = withTimestamp(Note)
  const note = new TimestampedNoteOnly('a', 'b')

  // A caller can pass any `now`, including one before the object existed.
  assert.equal(note.ageInSeconds(new Date(note.createdAt.getTime() - 5_000)), 0)
  assert.equal(note.ageInSeconds(note.createdAt), 0)
})

test('a mixin works on a class it was never written for', () => {
  // The whole argument for mixins over inheritance: no shared base, nothing planned.
  class Session {
    token: string
    constructor(token: string) {
      this.token = token
    }
  }

  const note = new (withSerializable(Session))('abc')
  assert.equal(note.serialize(), '{"token":"abc"}')

  const timed = new (withTimestamp(Session))('abc')
  assert.equal(timed.ageInSeconds(at(-1_000_000)), 0)
})

/* ── Composition ───────────────────────────────────────────────────────────────────── */

test('both abilities and the original arrive together', () => {
  const TimestampedNote = timestampedNote()
  const note = new TimestampedNote('Shopping', 'milk and bread')

  assert.equal(note.summary(), 'Shopping: milk and b')
  assert.ok(note.createdAt instanceof Date)
  assert.deepEqual(Object.keys(note.toRecord()), ['title', 'body', 'createdAt'])
})

test('a composed class is an ordinary class, subclassable and all', () => {
  const TimestampedNote = timestampedNote()

  class UrgentNote extends TimestampedNote {
    override summary(): string {
      return `URGENT ${super.summary()}`
    }
  }

  const urgent = new UrgentNote('Fire', 'the building is on fire')

  assert.equal(urgent.summary(), 'URGENT Fire: the buildi')
  assert.equal(urgent.ageInSeconds(at(-1)), 0)
  assert.ok(urgent instanceof Note, 'the chain reaches all the way down')
})

test('the composed type has all three sets of members', () => {
  const TimestampedNote = timestampedNote()
  const note = new TimestampedNote('a', 'b')

  // `InstanceType<typeof Note>` because `Note` arrived here as a destructured *value*, and
  // a value is not a type — lesson 3.3's distinction, in its most everyday form.
  type _hasAll = Expect<Equals<typeof note, InstanceType<typeof Note> & Serializable & Timestamped>>

  // @ts-expect-error — and nothing else. `Note` has no `tags`.
  void note.tags

  assert.equal(note.title, 'a')
})

test('the outermost mixin wins when two define the same member', () => {
  // Order is irrelevant for the exercise's two mixins, because they are independent. Here
  // is the case where it is not, since that is the rule worth knowing.
  const shout = <TBase extends Constructor<{ summary(): string }>>(Base: TBase) =>
    class extends Base {
      override summary(): string {
        return super.summary().toUpperCase()
      }
    }

  const exclaim = <TBase extends Constructor<{ summary(): string }>>(Base: TBase) =>
    class extends Base {
      override summary(): string {
        return `${super.summary()}!`
      }
    }

  // Applied inside-out, so the outermost runs last — exactly as the last `extends` in a
  // chain does.
  assert.equal(new (exclaim(shout(Note)))('a', 'b').summary(), 'A: B!')
  assert.equal(new (shout(exclaim(Note)))('a', 'b').summary(), 'A: B!')

  // The two happen to commute; a mixin that ignores `super` would not.
  const replace = <TBase extends Constructor<{ summary(): string }>>(Base: TBase) =>
    class extends Base {
      override summary(): string {
        return 'replaced'
      }
    }

  assert.equal(new (shout(replace(Note)))('a', 'b').summary(), 'REPLACED')
  assert.equal(new (replace(shout(Note)))('a', 'b').summary(), 'replaced')

  // And this is why the exercise's own two mixins can be composed in either order: they
  // share no member names with each other or with `Note`, so there is nothing to win.
  assert.equal(new (shout(withSerializable(Note)))('a', 'b').serialize(), '{"title":"a","body":"b"}')
  assert.equal(new (withSerializable(shout(Note)))('a', 'b').summary(), 'A: B')
})

/* ── Asking for the ability rather than the class ───────────────────────────────────── */

test('describeRecord works on the composed class', () => {
  const TimestampedNote = timestampedNote()
  const note = new TimestampedNote('a', 'b')

  assert.equal(
    describeRecord(note, new Date(note.createdAt.getTime() + 5_000)),
    '{"title":"a","body":"b","createdAt":"' + note.createdAt.toISOString() + '"} @ 5s',
  )
})

test('describeRecord works on anything with both abilities, mixin or not', () => {
  // It named two interfaces rather than a class, so a hand-written object qualifies — and
  // this is what makes the abilities worth expressing as interfaces at all.
  const createdAt = NOW
  const handmade: Serializable & Timestamped = {
    createdAt,
    serialize: () => '{"hand":"made"}',
    toRecord: () => ({ hand: 'made' }),
    ageInSeconds: (now) => Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 1000)),
  }

  assert.equal(describeRecord(handmade, at(120)), '{"hand":"made"} @ 120s')
})

test('describeRecord refuses something with only one of the two', () => {
  const serializableOnly = new (withSerializable(Note))('a', 'b')

  // Never invoked: the directive silences the type error and the call would still run,
  // reaching an `ageInSeconds` that does not exist.
  const rejected = (): void => {
    // @ts-expect-error — no `createdAt`, no `ageInSeconds`. The intersection is a real
    // requirement, not documentation.
    void describeRecord(serializableOnly, NOW)
  }
  void rejected

  assert.equal(serializableOnly.serialize(), '{"title":"a","body":"b"}')
})
