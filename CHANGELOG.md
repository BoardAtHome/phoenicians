# Changelog

What each app build adds, newest first. The app shows this list on its What's new
page, next to the rule and balance changes made through the admin page (config
versions, numbered v1, v2, ...).

Every pull request that changes the app adds an entry here and bumps `version` in the
root `package.json` to match (see "Releasing a build" in `PROGRESS.md`). The newest
entry is the build that goes live once the PR is merged and deployed.

## 0.12.0 — Clearer Curse prompts and auto "Not now"

_25 Oct 2026 · PR #15_

- Every player who could respond now gets the reaction timer and Not now after each action,
  even with no Curse that applies. Before, the prompt only came up for players holding a
  usable Curse, so whoever was drawing could tell nobody held one and keep going.
- New Auto "Not now" switch, on the reaction prompt and in Your Curses. When it is on, you
  pass on every reaction window straight away, even when you hold a Curse that could answer
  it. Only you can see it. If everyone has it on, the game doesn't wait at all.
- When a Curse is played on you, the prompt says what it does, not just its name. Everyone
  else sees the same line on their banner, and the same goes for Calamities.
- After a Curse resolves, the table is told what it did, e.g. "Ana's Construction Ban: Bob
  can't build during their next turn", or that an expedition was cut short.
- Opening a sheet such as the Market is no longer interrupted by every reaction window, only
  by ones aimed at you or ones you hold a Curse for.

## 0.11.1 — No more lag and disconnects as a game goes on

_25 Oct 2026 · PR #14_

- Games no longer slow down the longer they run. The server was keeping a full copy of the
  table for every move ever made in a match, so after a few rounds of drawing each tap took
  seconds and phones dropped their connection. Moves now take the same short time on the first
  turn and the fiftieth. Games already in progress shrink back on their next move.
- Fewer requests to the server while you play: the game page stops checking the seat list
  once you have picked your seat.

## 0.11.0 — End games you've stopped playing

_25 Oct 2026 · PR #13_

- Anyone at the table can end the game for everyone from the game menu (End game for
  everyone). No one wins, and the game over screen and log say who ended it.
- Games with no moves for 24 hours end by themselves, so abandoned games stop piling
  up as in progress. The time can be changed on the server (`IDLE_MATCH_HOURS`).
- Admin > Matches lists games in progress by default, with when each last had a move,
  an End button on each row, and End idle games to end every game with no moves for
  1 to 72 hours in one go. Tick Show finished games to see the rest.
- Ended games keep their full log and stats, and say whether a player, the admin or
  inactivity ended them.

## 0.10.1 — Reaction timer no longer gets stuck

_25 Oct 2026 · PR #12_

- A reaction window now always closes when its countdown ends. The server closes it,
  so the game no longer waits at 0s for a player who left, lost signal or put their
  phone away. Windows left open when the server restarted or slept close as soon as
  it is back.
- If your device stops getting answers from the server (a dropped connection, or it
  fell out of step), the game reconnects by itself after a few seconds, so buttons like
  Draw work again instead of doing nothing.

## 0.10.0 — App builds in What's new

_25 Oct 2026 · PR #11_

- The Changelog page is now "What's new", with two tabs: App builds (what each new
  version of the app added) and Rules and balance (config versions from the admin
  page). The build you are playing on is marked.
- The game menu links to What's new.

## 0.9.1 — Curses that would do nothing

_25 Oct 2026 · PR #9_

- A Curse can no longer be played when it would have no effect (for example Mass
  Theft when no opponent holds resources), so it stays in your hand. Its Play button
  is greyed out with the reason, and target pickers only offer targets it would affect.
- The activity log now says what a theft Curse took and from whom.

## 0.9.0 — Helper text and How to play

_25 Oct 2026 · PR #10_

- "How to play" guide, from the ? button at the top of the table or the game menu,
  with tabs for the basics of a turn, every Prophecy (goal, Banked or Hold, how to get
  there), Market buildings by kind, every Curse (what it does and when it can be
  played), Calamities and resources.
- Descriptions where you need them: each Market building says which Prophecies it
  counts toward; Curse cards in your hand, reaction prompts and target pickers explain
  what the Curse does and when it is offered; the Actions sheet explains each action;
  Guess a Prophecy shows each Prophecy's goal; your peeked Prophecy shows its goal and
  how to reach it; a Calamity in the middle of the table says what it does; resource
  tiles, structures, Curses and Divine Coins have hover tips.
