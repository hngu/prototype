import vine from '@vinejs/vine'
import { EVENT_CATEGORIES } from '#constants/event_categories'

export const searchEventsValidator = vine.create({
  date: vine.date({ formats: ['YYYY-MM-DD'] }).optional(),
  category: vine.enum(EVENT_CATEGORIES).optional(),
  q: vine.string().trim().maxLength(255).optional(),
})
