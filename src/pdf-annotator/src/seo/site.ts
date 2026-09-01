/** Public name. The npm package and folder stay `pdf-annotator`. */
export const SITE_TITLE = 'Sign PDF Online'

export const SITE_DESCRIPTION =
  'Add a signature or text to a PDF in your browser. Draw, type, or upload. Nothing is uploaded — the file never leaves your device.'

export const PRIVACY_DESCRIPTION =
  'What Sign PDF Online does and does not collect. PDFs are opened and rewritten in your browser; nothing is uploaded.'

export const OG_IMAGE_PATH = '/og.png'

/** Used when VITE_SITE_URL is unset. Replace at deploy time. */
export const DEFAULT_SITE_URL = 'https://sign-pdf-online.pages.dev'

export const FAQ_ITEMS = [
  {
    question: 'Is Sign PDF Online free?',
    answer:
      'Yes. The tool is free to use and does not require an account. Open a PDF, sign or add text, and download the result.',
  },
  {
    question: 'Do you upload my PDF?',
    answer:
      'No. The file is opened, rendered, and rewritten entirely in this browser tab. It is never sent to a server.',
  },
  {
    question: 'How do I sign a PDF?',
    answer:
      'Open a PDF, choose Add signature, then draw, type, or upload your signature and click the page to place it. Export PDF downloads a real PDF with the signature on it.',
  },
  {
    question: 'Can I add text as well as a signature?',
    answer:
      'Yes. Add text places a text box on the page. You can use signatures and text on the same document, then export once.',
  },
  {
    question: 'Is the signature legally binding?',
    answer:
      'A signature you place here is a mark on the PDF, not a qualified electronic signature. Whether that meets your needs depends on your jurisdiction and the document. This is not legal advice.',
  },
] as const

export const HOW_IT_WORKS = [
  {
    title: 'Open a PDF',
    body: 'Drop a file or choose one from your device. It stays on your computer — nothing is uploaded.',
  },
  {
    title: 'Sign and add text',
    body: 'Draw, type, or upload a signature. Place text boxes where you need them. Undo and redo as you go.',
  },
  {
    title: 'Download',
    body: 'Export a real PDF. Preview and export use the same layout, so what you see is what you get.',
  },
] as const

export const FEATURES = [
  {
    title: 'Sign in the browser',
    body: 'Draw with the pointer, type in a script font, or upload an image of your signature.',
  },
  {
    title: 'Add text',
    body: 'Place text boxes in Helvetica, Times-Roman, or Courier. Colour and size are yours to set.',
  },
  {
    title: 'Nothing is uploaded',
    body: 'The PDF is read and rewritten in this tab. No account, no install, no server copy of your file.',
  },
] as const

export const PRIVACY_SECTIONS = [
  {
    heading: 'What is collected',
    body: 'Sign PDF Online has no accounts and no server that receives your PDF. The file is read, rendered, and rewritten entirely in your browser tab. We do not see the document, its name, or its contents.',
  },
  {
    heading: 'Local storage',
    body: 'The last signature you confirmed is saved in this browser’s local storage so you can reuse it. It never leaves your device. Clearing site data removes it.',
  },
  {
    heading: 'Hosting',
    body: 'The app is a static site. The host processes request logs for the HTML, scripts, and fonts it serves — typically an IP address, user agent, and URL — in order to deliver the app and mitigate abuse. Those logs are about fetching the tool, not about your PDF.',
  },
] as const

export function resolveSiteUrl(env: Record<string, string | undefined>): string {
  const raw = env['VITE_SITE_URL']?.trim()
  return (raw && raw.length > 0 ? raw : DEFAULT_SITE_URL).replace(/\/$/, '')
}

export function advertisingParagraphs(adsEnabled: boolean): string[] {
  if (!adsEnabled) {
    return [
      'There is currently no advertising on this site. If that changes, this section will name the network, what it collects, and that ads appear only on the editor after you open a PDF — never on this page or the landing page.',
    ]
  }
  return [
    'Display banner ads appear only on the editor after you open a PDF — not on this page and not on the landing page. The intended network is Media.net (Yahoo/Bing contextual demand). Ads may use cookies or similar technologies on those banner requests.',
    'Your PDF is still not uploaded. Ad requests are made by the browser for the banner slots only.',
  ]
}
