import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.raw('CREATE EXTENSION IF NOT EXISTS postgis')
  }

  async down() {
    // Leave PostGIS installed. DROP EXTENSION would cascade-remove geography columns.
  }
}
