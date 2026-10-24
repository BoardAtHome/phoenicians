# Build progress

Living status note so work can resume in a fresh session. Updated with every push.
Build plan: https://claude.ai/artifact/JbxDULF9rQZxcRn6jXE6xA

## Current milestone: 1 — Engine core (branch `milestone-1-engine-core`)

- [x] Repo scaffold: npm workspaces, TypeScript, Vitest (`packages/engine`)
- [x] Config types, baseline config, validation (`packages/engine/src/config`)
- [x] Game setup: decks, shop, Prophecy dealing, starting curses (`setup.ts`)
- [ ] Turn flow: action phase → expedition → next player
- [ ] Expedition draws and all Calamity effects
- [ ] Shop and building
- [ ] Tests for every Calamity, build/refill, card conservation
- [ ] Open PR

## Next milestones

2. Prophecies and victory (turn-start check, Divine Coin guessing, attacks, elimination)
3. Online play (boardgame.io server, lobby, React client, admin config, hosting)
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
