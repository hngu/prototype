# Codelane — elearning site

A free, statically generated site for lessons on programming languages and technologies.
Lessons are plain Markdown; a build step turns them into HTML, including interactive quizzes.

Built with **Astro 7** and **Tailwind CSS v4**. Ships **no framework JavaScript** — a lesson page
carries about **1.5 KB of inline vanilla JS** (the quiz) and nothing else.

```bash
pnpm --filter elearning dev       # dev server
pnpm --filter elearning build     # static build → dist/
pnpm --filter elearning preview   # serve the build
pnpm --filter elearning check     # astro check (types + templates)
pnpm --filter elearning lint      # oxlint
pnpm --filter elearning og        # regenerate public/og-default.png
```

---

## Writing a lesson

Lessons live in `src/content/lessons/<course-id>/NN-<slug>.md`. The `NN-` prefix keeps directory
listings readable and is **stripped from the URL**; the authoritative ordering is the `order`
field, so inserting a lesson never means renumbering files.

```markdown
---
title: Inference and widening
course: typescript-fundamentals # must match a file in src/content/courses/
order: 1
summary: One or two sentences. Used as the meta description and the card blurb.
duration: 8 # minutes
draft: false
---

Prose goes here. Fenced code blocks get Shiki highlighting automatically.
```

Frontmatter is schema-validated (`src/content.config.ts`). A typo'd `course:` value or a missing
field fails `astro sync` with a clear message rather than rendering an empty page.

Drafts (`draft: true`) are visible in `dev` but **never built** in production, so they cannot be
crawled or appear in the sitemap.

## Writing a quiz

Put a fenced ` ```quiz ` block anywhere in a lesson. Files stay pure Markdown — no MDX, no JSX —
so they still render correctly on GitHub.

````markdown
```quiz
id: type-inference-1
q: What type is inferred for `const x = 5`?
- [x] `5`
- [ ] `number`
- [ ] `any`
explain: A `const` declaration narrows to the literal type.
```
````

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | lowercase kebab-case, **unique across the whole site** |
| `q` | yes | alias: `question`. Inline Markdown supported |
| `- [ ]` / `- [x]` | yes\* | `[x]` marks a correct answer; needs 2+ choices |
| `explain` | no | alias: `explanation`. Shown after answering, either way |
| `type` | no | `single`, `multi`, `true-false` |
| `answer` | tf only | `true` / `false` |

\* Not used by `true-false`, which takes `answer:` instead.

**Question types.** One `[x]` gives single-choice (radios). Two or more gives multi-select
(checkboxes, graded all-or-nothing — a partially correct answer is wrong, and correct-but-unselected
options are marked as missed). True/false is opt-in:

````markdown
```quiz
id: tf-widening-1
type: true-false
q: `let x = 5` widens to `number`.
answer: true
explain: Only `const` bindings keep the literal type.
```
````

Question, choice and explanation text all support inline Markdown — backticks, bold, links.

**Malformed blocks fail the build**, with the file path and the exact line:

```
Invalid ```quiz block:
  src/content/lessons/typescript-fundamentals/01-type-inference.md:35  no correct answer — mark one choice with "- [x]"
```

Validated: missing/duplicate/misspelled fields, bad `id` casing, fewer than two choices, no correct
answer, duplicate choice text, `type: single` contradicted by two correct answers, and duplicate
quiz ids across different files.

> **Answers are visible in the page source.** Client-side checking cannot be made cheat-proof
> without a server. That is the right trade for a free learning site — these are practice
> checkpoints, not proctored exams — but it is a deliberate decision, not an oversight.

---

## How it fits together

```
lesson.md
  └─ Sätteri mdast pass          src/plugins/quiz-plugin.ts
       ├─ parse + validate       src/plugins/quiz-parse.ts   (pure, no imports)
       ├─ throw on error         → build fails with path:line
       └─ replace code node with static HTML
                                 src/plugins/quiz-render.ts
  └─ Shiki highlights remaining code blocks
  └─ one small vanilla script wires [data-quiz]
                                 src/scripts/quiz.ts
```

Two things worth knowing before changing the pipeline:

1. **Astro 7 uses Sätteri, not remark, by default.** `@astrojs/markdown-remark` is only an optional
   peer dependency, so entries in `markdown.remarkPlugins` are *silently ignored*. Quiz handling is
   a Sätteri mdast plugin registered via `markdown.processor`.
2. **Sätteri diagnostics are discarded** by `@astrojs/markdown-satteri` (it destructures only
   `{ html, data }`), so `ctx.report()` cannot fail a build. The plugin `throw`s instead.

Replacing the node during the **mdast** phase also means Shiki — which runs later on hast `<pre>`
elements — never sees the quiz block, so no `excludeLangs` config is needed.

## Theming

Colours are defined once as a scale in `src/styles/global.css`, then mapped to **role tokens**
(`--color-surface`, `--color-content`, `--color-line`, …). Components reference only roles, which
is what keeps dark mode from turning into hundreds of `dark:` utilities. Dark mode flips the roles
in a single `[data-theme='dark']` block.

`ThemeScript.astro` must keep `is:inline` and stay first in `<head>` — without that Astro defers it
and the page flashes the wrong theme on load.

