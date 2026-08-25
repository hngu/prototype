import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'venues'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('name').notNullable()
      table.string('address').notNullable()
      table.specificType('location', 'geography(Point, 4326)').notNullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
    })

    this.schema.raw('CREATE INDEX venues_location_gix ON venues USING GIST (location)')
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
