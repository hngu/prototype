/**
 * Exercise: Do the job, you're hired
 * Lesson:   typescript-fundamentals/structural-typing
 *
 * Replace every `throw new Error('TODO: …')` with a real implementation.
 *
 * Notice how small these parameter types are. That is the exercise as much as the
 * function bodies: a parameter should ask for the least it can get away with, and
 * structural typing is what makes that free for the caller.
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

/** `'Hello, ada'` */
export function greet(entity: Named): string {
  throw new Error('TODO: greet by name')
}

/**
 * Names in English.
 *
 *   []                    →  'nobody'
 *   [ada]                 →  'ada'
 *   [ada, grace]          →  'ada and grace'
 *   [ada, grace, hopper]  →  'ada, grace and hopper'
 */
export function listNames(entities: readonly Named[]): string {
  throw new Error('TODO: join the names, with "and" before the last one')
}

/** `'w1 "widget" @ 1970-01-01'` — the date only, from `createdAt` as epoch ms. */
export function auditLine(entity: Identified & Named & Timestamped): string {
  throw new Error('TODO: build the audit line')
}

/** True when `value` has all three shapes' fields, with the right types. */
export function isAuditable(value: unknown): value is Identified & Named & Timestamped {
  throw new Error('TODO: check the three fields at run time')
}
