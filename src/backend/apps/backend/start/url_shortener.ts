import app from '@adonisjs/core/services/app'
import { urlShortenerService } from '#services/url_shortener_service'

app.terminating(() => urlShortenerService.persistUnusedSlots())
