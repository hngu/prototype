import type { SignatureImage } from '../pdf/rasterize.ts'

/**
 * The last signature is kept so a multi-page form does not mean drawing the same
 * name six times. It never leaves this browser.
 */
const STORAGE_KEY = 'pdf-annotator:last-signature'

export function loadSavedSignature(): SignatureImage | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'dataUrl' in parsed &&
      typeof parsed.dataUrl === 'string' &&
      parsed.dataUrl.startsWith('data:image/png') &&
      'aspect' in parsed &&
      typeof parsed.aspect === 'number' &&
      Number.isFinite(parsed.aspect) &&
      parsed.aspect > 0
    ) {
      return { dataUrl: parsed.dataUrl, aspect: parsed.aspect }
    }
  } catch {
    // Corrupt or unavailable storage is not worth surfacing.
  }
  return null
}

export function saveSignature(image: SignatureImage): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(image))
  } catch {
    // Quota exceeded or private mode; reuse is a convenience, not a requirement.
  }
}
