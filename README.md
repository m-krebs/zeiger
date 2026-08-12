# zeiger

A small self-hosted link saver: save links with tags, get a short link and QR code for
each, and share selected links publicly.

Built with SvelteKit, Drizzle ORM (PostgreSQL), shadcn-svelte, and better-auth
(username + password only).

## Features

- Save links with name, destination, tag list (melt-ui tags input), and a
  public/private flag
- Dynamic short links served at `${ORIGIN}/l/<short>` — private links require login,
  public ones redirect for everyone
- Every redirect is logged (`link_visit`): visit counts on the dashboard cards,
  recent visits with user/referer on the detail page
- Detail page per link at `/edit/<id>` (`/edit/new` creates) with a QR code
  pointing at the short link and delete-with-confirmation
- Favicons are fetched automatically on save (page `<link rel="icon">`, then
  `/favicon.ico`, then DuckDuckGo's icon service)
- Export all links as JSON and import them back (short codes are kept when free,
  regenerated on conflict)

## Development

```sh
pnpm install
pnpm run db:start     # Postgres via docker compose (host port 5433)
pnpm run db:push      # apply the drizzle schema
pnpm run dev
```

Configuration lives in `.env` (`DATABASE_URL`, `ORIGIN`, `BETTER_AUTH_SECRET`).
Set `ORIGIN` to the public FQDN in production — short links and QR codes derive
from the request origin.

If you change `src/lib/server/auth.ts`, regenerate the auth tables with
`pnpm run auth:schema` followed by `pnpm run db:push`.

## Production

```sh
pnpm run build
node build            # adapter-node output; needs ORIGIN and the .env vars set
```
