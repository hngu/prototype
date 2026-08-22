# prototype
Apps prototyping new technologies

## Setup

Local domains `adonis.app` and `prototype.app` must resolve to `127.0.0.1`, and they need HTTPS (the `.app` TLD is HSTS-preloaded). From `src/`:

```sh
./setup-hosts.sh
./setup-certs.sh
```

`setup-hosts.sh` edits `/etc/hosts` (sudo once). `setup-certs.sh` needs [mkcert](https://github.com/FiloSottile/mkcert) (`brew install mkcert`) and installs a local CA so the browser trusts the certs. See `src/docker.md` for nginx and Compose.
