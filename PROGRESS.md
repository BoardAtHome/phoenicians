# Build progress

Living status note so work can resume in a fresh session. Updated with every push.
Build plan: https://claude.ai/artifact/JbxDULF9rQZxcRn6jXE6xA

## Done

- Milestone 1 — Engine core (PR #1, merged)
- Milestone 2 — Prophecies, victory, attacks, Divine Coins (PR #2, merged)
- Milestone 3 — Online play (PR #3, merged)
- Milestone 4 — Curses on your own turn (PR #4, merged)
- Milestone 5 — Reactions (PR #5, merged)

- Milestone 6 — Playtest tooling (PR #6, merged)

## Current milestone: 7 — Table UI (branch `claude/project-thread-mdrr03`)

Redesign of the game screen from the co-creator's mobile mockup. Plan: https://claude.ai/artifact/9gEguFXddeLm5B4S5641dK
Jamil's direction: the mockup is inspiration for the layout only. Our established rules win every conflict,
keep the current look (colors, fonts, panels), and take liberties where the mockup doesn't cover something.
The new screen is opt-in with `?table=1` on a match URL until step 4 makes it the default.

- [x] Step 1: player count 3–6 (baseline config, Home page reads it); table shell in `client/src/table/`:
      seats around the table (next player on your left, then across the top, then right), Expedition deck
      in the middle, ticker, dock (Prophecy peek, resource tiles, village/Curses/coins strip, Set out / Draw / Keep),
      village and activity sheets. Reactions, Curses and pending choices reuse the classic components for now.
- [ ] Step 2: Market sheet and Build, Actions sheet (Ritual, Divine Coin, Guess), attack mode and attack flow
- [ ] Step 3: Curse hand, target pickers, reaction prompt and waiting banner (config timer, pause, pass),
      Divine Foresight, discard choices, Forced Conflict
- [ ] Step 4: game menu (invite, leave seat, versions), game-over card, desktop polish, table becomes default,
      classic board removed, browser check at 3/5/6 players on phone and desktop

## After milestone 7

- Deploy on Render (DEPLOY.md). The free database is deleted after 30 days, so upgrade it (about $6/month).
- The live published config may still say 7 players max; set "Most players" to 6 in Admin › Config if so.
- Possible extras: auto-pass toggle for windows, boardgame.io dependency advisories, config/backup export.

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
- Stats in progress hide Prophecies and Curse details behind "Show anyway", since the admin may be playing.
- Undo history lives in server memory (last 30 states per match) and resets on restart or deploy.
- "Avg own turn of first purchase" approximates the build plan's "turns to afford each category".
- Ending a match sets `ctx.gameover = { endedByAdmin: true }` with no winner.
