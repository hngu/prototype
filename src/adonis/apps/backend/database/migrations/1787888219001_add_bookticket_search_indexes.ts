import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.raw(`
      ALTER TABLE events
        ADD COLUMN name_search tsvector
        GENERATED ALWAYS AS (to_tsvector('english', coalesce(name, ''))) STORED
    `)
    this.schema.raw('CREATE INDEX events_name_search_gix ON events USING GIN (name_search)')
    this.schema.raw('CREATE INDEX events_category_date_idx ON events (category, date)')
  }

  async down() {
    this.schema.raw('DROP INDEX IF EXISTS events_name_search_gix')
    this.schema.raw('DROP INDEX IF EXISTS events_category_date_idx')
    this.schema.raw('ALTER TABLE events DROP COLUMN IF EXISTS name_search')
  }
}
