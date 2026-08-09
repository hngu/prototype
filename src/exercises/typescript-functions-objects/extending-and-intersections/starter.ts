/**
 * Exercise: Staple a page on, or demand both
 * Lesson:   typescript-functions-objects/extending-and-intersections
 *
 * Replace every `throw new Error('TODO: …')` with a real implementation.
 *
 * `WithId<T>` and `Timestamped<T>` take a type parameter. You have not met those
 * properly yet — course 3 is about them — and you do not need to: read `WithId<Note>`
 * as "a Note, plus an id" and everything here follows.
 */

export interface Note {
  readonly title: string
  readonly body: string
}

/** Epoch milliseconds, twice. Its own named type so it can be asked for alone. */
export interface Timestamps {
  readonly createdAt: number
  readonly updatedAt: number
}

/** "Whatever T is, plus an id." */
export type WithId<T> = T & { readonly id: string }

/** "Whatever T is, plus both timestamps." */
export type Timestamped<T> = T & Timestamps

/** Way one: compose the two helpers. */
export type StoredNote = Timestamped<WithId<Note>>

/**
 * Way two: an interface that `extends` and lists the rest. Exactly the same type as
 * `StoredNote`, arrived at from the other direction — `solution.test.ts` proves the
 * two are mutually assignable.
 */
export interface StoredNoteByExtends extends Note {
  readonly id: string
  readonly createdAt: number
  readonly updatedAt: number
}

/** Files a note. `createdAt` and `updatedAt` both start at `now`. */
export function store(note: Note, id: string, now: number): StoredNote {
  throw new Error('TODO: add the id and both timestamps')
}

/** Bumps `updatedAt` and changes nothing else. */
export function touch(stored: StoredNote, now: number): StoredNote {
  throw new Error('TODO: a copy with a new updatedAt')
}

/**
 * `'n1: Shopping'`.
 *
 * Note the parameter: the *minimum* this function needs, not `StoredNote`. A
 * `StoredNote` satisfies it anyway, because it has those fields and then some.
 */
export function summarise(entity: WithId<Note>): string {
  throw new Error('TODO: id, colon, title')
}

/** How long ago it was created. Asks only for the timestamps. */
export function ageMs(entity: Timestamps, now: number): number {
  throw new Error('TODO: now minus createdAt')
}
