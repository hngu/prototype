# Local Docker services

From this directory:

```sh
docker compose up -d
```

| Service | Role | URL / port |
| --- | --- | --- |
| Postgres | Database | `localhost:5432` |
| Redis Insight | Cluster UI | http://localhost:5540 |
| Redis Cluster | Master | `localhost:7001` |
| Redis Cluster | Master | `localhost:7002` |
| Redis Cluster | Master | `localhost:7003` |
| Redis Cluster | Replica (read-only) | `localhost:7004` |
| Redis Cluster | Replica (read-only) | `localhost:7005` |
| Redis Cluster | Replica (read-only) | `localhost:7006` |

Postgres credentials come from `PG_USER`, `PG_PASSWORD`, and `PG_DB_NAME` (defaults `postgres` / `postgres` / `prototype`). The host port is `PG_PORT` (default `5432`).

Redis Cluster CLI (cluster mode follows `MOVED` redirects):

```sh
redis-cli -c -h 127.0.0.1 -p 7001 CLUSTER NODES
```

Connecting to any master (`7001`–`7003`) is enough; replicas are discovered automatically. `FLUSHALL` only on masters — replicas reject writes.

Wipe cluster and database data:

```sh
docker compose down -v
```
