// @ts-check
import { defineConfig } from 'astro/config'
import { satteri } from '@astrojs/markdown-satteri'
import sitemap from '@astrojs/sitemap'
import tailwindcss from '@tailwindcss/vite'
import { quizPlugin } from './src/plugins/quiz-plugin.ts'

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
      // `defaultColor: false` makes Shiki emit --shiki-light / --shiki-dark custom
      // properties instead of baking one theme in, so CSS picks the theme with no
      // JS, no flash and no double render. See styles/prose.css.
      themes: { light: 'github-light', dark: 'github-dark-default' },
      defaultColor: false,
      wrap: false,
    },
  },
})
