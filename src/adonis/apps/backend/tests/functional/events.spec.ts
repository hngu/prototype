import { test } from '@japa/runner'
import { DateTime } from 'luxon'
import testUtils from '@adonisjs/core/services/test_utils'
import db from '@adonisjs/lucid/services/db'
import Event from '#models/event'
import User from '#models/user'
import type { EventCategory } from '#constants/event_categories'

test.group('Events search', (group) => {
  group.each.setup(() => testUtils.db().wrapInGlobalTransaction())

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

async function createVenue() {
  const [row] = await db
    .table('venues')
    .returning('id')
    .insert({
      name: 'Test Venue',
      address: '123 Main Street',
      location: db.raw('ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography', [-74.0006, 40.7302]),
      created_at: DateTime.utc().toISO(),
    })

  return Number((row as { id: number }).id)
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
