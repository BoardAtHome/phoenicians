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

- [x] Step 1: player count 3–6 (baseline config, Home page reads it); table shell in `client/src/table/`:
      seats around the table (next player on your left, then across the top, then right), Expedition deck
      in the middle, ticker, dock (Prophecy peek, resource tiles, village/Curses/coins strip, Set out / Draw / Keep),
      village and activity sheets. Reactions, Curses and pending choices reuse the classic components for now.
- [x] Step 2: Market sheet and Build (shortfall shown per building), Actions sheet (Ritual, Divine Coin, Attack,
      Guess; costs from config, disabled rows show why), Guess sheet, attack mode (ringed seats) and attack
      from a rival's village sheet. `metricText` moved to `format.ts`.
- [x] Step 3: `table/Curses.tsx`: Curse hand sheet, target pickers (players, resources, exchange, structures),
      reaction windows (blocking prompt when the action is aimed at you, banner otherwise, waiting banner for
      everyone else; timer from config, pause while choosing, Pass / Not now), Divine Foresight, discard and
      Forced Conflict sheets. The ticker and reaction banner sit at the top of the dock so they stay in view.
      `describeEntry` takes the viewer's id ("Sara is attacking your Farm").
- [x] Step 4: game menu (invite link, leave seat, activity log, versions), game-over card revealing every
      Prophecy, compact seats for 5–6 players, desktop widening. The table is the only game screen: the classic
      board (`client/src/board/`) and its CSS are gone; `useCountdown` lives in `table/countdown.ts`.
      Browser-checked at 3, 5 and 6 players on phone and desktop, plus scripted games covering build,
      expedition, attack, Curses with targets, reaction prompts, discards and admin end-match. Version 0.7.0.
- [ ] PR review and merge

## Playtest feedback (after milestone 7)

- [x] Drawn card shown face up in the middle (`table/Center.tsx`, branch `claude/project-thread-s9pp7k`).
      Derived from the log: the newest draw stays until a log event that isn't its aftermath
      (window closed, Calamity resolved, expedition ended, next turn started, extra expedition).
      The deck shrinks beside it when the middle is narrow (container query).

## Helper text for new players (branch `claude/project-thread-me1sw1`)

Jamil asked for descriptions everywhere a new player might need them. Wording for Prophecies follows the
Prophecy cheat sheet (https://claude.ai/artifact/HNeYf8tJsikXTvrdVX9Gqj).

- [x] `client/src/help.ts`: every description built from the live config (Prophecy goals and how-tos,
      which Prophecies a building counts toward, Curse effects from their params and when they can be played,
      Calamity effects, what each resource pays for, action blurbs, win rule). Curse text the admin edited
      away from the baseline is shown as written instead of the generated text.
- [x] `table/Guide.tsx`: "How to play" sheet with tabs, opened from the ? at the top right, the game menu,
      and "?" links in the Market, Actions, Guess and Curses sheets (`HelpLink` in `Sheet.tsx`).
- [x] Inline text in Market rows, Curse cards and pickers, Actions, Guess, Prophecy peek, Center Calamity
      alert, Foresight, Structural Burden discard; hover tips on resource tiles, structures, Curses, coins.
- [x] Browser-checked on phone and desktop.
- [ ] PR review and merge

## Reaction timer stuck at 0s (0.10.1, branch `claude/project-thread-6pr7xg`)

Playtest: after a draw the window sat at 0s ("Waiting on 1 player who may respond") and nobody could
draw or keep; later, pressing Draw did nothing. Windows only closed when a client sent `closeWindow`
after its own countdown, and boardgame.io silently drops moves from a client whose state is behind
the server (or whose socket is dead), so the match waited until someone reconnected.

- [x] `server/src/windowTimers.ts`: the server arms a timer at each window's deadline (from
      `HistoryStore.onSave`) and sends `closeWindow` itself through the match's move queue, then
      broadcasts. `trackAll()` on startup re-arms windows saved before a restart or sleep.
      Clients still ask as a fallback. Tests: `server/test/reactionTimer.test.ts`.
- [x] Client: if a move sent with `send` gets no state back in 6s (`STALE_AFTER_MS` in `useTurn.ts`),
      `MatchPage` remounts the game client, which opens a new socket and syncs. Browser-checked by
      dropping the socket's outgoing frames: reconnected after 6s and the next Draw went through.
- [ ] PR review and merge

## After milestone 7

- Deploy on Render (DEPLOY.md). The free database is deleted after 30 days, so upgrade it (about $6/month).
- The live published config may still say 7 players max; set "Most players" to 6 in Admin › Config if so.
- Possible extras: auto-pass toggle for windows, boardgame.io dependency advisories, config/backup export.

## Releasing a build (every PR that changes the app)

Jamil wants every new app build to say what it adds, alongside the config versions.

- Bump `version` in the root `package.json`: minor (0.x.0) for new features, patch (0.x.y) for fixes.
- Add a `## <version> — <short title>` entry at the top of `CHANGELOG.md`, with an italic
  `_<date> · PR #n_` line and player-facing bullets (what changed for someone at the table or on the admin page).
- The in-app What's new page (`/changelog`, App builds tab) reads `CHANGELOG.md` at build time.
  `packages/client/test/changelog.test.ts` fails if the top entry doesn't match `package.json`.
- If another PR merged first with the same number, take the next number when rebasing.
- Config (rules and balance) changes are not builds: they are versioned on the admin page and shown
  on the Rules and balance tab.

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
- A Curse can't be played when it would have no effect (`curseNoEffectReason`): e.g. Mass Theft
  when no opponent holds resources, Resource Purge on a resource the target lacks, Forced Conflict
  when Player A can't afford an attack. It stays in hand; if things change before it resolves, it
  fizzles. Deck-based checks (Divine Foresight, Prophecy Disruption) stay engine-only, since decks
  are hidden from clients. Theft Curses take from inventories only, not from an expedition in progress.
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
- boardgame.io's own undo is off (`disableUndo`). It copied G into `_undo` on every move and only
  clears it at a boardgame.io turn end, which never comes here, so the saved state grew by about
  45 KB a move and every move, save and lobby poll got slower until the game fell apart.
  `npx tsx bench/load.ts` in `packages/server` plays a 6-player match and prints the time and bytes
  per move (set `DATABASE_URL` to run it against Postgres).
- "Avg own turn of first purchase" approximates the build plan's "turns to afford each category".
- Ending a match sets `ctx.gameover = { endedByAdmin: true }` with no winner.
