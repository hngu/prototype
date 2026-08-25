import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'seats'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('seat_name').notNullable()
      table
        .integer('venue_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('venues')
        .onDelete('CASCADE')
        .index()

      table.unique(['venue_id', 'seat_name'])

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
