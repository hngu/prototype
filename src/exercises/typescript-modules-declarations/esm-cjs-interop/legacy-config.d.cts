/**
 * Declarations for `legacy-config.cjs` — given, not part of the exercise.
 *
 * Lesson 5.6 is about writing one of these. For now, note only that without it the import
 * next door is `TS7016: Could not find a declaration file for module …`, which is the
 * compiler declining to guess.
 */

export interface DbConfig {
  readonly host: string
  readonly port: number
  readonly ssl: boolean
}

export declare const DEFAULTS: DbConfig
export declare function load(overrides?: Partial<DbConfig>): DbConfig
export declare function describe(config: DbConfig): string
export declare const version: string
