/**
 * Asserts the built HTML still carries the SEO contract.
 *
 *   node scripts/check-seo.ts        (run AFTER `vite build`)
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = join(ROOT, 'dist')
const SRC = join(ROOT, 'src')

const problems = []

const fail = (message) => {
  problems.push(message)
}

if (!existsSync(DIST)) {
  process.stderr.write('✖ dist/ does not exist — run `pnpm --filter pdf-annotator build` first.\n')
  process.exit(1)
}

const indexHtml = join(DIST, 'index.html')
const privacyHtml = join(DIST, 'privacy.html')

if (!existsSync(indexHtml)) fail('dist/index.html is missing')
if (!existsSync(privacyHtml)) fail('dist/privacy.html is missing')

const assets = [
  'robots.txt',
  'sitemap.xml',
  'ads.txt',
  'favicon.svg',
  'og.png',
  '_headers',
  '_redirects',
]
for (const name of assets) {
  if (!existsSync(join(DIST, name))) fail(`dist/${name} is missing`)
}

if (existsSync(indexHtml)) {
  const html = readFileSync(indexHtml, 'utf8')
  if (!html.includes('<title>Sign PDF Online</title>')) {
    fail('dist/index.html is missing <title>Sign PDF Online</title>')
  }
  if (!html.includes('name="description"')) fail('dist/index.html is missing meta description')
  if (!html.includes('rel="canonical"')) fail('dist/index.html is missing canonical')
  if (!html.includes('"@type":"WebApplication"') && !html.includes('"@type": "WebApplication"')) {
    fail('dist/index.html is missing WebApplication JSON-LD')
  }
  if (!html.includes('"@type":"FAQPage"') && !html.includes('"@type": "FAQPage"')) {
    fail('dist/index.html is missing FAQPage JSON-LD')
  }
  if (!html.includes('<h1>Sign PDF Online</h1>')) {
    fail('dist/index.html is missing crawlable <h1>Sign PDF Online</h1>')
  }
  if (!html.includes('Nothing is uploaded')) {
    fail('dist/index.html is missing the no-upload copy')
  }
}

if (existsSync(privacyHtml)) {
  const html = readFileSync(privacyHtml, 'utf8')
  if (!html.includes('<title>Privacy · Sign PDF Online</title>')) {
    fail('dist/privacy.html is missing the privacy title')
  }
  if (!html.includes('"@type":"WebPage"') && !html.includes('"@type": "WebPage"')) {
    fail('dist/privacy.html is missing WebPage JSON-LD')
  }
  if (!html.includes('<h1>Privacy</h1>')) fail('dist/privacy.html is missing <h1>Privacy</h1>')
}

if (existsSync(join(DIST, 'robots.txt'))) {
  const robots = readFileSync(join(DIST, 'robots.txt'), 'utf8')
  if (!robots.includes('Sitemap:')) fail('dist/robots.txt is missing a Sitemap line')
}

if (existsSync(join(DIST, 'sitemap.xml'))) {
  const sitemap = readFileSync(join(DIST, 'sitemap.xml'), 'utf8')
  if (!sitemap.includes('/privacy')) fail('dist/sitemap.xml does not list /privacy')
}

const landingSrc = readFileSync(join(SRC, 'components', 'Landing.tsx'), 'utf8')
const privacySrc = readFileSync(join(SRC, 'components', 'PrivacyPage.tsx'), 'utf8')
if (landingSrc.includes('AdSlot')) fail('Landing.tsx imports or mentions AdSlot')
if (privacySrc.includes('AdSlot')) fail('PrivacyPage.tsx imports or mentions AdSlot')

if (problems.length > 0) {
  process.stderr.write(`✖ check:seo failed\n${problems.map((p) => `  - ${p}`).join('\n')}\n`)
  process.exit(1)
}

process.stdout.write('✔ dist/ carries Sign PDF Online title, description, canonical, JSON-LD, privacy page, and crawler files.\n')
