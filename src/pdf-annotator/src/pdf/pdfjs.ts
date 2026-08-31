/**
 * The one place pdf.js is imported from.
 *
 * It has to be the `legacy` build: the default one calls very new language APIs
 * (`Map.prototype.getOrInsertComputed`) that shipping browsers do not have yet,
 * and the first `page.render` throws as a result. The legacy bundle is the same
 * library, transpiled and polyfilled.
 *
 * Routing every import through this module also guarantees a single module
 * instance, which matters because render cancellation is detected with
 * `instanceof RenderingCancelledException`.
 */
export {
  getDocument,
  GlobalWorkerOptions,
  InvalidPDFException,
  PasswordException,
  RenderingCancelledException,
} from 'pdfjs-dist/legacy/build/pdf.mjs'

export type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
} from 'pdfjs-dist/legacy/build/pdf.mjs'

export const WORKER_SRC = new URL(
  'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()
