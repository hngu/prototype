import { VenueSchema } from '#database/schema'
import { column, hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import Event from '#models/event'

export default class Venue extends VenueSchema {
  @column({ serializeAs: null })
  declare location: unknown

  @hasMany(() => Event)
  declare events: HasMany<typeof Event>
}
