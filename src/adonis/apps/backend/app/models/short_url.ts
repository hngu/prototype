import { ShortUrlSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { appUrl } from '#config/app'
import User from '#models/user'

export default class ShortUrl extends ShortUrlSchema {
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  get shortUrl() {
    const baseUrl = appUrl.replace(/\/$/, '')
    return `${baseUrl}/s/${this.shortCode}`
  }

  static findByShortCode(shortCode: string) {
    return this.findBy('shortCode', shortCode)
  }
}
