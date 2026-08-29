import { EventSchema } from '#database/schema'
import { DateTime } from 'luxon'
import { belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import type { EventCategory } from '#constants/event_categories'
import Venue from '#models/venue'

export type EventSearchFilters = {
  date?: DateTime
  category?: EventCategory
  q?: string
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

  static search({ date, category, q }: EventSearchFilters) {
    // preloading here but when we implement location search we need join
    // preload will fetch the matching venue ids as a second query after this one
    // to load with the event result models
    const query = this.query().preload('venue').orderBy('date', 'asc')

    if (date) {
      query.where('date', '>=', date.startOf('day').toISO()!)
    }

    if (category) {
      query.where('category', category)
    }

    if (q) {
      query.whereRaw(`name_search @@ plainto_tsquery('english', ?)`, [q])
    }

    return query
  }
}
