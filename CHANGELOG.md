# Changelog

App builds. Rule and balance changes made through the admin page are versioned
separately and shown on the in-app Changelog page.

## Unreleased

- The last card drawn from the Expedition deck lies face up next to the deck, big
  enough for everyone to see, with who drew it. It stays until someone does
  something new. Calamities show their name, and a stamp when they were ignored
  (first card) or stopped.
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
- A Curse can no longer be played when it would have no effect (for example Mass
  Theft when no opponent holds resources), so it stays in your hand. Its Play button
  is greyed out with the reason, and target pickers only offer targets it would affect.
- The activity log now says what a theft Curse took and from whom.

## 0.7.0 — Table layout

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

- Play 12 Curses during your action phase: Resource Exchange, Petty Theft,
  Divine Foresight, Mass Theft, Extra Expedition, Construction Ban,
  Market Manipulation, Forced Conflict, Resource Purge, Military Sabotage,
  Structural Burden, Prophecy Disruption. Played Curses show in the activity log.
- Divine Foresight shows the top cards only to the player who played it.
- The 7 reactive Curses and Revival arrive with reaction windows.

## 0.3.0 — Online play

- Play online: create a game, share the link, each player claims their seat.
- Board with shop, expeditions, Calamity discard choices, attacks, rituals,
  Divine Coins and Prophecy guesses. Curses are visible but not playable yet.
- Admin page behind a shared password: edit the config, save noted changes to
  a draft, publish versions, make any version active, start a draft from any version.
- Public changelog page of config versions.
- Games and configs stored in Postgres.

## 0.2.0 — Prophecies and victory

- Automatic victory at the start of your own turn, attacks, rituals,
  Divine Coins, elimination, last player standing.

## 0.1.0 — Engine core

- Config, setup, turn flow, expeditions, all Calamities, building.
