import { test } from '@japa/runner'
import { NominatimGeocoder } from '#services/nominatim_geocoder'

const USER_AGENT = 'BookTicket-Test/1.0 (https://adonis.app)'

test.group('NominatimGeocoder', () => {
  test('parses the first Nominatim hit', async ({ assert }) => {
    const geocoder = new NominatimGeocoder({
      userAgent: USER_AGENT,
      fetch: jsonFetch([{ lat: '40.7302', lon: '-74.0006' }]),
    })

    const result = await geocoder.forward('New York')
    assert.deepEqual(result, { latitude: 40.7302, longitude: -74.0006 })
  })

  test('sends an identifying User-Agent', async ({ assert }) => {
    let userAgent: string | null = null
    const geocoder = new NominatimGeocoder({
      userAgent: USER_AGENT,
      fetch: async (_input, init) => {
        userAgent = new Headers(init?.headers).get('User-Agent')
        return jsonResponse([{ lat: '40.7302', lon: '-74.0006' }])
      },
    })

    await geocoder.forward('New York')
    assert.equal(userAgent, USER_AGENT)
  })

  test('caches results by normalized query', async ({ assert }) => {
    let calls = 0
    const geocoder = new NominatimGeocoder({
      userAgent: USER_AGENT,
      fetch: async () => {
        calls += 1
        return jsonResponse([{ lat: '41.8748', lon: '-87.6561' }])
      },
    })

    const first = await geocoder.forward('Chicago')
    const second = await geocoder.forward('  chicago ')
    assert.deepEqual(first, second)
    assert.equal(calls, 1)
  })

  test('returns null when Nominatim has no hits', async ({ assert }) => {
    const geocoder = new NominatimGeocoder({
      userAgent: USER_AGENT,
      fetch: jsonFetch([]),
    })

    assert.isNull(await geocoder.forward('xyzzy'))
  })

  test('returns null for a blank query without fetching', async ({ assert }) => {
    let calls = 0
    const geocoder = new NominatimGeocoder({
      userAgent: USER_AGENT,
      fetch: async () => {
        calls += 1
        return jsonResponse([])
      },
    })

    assert.isNull(await geocoder.forward('   '))
    assert.equal(calls, 0)
  })
})

function jsonFetch(body: unknown): typeof globalThis.fetch {
  return async () => jsonResponse(body)
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
