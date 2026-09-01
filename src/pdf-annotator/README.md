# Sign PDF Online

Browser-only PDF signer. Open a PDF, place signatures and text boxes, then
download a modified PDF. Nothing is uploaded — the file is read, rendered, and
rewritten entirely in the tab.

Public name: **Sign PDF Online**. The package folder stays `pdf-annotator`.

## Stack

- Vite 8 + React 19 + TypeScript
- Mantine v9 for UI
- `pdfjs-dist` (legacy build) for rendering
- `@cantoo/pdf-lib` for writing the export
- `perfect-freehand` for drawn signatures

## Run

From the repo root (or this package):

```sh
pnpm --filter pdf-annotator install   # if needed after cloning
pnpm --filter pdf-annotator dev
```

Dev server listens on **http://localhost:5174** (5173 is reserved for the Adonis
frontend).

```sh
pnpm --filter pdf-annotator verify   # lint + typecheck + test + build + check:seo
```

## Usage

1. Drop or choose a PDF on the landing screen.
2. **Add text** — click the tool, then click the page. Type in the box. Font,
   size, and colour apply to the selected box and become the default for the next one.
3. **Add signature** — Draw, Type (Great Vibes), or Upload. Then click the page
   to place it. The last signature is kept in `localStorage` for reuse.
4. Drag via the blue grip bar; signatures also have corner resize (aspect locked).
5. **Export PDF** downloads `<name>-annotated.pdf`.

### Keyboard

| Key | Action |
| --- | --- |
| ⌘/Ctrl+Z | Undo |
| ⌘/Ctrl+Shift+Z | Redo |
| Delete / Backspace | Remove selected annotation |
| Escape | Clear selection / cancel placement |

Closing the tab with unsaved annotations prompts the browser's leave warning.

## Limits

- Standard PDF fonts only (Helvetica, Times-Roman, Courier) — WinAnsi characters.
  Non-Latin input is stripped while typing and refused at export.
- Encrypted PDFs are rejected at open time (pdf-lib cannot rewrite them).
- Text boxes do not auto-wrap; they grow with explicit newlines so preview and
  export stay aligned.

## Layout

```
src/
  seo/           site copy, static HTML head/body for crawlers
  pdf/           load, render, coords, measure, export
  state/         annotation reducer + undo/redo
  components/    landing, viewer, text/signature UI, toolbar, ad slots
  hooks/         pointer drag
```

## Deploying

The build is a plain static directory (`dist/`) and works on any static host.
**Cloudflare Pages is the recommended target.**

| Host | Build command | Output directory |
| --- | --- | --- |
| **Cloudflare Pages** | `pnpm --filter pdf-annotator build` | `src/pdf-annotator/dist` (from repo root) |

Node is pinned in the repo-root `.nvmrc` (`24.9.0`), which Cloudflare Pages reads.
Also set `PNPM_VERSION=11.20.0` if you want the same pnpm as the workspace —
Pages does not read `packageManager`.

This repo can host a second Pages project alongside the learning site; they only
differ in build command and output directory.

### Environment

| Variable | When |
| --- | --- |
| `VITE_SITE_URL` | Production origin, no trailing slash. Canonical URLs, Open Graph, robots.txt, and the sitemap are derived from it. Defaults to `https://sign-pdf-online.pages.dev` until you set a custom domain. |
| `VITE_ADS_ENABLED` | Set to `true` only after a publisher ID is live. Leave unset so ad slots render nothing. |

### Before the first production deploy

1. Set `VITE_SITE_URL` to the real host on the Pages production environment.
2. Optionally run `pnpm --filter pdf-annotator og` if you rename the product — that regenerates `public/og.png`.
3. After go-live: Google Search Console and Bing Webmaster Tools, submit `/sitemap.xml`.

Cloudflare Pages allows commercial use on the free tier and does not meter
static-asset bandwidth. Vercel Hobby names advertising as commercial use;
Netlify suspends the site for the rest of the month on bandwidth overage.

## Advertising

Slots exist on the **editor only** (top and bottom of the PDF viewer). The
landing page and `/privacy` do not import `AdSlot`, so they cannot show ads
even when the flag is on.

Nothing renders — no placeholder, no network request — unless
`VITE_ADS_ENABLED=true` is set at build time.

**Do not apply to AdSense for the viewer.** Google’s inventory-value policy
disallows ads on screens without publisher-content; the editor is the user’s
PDF. The intended network is **Media.net** display (Yahoo/Bing contextual
demand). **Adsterra** display-only is the fallback if Media.net declines a
tool-only editor. Disable popunder, push, and social bar if you ever use
Adsterra. Do not enable Auto ads or pop/push formats.

When a network is approved: put their publisher line in `public/ads.txt`,
replace the inner frame in `AdSlot.tsx` with the embed (**keep the wrapper** —
it reserves height so CLS stays zero), set `VITE_ADS_ENABLED=true` on
production, and update the advertising section on `/privacy`.
