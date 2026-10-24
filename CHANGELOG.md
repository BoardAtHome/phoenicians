# Changelog

App builds. Rule and balance changes made through the admin page are versioned
separately and shown on the in-app Changelog page.

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
