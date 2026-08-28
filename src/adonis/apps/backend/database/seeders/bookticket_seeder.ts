import { BaseSeeder } from '@adonisjs/lucid/seeders'
import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import type { EventCategory } from '#constants/event_categories'

const SEAT_INSERT_CHUNK_SIZE = 200

type VenueSeed = {
  name: string
  address: string
  longitude: number
  latitude: number
  rows: number
  seatsPerRow: number
  event: {
    name: string
    artists: string[]
    description: string
    category: EventCategory
    date: DateTime
  }
}

const VENUES: VenueSeed[] = [
  {
    name: 'The Comedy Cellar',
    address: '117 MacDougal Street, New York, NY 10012',
    longitude: -74.0006,
    latitude: 40.7302,
    rows: 8,
    seatsPerRow: 10,
    event: {
      name: 'Late Night at the Cellar',
      artists: ['Mark Normand', 'Joe List'],
      description: 'Two-set standup in the MacDougal room',
      category: 'comedy',
      date: DateTime.fromObject(
        { year: 2076, month: 9, day: 4, hour: 22, minute: 0 },
        { zone: 'America/New_York' }
      ),
    },
  },
  {
    name: 'Credit Union 1 Arena',
    address: '525 S Racine Avenue, Chicago, IL 60607',
    longitude: -87.6561,
    latitude: 41.8748,
    rows: 15,
    seatsPerRow: 20,
    event: {
      name: 'UIC Flames vs. DePaul Blue Demons',
      artists: ['UIC Flames', 'DePaul Blue Demons'],
      description: "Men's basketball crosstown game",
      category: 'sports',
      date: DateTime.fromObject(
        { year: 2076, month: 10, day: 10, hour: 19, minute: 0 },
        { zone: 'America/Chicago' }
      ),
    },
  },
  {
    name: 'The Fillmore',
    address: '1805 Geary Boulevard, San Francisco, CA 94115',
    longitude: -122.4331,
    latitude: 37.7841,
    rows: 20,
    seatsPerRow: 40,
    event: {
      name: 'Japanese Breakfast — For Melancholy Brunettes',
      artists: ['Japanese Breakfast', 'Jay Som'],
      description: 'Headline concert with opener',
      category: 'concert',
      date: DateTime.fromObject(
        { year: 2076, month: 11, day: 14, hour: 20, minute: 0 },
        { zone: 'America/Los_Angeles' }
      ),
    },
  },
]

function seatNames(rowCount: number, seatsPerRow: number): string[] {
  const names: string[] = []
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    const row = String.fromCharCode(65 + rowIndex)
    for (let seat = 1; seat <= seatsPerRow; seat++) {
      names.push(`${row}${seat}`)
    }
  }
  return names
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}

export default class extends BaseSeeder {
  static environment = ['development', 'test']

  async run() {
    await this.client.transaction(async (trx) => {
      await trx.from('events').delete()
      await trx.from('seats').delete()
      await trx.from('venues').delete()

      const now = DateTime.utc().toISO()!

      for (const venue of VENUES) {
        const venueId = await this.insertVenue(trx, venue, now)
        await this.insertSeats(trx, venueId, venue, now)
        await this.insertEvent(trx, venueId, venue, now)
      }
    })
  }

  private async insertVenue(trx: TransactionClientContract, venue: VenueSeed, now: string) {
    const [row] = await trx
      .table('venues')
      .returning('id')
      .insert({
        name: venue.name,
        address: venue.address,
        location: trx.raw('ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography', [
          venue.longitude,
          venue.latitude,
        ]),
        created_at: now,
      })

    return Number((row as { id: number }).id)
  }

  private async insertSeats(
    trx: TransactionClientContract,
    venueId: number,
    venue: VenueSeed,
    now: string
  ) {
    const rows = seatNames(venue.rows, venue.seatsPerRow).map((seatName) => ({
      seat_name: seatName,
      venue_id: venueId,
      created_at: now,
    }))

    for (const seats of chunk(rows, SEAT_INSERT_CHUNK_SIZE)) {
      await trx.table('seats').multiInsert(seats)
    }
  }

  private async insertEvent(
    trx: TransactionClientContract,
    venueId: number,
    venue: VenueSeed,
    now: string
  ) {
    await trx.table('events').insert({
      name: venue.event.name,
      venue_id: venueId,
      artists: JSON.stringify(venue.event.artists),
      description: venue.event.description,
      category: venue.event.category,
      date: venue.event.date.toUTC().toISO(),
      created_at: now,
    })
  }
}
