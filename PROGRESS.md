# Build progress

Living status note so work can resume in a fresh session. Updated with every push.
Build plan: https://claude.ai/artifact/JbxDULF9rQZxcRn6jXE6xA

## Done

- Milestone 1 — Engine core (PR #1, merged)

## Current milestone: 2 — Prophecies and victory (branch `milestone-2-prophecies`)

- [x] Prophecy evaluation and automatic win at turn start (`prophecy.ts`, `turn.ts`)
- [x] Attacks: destroy, Conqueror credit, return to deck and shuffle, refill shop (`actions.ts`)
- [x] Rituals: draw a curse, ritual count, hand limit, curse deck reshuffle
- [x] Divine Coins: buy, guess (public), elimination, last player standing
- [x] Prophecy replacement helper for Prophecy Disruption
- [x] Tests (80 total, incl. the rulebook Warlord example)
- [x] Open PR (awaiting merge)

## Next milestones

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
