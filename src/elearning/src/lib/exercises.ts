/**
 * Loads a lesson's coding exercise off disk from the sibling `src/exercises`
 * package.
 *
 * Throws on anything missing or malformed. Unlike the quiz plugin — whose throw
 * the glob loader catches and swallows (see quiz-plugin.ts) — this one runs in the
 * *page body* of courses/[course]/[lesson].astro, outside the content pipeline,
 * where a throw really does stop `astro build` with a non-zero exit. That
 * placement is the whole reason it lives here rather than in a loader or a
 * Markdown plugin.
 *
 * A lesson that silently renders without its exercise is worse than a build that
 * stops: the page would still look finished, and the missing thing is the part
 * that makes the course trustworthy.
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { marked } from 'marked'
import type { Lesson } from './courses.ts'
import { repoFileUrl, repoTreeUrl } from './site.ts'

/**
 * Locates the workspace root by walking up for `pnpm-workspace.yaml`.
 *
 * Neither of the obvious approaches works here:
 *
 *   - `import.meta.url` is not this file at build time. Vite bundles page modules
 *     into `dist/.prerender/chunks/`, so a relative walk from it lands inside
 *     `dist/` and silently resolves to a directory that does not exist. (Measured:
 *     it produced `src/elearning/exercises` instead of `src/exercises`.)
 *   - `process.cwd()` depends on where the command was invoked from.
 *
 * Walking up for the workspace marker is immune to both: it works from a source
 * path in `astro dev` and from a bundled chunk in `astro build`, because both live
 * underneath the same repository.
 */
function findWorkspaceRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url))

  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    const parent = dirname(dir)
    if (parent === dir) {
      throw new Error(
        'Could not locate pnpm-workspace.yaml walking up from ' +
          `${fileURLToPath(import.meta.url)} — src/lib/exercises.ts needs it to find ` +
          'src/exercises. Did the workspace layout change?',
      )
    }
    dir = parent
  }
}

const EXERCISES_ROOT = join(findWorkspaceRoot(), 'src', 'exercises')

/** Repo-relative, for the GitHub permalinks. Kept in sync with the above by
 *  construction — both describe the same directory. */
const EXERCISES_REPO_PATH = 'src/exercises'

export interface ExerciseFile {
  /** Bare filename, shown as the pane label. */
  name: string
  /** File contents, verbatim. */
  code: string
  /** Permalink to the file on GitHub. */
  href: string
}

export interface Exercise {
  /** `typescript-fundamentals/type-inference` — the lesson id. */
  id: string
  /** Repo-relative directory, shown in the card footer. */
  dir: string
  /** Permalink to the directory on GitHub. */
  href: string
  /** The `# H1` from README.md. */
  title: string
  /** Rendered HTML of the brief — everything before the first `##`. */
  briefHtml: string
  /** Rendered HTML of the `## Goal` section. */
  goalHtml: string
  starter: ExerciseFile
  solution: ExerciseFile
  tests: ExerciseFile
}

/** Reads a required file, or explains precisely what to do about it. */
function read(dir: string, name: string, id: string): string {
  const path = join(dir, name)
  if (!existsSync(path)) {
    throw new Error(
      `Lesson "${id}" sets \`exercise: true\` but ${EXERCISES_REPO_PATH}/${id}/${name} is missing.\n` +
        `  An exercise directory needs README.md, starter.ts, solution.ts and solution.test.ts.\n` +
        `  Run \`pnpm --filter exercises manifest\` to see every problem at once, or set ` +
        `\`exercise: false\` on the lesson.`,
    )
  }
  const code = readFileSync(path, 'utf8')
  if (code.trim() === '') {
    throw new Error(`${EXERCISES_REPO_PATH}/${id}/${name} is empty.`)
  }
  return code
}

/**
 * Splits README.md into the pieces the card renders.
 *
 * `## Run it` and `## Hints` are deliberately *not* rendered on the page: the run
 * commands appear as their own highlighted block, and hints in a card that also
 * shows the solution would be noise. They stay in the file for GitHub readers.
 *
 * Both the H1 and `## Goal` are required, so a half-written brief fails the build
 * rather than rendering a card with a blank space where the task should be.
 */
function parseBrief(markdown: string, id: string): {
  title: string
  briefHtml: string
  goalHtml: string
} {
  const titleMatch = /^#\s+(.+)$/m.exec(markdown)
  if (!titleMatch) {
    throw new Error(
      `${EXERCISES_REPO_PATH}/${id}/README.md has no \`# Title\` heading — it is the exercise name ` +
        `shown on the lesson page.`,
    )
  }
  const title = titleMatch[1]!.trim()

  // Everything between the H1 and the first `##`.
  const afterTitle = markdown.slice(titleMatch.index + titleMatch[0].length)
  const brief = afterTitle.split(/^##\s+/m)[0]?.trim() ?? ''
  if (brief === '') {
    throw new Error(
      `${EXERCISES_REPO_PATH}/${id}/README.md has no intro paragraph between the title and the ` +
        `first \`##\` heading. That paragraph is the brief a learner reads first.`,
    )
  }

  const goalMatch = /^##\s+Goal\s*$([\s\S]*?)(?=^##\s|\s*$)/m.exec(markdown)
  if (!goalMatch) {
    throw new Error(
      `${EXERCISES_REPO_PATH}/${id}/README.md has no \`## Goal\` section — it is the acceptance ` +
        `criteria, and the lesson page renders it as the task list.`,
    )
  }

  /* marked.parse, not parseInline: these are multi-paragraph sections with lists.
     NOTE: it does not escape raw HTML, the same caveat quiz-render.ts carries.
     Fine while every exercise is authored in this repo; needs sanitising the
     moment that stops being true. */
  return {
    title,
    briefHtml: marked.parse(brief, { async: false }),
    goalHtml: marked.parse(goalMatch[1]!.trim(), { async: false }),
  }
}

const file = (dir: string, name: string, id: string): ExerciseFile => ({
  name,
  code: read(dir, name, id).replace(/\s+$/, ''),
  href: repoFileUrl(`${EXERCISES_REPO_PATH}/${id}/${name}`),
})

/** Loads the exercise for a lesson, or undefined when the lesson has none. */
export function loadExerciseFor(lesson: Lesson): Exercise | undefined {
  if (!lesson.data.exercise) return undefined

  const id = lesson.id
  const dir = join(EXERCISES_ROOT, id)

  if (!existsSync(dir)) {
    throw new Error(
      `Lesson "${id}" sets \`exercise: true\` but ${EXERCISES_REPO_PATH}/${id}/ does not exist.\n` +
        `  The directory name must match the lesson id exactly — note the id has no \`NN-\` ` +
        `prefix, even though the lesson filename does.\n` +
        `  Create it with README.md, starter.ts, solution.ts and solution.test.ts, or set ` +
        `\`exercise: false\`.`,
    )
  }

  const { title, briefHtml, goalHtml } = parseBrief(read(dir, 'README.md', id), id)

  return {
    id,
    dir: `${EXERCISES_REPO_PATH}/${id}`,
    href: repoTreeUrl(`${EXERCISES_REPO_PATH}/${id}`),
    title,
    briefHtml,
    goalHtml,
    starter: file(dir, 'starter.ts', id),
    solution: file(dir, 'solution.ts', id),
    tests: file(dir, 'solution.test.ts', id),
  }
}
