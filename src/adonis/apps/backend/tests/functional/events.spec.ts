import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import Event from '#models/event'
import User from '#models/user'
import type { EventCategory } from '#constants/event_categories'
import { getGeocoder, setGeocoder } from '#services/nominatim_geocoder'
import type { Coordinates, Geocoder } from '#services/nominatim_geocoder'

const NYC: Coordinates = { latitude: 40.7302, longitude: -74.0006 }
const CHICAGO: Coordinates = { latitude: 41.8748, longitude: -87.6561 }
const METERS_PER_DEGREE_LAT = 111_320

test.group('Events search', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())
  group.each.setup(async () => {
    await db.from('events').delete()
    await db.from('seats').delete()
    await db.from('venues').delete()
  })
  group.each.setup(() => {
    const previous = getGeocoder()
    setGeocoder(stubGeocoder())
    return () => setGeocoder(previous)
  })

  test('returns 401 without a token', async ({ client }) => {
    const response = await client.get('/api/v1/events')
    response.assertStatus(401)
  })

  test('keeps events on or after the selected date', async ({ client, assert }) => {
    const token = await createAccessToken()
    const venueId = await createVenue()
    await createEvent(venueId, {
      name: 'September Show',
      category: 'comedy',
      date: DateTime.fromISO('2076-09-04T22:00:00.000Z'),
    })
    await createEvent(venueId, {
      name: 'October Game',
      category: 'sports',
      date: DateTime.fromISO('2076-10-10T19:00:00.000Z'),
    })

    const response = await client
      .get('/api/v1/events')
      .bearerToken(token)
      .qs({ date: '2076-10-01' })

    response.assertStatus(200)
    const names = eventNames(response.body())
    assert.deepEqual(names, ['October Game'])
  })

  test('includes events that fall on the selected date', async ({ client, assert }) => {
    const token = await createAccessToken()
    const venueId = await createVenue()
    await createEvent(venueId, {
      name: 'Same Day',
      category: 'comedy',
      date: DateTime.fromISO('2076-09-04T00:00:00.000Z'),
    })
    await createEvent(venueId, {
      name: 'Next Day',
      category: 'comedy',
      date: DateTime.fromISO('2076-09-05T12:00:00.000Z'),
    })

    const response = await client
      .get('/api/v1/events')
      .bearerToken(token)
      .qs({ date: '2076-09-04' })

    response.assertStatus(200)
    const names = eventNames(response.body())
    assert.deepEqual(names, ['Same Day', 'Next Day'])
  })

  test('filters by exact category', async ({ client, assert }) => {
    const token = await createAccessToken()
    const venueId = await createVenue()
    await createEvent(venueId, {
      name: 'Standup Night',
      category: 'comedy',
      date: DateTime.fromISO('2076-09-04T22:00:00.000Z'),
    })
    await createEvent(venueId, {
      name: 'Home Opener',
      category: 'sports',
      date: DateTime.fromISO('2076-10-10T19:00:00.000Z'),
    })

    const response = await client
      .get('/api/v1/events')
      .bearerToken(token)
      .qs({ category: 'comedy' })

    response.assertStatus(200)
    const names = eventNames(response.body())
    assert.deepEqual(names, ['Standup Night'])
    assert.equal(response.body().data[0].category, 'comedy')
  })

  test('rejects an unknown category with 422', async ({ client }) => {
    const token = await createAccessToken()

    const response = await client
      .get('/api/v1/events')
      .bearerToken(token)
      .qs({ category: 'theater' as unknown as EventCategory })

    response.assertStatus(422)
  })

  test('matches event names with full text search', async ({ client, assert }) => {
    const token = await createAccessToken()
    const venueId = await createVenue()
    await createEvent(venueId, {
      name: 'Late Night at the Cellar',
      category: 'comedy',
      date: DateTime.fromISO('2076-09-04T22:00:00.000Z'),
    })
    await createEvent(venueId, {
      name: 'UIC Flames vs. DePaul Blue Demons',
      category: 'sports',
      date: DateTime.fromISO('2076-10-10T19:00:00.000Z'),
    })

    const match = await client.get('/api/v1/events').bearerToken(token).qs({ q: 'cellar' })
    match.assertStatus(200)
    assert.deepEqual(eventNames(match.body()), ['Late Night at the Cellar'])

    const miss = await client.get('/api/v1/events').bearerToken(token).qs({ q: 'xyzzy' })
    miss.assertStatus(200)
    assert.deepEqual(eventNames(miss.body()), [])
  })

  test('applies date, category, and name filters together', async ({ client, assert }) => {
    const token = await createAccessToken()
    const venueId = await createVenue()
    await createEvent(venueId, {
      name: 'Late Night at the Cellar',
      category: 'comedy',
      date: DateTime.fromISO('2076-09-04T22:00:00.000Z'),
    })
    await createEvent(venueId, {
      name: 'Cellar Sessions',
      category: 'concert',
      date: DateTime.fromISO('2076-09-20T20:00:00.000Z'),
    })
    await createEvent(venueId, {
      name: 'UIC Flames vs. DePaul Blue Demons',
      category: 'sports',
      date: DateTime.fromISO('2076-10-10T19:00:00.000Z'),
    })

    const response = await client.get('/api/v1/events').bearerToken(token).qs({
      date: '2076-09-01',
      category: 'comedy',
      q: 'cellar',
    })

    response.assertStatus(200)
    const body = response.body()
    assert.deepEqual(eventNames(body), ['Late Night at the Cellar'])
    assert.equal(body.data[0].category, 'comedy')
    assert.equal(body.data[0].venue.name, 'Test Venue')
    assert.equal(body.data[0].venue.address, '123 Main Street')
    assert.notProperty(body.data[0], 'nameSearch')
    assert.notProperty(body.data[0].venue, 'location')
  })

  test('keeps events whose venues are within 20 miles of a geocoded place', async ({
    client,
    assert,
  }) => {
    const token = await createAccessToken()
    const nycVenueId = await createVenue({ name: 'NYC Venue', ...NYC })
    const chicagoVenueId = await createVenue({ name: 'Chicago Venue', ...CHICAGO })
    await createEvent(nycVenueId, {
      name: 'Late Night at the Cellar',
      category: 'comedy',
      date: DateTime.fromISO('2076-09-04T22:00:00.000Z'),
    })
    await createEvent(chicagoVenueId, {
      name: 'UIC Flames vs. DePaul Blue Demons',
      category: 'sports',
      date: DateTime.fromISO('2076-10-10T19:00:00.000Z'),
    })

    const nyc = await client.get('/api/v1/events').bearerToken(token).qs({ near: 'New York' })
    nyc.assertStatus(200)
    assert.deepEqual(eventNames(nyc.body()), ['Late Night at the Cellar'])

    const chicago = await client.get('/api/v1/events').bearerToken(token).qs({ near: 'Chicago' })
    chicago.assertStatus(200)
    assert.deepEqual(eventNames(chicago.body()), ['UIC Flames vs. DePaul Blue Demons'])
  })

  test('rejects an unknown place with 422', async ({ client, assert }) => {
    const token = await createAccessToken()

    const response = await client.get('/api/v1/events').bearerToken(token).qs({ near: 'Atlantis' })

    response.assertStatus(422)
    const body = response.body() as unknown as {
      errors: { field: string; message: string }[]
    }
    assert.equal(body.errors[0].field, 'near')
    assert.equal(body.errors[0].message, 'Could not find that place')
  })

  test('includes venues 19 miles away and excludes venues 21 miles away', async ({
    client,
    assert,
  }) => {
    const token = await createAccessToken()
    const insideVenueId = await createVenue({
      name: 'Inside Radius',
      latitude: latitudeMilesNorth(NYC.latitude, 19),
      longitude: NYC.longitude,
    })
    const outsideVenueId = await createVenue({
      name: 'Outside Radius',
      latitude: latitudeMilesNorth(NYC.latitude, 21),
      longitude: NYC.longitude,
    })
    await createEvent(insideVenueId, {
      name: 'Nineteen Miles Out',
      category: 'comedy',
      date: DateTime.fromISO('2076-09-04T22:00:00.000Z'),
    })
    await createEvent(outsideVenueId, {
      name: 'Twenty One Miles Out',
      category: 'concert',
      date: DateTime.fromISO('2076-09-05T22:00:00.000Z'),
    })

    const response = await client.get('/api/v1/events').bearerToken(token).qs({ near: 'New York' })

    response.assertStatus(200)
    assert.deepEqual(eventNames(response.body()), ['Nineteen Miles Out'])
  })
})

