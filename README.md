# Arena Clash

A lightweight top-down arena action game. Vanilla JS (ES modules) + Canvas 2D, no build step, no assets.

## Run
Modules need an HTTP server (not `file://`):

```
npm start          # or: python3 -m http.server 8000
```
then open http://localhost:8000.

## Controls
| Action | Input |
|---|---|
| Move | WASD / arrows |
| Aim | Mouse |
| Attack | Hold left click (J = keyboard auto-aim) |
| Ability | Space / right click / E / on-screen button |
| Day ↔ Night | N / top-right button |
| Pause / Mute | Esc or P / M |
| Level-up pick | click or 1-3 |

## Content
- **Heroes (5):** Knight, Ranger, Mage, Rogue, Cleric — each with a unique attack + ability.
- **Enemies (5):** Grunt, Archer, Wraith (ignores walls), Bomber (fuse + blast), Brute (telegraphed charge).
- **Maps (3):** Sunlit Meadow, Sandstone Ruins, Ember Caverns (lava hazards).
- **Modes (2):** Survival (endless waves), Hunt (defeat 40 to win).
- **Day/Night:** auto-cycles; day = health regen, night = tougher enemies but +50% XP and limited vision.
- **XP:** enemies drop orbs; each level-up offers 3 of 7 upgrades.

## Extending (all data-driven)
| To add… | Edit |
|---|---|
| Hero | `js/data/characters.js` (+ ability in `js/data/abilities.js`) |
| Enemy | `js/data/enemies.js` (+ behaviour in `js/systems/ai.js` if new `ai` key) |
| Map | `js/data/maps.js` |
| Ability | `js/data/abilities.js` |
| Upgrade | `js/data/upgrades.js` |
| Game mode | `js/data/modes.js` |

## Layout
`core/` input, camera, audio, utils · `data/` content definitions · `entities/` entity class · `systems/` combat, ai, movement, day/night, progression, effects · `render/` canvas drawing · `ui/` DOM menus & HUD · `game.js` world state + loop.
