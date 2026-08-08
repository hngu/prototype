/**
 * Guards the promises this package makes to the site.
 *
 * The lesson pages render a pill reading "Typechecked and tested against
 * TypeScript X.Y.Z", sourced from `src/elearning/src/lib/typescript-version.ts`.
 * That claim is only true while all three of these agree: the site's declared
 * TypeScript range, this package's declared range, and the compiler actually
 * installed here. One `pnpm update --filter elearning` is enough to break it,
 * and nothing else in the repo would notice.
 */

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { test } from 'node:test'
import { REPO_ROOT, readManifest, defaultRoots } from './manifest.ts'

const require = createRequire(import.meta.url)

interface PackageJson {
  devDependencies?: Record<string, string> | undefined
  dependencies?: Record<string, string> | undefined
}

const readPackage = (...segments: string[]): PackageJson =>
  JSON.parse(readFileSync(join(REPO_ROOT, ...segments, 'package.json'), 'utf8')) as PackageJson

const declaredTypescript = (pkg: PackageJson): string | undefined =>
  pkg.devDependencies?.['typescript'] ?? pkg.dependencies?.['typescript']

test('the site and the exercises declare the same TypeScript range', () => {
  const site = declaredTypescript(readPackage('src', 'elearning'))
  const exercises = declaredTypescript(readPackage('src', 'exercises'))

  assert.ok(site, 'src/elearning/package.json declares no typescript dependency')
  assert.equal(
    exercises,
    site,
    'src/exercises must pin the same TypeScript range as src/elearning, or the site ' +
      'would advertise a version the exercises were not graded with',
  )
})

test('the pinned TYPESCRIPT_VERSION matches the installed compiler', () => {
  const source = readFileSync(
    join(REPO_ROOT, 'src', 'elearning', 'src', 'lib', 'typescript-version.ts'),
    'utf8',
  )
  const pinned = /export const TYPESCRIPT_VERSION = '([^']+)'/.exec(source)?.[1]
  assert.ok(pinned, 'could not find TYPESCRIPT_VERSION in src/elearning/src/lib/typescript-version.ts')

  const installed = (
    JSON.parse(readFileSync(require.resolve('typescript/package.json'), 'utf8')) as {
      version: string
    }
  ).version

  // The site module throws on drift at build time, which covers `astro build`.
  // Asserting it here too means `pnpm --filter exercises verify` catches it
  // without needing to run a full site build.
  assert.equal(
    installed,
    pinned,
    `TYPESCRIPT_VERSION is "${pinned}" but src/exercises resolves typescript@${installed}`,
  )
})

test('every exercise directory is complete and claimed by a lesson', () => {
  // Same check as `pnpm manifest`, asserted here so a plain `pnpm test` cannot
  // pass against a broken tree. The script version exists because CI wants it
  // to run *before* tsc, and because its output is readable by a human.
  const manifest = readManifest(defaultRoots())
  assert.deepEqual(
    manifest.problems,
    [],
    `manifest problems:\n${manifest.problems.map((p) => `  ${p.where}: ${p.message}`).join('\n')}`,
  )
  assert.ok(manifest.exercises.length > 0, 'no exercises found — node --test would grade nothing')
})
