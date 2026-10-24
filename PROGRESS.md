# Build progress

Living status note so work can resume in a fresh session. Updated with every push.
Build plan: https://claude.ai/artifact/JbxDULF9rQZxcRn6jXE6xA

## Done

- Milestone 1 — Engine core (PR #1, merged)
- Milestone 2 — Prophecies, victory, attacks, Divine Coins (PR #2, merged)
- Milestone 3 — Online play (PR #3, merged)

## Current milestone: 4 — Curses on your own turn (branch `milestone-4-curses`)

- [x] Engine: 12 Curse effects in `curses.ts` (`playCurse`). Revival is reactive, so it moves to milestone 5.
- [x] Follow-up choices: Divine Foresight arrange, Forced Conflict target, Structural Burden discard
- [x] Unit tests per Curse (99 engine tests; random play now casts Curses too)
- [x] Game moves + Foresight cards visible only to their player
- [x] Board UI: play a Curse, pick targets, follow-up dialogs (`client/src/board/Curses.tsx`)
- [x] Browser check + PR (awaiting merge)

## Next milestones

5. Reaction windows and reactive curses
6. Playtest tooling (log export, stats, config editor UI, version history UI)

## Decisions and notes

- Engine is plain TypeScript with no framework imports. Functions mutate the `GameState`
  passed in (boardgame.io moves work this way via Immer) and return `Result`.
- Randomness is injected through `Rng` so boardgame.io's seeded random can drive it.
- Spent and discarded resource cards go to the expedition discard pile.
- Curse copy counts in the baseline are a placeholder (2 each) until set before a playtest.
- All rules decisions are recorded in the build plan's "Rules decisions" section.
- "Choose a player" Curses may target anyone, including yourself; "opponent" Curses only others.
- Forced Conflict: the caster picks Player A and Player B; Player A picks the structure and pays the attack cost.
- Military Sabotage: the caster picks which structures are destroyed and gets Conqueror credit.
- Structural Burden: the target picks which cards to discard.
- Extra Expedition on your own turn: another expedition starts when the current one ends.
