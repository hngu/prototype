import { EventSchema } from '#database/schema'
import { DateTime } from 'luxon'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { EventCategory } from '#constants/event_categories'
import Venue from '#models/venue'

// 20 miles × meters-per-mile; PostGIS ST_DWithin on geography expects meters.
export const EVENT_SEARCH_RADIUS_METERS = 20 * 1609.344

export type EventSearchFilters = {
  date?: DateTime
  category?: EventCategory
  q?: string
  latitude?: number
  longitude?: number
}

export default class Event extends EventSchema {
  @column({
    prepare: (value: string[]) => JSON.stringify(value),
    consume: (value: string[] | string) => (typeof value === 'string' ? JSON.parse(value) : value),
  })
  declare artists: string[]

  @column({ serializeAs: null })
  declare nameSearch: string | null

  @belongsTo(() => Venue)
  declare venue: BelongsTo<typeof Venue>

  static search({ date, category, q, latitude, longitude }: EventSearchFilters) {
    const query = this.query().preload('venue').select('events.*').orderBy('events.date', 'asc')

    if (date) {
      query.where('events.date', '>=', date.startOf('day').toISO()!)
    }

    if (category) {
      query.where('events.category', category)
    }

    if (q) {
      query.whereRaw(`events.name_search @@ plainto_tsquery('english', ?)`, [q])
    }

    if (latitude !== undefined && longitude !== undefined) {
      query
        .innerJoin('venues', 'events.venue_id', 'venues.id')
        .whereRaw(
          'ST_DWithin(venues.location, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, ?)',
          [longitude, latitude, EVENT_SEARCH_RADIUS_METERS]
        )
    }

    return query
  }
}
