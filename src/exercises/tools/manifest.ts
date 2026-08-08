/**
 * Reads "which exercises exist, are they complete, and does a lesson claim each
 * one" — in both directions.
 *
 * Dependency-free and side-effect-free on purpose. Three callers depend on it
 * (the CI gate, the parity test, and a human running `pnpm manifest`), and
 * keeping it pure is what makes the interesting logic assertable without
 * building a filesystem fixture.
 *
 * Why this exists at all: `node --test` exits 0 when it discovers no test files,
 * and also exits 0 when handed a path that does not exist. Without a gate that
 * counts what it found, a renamed directory produces a green CI run that graded
 * nothing — the worst possible outcome for a site whose whole claim is "these
 * solutions are verified".
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

/** Every exercise directory must contain exactly these. Array order is the
 *  order the site renders them in. */
export const REQUIRED_FILES = [
  'README.md',
  'starter.ts',
  'solution.ts',
  'solution.test.ts',
] as const

export type RequiredFile = (typeof REQUIRED_FILES)[number]

export interface ExerciseDir {
  /** `typescript-fundamentals/type-inference` — identical to the lesson id. */
  id: string
  /** Absolute path to the directory. */
  path: string
  /** Required files that are absent. Empty means complete. */
  missing: RequiredFile[]
}

export interface LessonRef {
  /** `typescript-fundamentals/type-inference` */
  id: string
  /** Absolute path to the lesson markdown file. */
  path: string
  /** The `exercise:` frontmatter field. */
  wantsExercise: boolean
  /** The `draft:` frontmatter field. Drafts are checked too — a broken exercise
   *  behind a draft flag must not be allowed to rot until the day it ships. */
  draft: boolean
}

export interface Problem {
  /** Repo-relative path the reader should open first. */
  where: string
  message: string
}

export interface Manifest {
  exercises: ExerciseDir[]
  lessons: LessonRef[]
  /** Every inconsistency found, in reading order. */
  problems: Problem[]
}

export interface ManifestRoots {
  /** Absolute path to `src/exercises`. */
  exercisesRoot: string
  /** Absolute path to `src/elearning/src/content/lessons`. */
  lessonsRoot: string
  /** Absolute path to the repo root, so messages can print short paths. */
  repoRoot: string
}

/* ── Paths ────────────────────────────────────────────────────────────────── */

/* Derived from import.meta.url, never process.cwd(): this module is imported by
   a test (cwd = src/exercises) and by a script that a human may well run from
   the repo root. */
const HERE = fileURLToPath(new URL('.', import.meta.url))

export const EXERCISES_ROOT = join(HERE, '..')
export const REPO_ROOT = join(HERE, '..', '..', '..')
export const LESSONS_ROOT = join(REPO_ROOT, 'src', 'elearning', 'src', 'content', 'lessons')

export const defaultRoots = (): ManifestRoots => ({
  exercisesRoot: EXERCISES_ROOT,
  lessonsRoot: LESSONS_ROOT,
  repoRoot: REPO_ROOT,
})

/** Directories that live alongside the course directories and are not courses. */
const NOT_A_COURSE = new Set(['tools', 'node_modules'])

/* ── Reading ──────────────────────────────────────────────────────────────── */

/**
 * Strips the `NN-` sort prefix off a lesson filename.
 *
 * DUPLICATED, KNOWINGLY: the identical regex is `generateId` in
 * src/elearning/src/content.config.ts. These are two packages with no dependency
 * between them, and inventing one so a six-character regex can be shared would
 * be the worse trade. Both sites carry a comment pointing at the other — change
 * them together.
 */
const stripOrderPrefix = (relPath: string): string =>
  relPath.replace(/\.md$/, '').replace(/(^|\/)\d+[-_]/g, '$1')

/**
 * Pulls one scalar out of a YAML frontmatter block.
 *
 * Not a YAML parser, and does not need to be: the lesson schema in
 * content.config.ts admits only flat scalars and one string array, and adding a
 * YAML dependency to read a single boolean would break the workspace's
 * no-new-deps rule for no gain. If lesson frontmatter ever grows nested
 * structure, this function is the thing that has to change.
 */
