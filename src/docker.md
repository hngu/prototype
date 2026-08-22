# Local Docker services

From this directory:

```sh
docker compose up -d
```

| Service | Role | URL / port |
| --- | --- | --- |
| Nginx | Reverse proxy + CDN | https://adonis.app (Adonis), https://prototype.app (Vite) |
| Postgres | Database | `localhost:5432` |
| Redis Insight | Cluster UI | http://localhost:5540 |
| Redis Cluster | Master | `localhost:7001` |
| Redis Cluster | Master | `localhost:7002` |
| Redis Cluster | Master | `localhost:7003` |
| Redis Cluster | Replica (read-only) | `localhost:7004` |
| Redis Cluster | Replica (read-only) | `localhost:7005` |
| Redis Cluster | Replica (read-only) | `localhost:7006` |

Postgres credentials come from `PG_USER`, `PG_PASSWORD`, and `PG_DB_NAME` (defaults `postgres` / `postgres` / `prototype`). The host port is `PG_PORT` (default `5432`).

## Domain names (nginx)

Nginx listens on host ports 80 and 443. HTTP redirects to HTTPS (the `.app` TLD is HSTS-preloaded, so browsers refuse plain HTTP). Traffic is proxied by `Host` header to apps running on the host:

| Domain | Proxies to |
| --- | --- |
| https://adonis.app | Adonis on `localhost:3333` |
| https://adonis.app/s/… | Adonis, with nginx `proxy_cache` (CDN for short-URL 302s) |
| https://prototype.app | Vite on `localhost:5173` |

`/api/` and the rest of `adonis.app` stay a plain reverse proxy (never cached). Only `GET /s/:shortCode` is a CDN location: cache hits never reach Adonis; misses and expired entries do. Redis remains the origin cache for the mapping; nginx caches the HTTP 302.

Cache files live in the `nginx_cdn_cache` volume (`/var/cache/nginx/cdn`). After creating a short URL, the second request should be a HIT:

```sh
curl -sI https://adonis.app/s/YOURCODE | grep -i x-cache
# first:  MISS (Adonis ran)
# second: HIT  (nginx only)
```

`.app` is a real TLD, so the host machine must resolve those names to loopback. A container cannot write macOS `/etc/hosts` (Docker Desktop is not root on the Mac). From this directory:

```sh
./setup-hosts.sh
./setup-certs.sh
```

`setup-hosts.sh` appends `127.0.0.1 adonis.app prototype.app` to `/etc/hosts` if it is missing (sudo prompt once). Remove with `./setup-hosts.sh --remove`.

`setup-certs.sh` uses [mkcert](https://github.com/FiloSottile/mkcert) (`brew install mkcert`) to install a local CA and write `nginx/certs/local.pem`. Recreate nginx after generating certs:

```sh
docker compose up -d nginx
```

Start Adonis and Vite on the host as usual. They must bind beyond loopback so the container can reach them:

- Adonis: `HOST=0.0.0.0` and `APP_URL=https://adonis.app` (see `src/backend/apps/backend/.env.example`)
- Vite: already configured in `src/frontend/vite.config.ts`
- Frontend API calls: `VITE_API_URL=https://adonis.app` (see `src/frontend/.env.example`; this is also the client default)

Direct `localhost:3333` and `localhost:5173` still work as a fallback.

If Compose fails to bind port 80 or 443, something else on the machine is already using it.

Redis Cluster CLI (cluster mode follows `MOVED` redirects):

```sh
redis-cli -c -h 127.0.0.1 -p 7001 CLUSTER NODES
```

Connecting to any master (`7001`–`7003`) is enough; replicas are discovered automatically. `FLUSHALL` only on masters — replicas reject writes.

The Adonis backend seeds the cluster with `REDIS_NODES=127.0.0.1:7001,127.0.0.1:7002,127.0.0.1:7003`.

Wipe cluster and database data:

```sh
docker compose down -v
```
