import env from '#start/env'

export type Coordinates = {
  latitude: number
  longitude: number
}

export type Geocoder = {
  forward(query: string): Promise<Coordinates | null>
}

type NominatimHit = {
  lat?: string | number
  lon?: string | number
}

const NOMINATIM_SEARCH_URL = 'https://nominatim.openstreetmap.org/search'

async function disabledNominatimFetch(): Promise<Response> {
  throw new Error('Nominatim HTTP is disabled in tests. Pass a fetch mock or call setGeocoder().')
}

function defaultFetch(): typeof globalThis.fetch {
  if (process.env.NODE_ENV === 'test') {
    return disabledNominatimFetch
  }
  return globalThis.fetch
}

export class NominatimGeocoder implements Geocoder {
  readonly #cache = new Map<string, Coordinates | null>()
  readonly #fetch: typeof globalThis.fetch
  readonly #userAgent: string
  readonly #baseUrl: string

  constructor(options: { userAgent: string; fetch?: typeof globalThis.fetch; baseUrl?: string }) {
    this.#userAgent = options.userAgent
    this.#fetch = options.fetch ?? defaultFetch()
    this.#baseUrl = options.baseUrl ?? NOMINATIM_SEARCH_URL
  }

  async forward(query: string): Promise<Coordinates | null> {
    const cacheKey = query.trim().toLowerCase()
    if (!cacheKey) {
      return null
    }

    if (this.#cache.has(cacheKey)) {
      return this.#cache.get(cacheKey)!
    }

    const url = new URL(this.#baseUrl)
    url.searchParams.set('q', query.trim())
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('limit', '1')
    url.searchParams.set('addressdetails', '0')

    const response = await this.#fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': this.#userAgent,
      },
    })

    if (!response.ok) {
      throw new Error(`Nominatim request failed with ${response.status}`)
    }

    const coordinates = parseNominatimResponse(await response.json())
    this.#cache.set(cacheKey, coordinates)
    return coordinates
  }
}

function parseNominatimResponse(data: unknown): Coordinates | null {
  if (!Array.isArray(data) || data.length === 0) {
    return null
  }

  const hit = data[0] as NominatimHit
  const latitude = Number(hit?.lat)
  const longitude = Number(hit?.lon)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null
  }

  return { latitude, longitude }
}

export const nominatimGeocoder = new NominatimGeocoder({
  userAgent: `BookTicket/1.0 (${env.get('APP_URL')})`,
})

let geocoder: Geocoder = nominatimGeocoder

export function getGeocoder(): Geocoder {
  return geocoder
}

export function setGeocoder(next: Geocoder) {
  geocoder = next
}
