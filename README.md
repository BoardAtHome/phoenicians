# Phoenicians

Online prototype of the board game *Phoenicians*, built for remote playtesting with family and friends.

- `packages/engine`: the rules, in plain TypeScript, with every number read from a config.
- `packages/game`: the boardgame.io wrapper (moves, hidden information).
- `packages/server`: game server, versioned config store, admin API.
- `packages/client`: React web app.

See `PROGRESS.md` for build status and `CHANGELOG.md` for releases.

## Run locally

```sh
npm install
ADMIN_PASSWORD=secret npm run dev   # server on :8000, app on http://localhost:5173
npm test
```

Without `DATABASE_URL`, configs and games live in memory and reset on restart.

## Deploy (Render)

1. In Render, choose **New > Blueprint** and select this repository. `render.yaml`
   creates the web service and a Postgres database.
2. Set `ADMIN_PASSWORD` when prompted.
3. Every merge to `main` deploys automatically.

| Variable | Purpose |
| --- | --- |
| `ADMIN_PASSWORD` | Unlocks the admin page. Admin is disabled if unset. |
| `DATABASE_URL` | Postgres connection string. Set by the Blueprint. |
| `PORT` | Set by Render. Defaults to 8000. |
| `BUILD_VERSION` | Optional; defaults to the root `package.json` version. |
