import {
  FAQ_ITEMS,
  FEATURES,
  HOW_IT_WORKS,
  OG_IMAGE_PATH,
  PRIVACY_DESCRIPTION,
  PRIVACY_SECTIONS,
  SITE_DESCRIPTION,
  SITE_TITLE,
  advertisingParagraphs,
} from './site.ts'

export type PageKind = 'home' | 'privacy'

const escapeAttr = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

const escapeText = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const jsonLdScript = (data: unknown): string => {
  const json = JSON.stringify(data).replace(/</g, '\\u003c')
  return `<script type="application/ld+json">${json}</script>`
}

const pageMeta = (
  kind: PageKind,
  siteUrl: string,
): { title: string; description: string; canonical: string; ogTitle: string } => {
  if (kind === 'privacy') {
    return {
      title: `Privacy · ${SITE_TITLE}`,
      description: PRIVACY_DESCRIPTION,
      canonical: `${siteUrl}/privacy`,
      ogTitle: `Privacy · ${SITE_TITLE}`,
    }
  }
  return {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    canonical: `${siteUrl}/`,
    ogTitle: SITE_TITLE,
  }
}

const webApplicationLd = (siteUrl: string) => ({
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: SITE_TITLE,
  url: `${siteUrl}/`,
  description: SITE_DESCRIPTION,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Any',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  featureList: [
    'Sign a PDF in the browser',
    'Draw, type, or upload a signature',
    'Add text to a PDF',
    'Nothing is uploaded',
  ],
})

const faqPageLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: { '@type': 'Answer', text: item.answer },
  })),
})

const privacyPageLd = (siteUrl: string) => ({
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Privacy',
  url: `${siteUrl}/privacy`,
  description: PRIVACY_DESCRIPTION,
  isPartOf: { '@type': 'WebApplication', name: SITE_TITLE, url: `${siteUrl}/` },
})

export const seoHead = (kind: PageKind, siteUrl: string): string => {
  const { title, description, canonical, ogTitle } = pageMeta(kind, siteUrl)
  const image = `${siteUrl}${OG_IMAGE_PATH}`
  const scripts =
    kind === 'home'
      ? `${jsonLdScript(webApplicationLd(siteUrl))}\n${jsonLdScript(faqPageLd())}`
      : jsonLdScript(privacyPageLd(siteUrl))

  return `
    <title>${escapeText(title)}</title>
    <meta name="description" content="${escapeAttr(description)}" />
    <link rel="canonical" href="${escapeAttr(canonical)}" />
    <meta name="robots" content="index, follow" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="sitemap" href="/sitemap.xml" />
    <meta property="og:site_name" content="${escapeAttr(SITE_TITLE)}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeAttr(ogTitle)}" />
    <meta property="og:description" content="${escapeAttr(description)}" />
    <meta property="og:url" content="${escapeAttr(canonical)}" />
    <meta property="og:image" content="${escapeAttr(image)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttr(ogTitle)}" />
    <meta name="twitter:description" content="${escapeAttr(description)}" />
    <meta name="twitter:image" content="${escapeAttr(image)}" />
    ${scripts}
  `
}

const footerHtml = (): string => `
  <footer>
    <p><a href="/">${escapeText(SITE_TITLE)}</a> · <a href="/privacy">Privacy</a></p>
  </footer>
`

export const landingBodyHtml = (): string => `
  <header><p>${escapeText(SITE_TITLE)}</p></header>
  <main>
    <h1>${escapeText(SITE_TITLE)}</h1>
    <p>Draw, type, or upload a signature; add text; download. The file is never uploaded.</p>
    <p>Drop a PDF here or choose a file. The file is opened and rewritten inside this tab. Nothing is uploaded anywhere.</p>
    <h2>How it works</h2>
    <ol>
      ${HOW_IT_WORKS.map((step) => `<li><strong>${escapeText(step.title)}</strong> — ${escapeText(step.body)}</li>`).join('\n      ')}
    </ol>
    <h2>What you can do</h2>
    <ul>
      ${FEATURES.map((feature) => `<li><strong>${escapeText(feature.title)}</strong> — ${escapeText(feature.body)}</li>`).join('\n      ')}
    </ul>
    <h2>Questions</h2>
    ${FAQ_ITEMS.map(
      (item) =>
        `<h3>${escapeText(item.question)}</h3>\n    <p>${escapeText(item.answer)}</p>`,
    ).join('\n    ')}
  </main>
  ${footerHtml()}
`

export const privacyBodyHtml = (adsEnabled: boolean): string => `
  <header><p><a href="/">${escapeText(SITE_TITLE)}</a></p></header>
  <main>
    <h1>Privacy</h1>
    ${PRIVACY_SECTIONS.map(
      (section) =>
        `<h2>${escapeText(section.heading)}</h2>\n    <p>${escapeText(section.body)}</p>`,
    ).join('\n    ')}
    <h2>Advertising</h2>
    ${advertisingParagraphs(adsEnabled)
      .map((paragraph) => `<p>${escapeText(paragraph)}</p>`)
      .join('\n    ')}
  </main>
  ${footerHtml()}
`

export const robotsTxt = (siteUrl: string): string =>
  `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`

export const sitemapXml = (siteUrl: string): string => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${escapeText(`${siteUrl}/`)}</loc></url>
  <url><loc>${escapeText(`${siteUrl}/privacy`)}</loc></url>
</urlset>
`
