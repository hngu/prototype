import { randomBytes } from 'node:crypto'
import { createShortUrlValidator } from '#validators/short_url'
import { appUrl } from '#config/app'
import type { HttpContext } from '@adonisjs/core/http'

const SLUG_ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const SLUG_LENGTH = 8

function randomSlug(): string {
  const bytes = randomBytes(SLUG_LENGTH)
  let slug = ''
  for (const byte of bytes) {
    slug += SLUG_ALPHABET[byte % SLUG_ALPHABET.length]
  }
  return slug
}

export default class ShortUrlsController {
  async store({ request, serialize }: HttpContext) {
    const { alias } = await request.validateUsing(createShortUrlValidator)
    const slug = alias?.trim() || randomSlug()
    const baseUrl = appUrl.replace(/\/$/, '')

    return serialize({
      shortUrl: `${baseUrl}/${slug}`,
    })
  }
}
