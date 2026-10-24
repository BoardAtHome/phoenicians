# Build progress

Living status note so work can resume in a fresh session. Updated with every push.
Build plan: https://claude.ai/artifact/JbxDULF9rQZxcRn6jXE6xA

## Done

- Milestone 1 — Engine core (PR #1, merged)
- Milestone 2 — Prophecies, victory, attacks, Divine Coins (PR #2, merged)

## Current milestone: 3 — Online play (branch `milestone-3-online-play`)

- [x] `packages/game`: boardgame.io wrapper. All players may send moves; the engine decides legality.
      `playerView` hides others' curses and Prophecies and all deck order.
- [ ] `packages/server`: boardgame.io server, config store (draft, versions, rollback), admin password
- [ ] `packages/client`: Vite + React lobby, match links, board
- [ ] Admin page: JSON config editor, publish versions
- [ ] Deploy setup (Render)
- [ ] Open PR

## Next milestones

4. Non-reactive curses
5. Reaction windows and reactive curses
6. Playtest tooling (log export, stats, config editor UI, version history UI)

## Decisions and notes

- Engine is plain TypeScript with no framework imports. Functions mutate the `GameState`
  passed in (boardgame.io moves work this way via Immer) and return `Result`.
- Randomness is injected through `Rng` so boardgame.io's seeded random can drive it.
- Spent and discarded resource cards go to the expedition discard pile.
- Curse copy counts in the baseline are a placeholder (2 each) until set before a playtest.
- All rules decisions are recorded in the build plan's "Rules decisions" section.
