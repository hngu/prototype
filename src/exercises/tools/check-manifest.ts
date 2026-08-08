/**
 * The gate. Run before `tsc` and `node --test`, never after.
 *
 * `node --test` exits 0 when it finds no test files, and exits 0 when handed a
 * path that does not exist. That makes "green" and "graded something" different
 * facts, and this script is the only thing that checks the second one. If
 * anybody ever "simplifies" the `verify` script by dropping `manifest`, the
 * guard is gone and CI starts lying — see README.md, "The three invariants".
 *
 *   node tools/check-manifest.ts
 *
 * Exits 1 on any inconsistency, and on a count of zero.
 */

import { readManifest, defaultRoots, REQUIRED_FILES } from './manifest.ts'

const manifest = readManifest(defaultRoots())

const complete = manifest.exercises.filter((exercise) => exercise.missing.length === 0)
const claiming = manifest.lessons.filter((lesson) => lesson.wantsExercise)

for (const problem of manifest.problems) {
  process.stderr.write(`  ${problem.where}\n    ${problem.message}\n`)
}

if (manifest.problems.length > 0) {
  process.stderr.write(
    `\n✖ ${manifest.problems.length} problem(s). ` +
      `Every exercise directory needs ${REQUIRED_FILES.join(', ')}, ` +
      `and every lesson with \`exercise: true\` needs a directory named after its lesson id.\n`,
  )
  process.exit(1)
}

// The zero check is the whole point of this file existing. Counted separately
// from the problem list above, because "nothing is inconsistent" is trivially
// true of an empty tree.
if (complete.length === 0) {
  process.stderr.write(
    `✖ No complete exercises found under src/exercises/.\n` +
      `  \`node --test\` would exit 0 here having graded nothing, so this is a failure.\n`,
  )
  process.exit(1)
}

process.stdout.write(
  `✔ ${complete.length} exercise(s), ${claiming.length} lesson(s) claiming one, no problems.\n`,
)
