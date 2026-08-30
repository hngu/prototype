import Event from '#models/event'
import { searchEventsValidator } from '#validators/event'
import EventTransformer from '#transformers/event_transformer'
import { getGeocoder } from '#services/nominatim_geocoder'
import { errors } from '@vinejs/vine'
import type { HttpContext } from '@adonisjs/core/http'

export default class EventsController {
  async index({ request, serialize }: HttpContext) {
    const { near, ...filters } = await request.validateUsing(searchEventsValidator, {
      data: request.qs(),
    })

    let latitude: number | undefined
    let longitude: number | undefined

    if (near) {
      const coordinates = await getGeocoder().forward(near)
      if (!coordinates) {
        throw new errors.E_VALIDATION_ERROR([
          {
            field: 'near',
            message: 'Could not find that place',
            rule: 'geocode',
          },
        ])
      }
      latitude = coordinates.latitude
      longitude = coordinates.longitude
    }

    const events = await Event.search({ ...filters, latitude, longitude })
    return serialize(EventTransformer.transform(events))
  }
}
