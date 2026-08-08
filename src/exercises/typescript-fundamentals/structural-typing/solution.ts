/**
 * Reference solution: Do the job, you're hired
 * Lesson: typescript-fundamentals/structural-typing
 */

export interface Named {
  readonly name: string
}

export interface Identified {
  readonly id: string
}

export interface Timestamped {
  readonly createdAt: number
}

/* `Named` asks for one field, so every object in the program that happens to have
   a name is already a valid argument — a user, an organisation, a build artefact,
   a test fixture someone wrote in a hurry. None of them import `Named` or mention
   it. That is not laziness on their part; it is the point of a structural type
   system, and it is why "type the parameter against the smallest shape you need"
   costs the caller nothing. */
export function greet(entity: Named): string {
  return `Hello, ${entity.name}`
}

/* `names[names.length - 1]` would be typed `string | undefined` here, because
   `noUncheckedIndexedAccess` will not pretend an index exists. You could silence
   it with `!`, but `slice(-1)` never lies: it returns an array, empty or not, and
   `join('')` flattens it to the string we know is there. Lesson 8 is about living
   with that flag pleasantly. */
export function listNames(entities: readonly Named[]): string {
  const names = entities.map((entity) => entity.name)
  if (names.length === 0) return 'nobody'

  const head = names.slice(0, -1)
  const last = names.slice(-1).join('')

  return head.length === 0 ? last : `${head.join(', ')} and ${last}`
}

/* `A & B & C` is an intersection: a value must satisfy all three at once. It reads
   like addition and it behaves like a checklist — three requirements, and anything
   carrying all of them qualifies, whatever else it also carries. */
export function auditLine(entity: Identified & Named & Timestamped): string {
  const date = new Date(entity.createdAt).toISOString().slice(0, 10)
  return `${entity.id} "${entity.name}" @ ${date}`
}

/* The runtime version of the same question, and worth comparing to the type above
   it. The compiler decides "is this the right shape?" by reading declarations; this
   function decides it by looking at the object. Structural typing means both are
   asking about fields rather than about names, which is why the runtime check is a
   faithful translation of the type and not an approximation of it. */
export function isAuditable(value: unknown): value is Identified & Named & Timestamped {
  if (typeof value !== 'object' || value === null) return false

  const { id, name, createdAt } = value as Partial<Identified & Named & Timestamped>
  return typeof id === 'string' && typeof name === 'string' && Number.isFinite(createdAt)
}
