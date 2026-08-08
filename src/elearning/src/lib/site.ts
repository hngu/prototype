/* PLACEHOLDER BRANDING — change these three lines and `site` in astro.config.mjs
   to rename the site. Nothing else hardcodes the name. */
export const SITE_TITLE = 'Codelane'
export const SITE_TAGLINE = 'Learn programming languages, one lesson at a time.'
export const SITE_DESCRIPTION =
  'Free, open lessons on programming languages and technologies. Short reads, real code, and a quiz at the end of every lesson.'

/** Ads render only when this is explicitly enabled — see components/AdSlot.astro. */
export const ADS_ENABLED = import.meta.env['PUBLIC_ADS_ENABLED'] === 'true'

export const NAV_LINKS = [
  { href: '/courses', label: 'Courses' },
  { href: '/about', label: 'About' },
] as const

export const LEVEL_LABELS = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
} as const

/* ── Source repository ─────────────────────────────────────────────────────
   Coding exercises live in the sibling `src/exercises` package and are rendered
   into lesson pages from disk. These build the "open on GitHub" permalinks, so a
   reader can clone and run the thing they are reading rather than trusting it. */
export const REPO_URL = 'https://github.com/hngu/prototype'
export const REPO_BRANCH = 'main'

/** Permalink to a repo-root-relative file, e.g. `src/exercises/…/starter.ts`. */
export const repoFileUrl = (path: string): string => `${REPO_URL}/blob/${REPO_BRANCH}/${path}`

/** Permalink to a repo-root-relative directory. */
export const repoTreeUrl = (path: string): string => `${REPO_URL}/tree/${REPO_BRANCH}/${path}`

/** The workflow that typechecks and runs every exercise on every push. The
 *  "verified" pill links here rather than embedding GitHub's badge SVG — see
 *  components/VerifiedPill.astro for why. */
export const CI_WORKFLOW_URL = `${REPO_URL}/actions/workflows/exercises.yml`