---

## Deploying

The build is a plain static directory (`dist/`) and works on any static host. **Cloudflare Pages is
the recommended target** — see the note on advertising below.

| Host | Build command | Output directory |
| --- | --- | --- |
| **Cloudflare Pages** | `pnpm --filter elearning build` | `src/elearning/dist` (from repo root) |
| Netlify | `pnpm build` with `base = "src/elearning"` | `dist` (relative to `base`) |
| Vercel | Root Directory `src/elearning` | auto |
| GitHub Pages | `withastro/action` with `path: ./src/elearning` | auto |

Set `NODE_VERSION=24.9.0` (Cloudflare/Netlify) — neither reads `.tool-versions`. Vercel needs an
`engines.node` field or `.nvmrc`, and "Include files outside the Root Directory" enabled so the
pnpm workspace and lockfile resolve.

**GitHub Pages needs a config change** if served from a subpath: set `base: '/repo'` in
`astro.config.mjs` *and* use `import.meta.env.BASE_URL` for every internal link, or all links 404.

### Before the first production deploy

1. Set the real domain in `astro.config.mjs` (`site`) — canonical URLs, OpenGraph tags and the
   sitemap are all derived from it, and `@astrojs/sitemap` emits nothing without it.
2. Update the `Sitemap:` line in `public/robots.txt` to match.
3. Change `SITE_TITLE` / `SITE_TAGLINE` in `src/lib/site.ts`, then run `pnpm og` to regenerate the
   share image.
4. Put a real address on `/contact` and finish `/privacy`.

---

## Advertising

Ad slots exist but are **off**. Nothing renders — no placeholder, no network request — unless
`PUBLIC_ADS_ENABLED=true` is set at build time.

`<AdSlot />` is rendered **only from `LessonLayout.astro`**, never from `BaseLayout`, so the landing
page, course index and legal pages structurally cannot carry an ad. There is a check for this in
the verification steps below.

**Neither major network will accept the site as it stands**, so this is sequenced:

| Stage | Requirement | Action |
| --- | --- | --- |
| now | — | slots dark; write lessons |
| ~15–30 lessons + organic traffic | no traffic floor, but thin content is the top rejection reason | apply to **AdSense** |
| 50k+ pageviews/month | EthicalAds' stated minimum | apply to **EthicalAds** |

EthicalAds is the better long-term fit for programming content: developer-focused, ~$2.50 CPM, and
**no cookies, so no consent banner**. AdSense requires a CMP in the EU, which is itself a layout-shift
and UX cost.

**Hosting interacts with this.** Vercel's fair-use policy names advertising as commercial use and
restricts the Hobby plan to non-commercial personal use, so ads there require a Pro plan. Netlify
*suspends the site for the rest of the month* on bandwidth overage — the worst possible failure for
an ad-supported site, since it hits precisely when traffic peaks. Cloudflare Pages allows commercial
use on the free tier and does not meter static-asset bandwidth.

When switching a network on: replace the inner `div` in `AdSlot.astro` with the network's embed,
**keep the wrapper** (it reserves the height that holds CLS at zero), add the publisher line to
`public/ads.txt`, and update `/privacy`.

---

## Security

Dependencies were audited before selection: no known advisories at the pinned versions, no install
lifecycle scripts, and SLSA provenance on every direct dependency including native binaries.

Two workspace settings do the real work and should be kept:

- **`minimumReleaseAge: 10080`** in `pnpm-workspace.yaml` quarantines any package version for seven
  days. Registry worms are typically detected and purged within hours to two days, so this is the
  single most effective control against them. It is also why `astro` is pinned at `^7.1.6` rather
  than `7.2.0`. **Adding a dependency published in the last week will fail to install — this is
  working as intended.**
- **pnpm blocks install scripts by default.** `allowBuilds` in `pnpm-workspace.yaml` is a narrow
  allowlist (currently just `esbuild`, which needs its postinstall to link a platform binary).

```bash
pnpm audit --audit-level high
npm audit signatures        # verifies registry signatures + provenance
```

### Known open advisory: `nanoid` (GHSA-2v37-7h3g-55p8, high)

`pnpm audit` reports one high-severity advisory against `nanoid@3.3.16`, reached transitively via
`vite → postcss`. **Assessed as not exploitable here:**

- It is a **build-time** dependency. `nanoid` does not appear anywhere in `dist/` — this is a static
  site with no server runtime, so it never reaches a browser or handles a request.
- The bug is an infinite loop in `customAlphabet` / `customRandom` when called with an
  **attacker-controlled `size` of 0**. postcss calls it with fixed internal sizes; there is no path
  from site content or a visitor to that argument.

**It is deliberately not patched yet.** The fix (`3.3.17`) was published 2026-08-03 and is younger
than the seven-day `minimumReleaseAge` quarantine, so pnpm correctly refuses it. The eligible
alternative, `5.1.6`, is a major bump to an ESM-only release that `postcss` does not expect.

The correct action is to wait: `3.3.17` ages past the quarantine around **2026-08-10**, after which a
plain `pnpm update` resolves it. Do **not** lower `minimumReleaseAge` to pull a four-day-old package
— that control is worth far more than this advisory costs.
