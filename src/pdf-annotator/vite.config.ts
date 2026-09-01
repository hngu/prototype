import { loadEnv, type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { fileURLToPath } from 'node:url'
import { landingBodyHtml, privacyBodyHtml, robotsTxt, seoHead, sitemapXml } from './src/seo/html.ts'
import { resolveSiteUrl } from './src/seo/site.ts'

const root = fileURLToPath(new URL('.', import.meta.url))

function htmlSeoPlugin(siteUrl: string, adsEnabled: boolean): Plugin {
  const robots = robotsTxt(siteUrl)
  const sitemap = sitemapXml(siteUrl)

  const kindFrom = (filename: string): 'home' | 'privacy' =>
    filename.replaceAll('\\', '/').endsWith('privacy.html') ? 'privacy' : 'home'

  return {
    name: 'html-seo',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const filename = ctx.filename ?? ctx.path
        const kind = kindFrom(filename)
        const withHead = html.replace('<!--seo-head-->', seoHead(kind, siteUrl))
        const body = kind === 'privacy' ? privacyBodyHtml(adsEnabled) : landingBodyHtml()
        return withHead.replace('<div id="root"></div>', `<div id="root">${body}</div>`)
      },
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots })
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap })
    },
    configureServer(server) {
      server.middlewares.use(seoMiddleware(robots, sitemap))
    },
    configurePreviewServer(server) {
      server.middlewares.use(seoMiddleware(robots, sitemap))
    },
  }
}

function seoMiddleware(robots: string, sitemap: string) {
  return (
    req: { url?: string | undefined },
    res: { setHeader: (name: string, value: string) => void; end: (body: string) => void },
    next: () => void,
  ) => {
    const url = req.url ?? ''
    if (url === '/robots.txt') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.end(robots)
      return
    }
    if (url === '/sitemap.xml') {
      res.setHeader('Content-Type', 'application/xml; charset=utf-8')
      res.end(sitemap)
      return
    }
    if (url === '/privacy' || url === '/privacy/') {
      req.url = '/privacy.html'
    }
    next()
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, root, 'VITE_')
  const siteUrl = resolveSiteUrl(env)
  const adsEnabled = env['VITE_ADS_ENABLED'] === 'true'

  return {
    plugins: [
      htmlSeoPlugin(siteUrl, adsEnabled),
      react(),
      babel({ presets: [reactCompilerPreset()] }),
    ],
    // 5173 belongs to the Adonis frontend dev server.
    server: { port: 5174 },
    build: {
      rollupOptions: {
        input: {
          main: fileURLToPath(new URL('index.html', import.meta.url)),
          privacy: fileURLToPath(new URL('privacy.html', import.meta.url)),
        },
      },
    },
    test: {
      environment: 'node',
      include: ['src/**/*.spec.ts'],
    },
  }
})
