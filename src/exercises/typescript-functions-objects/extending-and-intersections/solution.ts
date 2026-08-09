/**
 * Reference solution: Staple a page on, or demand both
 * Lesson: typescript-functions-objects/extending-and-intersections
 */

export interface Note {
  readonly title: string
  readonly body: string
}

export interface Timestamps {
  readonly createdAt: number
  readonly updatedAt: number
}

/* Two one-line helpers that pay for themselves immediately: every "the same thing,
   but stored" type in a codebase becomes `WithId<Timestamped<X>>` instead of a
   hand-written copy of X with three fields bolted on. When the id becomes a `number`,
   there is one line to change.

   `T & { … }` reads as addition and behaves like a checklist: a value must satisfy
   both sides at once. */
export type WithId<T> = T & { readonly id: string }

export type Timestamped<T> = T & Timestamps

export type StoredNote = Timestamped<WithId<Note>>

export interface StoredNoteByExtends extends Note {
  readonly id: string
  readonly createdAt: number
  readonly updatedAt: number
}

/* Spread the note rather than listing its fields, so adding a field to `Note` does
   not require editing this function. The return type keeps it honest: if `Note` gains
   a required field, the spread supplies it automatically and nothing here changes; if
   `StoredNote` gains one, this stops compiling, which is the half you want to be told
   about. */
export function store(note: Note, id: string, now: number): StoredNote {
  return { ...note, id, createdAt: now, updatedAt: now }
}

/* `stored` is `readonly` throughout, so `stored.updatedAt = now` is a compile error
   and a copy is the only way through. That is `readonly` doing its job: the caller's
   object is untouched and this function has no action at a distance. */
export function touch(stored: StoredNote, now: number): StoredNote {
  return { ...stored, updatedAt: now }
}

/* The parameter is the interesting part. `WithId<Note>` is the least this function
   needs — a `StoredNote` has timestamps too, and is accepted regardless, because
   structural typing only asks whether the required fields are there.

   Asking for `StoredNote` here would have worked today and been wrong tomorrow: a
   draft note with an id but no timestamps could no longer be summarised, for no
   reason at all. */
export function summarise(entity: WithId<Note>): string {
  return `${entity.id}: ${entity.title}`
}

/* Same idea taken further: this needs neither the note nor the id, so it asks for
   neither. `Timestamps` exists as a named type precisely so it can be requested on
   its own — which is also why `Timestamped<T>` is defined as `T & Timestamps` rather
   than spelling the two fields out inline. */
export function ageMs(entity: Timestamps, now: number): number {
  return now - entity.createdAt
}