function frontmatterField(source: string, field: string): string | undefined {
  if (!source.startsWith('---')) return undefined
  const end = source.indexOf('\n---', 3)
  if (end === -1) return undefined
  const match = new RegExp(`^${field}[ \\t]*:[ \\t]*(.*)$`, 'm').exec(source.slice(3, end))
  return match?.[1]?.trim()
}

/** Two-levels-deep directories under `root`, as `<course>/<slug>`. */
function twoLevelDirs(root: string): string[] {
  if (!existsSync(root)) return []
  const out: string[] = []
  for (const course of readdirSync(root, { withFileTypes: true })) {
    if (!course.isDirectory() || NOT_A_COURSE.has(course.name)) continue
    for (const entry of readdirSync(join(root, course.name), { withFileTypes: true })) {
      if (entry.isDirectory()) out.push(`${course.name}/${entry.name}`)
    }
  }
  return out.sort()
}

/** Lesson markdown files two levels deep, as absolute paths. */
function lessonFiles(root: string): string[] {
  if (!existsSync(root)) return []
  const out: string[] = []
  for (const course of readdirSync(root, { withFileTypes: true })) {
    if (!course.isDirectory()) continue
    for (const entry of readdirSync(join(root, course.name), { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        out.push(join(root, course.name, entry.name))
      }
    }
  }
  return out.sort()
}

/* ── The cross-check ──────────────────────────────────────────────────────── */

export function readManifest(roots: ManifestRoots): Manifest {
  const { exercisesRoot, lessonsRoot, repoRoot } = roots
  const rel = (path: string): string => relative(repoRoot, path)

  const exercises: ExerciseDir[] = twoLevelDirs(exercisesRoot).map((id) => {
    const path = join(exercisesRoot, id)
    return {
      id,
      path,
      missing: REQUIRED_FILES.filter((file) => !existsSync(join(path, file))),
    }
  })

  const lessons: LessonRef[] = lessonFiles(lessonsRoot).map((path) => {
    const source = readFileSync(path, 'utf8')
    return {
      id: stripOrderPrefix(relative(lessonsRoot, path).split('\\').join('/')),
      path,
      wantsExercise: frontmatterField(source, 'exercise') === 'true',
      draft: frontmatterField(source, 'draft') === 'true',
    }
  })

  const problems: Problem[] = []
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]))
  const claimedBy = new Map<string, LessonRef>()

  // ── Every exercise directory is complete ────────────────────────────────
  for (const exercise of exercises) {
    if (exercise.missing.length > 0) {
      problems.push({
        where: rel(exercise.path),
        message: `incomplete exercise — missing ${exercise.missing.join(', ')}`,
      })
    }
  }

  // ── Every lesson claiming an exercise has one ───────────────────────────
  for (const lesson of lessons) {
    if (!lesson.wantsExercise) continue
    claimedBy.set(lesson.id, lesson)

    if (!byId.has(lesson.id)) {
      problems.push({
        where: rel(lesson.path),
        message:
          `has \`exercise: true\` but src/exercises/${lesson.id}/ does not exist. ` +
          `Create it with ${REQUIRED_FILES.join(', ')}, or set \`exercise: false\`.`,
      })
    }
  }

  // ── …and nothing exists that no lesson renders ──────────────────────────
  // An orphan is not harmless: it is code nobody reads, that CI keeps green,
  // which is exactly how a stale wrong answer survives a refactor.
  for (const exercise of exercises) {
    if (claimedBy.has(exercise.id)) continue

    const lesson = lessons.find((entry) => entry.id === exercise.id)
    problems.push({
      where: rel(exercise.path),
      message: lesson
        ? `exists, but ${rel(lesson.path)} does not set \`exercise: true\` — nothing renders it.`
        : `has no lesson at src/elearning/src/content/lessons/${exercise.id}.md (any NN- prefix). ` +
          `Rename the directory to match the lesson id, or delete it.`,
    })
  }

  problems.sort((a, b) => a.where.localeCompare(b.where))
  return { exercises, lessons, problems }
}

/** Exercises that a published (non-draft) lesson renders. */
export const publishedExercises = (manifest: Manifest): ExerciseDir[] => {
  const live = new Set(
    manifest.lessons.filter((l) => l.wantsExercise && !l.draft).map((l) => l.id),
  )
  return manifest.exercises.filter((exercise) => live.has(exercise.id))
}