- Every number in the helper text comes from the game's live config, so it follows the
  admin's changes. Curse card text the admin rewrote is shown as written.

## 0.8.0 — Drawn card on the table

_25 Oct 2026 · PR #8_

- The last card drawn from the Expedition deck lies face up next to the deck, big
  enough for everyone to see, with who drew it. It stays until someone does
  something new. Calamities show their name, and a stamp when they were ignored
  (first card) or stopped.

## 0.7.0 — Table layout

_24 Oct 2026 · PR #7_

- New game screen laid out like a real table: rivals sit around the edge in turn
  order (the next player on your left), the Expedition deck is in the middle, and
  your hand is docked at the bottom. Works on phones and widens on desktop.
- Your dock: secret Prophecy (tap to peek, hides when you leave the page, glows
  while it is met), resource tiles, your village, Curses and Divine Coins, and the
  main buttons for the moment (Actions / Set out, Keep / Draw a card).
- Market, villages, actions, Guess a Prophecy, Curses and the activity log open as
  sheets. The Market shows what you're missing for each building. Attack by tapping
  a rival's seat and picking a structure.
- Reaction windows: a prompt when the action is aimed at you, a banner when you can
  answer someone else's action, and a countdown for everyone else. Timer, pause and
  pass work as before.
- Picking targets for Curses uses player, resource and structure buttons instead of
  dropdowns. Discards use + and − steppers.
- Game menu with the invite link, leave seat and version info; a game-over card
  reveals every Prophecy.
- Games now take 3 to 6 players.

## 0.6.0 — Playtest tools

_24 Oct 2026 · PR #6_

- Admin page in three tabs: Config, Versions, and Matches and stats.
- Form editor for every config number (decks, costs, buildings, Prophecies,
  Curses and their numbers, reaction timer), with live validation and a preview
  of unsaved edits. The JSON editor is still there.
- Versions: compare any two versions, or a version and the draft, line by line.
- Matches: every game with its config version and build. Per-game stats follow
  the Playtesting Guide's scenario list: expeditions, Calamities, building pace,
  shop stagnation, Prophecy timing and disruption, Curse use, reaction windows,
  and per-player totals.
- Downloads: a game's full log (CSV), everything about a game (JSON), and one
  row per game for all games (CSV).
- Admin match controls: undo the last action, end a stuck match. Players see
  the change at once.
- Deploys wait for CI to pass. New DEPLOY.md guide.

## 0.5.0 — Reactions

_24 Oct 2026 · PR #5_

- After each draw, attack, ritual, Curse, build, Divine Coin or guess, players
  who could answer get a short window (5 seconds, configurable) to play a Curse.
  Everyone else sees a countdown. Pass ends your part early; choosing targets
  pauses the countdown.
- Reactive Curses: Attack Negation, Curse Negation, Divine Interception,
  Calamity Protection, Expedition Interruption, Expedition Theft,
  Forced Exploration and Revival.
- Ordinary Curses can now be played outside your turn in a window, and during
  your own expedition.
- Extra Expedition works outside your turn: you explore right after the current turn.

## 0.4.0 — Curses on your own turn

_24 Oct 2026 · PR #4_

- Play 12 Curses during your action phase: Resource Exchange, Petty Theft,
  Divine Foresight, Mass Theft, Extra Expedition, Construction Ban,
  Market Manipulation, Forced Conflict, Resource Purge, Military Sabotage,
  Structural Burden, Prophecy Disruption. Played Curses show in the activity log.
- Divine Foresight shows the top cards only to the player who played it.
- The 7 reactive Curses and Revival arrive with reaction windows.

## 0.3.0 — Online play

_24 Oct 2026 · PR #3_

- Play online: create a game, share the link, each player claims their seat.
- Board with shop, expeditions, Calamity discard choices, attacks, rituals,
  Divine Coins and Prophecy guesses. Curses are visible but not playable yet.
- Admin page behind a shared password: edit the config, save noted changes to
  a draft, publish versions, make any version active, start a draft from any version.
- Public changelog page of config versions.
- Games and configs stored in Postgres.

## 0.2.0 — Prophecies and victory

_24 Oct 2026 · PR #2_

- Automatic victory at the start of your own turn, attacks, rituals,
  Divine Coins, elimination, last player standing.

## 0.1.0 — Engine core

_24 Oct 2026 · PR #1_

- Config, setup, turn flow, expeditions, all Calamities, building.
