# Frontend

React 19 + Vite + Mantine SPA in the AdonisJS API monorepo. It talks to [`apps/backend`](../backend) through [Tuyau](https://docs.adonisjs.com/guides/frontend/api-client) and cookie-backed Bearer tokens.

## Develop

From the Adonis workspace root (`src/adonis`):

```sh
pnpm install
pnpm dev
```

Turbo starts the API on `http://localhost:3333` and this app on `http://localhost:5173`. Behind local nginx (see `src/docker.md`):

- UI: `https://prototype.app`
- API: `https://adonis.app`

Frontend-only:

```sh
pnpm --filter @api-starter-kit/frontend dev
```

Copy [`.env.example`](./.env.example) to `.env`. `VITE_API_URL` defaults to `https://adonis.app`.

## Scripts

- `pnpm dev` — Vite
- `pnpm build` — `tsc -b` then Vite production build
- `pnpm typecheck` — `tsc -b`
- `pnpm lint` — oxlint
- `pnpm preview` — serve the production build

The React Compiler is enabled. See the [React Compiler docs](https://react.dev/learn/react-compiler).
