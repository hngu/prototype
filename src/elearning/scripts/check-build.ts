/**
 * Asserts the built site is not quietly broken.
 *
 *   node scripts/check-build.ts        (run AFTER `astro build`)
 *
 * `scripts/check-content.ts` validates the inputs. This validates the outputs,
 * and it exists because of a measured failure mode: when Astro 7's glob loader
 * catches an error thrown while rendering a lesson, it logs and continues, and
 * the build emits that lesson page with a **completely empty `<article>`** while
 * exiting 0.
 *
 * check-content covers the cause we know about. This covers the shape of the
 * symptom, so the next cause — a plugin change, an Astro upgrade, a Sätteri
 * quirk nobody has met yet — cannot ship an empty lesson either.
 *
 * Deliberately crude: string matching on the emitted HTML, no parser, no new
 * dependency. It only has to answer "is there prose in there, and did the
 * quizzes survive".
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = join(ROOT, 'dist')
const LESSONS = join(ROOT, 'src', 'content', 'lessons')

/** Prose shorter than this is not a lesson, whatever else it is. */
const MIN_ARTICLE_CHARS = 400

const problems: string[] = []

if (!existsSync(DIST)) {
  process.stderr.write('✖ dist/ does not exist — run `astro build` first.\n')
  process.exit(1)
}

/** Every `index.html` under dist/courses/<course>/<lesson>/. */
function builtLessonPages(): string[] {
  const courses = join(DIST, 'courses')
  if (!existsSync(courses)) return []

  const out: string[] = []
  for (const course of readdirSync(courses, { withFileTypes: true })) {
    if (!course.isDirectory()) continue
    for (const lesson of readdirSync(join(courses, course.name), { withFileTypes: true })) {
      if (!lesson.isDirectory()) continue
      const page = join(courses, course.name, lesson.name, 'index.html')
      if (existsSync(page)) out.push(page)
    }
  }
  return out.sort()
}

/**
 * Expected quiz count per lesson id, counted from the source `.md`.
 *
 * Counting fences in the source and `data-quiz-id` in the output means a quiz
 * that silently fails to render is a mismatch, not just a smaller number.
 */
function expectedQuizCounts(): Map<string, number> {
  const counts = new Map<string, number>()
  if (!existsSync(LESSONS)) return counts

  for (const course of readdirSync(LESSONS, { withFileTypes: true })) {
    if (!course.isDirectory()) continue
    for (const entry of readdirSync(join(LESSONS, course.name), { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue

      const source = readFileSync(join(LESSONS, course.name, entry.name), 'utf8')
      const fences = source.match(/^\s*`{3,}\s*quiz\s*$/gm)?.length ?? 0
      const slug = entry.name.replace(/\.md$/, '').replace(/^\d+[-_]/, '')
      counts.set(`${course.name}/${slug}`, fences)
    }
  }
  return counts
}

const expected = expectedQuizCounts()
const pages = builtLessonPages()

if (pages.length === 0) {
  process.stderr.write('✖ no lesson pages found under dist/courses/ — the build emitted nothing.\n')
  process.exit(1)
}

for (const page of pages) {
  const rel = relative(ROOT, page)
  const html = readFileSync(page, 'utf8')

  // Astro appends a scoped `data-astro-cid-*` attribute to the tag, so the open
  // tag cannot be matched literally.
  const article = /<article class="prose"[^>]*>([\s\S]*?)<\/article>/.exec(html)?.[1]
  if (article === undefined) {
    problems.push(`${rel}\n    no <article class="prose"> — the lesson layout did not render`)
    continue
  }

  const text = article.replace(/<[^>]+>/g, '').trim()
  if (text.length < MIN_ARTICLE_CHARS) {
    problems.push(
      `${rel}\n    article body is ${text.length} chars (min ${MIN_ARTICLE_CHARS}) — the lesson ` +
        `rendered EMPTY.\n    This is the glob-loader-swallowed-an-error failure. Run ` +
        `\`node scripts/check-content.ts\` and re-read the build log for [glob-loader] errors.`,
    )
    continue
  }

  // dist/courses/<course>/<lesson>/index.html → <course>/<lesson>
  const parts = rel.split(/[\\/]/)
  const id = `${parts[2]}/${parts[3]}`
  const want = expected.get(id)
  const got = html.match(/data-quiz-id="/g)?.length ?? 0

  if (want !== undefined && got !== want) {
    problems.push(`${rel}\n    ${got} quiz block(s) rendered, ${want} in the source .md`)
  }
}

if (problems.length > 0) {
  for (const problem of problems) process.stderr.write(`  ${problem}\n`)
  process.stderr.write(`\n✖ ${problems.length} problem(s) in the built output.\n`)
  process.exit(1)
}

const quizzes = pages.reduce(
  (sum, page) => sum + (readFileSync(page, 'utf8').match(/data-quiz-id="/g)?.length ?? 0),
  0,
)
process.stdout.write(`✔ ${pages.length} lesson page(s) built with prose and ${quizzes} quiz block(s).\n`)
