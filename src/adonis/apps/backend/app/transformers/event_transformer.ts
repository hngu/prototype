import type Event from '#models/event'
import { BaseTransformer } from '@adonisjs/core/transformers'
import VenueTransformer from '#transformers/venue_transformer'

export default class EventTransformer extends BaseTransformer<Event> {
  toObject() {
    return {
      ...this.pick(this.resource, ['id', 'name', 'artists', 'description', 'category', 'date']),
      venue: VenueTransformer.transform(this.resource.venue),
    }
  }
}
