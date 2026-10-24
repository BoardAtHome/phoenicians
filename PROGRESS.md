# Build progress

Living status note so work can resume in a fresh session. Updated with every push.
Build plan: https://claude.ai/artifact/JbxDULF9rQZxcRn6jXE6xA

## Done

- Milestone 1 — Engine core (PR #1, merged)
- Milestone 2 — Prophecies, victory, attacks, Divine Coins (PR #2, merged)
- Milestone 3 — Online play (PR #3, merged)
- Milestone 4 — Curses on your own turn (PR #4, merged)

## Current milestone: 5 — Reactions (branch `milestone-5-reactions`)

- [x] Engine: action stack + reaction windows in `reactions.ts` (pass, hold, release, close)
- [x] Engine: 8 reactive Curses, Revival, out-of-turn Extra Expedition (`curses.ts` `prepareResponse`, `turn.ts` `endTurn`)
- [x] Tests: `reactions.test.ts` plus random play with windows on (122 engine tests)
- [x] Game moves `pass`, `holdWindow`, `releaseWindow`, `closeWindow`; the server stamps window deadlines
- [x] Board: `client/src/board/Reactions.tsx` reaction bar with countdown
- [x] 3-player browser check; PR

## Next milestones

6. Playtest tooling (log export, stats, config editor UI, version history UI)
   Possible extras: an auto-pass toggle for windows, patching boardgame.io dependency advisories.

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
- Reactions: after a draw, attack, ritual, Curse, build, Divine Coin or guess, a window opens for
  players holding a Curse they could play right then. Responses are first come, first served;
  each response gets its own window, and everything resolves last played first. When a response
  resolves, the action it answered gets a fresh window.
- Ordinary Curses may be played in any window (outside your turn), and by the explorer during
  their own expedition when no window is open. Reactive Curses only in a window that fits them.
- Who may respond is hidden from other players; they only see how many are still deciding.
- Choosing targets for a response pauses the countdown (`reactions.holdSeconds`, default 30).
- Calamities strike when their window closes, so Calamity Protection can stop them; after a
  protected Calamity the explorer must draw again before stopping.
- Expedition Interruption, Theft and Forced Exploration answer a draw by another player.
  Curse Negation answers Curses aimed at you, including Attack Negation and Divine Interception
  played against your action. Calamity Protection and Revival can't be negated.
- Revival: answers a correct guess against you. You are out (your cards return to the piles)
  and come back at your next turn with 1 Building Material (taken from the discard pile, else the
  deck), a new Prophecy, no Divine Coins, and your cumulative counters. If the game ends first, it
  stays over.
- Extra Expedition played outside your turn: you take the expedition as soon as the current turn
  ends, then play carries on from the player whose turn it was.
- Attacks and rituals are paid when declared; a canceled attack keeps the cost spent.
