import { degrees, PDFDocument } from '@cantoo/pdf-lib'
import { describe, expect, it } from 'vitest'
import { pageGeometry } from './coords.ts'
import { annotatedFileName, buildAnnotatedPdf, ExportError, hexToRgb } from './exportPdf.ts'
import { asPdfHexString, readablePdf } from '../testing/readablePdf.ts'
import type { Annotation, TextAnnotation } from '../state/types.ts'

/** 2x2 opaque red PNG. */
const RED_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8DAwMDAxMDAwAAADgYBAP2Y8BgAAAAASUVORK5CYII='

async function blankPdf(rotate = 0) {
  const doc = await PDFDocument.create()
  const page = doc.addPage([595, 842])
  if (rotate !== 0) page.setRotation(degrees(rotate))
  return new Uint8Array(await doc.save())
}

const geometryFor = (rotate = 0) => [pageGeometry(0, rotate, [0, 0, 595, 842])]

const textAt = (overrides: Partial<TextAnnotation> = {}): Annotation => ({
  id: 'text-1',
  kind: 'text',
  pageIndex: 0,
  rect: { x: 72, y: 700, width: 200, height: 24 },
  lines: ['Hello annotator'],
  fontSize: 20,
  font: 'Helvetica',
  color: '#1e1e1e',
  ...overrides,
})

const signature = (): Annotation => ({
  id: 'sig-1',
  kind: 'signature',
  pageIndex: 0,
  rect: { x: 100, y: 100, width: 180, height: 60 },
  dataUrl: RED_PNG,
  aspect: 3,
})

describe('buildAnnotatedPdf', () => {
  it('keeps the original page and writes the text into it', async () => {
    const output = await buildAnnotatedPdf({
      bytes: await blankPdf(),
      pages: geometryFor(),
      annotations: [textAt()],
    })

    const reloaded = await PDFDocument.load(output)
    expect(reloaded.getPageCount()).toBe(1)
    expect(reloaded.getPage(0).getSize()).toEqual({ width: 595, height: 842 })
    expect(readablePdf(output)).toContain(asPdfHexString('Hello annotator'))
  })

  it('places the first line so the box top is its ascender top', async () => {
    const output = await buildAnnotatedPdf({
      bytes: await blankPdf(),
      pages: geometryFor(),
      annotations: [textAt({ rect: { x: 72, y: 700, width: 200, height: 24 } })],
    })

    // Box top is 724; the Helvetica ascender at 20pt is 14.36, so the baseline
    // sits at 709.64 and the text matrix must say so.
    expect(readablePdf(output)).toContain('1 0 0 1 72 709.64 Tm')
  })

  it('embeds a signature image at the requested size', async () => {
    const output = await buildAnnotatedPdf({
      bytes: await blankPdf(),
      pages: geometryFor(),
      annotations: [signature()],
    })

    const content = readablePdf(output)
    expect(content).toContain('1 0 0 1 100 100 cm')
    expect(content).toContain('180 0 0 60 0 0 cm')
  })

  it('leaves the original bytes untouched so the document can be exported twice', async () => {
    const bytes = await blankPdf()
    const before = Buffer.from(bytes).toString('latin1')

    await buildAnnotatedPdf({ bytes, pages: geometryFor(), annotations: [textAt(), signature()] })
    await buildAnnotatedPdf({ bytes, pages: geometryFor(), annotations: [textAt()] })

    expect(Buffer.from(bytes).toString('latin1')).toBe(before)
  })

  it('skips blank lines instead of emitting empty text runs', async () => {
    const output = await buildAnnotatedPdf({
      bytes: await blankPdf(),
      pages: geometryFor(),
      annotations: [textAt({ lines: ['first', '', 'third'] })],
    })

    const content = readablePdf(output)
    expect(content).toContain(asPdfHexString('first'))
    expect(content).toContain(asPdfHexString('third'))
    expect(content).not.toContain('<> Tj')
  })

  it('rotates stamped content to match a rotated page', async () => {
    const output = await buildAnnotatedPdf({
      bytes: await blankPdf(90),
      pages: geometryFor(90),
      annotations: [signature()],
    })

    // A quarter turn is the matrix [~0 1 -1 ~0]. The anchor moves too: view
    // (100, 100) is user (595 - 100, 100) on a page displayed rotated 90.
    expect(readablePdf(output)).toMatch(/1 0 0 1 495 100 cm/)
    expect(readablePdf(output)).toMatch(/\S+ 1 -1 \S+ 0 0 cm/)
  })

  it('refuses characters the standard fonts cannot encode', async () => {
    await expect(
      buildAnnotatedPdf({
        bytes: await blankPdf(),
        pages: geometryFor(),
        annotations: [textAt({ lines: ['日本語'] })],
      }),
    ).rejects.toThrow(ExportError)
  })

  it('ignores annotations pointing at a page that is not there', async () => {
    const output = await buildAnnotatedPdf({
      bytes: await blankPdf(),
      pages: geometryFor(),
      annotations: [textAt({ pageIndex: 7 })],
    })

    expect((await PDFDocument.load(output)).getPageCount()).toBe(1)
  })
})

describe('hexToRgb', () => {
  it('parses long and short hex', () => {
    expect(hexToRgb('#ff0000')).toEqual({ type: 'RGB', red: 1, green: 0, blue: 0 })
    expect(hexToRgb('#00f')).toEqual({ type: 'RGB', red: 0, green: 0, blue: 1 })
  })
})

describe('annotatedFileName', () => {
  it('suffixes the base name and keeps a single extension', () => {
    expect(annotatedFileName('contract.pdf')).toBe('contract-annotated.pdf')
    expect(annotatedFileName('contract.PDF')).toBe('contract-annotated.pdf')
    expect(annotatedFileName('no-extension')).toBe('no-extension-annotated.pdf')
  })
})
