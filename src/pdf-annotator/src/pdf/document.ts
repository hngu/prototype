import { PDFDocument } from '@cantoo/pdf-lib'
import { pageGeometry, type PageGeometry } from './coords.ts'
import {
  getDocument,
  GlobalWorkerOptions,
  InvalidPDFException,
  PasswordException,
  WORKER_SRC,
  type PDFDocumentLoadingTask,
  type PDFDocumentProxy,
} from './pdfjs.ts'

GlobalWorkerOptions.workerSrc = WORKER_SRC

export type LoadedPdf = {
  name: string
  /**
   * Pristine copy of the uploaded file, kept for export. pdf.js transfers the
   * buffer it is handed to its worker, which detaches it on this side.
   */
  bytes: Uint8Array
  doc: PDFDocumentProxy
  /** Held so replacing the document can tear down its worker. */
  task: PDFDocumentLoadingTask
  pages: PageGeometry[]
}

export class PdfLoadError extends Error {}

export async function loadPdf(file: File): Promise<LoadedPdf> {
  const bytes = new Uint8Array(await file.arrayBuffer())

  // Parse with pdf-lib up front. It is stricter than pdf.js, so a file that
  // renders fine but cannot be written would otherwise only fail at export,
  // after the user has done all the work.
  await assertWritable(bytes)

  const { doc, task } = await openWithPdfJs(bytes)
  const pages = await Promise.all(
    Array.from({ length: doc.numPages }, async (_, index) => {
      const page = await doc.getPage(index + 1)
      return pageGeometry(index, page.rotate, page.view)
    }),
  )

  return { name: file.name, bytes, doc, task, pages }
}

async function assertWritable(bytes: Uint8Array): Promise<void> {
  try {
    await PDFDocument.load(copyOf(bytes), { updateMetadata: false })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('is encrypted')) {
      throw new PdfLoadError('This PDF is password protected, so it cannot be edited.')
    }
    throw new PdfLoadError(`This PDF could not be parsed for editing: ${message}`)
  }
}

async function openWithPdfJs(bytes: Uint8Array) {
  const task = getDocument({ data: copyOf(bytes) })
  try {
    return { doc: await task.promise, task }
  } catch (error) {
    void task.destroy()
    if (error instanceof PasswordException) {
      throw new PdfLoadError('This PDF is password protected, so it cannot be edited.')
    }
    if (error instanceof InvalidPDFException) {
      throw new PdfLoadError('This file is not a valid PDF.')
    }
    throw error
  }
}

export function copyOf(bytes: Uint8Array): Uint8Array {
  return bytes.slice()
}
