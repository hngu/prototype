import { defineCollection, reference } from 'astro:content'
import { glob } from 'astro/loaders'
// `z` re-exported from 'astro:content' / 'astro:schema' is deprecated and goes
// away in the next major; 'astro/zod' is the supported path (Zod v4).
import { z } from 'astro/zod'

const courses = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/courses' }),
  schema: z.object({
    title: z.string(),
    /* Kept short on purpose: this doubles as the meta description and the card
       blurb, and search engines truncate around 160–180 chars. */
    description: z.string().max(180),
    level: z.enum(['beginner', 'intermediate', 'advanced']),
    tags: z.array(z.string()).default([]),
    /* Short glyph shown in the course card chip. */
    icon: z.string(),
    /* oklch() string used as the card accent. */
    accent: z.string(),
    order: z.number().int().default(999),
    draft: z.boolean().default(false),
  }),
})

const lessons = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/lessons',
    /* Files carry an `NN-` prefix so directory listings sort readably, but the
       prefix has no business being in the URL. Strip it:
         typescript-fundamentals/01-type-inference
       → typescript-fundamentals/type-inference                                */
    generateId: ({ entry }) => entry.replace(/\.md$/, '').replace(/(^|\/)\d+[-_]/g, '$1'),
  }),
  schema: z.object({
    title: z.string(),
    /* Build-time validated: a typo'd course slug fails `astro sync` instead of
       silently rendering an empty page. */
    course: reference('courses'),
    /* Authoritative ordering. Never the filename — renumbering files just to
       insert a lesson in the middle is miserable, so the `NN-` prefix is a
       readability convenience only and this field is the source of truth. */
    order: z.number().int(),
    summary: z.string(),
    /* Estimated reading time in minutes. */
    duration: z.number().int().positive(),
    /* True when `src/exercises/<this lesson's id>/` exists and holds README.md,
       starter.ts, solution.ts and solution.test.ts. The path is derived from the
       lesson id rather than written out, so there is no second string to typo —
       but the flag stays explicit, because "directory missing" has to mean "the
       build stops", not "no exercise today". Zod cannot see the entry id here, so
       the pairing is validated in src/lib/exercises.ts and, for draft lessons
       too, by src/exercises/tools/check-manifest.ts. */
    exercise: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
})

export const collections = { courses, lessons }
