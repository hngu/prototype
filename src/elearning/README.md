# Codelane — elearning site

[![exercises](https://github.com/hngu/prototype/actions/workflows/exercises.yml/badge.svg?branch=main)](https://github.com/hngu/prototype/actions/workflows/exercises.yml)

A free, statically generated site for lessons on programming languages and technologies.
Lessons are plain Markdown; a build step turns them into HTML, including interactive quizzes and a
coding exercise whose reference solution is covered by unit tests that actually run.

Built with **Astro 7** and **Tailwind CSS v4**. Ships **no framework JavaScript** — a lesson page
carries about **1.5 KB of inline vanilla JS** (the quiz) and nothing else. The exercise card adds
none.

```bash
pnpm --filter elearning dev            # dev server
pnpm --filter elearning build          # static build → dist/
pnpm --filter elearning preview        # serve the build
pnpm --filter elearning check          # astro check (types + templates)
pnpm --filter elearning check:content  # validate every quiz block  (BEFORE build)
pnpm --filter elearning check:build    # assert dist/ is not empty   (AFTER build)
pnpm --filter elearning lint           # oxlint
pnpm --filter elearning verify         # all of the above, in the right order — what CI runs
pnpm --filter elearning og             # regenerate public/og-default.png
```

Exercises live in a sibling package with its own commands — see
[Exercises](#exercises) and [`src/exercises/README.md`](../exercises/README.md).

The whole TypeScript track — 6 courses, 46 lessons, which docs page each one covers, and what is
still unwritten — is mapped in **[CURRICULUM.md](./CURRICULUM.md)**. Start there before authoring.

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
exercise: true # needs src/exercises/<this lesson's id>/ — see Exercises below
draft: false
---

Prose goes here. Fenced code blocks get Shiki highlighting automatically.
```

Frontmatter is schema-validated (`src/content.config.ts`). A typo'd `course:` value or a missing
field fails `astro sync` with a clear message rather than rendering an empty page.

Drafts (`draft: true`) are visible in `dev` but **never built** in production, so they cannot be
crawled or appear in the sitemap. The same flag on a *course* is the publish gate for a whole
course: it stays `true` until every lesson in it is written, so `main` is always shippable
mid-track.

The repeatable lesson shape — hook, three concepts, three quizzes, takeaways — is in
[CURRICULUM.md](./CURRICULUM.md#lesson-template). Do **not** write a `## Practice` heading; the
exercise card is appended by `LessonLayout.astro`.

## Writing a quiz

Put a fenced ` ```quiz ` block anywhere in a lesson. Files stay pure Markdown — no MDX, no JSX —
so they still render correctly on GitHub.

````markdown
```quiz
id: typescript-fundamentals-type-inference-q1
q: What type is inferred for `const x = 5`?
- [x] `5`
- [ ] `number`
- [ ] `any`
explain: A `const` declaration narrows to the literal type.
```
````

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | **must be `<courseId>-<lessonSlug>-q<n>`** — see below |
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
id: typescript-fundamentals-type-inference-q2
type: true-false
q: `let x = 5` widens to `number`.
answer: true
explain: Only `const` bindings keep the literal type.
```
````

Question, choice and explanation text all support inline Markdown — backticks, bold, links.

**Quiz ids are derived from the file path**, not chosen: `<courseId>-<lessonSlug>-q<n>`, numbered in
document order. The lesson slug has no `NN-` prefix, so
`lessons/typescript-fundamentals/01-type-inference.md` gives
`typescript-fundamentals-type-inference-q1`, `-q2`, `-q3`.

Uniqueness alone was already enforced, but the finished track is ~50 lessons × 3 quizzes, and at 150
ids "unique" is not the same as "findable" — nobody should have to grep for a free name while writing
lesson 40. Deriving the id from the path makes collisions structurally impossible and makes any
quiz's id predictable from the file in front of you. The rule lives in `src/plugins/quiz-id.ts` and
is shared by the plugin and the build gate, so the two cannot disagree.

**Malformed blocks fail `check:content`** — which is *not* the same as failing the build. This
matters enough to have its own section: see
[Why a broken lesson does not fail `astro build`](#why-a-broken-lesson-does-not-fail-astro-build).

```
$ pnpm --filter elearning check:content
  src/content/lessons/typescript-fundamentals/01-type-inference.md:35
    no correct answer — mark one choice with "- [x]"

✖ 1 content problem(s).
```

Validated: missing/duplicate/misspelled fields, bad `id` casing, ids that do not match the file,
out-of-order numbering, unterminated fences, fewer than two choices, no correct answer, duplicate
choice text, `type: single` contradicted by two correct answers, and duplicate ids across files.

> **Answers are visible in the page source.** Client-side checking cannot be made cheat-proof
> without a server. That is the right trade for a free learning site — these are practice
> checkpoints, not proctored exams — but it is a deliberate decision, not an oversight.

---

## Exercises

Every lesson with `exercise: true` ends in a **Practice** card: the brief, the starter file, the unit
tests, how to run them, and the reference solution behind a closed `<details>`. The card ships zero
client JavaScript.

The files come from the sibling [`src/exercises`](../exercises) package, read off disk at build time
and highlighted with `<Code>`. **The directory name is the lesson id**, which has no `NN-` prefix even
though the lesson filename does:

```
src/content/lessons/typescript-fundamentals/01-type-inference.md   ← exercise: true
src/exercises/typescript-fundamentals/type-inference/              ← must exist
    README.md  starter.ts  solution.ts  solution.test.ts           ← all four required
```

Authoring rules, invariants and the erasable-syntax constraint are in
[`src/exercises/README.md`](../exercises/README.md). The short version: **Node deletes types rather
than compiling them**, so exercise code is authored under `erasableSyntaxOnly` and cannot contain
enums, namespaces, parameter properties, decorators or JSX. Lesson *prose* is unaffected — fenced
blocks are highlighted, never executed — so the courses teach all of those in full, and a few lessons
turn the constraint into the lesson.

**This side of the wiring is a real build gate.** `loadExerciseFor` runs in the page body of
`[lesson].astro`, outside the content pipeline, so a throw there stops `astro build` with a non-zero
exit. Verified: renaming the directory, deleting `solution.test.ts`, emptying `starter.ts` and
removing the `## Goal` heading each fail the build with a message naming the fix.

Two things it deliberately does not do:

- **`astro dev` does not watch `src/exercises`.** Vite's watcher covers the Astro project root only.
  After editing an exercise, touch the lesson `.md` or restart the dev server. Fixable with a ~15-line
  Vite plugin calling `server.watcher.add(…)`; not worth carrying until someone is authoring both
  sides at once.
- **`marked.parse` does not escape raw HTML** in an exercise README, the same caveat
  `quiz-render.ts` carries. Fine while every exercise is authored in this repo.

---

## How it fits together

```
lesson.md
  └─ Sätteri mdast pass          src/plugins/quiz-plugin.ts
       ├─ parse + validate       src/plugins/quiz-parse.ts   (pure, no imports)
       ├─ check id vs path       src/plugins/quiz-id.ts      (shared with the gate)
       ├─ throw on error         → dev overlay only. NOT a build failure. See below.
       └─ replace code node with static HTML
                                 src/plugins/quiz-render.ts
  └─ Shiki highlights remaining code blocks
  └─ [lesson].astro page body
       └─ loadExerciseFor()      src/lib/exercises.ts
            ├─ reads src/exercises/<lesson id>/*
            └─ throw on error    → real build failure (page body, not the loader)
  └─ LessonLayout appends        src/components/ExerciseCard.astro
  └─ one small vanilla script wires [data-quiz]
                                 src/scripts/quiz.ts

gates, outside the pipeline
  scripts/check-content.ts       before the build — validates every quiz block
  scripts/check-build.ts         after the build  — asserts dist/ has real prose
```

Three things worth knowing before changing the pipeline:

1. **Astro 7 uses Sätteri, not remark, by default.** `@astrojs/markdown-remark` is only an optional
   peer dependency, so entries in `markdown.remarkPlugins` are *silently ignored*. Quiz handling is
   a Sätteri mdast plugin registered via `markdown.processor`.
2. **Sätteri diagnostics are discarded** by `@astrojs/markdown-satteri` (it destructures only
   `{ html, data }`), so `ctx.report()` cannot fail a build. The plugin `throw`s instead — which is
   also not enough, for the reason below.
3. **Rendered Markdown is cached in `node_modules/.astro`, which survives `rm -rf .astro`.** A change
   to the quiz plugin's *rules* therefore does not re-validate existing lessons on a normal rebuild.
   To force one:
   ```bash
   rm -rf .astro node_modules/.astro node_modules/.vite dist
   ```
   `check:content` reads the `.md` files directly and is immune to this.

Replacing the node during the **mdast** phase also means Shiki — which runs later on hast `<pre>`
elements — never sees the quiz block, so no `excludeLangs` config is needed.

### Why a broken lesson does not fail `astro build`

Measured, not assumed, and the most important thing in this file.

Astro 7's glob loader **catches whatever `render()` throws**, logs
`[ERROR] [glob-loader] Error rendering <file>`, and carries on. `astro build` then exits **0** having
emitted that lesson page with a completely **empty `<article>`**:

```
$ pnpm --filter elearning build     # with one malformed quiz block
[ERROR] [glob-loader] Error rendering typescript-fundamentals/02-narrowing.md: …
[build] 10 page(s) built
[build] Complete!
$ echo $?
0                                   # ← and narrowing/index.html has a 0-char article
```

Silently publishing an empty lesson is the worst failure mode available here, so validation lives in
two scripts either side of the build, where an exit code is an exit code:

| Script | When | Catches |
| --- | --- | --- |
| `check:content` | **before** build | the cause — every quiz block, read straight from the `.md` |
| `check:build` | **after** build | the symptom's *shape* — an emitted lesson with no prose, or a quiz count that does not match the source |

`check:build` exists so that the *next* cause of an empty lesson — an Astro upgrade, a Sätteri quirk,
something nobody has met yet — is caught too. `pnpm --filter elearning verify` runs both in the right
order, and so does CI. **Do not "simplify" either out of the chain.**

An exercise reference is the exception: it is validated in the page body and *does* fail the build.

---

## Continuous integration

[`.github/workflows/exercises.yml`](../../.github/workflows/exercises.yml) — one workflow, two jobs,
so a single badge means "the whole thing is green" rather than two badges and a reader who checks one.

| Job | Steps |
| --- | --- |
| `exercises` | `manifest` → `typecheck` → `test` |
| `site` | `lint` → `check:content` → `check` → `build` → `check:build` |

**The `exercises` ordering is load-bearing.** `node --test` exits **0** when it discovers no test
files — and also when handed a path that does not exist. "Green" and "graded something" are therefore
different facts, and `manifest` is the only step that checks the second one: it fails on a count of
zero, on an incomplete exercise directory, and on a lesson whose exercise is missing. Without it
first, renaming a directory would produce a passing run that graded nothing, and the "verified" pill
on every lesson page would be certifying an empty set.

[`.github/actions/setup-workspace`](../../.github/actions/setup-workspace/action.yml) reads Node and
pnpm out of `.tool-versions` with `awk` rather than hardcoding them — this repo has no root
`package.json`, so `pnpm/action-setup` cannot infer a version from a `packageManager` field, and a
literal in the workflow would be a second place for the toolchain version to drift.

**Every `uses:` is pinned to a full commit SHA**, tag in a trailing comment. Tags are mutable; a
floating `@v7` would be the same supply-chain hole this repo's `minimumReleaseAge` policy exists to
close, in a different registry. Pinned versions are also checked to be more than seven days old for
consistency with that policy — which is why `pnpm/action-setup` is v6.0.9 rather than the v6.0.10
published five days before it was added. To refresh:

```bash
gh api repos/actions/checkout/commits/v7.0.1 --jq .sha
gh api repos/actions/checkout/releases/tags/v7.0.1 --jq .published_at
```

The badge above reads "no status" until this workflow exists on `main` — GitHub resolves badges
against the default branch, not a PR branch. Not a bug.

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
4. Set `REPO_URL` / `REPO_BRANCH` in `src/lib/site.ts` if the repository moves — every "Open on
   GitHub" link in an exercise card is built from them, and a wrong value produces a page full of
   404s that nothing checks.
5. Put a real address on `/contact` and finish `/privacy`.

**Hosting note for exercises.** The build reads files from `../exercises`, *outside* this package. A
host configured with `src/elearning` as its root directory must still check out the whole repository —
on Vercel that means enabling "Include files outside the Root Directory", which the pnpm workspace
already requires anyway.

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

Three settings do the real work and should be kept:

- **`minimumReleaseAge: 10080`** in `pnpm-workspace.yaml` quarantines any package version for seven
  days. Registry worms are typically detected and purged within hours to two days, so this is the
  single most effective control against them. It is also why `astro` is pinned at `^7.1.6` rather
  than `7.2.0`. **Adding a dependency published in the last week will fail to install — this is
  working as intended.**
- **pnpm blocks install scripts by default.** `allowBuilds` in `pnpm-workspace.yaml` is a narrow
  allowlist (currently just `esbuild`, which needs its postinstall to link a platform binary).
- **GitHub Actions are pinned to commit SHAs**, and to versions aged past the same seven-day window.
  See [Continuous integration](#continuous-integration). A mutable `@v7` tag is the identical
  supply-chain risk in a registry `pnpm audit` cannot see.

The `src/exercises` package adds exactly one dependency beyond the compiler: `@types/node`, pinned to
an exact version already in the lockfile so installing it resolves nothing new. It is types-only and
has no install scripts.

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
