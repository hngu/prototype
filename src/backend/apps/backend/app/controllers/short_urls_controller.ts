import { createShortUrlValidator } from '#validators/short_url'
import { urlShortenerService } from '#services/url_shortener_service'
import type { HttpContext } from '@adonisjs/core/http'

export default class ShortUrlsController {
  async store({ auth, request, serialize }: HttpContext) {
    const { alias, url } = await request.validateUsing(createShortUrlValidator)
    const record = await urlShortenerService.create(auth.getUserOrFail(), { alias, url })

    return serialize({
      shortUrl: record.shortUrl,
    })
  }

  async show({ request, response }: HttpContext) {
    const shortCode = request.param('shortCode')
    const longUrl = await urlShortenerService.getLongUrl(shortCode)

    if (!longUrl) {
      return response.notFound()
    }
    return response.redirect().status(302).toPath(longUrl)
  }
}
