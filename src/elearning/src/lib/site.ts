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
