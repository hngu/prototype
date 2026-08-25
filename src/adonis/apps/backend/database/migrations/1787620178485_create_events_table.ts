import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'events'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('name').notNullable()
      table
        .integer('venue_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('venues')
        .onDelete('RESTRICT')
        .index()

      table.jsonb('artists').notNullable().defaultTo('[]')
      table.text('description').nullable()
      table.string('category').notNullable().index()
      table.timestamp('date').notNullable().index()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
