// @ts-check
import { defineConfig } from 'astro/config'
import { satteri } from '@astrojs/markdown-satteri'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import { quizPlugin } from './src/plugins/quiz-plugin.ts'
import { CODE_THEMES, CODE_DEFAULT_COLOR } from './src/lib/code-theme.ts'

// https://astro.build/config
export default defineConfig({
  // PLACEHOLDER: replace with the real domain before the first production deploy.
  // Canonical URLs, OpenGraph tags and the sitemap are all derived from this —
  // `@astrojs/sitemap` silently emits nothing if `site` is unset.
  site: 'https://codelane.example',

  integrations: [sitemap()],

  vite: {
    plugins: [tailwindcss()],
  },

  markdown: {
    // Sätteri is Astro 7's default Markdown processor; `remarkPlugins` entries
    // would be silently ignored here. `quizPlugin` is passed as a factory (not
    // called) so any per-document state resets per compile.
    processor: satteri({ mdastPlugins: [quizPlugin] }),

    shikiConfig: {
      // The theme pair and `defaultColor: false` live in src/lib/code-theme.ts so
      // that ExerciseCard.astro can highlight the exercise files it reads off disk
      // with the identical settings. Two copies would let Markdown code blocks and
      // exercise panes drift apart in one colour mode only. See that file, and
      // styles/code.css for how the custom properties are selected.
      themes: CODE_THEMES,
      defaultColor: CODE_DEFAULT_COLOR,
      wrap: false,
    },
  },
})
