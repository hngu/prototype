import { degrees, PDFDocument, rgb, StandardFonts, type PDFFont } from '@cantoo/pdf-lib'
import { viewToUser, type PageGeometry } from './coords.ts'
import { textBaselines } from './textLayout.ts'
import { unsupportedCharacters } from './winAnsi.ts'
import type { Annotation, FontKey } from '../state/types.ts'

export class ExportError extends Error {}

const STANDARD_FONT: Record<FontKey, StandardFonts> = {
  Helvetica: StandardFonts.Helvetica,
  'Times-Roman': StandardFonts.TimesRoman,
  Courier: StandardFonts.Courier,
}

export type ExportInput = {
  /** The pristine original file. */
  bytes: Uint8Array
  pages: PageGeometry[]
  annotations: Annotation[]
}

/**
 * Stamps every annotation onto a copy of the original document.
 *
 * Annotations are stored in view space, so on a page with a non-zero /Rotate the
 * anchor is mapped back into user space and the drawn content is rotated by the
 * same angle. The viewer then un-rotates it and the annotation lands upright
 * exactly where the user placed it.
 */
export async function buildAnnotatedPdf({
  bytes,
  pages,
  annotations,
}: ExportInput): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes.slice(), { updateMetadata: false })
  const fonts = new Map<FontKey, PDFFont>()

  const font = async (key: FontKey) => {
    const cached = fonts.get(key)
    if (cached) return cached
    const embedded = await doc.embedFont(STANDARD_FONT[key])
    fonts.set(key, embedded)
    return embedded
  }

  for (const annotation of annotations) {
    const geometry = pages[annotation.pageIndex]
    if (!geometry) continue

    const page = doc.getPage(annotation.pageIndex)
    const rotate = degrees(geometry.rotation)

    if (annotation.kind === 'text') {
      const text = annotation.lines.join('\n')
      const unsupported = unsupportedCharacters(text)
      if (unsupported.length > 0) {
        throw new ExportError(
          `The PDF standard fonts cannot render ${unsupported.map((c) => `"${c}"`).join(', ')}. Remove those characters and try again.`,
        )
      }

      const embedded = await font(annotation.font)
      const color = hexToRgb(annotation.color)

      for (const { text: line, origin } of textBaselines(annotation)) {
        const anchor = viewToUser(origin, geometry)
        page.drawText(line, {
          x: anchor.x,
          y: anchor.y,
          size: annotation.fontSize,
          font: embedded,
          color,
          rotate,
        })
      }
    } else {
      const image = await doc.embedPng(dataUrlToBytes(annotation.dataUrl))
      const anchor = viewToUser({ x: annotation.rect.x, y: annotation.rect.y }, geometry)
      page.drawImage(image, {
        x: anchor.x,
        y: anchor.y,
        width: annotation.rect.width,
        height: annotation.rect.height,
        rotate,
      })
    }
  }

  return doc.save()
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function hexToRgb(hex: string) {
  const value = hex.replace('#', '')
  const full =
    value.length === 3
      ? [...value].map((c) => c + c).join('')
      : value.padEnd(6, '0').slice(0, 6)
  const int = Number.parseInt(full, 16)
  return rgb(((int >> 16) & 0xff) / 255, ((int >> 8) & 0xff) / 255, (int & 0xff) / 255)
}

export function annotatedFileName(name: string): string {
  const base = name.replace(/\.pdf$/i, '')
  return `${base}-annotated.pdf`
}

export function downloadPdf(bytes: Uint8Array, fileName: string): void {
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}
