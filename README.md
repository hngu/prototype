# prototype
Apps prototyping new technologies

## Apps

| Path | What |
| --- | --- |
| [`src/adonis`](src/adonis) | AdonisJS API + React SPA (`adonis.app` / `prototype.app`) |
| [`src/elearning`](src/elearning) | Astro TypeScript learning site |
| [`src/exercises`](src/exercises) | Graded exercise solutions for the learning site |
| [`src/pdf-annotator`](src/pdf-annotator) | Sign PDF Online — client-only signer (`localhost:5174`) |

## Setup

Local domains `adonis.app` and `prototype.app` must resolve to `127.0.0.1`, and they need HTTPS (the `.app` TLD is HSTS-preloaded). From `src/`:

```sh
./setup-hosts.sh
./setup-certs.sh
```

`setup-hosts.sh` edits `/etc/hosts` (sudo once). `setup-certs.sh` needs [mkcert](https://github.com/FiloSottile/mkcert) (`brew install mkcert`) and installs a local CA so the browser trusts the certs. See `src/docker.md` for nginx and Compose.

The PDF annotator needs no hosts or certs — run `pnpm --filter pdf-annotator dev`.
