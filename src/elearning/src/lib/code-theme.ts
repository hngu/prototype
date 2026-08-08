/**
 * The Shiki theme pair, declared once.
 *
 * Two pipelines highlight code on a lesson page and they must not drift:
 *
 *   - fenced blocks in Markdown, highlighted by `markdown.shikiConfig` in
 *     astro.config.mjs;
 *   - exercise files read off disk from `src/exercises`, highlighted by
 *     `<Code>` inside components/ExerciseCard.astro.
 *
 * Declaring the pair twice would let those two drift to different themes, and
 * the result is visible in only one colour mode — exactly the kind of bug nobody
 * notices for a month.
 *
 * `defaultColor: false` belongs with the pair rather than next to either caller:
 * it is what makes Shiki emit `--shiki-light` / `--shiki-dark` custom properties
 * instead of baking one theme into the markup, which is the mechanism
 * styles/code.css selects on. Change one without the other and dark mode breaks
 * silently.
 */

export const CODE_THEMES = {
  light: 'github-light',
  dark: 'github-dark-default',
} as const

export const CODE_DEFAULT_COLOR = false as const
