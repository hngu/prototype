import logger from '@adonisjs/core/services/logger'
import redis from '@adonisjs/redis/services/main'
import { E_ALIAS_TAKEN } from '#exceptions/alias_taken'
import ShortUrl from '#models/short_url'
import type User from '#models/user'

const BATCH_SIZE = 10
const COUNTER_KEY = 'url_shortener:counter'
const UNUSED_SLOTS_KEY = 'url_shortener:unused_slots'
const URL_CACHE_PREFIX = 'url_shortener:urls:'
const BASE62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const CODE_LENGTH = 7
const MAX = 62 ** CODE_LENGTH // 3_521_614_606_208

export class UrlShortenerService {
  private slots: number[] = []
  private shuttingDown = false

  async getNextCounter() {
    if (this.shuttingDown) {
      throw new Error('Cannot allocate short code slots while shutting down')
    }

    if (this.slots.length === 0) {
      this.slots = parseSlots(await redis.lpop(UNUSED_SLOTS_KEY, BATCH_SIZE))
    }

    if (this.slots.length === 0) {
      const end = await redis.incrby(COUNTER_KEY, BATCH_SIZE)
      const start = end - BATCH_SIZE + 1
      this.slots = Array.from({ length: BATCH_SIZE }, (_, i) => start + i)
    }

    const randomIndex = Math.floor(Math.random() * this.slots.length)
    return this.slots.splice(randomIndex, 1)[0]
  }

  async persistUnusedSlots() {
    this.shuttingDown = true
    const leftover = this.slots.splice(0)
    if (leftover.length === 0) {
      logger.info('No unused short-code slots to persist')
      return
    }

    try {
      await redis.lpush(UNUSED_SLOTS_KEY, ...leftover)
      logger.info('Persisted %s unused short-code slots', leftover.length)
    } catch (error) {
      logger.error({ err: error }, 'Failed to persist unused short-code slots')
    }
  }

  convertCounterToShortCode(num: number): string {
    if (!Number.isInteger(num) || num < 0 || num >= MAX) {
      throw new RangeError(`counter must be an integer in [0, ${MAX})`)
    }

    let n = num
    let out = ''

    while (n > 0) {
      out = BASE62[n % 62] + out
      n = Math.floor(n / 62)
    }

    return out.padStart(CODE_LENGTH, BASE62[0])
  }

  async nextShortCode(): Promise<string> {
    return this.convertCounterToShortCode(await this.getNextCounter())
  }

  async create(user: User, { alias, url }: { alias?: string | null; url: string }) {
    if (alias) {
      const isAliasTaken = await ShortUrl.findByShortCode(alias)
      if (isAliasTaken) {
        throw new E_ALIAS_TAKEN()
      }
    }

    const shortCode = alias?.trim() || (await this.nextShortCode())

    try {
      const record = await user.related('shortUrls').create({
        shortCode,
        longUrl: url,
      })
      await this.cache(record.shortCode, record.longUrl)
      return record
    } catch (error) {
      if (alias && isUniqueViolation(error)) {
        throw new E_ALIAS_TAKEN()
      }
      throw error
    }
  }

  async getLongUrl(shortCode: string) {
    const cached = await redis.get(this.cacheKey(shortCode))
    if (cached) {
      return cached
    }

    const record = await ShortUrl.findByShortCode(shortCode)
    if (!record) {
      return null
    }

    await this.cache(record.shortCode, record.longUrl)
    return record.longUrl
  }

  private cacheKey(shortCode: string) {
    return `${URL_CACHE_PREFIX}${shortCode}`
  }

  private cache(shortCode: string, longUrl: string) {
    return redis.set(this.cacheKey(shortCode), longUrl)
  }
}

function parseSlots(raw: string[] | null): number[] {
  if (!raw || raw.length === 0) {
    return []
  }

  return raw
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value >= 0 && value < MAX)
}

function isUniqueViolation(error: unknown) {
  let current = error
  while (current && typeof current === 'object') {
    if ('code' in current && current.code === '23505') {
      return true
    }
    current = 'cause' in current ? current.cause : undefined
  }
  return false
}

export const urlShortenerService = new UrlShortenerService()
