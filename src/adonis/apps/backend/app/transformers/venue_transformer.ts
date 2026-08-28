import type Venue from '#models/venue'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class VenueTransformer extends BaseTransformer<Venue> {
  toObject() {
    return this.pick(this.resource, ['id', 'name', 'address'])
  }
}