async function createAccessToken() {
  const user = await User.create({
    fullName: 'Events Tester',
    email: 'events@example.com',
    password: 'password123',
  })
  const token = await User.accessTokens.create(user)
  return token.value!.release()
}

async function createVenue(
  attrs: {
    name?: string
    address?: string
    latitude?: number
    longitude?: number
  } = {}
) {
  const latitude = attrs.latitude ?? NYC.latitude
  const longitude = attrs.longitude ?? NYC.longitude
  const [row] = await db
    .table('venues')
    .returning('id')
    .insert({
      name: attrs.name ?? 'Test Venue',
      address: attrs.address ?? '123 Main Street',
      location: db.raw('ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography', [longitude, latitude]),
      created_at: DateTime.utc().toISO(),
    })

  return Number((row as { id: number }).id)
}

function stubGeocoder(): Geocoder {
  return {
    async forward(query) {
      const key = query.trim().toLowerCase()
      if (key === 'new york') {
        return NYC
      }
      if (key === 'chicago') {
        return CHICAGO
      }
      return null
    },
  }
}

function latitudeMilesNorth(latitude: number, miles: number) {
  return latitude + (miles * 1609.344) / METERS_PER_DEGREE_LAT
}

async function createEvent(
  venueId: number,
  attrs: {
    name: string
    category: EventCategory
    date: DateTime
  }
) {
  return Event.create({
    venueId,
    name: attrs.name,
    artists: ['Test Artist'],
    description: 'Test description',
    category: attrs.category,
    date: attrs.date,
  })
}

function eventNames(body: { data: { name: string }[] }) {
  return body.data.map((event) => event.name)
}
