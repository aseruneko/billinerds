# Billinerds

Billinerds is a billiards-inspired stage clear game built around turn-based shots,
enemy balls, hazards, shop items, and strange table gimmicks.

Play page:
https://aseruneko.itch.io/billinerds

## Game Overview

The player controls the cue ball and clears stages by reducing enemy balls' HP to
zero. Shots are charged with the mouse, then released toward the aim direction.
After the player's shot ends, enemy balls may take special actions.

The game includes:

- Stage-based progression
- Enemy balls with HP, attack, defense, weight, and special actions
- Hazards such as poison, fog, mirrors, roulettes, and magic circles
- Shop items that modify cue ball stats, add active abilities, or change stage
  strategy
- Encyclopedia, rule, settings, credit, dialogue, shop, game over, and game
  clear scenes

## Technical Notes

This project is a Vite + Preact + TypeScript app, but most gameplay and UI are
implemented in Phaser.

- Vite handles development/build tooling.
- Preact only mounts the Phaser canvas.
- Phaser manages scenes, rendering, input, sound, UI objects, and Matter physics.
- Game data is mostly CSV-driven for balls, actions, items, rules, and UI text.
- The game uses fixed 4:3 resolution at `1024 x 768`.

Useful commands:

```sh
npm install
npm run dev
npm run typecheck
npm run build
```

## Missing Files Notice

This repository intentionally excludes generated files and large/local assets:

- `node_modules/`
- `dist/`
- `dist*.zip`
- `src/assets/`

Because `src/assets/` is ignored, a fresh clone of this repository will not run
or build as-is unless the required image, audio, and font assets are restored in
that directory.

The playable build is available on itch.io:
https://aseruneko.itch.io/billinerds
