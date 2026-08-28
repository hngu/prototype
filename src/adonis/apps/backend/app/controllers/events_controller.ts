import Event from '#models/event'
import { searchEventsValidator } from '#validators/event'
import EventTransformer from '#transformers/event_transformer'
import type { HttpContext } from '@adonisjs/core/http'

export default class EventsController {
  async index({ request, serialize }: HttpContext) {
    const filters = await request.validateUsing(searchEventsValidator, {
      data: request.qs(),
    })

    const events = await Event.search(filters)
    return serialize(EventTransformer.transform(events))
  }
}
