# prototype
Apps prototyping new technologies

## Apps

| Path | What |
| --- | --- |
| [`src/adonis`](src/adonis) | AdonisJS API + React SPA (`adonis.app` / `prototype.app`) |
| [`src/elearning`](src/elearning) | Astro TypeScript learning site |
| [`src/exercises`](src/exercises) | Graded exercise solutions for the learning site |

## Setup

Local domains `adonis.app` and `prototype.app` must resolve to `127.0.0.1`, and they need HTTPS (the `.app` TLD is HSTS-preloaded). From `src/`:

```sh
./setup-hosts.sh
./setup-certs.sh
```

`setup-hosts.sh` edits `/etc/hosts` (sudo once). `setup-certs.sh` needs [mkcert](https://github.com/FiloSottile/mkcert) (`brew install mkcert`) and installs a local CA so the browser trusts the certs. See `src/docker.md` for nginx and Compose.

## TODO

- [ ] **Commit a `.tool-versions` for asdf.** Node is pinned in `.nvmrc` and pnpm in `package.json#packageManager`, but there is no committed `.tool-versions`. Cloudflare Pages treats that file as an asdf manifest and tries to install every tool in it, including pnpm, whose asdf plugin is not on the Pages image, so the deploy fails before the build runs (see `.github/actions/setup-workspace/action.yml`). For now, keep a local `.tool-versions` listed in `.git/info/exclude`. Find a way to commit it without breaking Pages, for example by setting `PNPM_VERSION` on Pages or checking whether a newer build image handles it.
