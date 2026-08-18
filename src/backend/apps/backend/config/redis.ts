import env from '#start/env'
import { defineConfig } from '@adonisjs/redis'
import type { InferConnections } from '@adonisjs/redis/types'

const redisConfig = defineConfig({
  connection: 'main',
  connections: {
    main: {
      clusters: env
        .get('REDIS_NODES')
        .split(',')
        .map((entry) => {
          const [host, port] = entry.trim().split(':')
          return { host, port: Number(port) }
        }),
    },
  },
})

export default redisConfig

declare module '@adonisjs/redis/types' {
  export interface RedisConnections extends InferConnections<typeof redisConfig> {}
}
