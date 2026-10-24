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

## Deploy

See [DEPLOY.md](DEPLOY.md) for the Render setup, costs, releasing updates and troubleshooting.
