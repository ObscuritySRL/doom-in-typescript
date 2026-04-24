# Master Checklist

- Total steps: 167
- Initial next eligible step: `00-001 pin-primary-target`
- Rule: the first unchecked step whose prerequisites are complete is the default next task.

## Phase 00: Governance

- [x] `00-001` `pin-primary-target` | prereqs: `none` | test: `d:\Projects\bun-win32\doom_codex\test\reference\target.test.ts` | verify: `bun test test/reference/target.test.ts`
- [x] `00-002` `record-reference-hashes` | prereqs: `00-001` | test: `d:\Projects\bun-win32\doom_codex\test\reference\hash-manifest.test.ts` | verify: `bun test test/reference/hash-manifest.test.ts`
- [x] `00-003` `create-source-catalog` | prereqs: `00-002` | test: `d:\Projects\bun-win32\doom_codex\test\reference\source-catalog.test.ts` | verify: `bun test test/reference/source-catalog.test.ts`
- [x] `00-004` `create-package-capability-matrix` | prereqs: `00-003` | test: `d:\Projects\bun-win32\doom_codex\test\reference\package-capability-matrix.test.ts` | verify: `bun test test/reference/package-capability-matrix.test.ts`
- [x] `00-005` `define-oracle-schemas` | prereqs: `00-004` | test: `d:\Projects\bun-win32\doom_codex\test\oracles\oracle-schema.test.ts` | verify: `bun test test/oracles/oracle-schema.test.ts`
- [x] `00-006` `lock-asset-and-license-boundaries` | prereqs: `00-005` | test: `d:\Projects\bun-win32\doom_codex\test\reference\license-boundary.test.ts` | verify: `bun test test/reference/license-boundary.test.ts`

## Phase 01: Reference Inventory

- [x] `01-001` `parse-wad-header-and-directory` | prereqs: `00-006` | test: `d:\Projects\bun-win32\doom_codex\test\wad\header-directory.test.ts` | verify: `bun test test/wad/header-directory.test.ts`
- [x] `01-002` `record-map-and-lump-inventory` | prereqs: `01-001` | test: `d:\Projects\bun-win32\doom_codex\test\reference\wad-map-summary.test.ts` | verify: `bun test test/reference/wad-map-summary.test.ts`
- [x] `01-003` `record-demo-lump-metadata` | prereqs: `01-002` | test: `d:\Projects\bun-win32\doom_codex\test\reference\demo-lump-summary.test.ts` | verify: `bun test test/reference/demo-lump-summary.test.ts`
- [x] `01-004` `record-config-variable-summary` | prereqs: `01-003` | test: `d:\Projects\bun-win32\doom_codex\test\reference\config-summary.test.ts` | verify: `bun test test/reference/config-summary.test.ts`
- [x] `01-005` `record-vanilla-limit-summary` | prereqs: `01-004` | test: `d:\Projects\bun-win32\doom_codex\test\reference\vanilla-limit-summary.test.ts` | verify: `bun test test/reference/vanilla-limit-summary.test.ts`
- [x] `01-006` `record-title-demo-sequence-reference` | prereqs: `01-005` | test: `d:\Projects\bun-win32\doom_codex\test\reference\title-sequence.test.ts` | verify: `bun test test/reference/title-sequence.test.ts`
- [x] `01-007` `record-render-and-audio-quirk-list` | prereqs: `01-006` | test: `d:\Projects\bun-win32\doom_codex\test\reference\quirk-manifest.test.ts` | verify: `bun test test/reference/quirk-manifest.test.ts`
- [x] `01-008` `define-later-compatibility-targets` | prereqs: `01-007` | test: `d:\Projects\bun-win32\doom_codex\test\reference\compatibility-targets.test.ts` | verify: `bun test test/reference/compatibility-targets.test.ts`

## Phase 02: Oracle Foundation

- [x] `02-001` `define-reference-sandbox-copy-policy` | prereqs: `01-008` | test: `d:\Projects\bun-win32\doom_codex\test\oracles\reference-sandbox-policy.test.ts` | verify: `bun test test/oracles/reference-sandbox-policy.test.ts`
- [x] `02-002` `define-reference-run-manifest` | prereqs: `02-001` | test: `d:\Projects\bun-win32\doom_codex\test\oracles\reference-run-manifest.test.ts` | verify: `bun test test/oracles/reference-run-manifest.test.ts`
- [x] `02-003` `define-input-script-format` | prereqs: `02-002` | test: `d:\Projects\bun-win32\doom_codex\test\oracles\input-script-format.test.ts` | verify: `bun test test/oracles/input-script-format.test.ts`
- [x] `02-004` `define-state-hash-format` | prereqs: `02-003` | test: `d:\Projects\bun-win32\doom_codex\test\oracles\state-hash-format.test.ts` | verify: `bun test test/oracles/state-hash-format.test.ts`
- [x] `02-005` `define-framebuffer-hash-format` | prereqs: `02-004` | test: `d:\Projects\bun-win32\doom_codex\test\oracles\framebuffer-hash-format.test.ts` | verify: `bun test test/oracles/framebuffer-hash-format.test.ts`
- [x] `02-006` `define-audio-hash-format` | prereqs: `02-005` | test: `d:\Projects\bun-win32\doom_codex\test\oracles\audio-hash-format.test.ts` | verify: `bun test test/oracles/audio-hash-format.test.ts`
- [x] `02-007` `define-music-event-log-format` | prereqs: `02-006` | test: `d:\Projects\bun-win32\doom_codex\test\oracles\music-event-log-format.test.ts` | verify: `bun test test/oracles/music-event-log-format.test.ts`
- [x] `02-008` `prove-window-capture-feasibility` | prereqs: `02-007` | test: `d:\Projects\bun-win32\doom_codex\test\oracles\window-capture-feasibility.test.ts` | verify: `bun test test/oracles/window-capture-feasibility.test.ts`
- [x] `02-009` `prove-reference-run-isolation` | prereqs: `02-008` | test: `d:\Projects\bun-win32\doom_codex\test\oracles\reference-run-isolation.test.ts` | verify: `bun test test/oracles/reference-run-isolation.test.ts`
- [x] `02-010` `define-manual-a-b-gates` | prereqs: `02-009` | test: `d:\Projects\bun-win32\doom_codex\test\oracles\manual-gates.test.ts` | verify: `bun test test/oracles/manual-gates.test.ts`

## Phase 03: Scaffold And Test Harness

- [x] `03-001` `scaffold-doom-codex-package` | prereqs: `02-010` | test: `d:\Projects\bun-win32\doom_codex\test\scaffold\package.test.ts` | verify: `bun test test/scaffold/package.test.ts`
- [x] `03-002` `scaffold-test-layout` | prereqs: `03-001` | test: `d:\Projects\bun-win32\doom_codex\test\scaffold\test-layout.test.ts` | verify: `bun test test/scaffold/test-layout.test.ts`
- [x] `03-003` `add-golden-file-loader` | prereqs: `03-002` | test: `d:\Projects\bun-win32\doom_codex\test\_harness\golden-loader.test.ts` | verify: `bun test test/_harness/golden-loader.test.ts`
- [x] `03-004` `add-temp-sandbox-helper` | prereqs: `03-003` | test: `d:\Projects\bun-win32\doom_codex\test\_harness\temp-sandbox.test.ts` | verify: `bun test test/_harness/temp-sandbox.test.ts`
- [x] `03-005` `add-binary-buffer-assertions` | prereqs: `03-004` | test: `d:\Projects\bun-win32\doom_codex\test\_harness\binary-assert.test.ts` | verify: `bun test test/_harness/binary-assert.test.ts`
- [x] `03-006` `add-cli-smoke-harness` | prereqs: `03-005` | test: `d:\Projects\bun-win32\doom_codex\test\scaffold\cli-smoke.test.ts` | verify: `bun test test/scaffold/cli-smoke.test.ts`
- [x] `03-007` `add-deterministic-time-freeze-harness` | prereqs: `03-006` | test: `d:\Projects\bun-win32\doom_codex\test\_harness\determinism.test.ts` | verify: `bun test test/_harness/determinism.test.ts`
- [x] `03-008` `lock-verify-command-conventions` | prereqs: `03-007` | test: `d:\Projects\bun-win32\doom_codex\test\scaffold\verify-commands.test.ts` | verify: `bun test test/scaffold/verify-commands.test.ts`

## Phase 04: Core Math And Binary

- [x] `04-001` `fixed-constants-and-type` | prereqs: `03-008` | test: `d:\Projects\bun-win32\doom_codex\test\core\fixed.constants.test.ts` | verify: `bun test test/core/fixed.constants.test.ts`
- [x] `04-002` `fixed-add-sub-overflow` | prereqs: `04-001` | test: `d:\Projects\bun-win32\doom_codex\test\core\fixed.add-sub.test.ts` | verify: `bun test test/core/fixed.add-sub.test.ts`
- [x] `04-003` `fixed-multiply` | prereqs: `04-002` | test: `d:\Projects\bun-win32\doom_codex\test\core\fixed.multiply.test.ts` | verify: `bun test test/core/fixed.multiply.test.ts`
- [x] `04-004` `fixed-divide` | prereqs: `04-003` | test: `d:\Projects\bun-win32\doom_codex\test\core\fixed.divide.test.ts` | verify: `bun test test/core/fixed.divide.test.ts`
- [x] `04-005` `angle-type-and-wrap` | prereqs: `04-004` | test: `d:\Projects\bun-win32\doom_codex\test\core\angle.wrap.test.ts` | verify: `bun test test/core/angle.wrap.test.ts`
- [x] `04-006` `trig-lookups` | prereqs: `04-005` | test: `d:\Projects\bun-win32\doom_codex\test\core\trig-lookup.test.ts` | verify: `bun test test/core/trig-lookup.test.ts`
- [x] `04-007` `deterministic-rng-stream` | prereqs: `04-006` | test: `d:\Projects\bun-win32\doom_codex\test\core\rng.test.ts` | verify: `bun test test/core/rng.test.ts`
- [x] `04-008` `little-endian-binary-reader` | prereqs: `04-007` | test: `d:\Projects\bun-win32\doom_codex\test\core\binary-reader.test.ts` | verify: `bun test test/core/binary-reader.test.ts`

## Phase 05: WAD And Assets

- [x] `05-001` `lump-name-lookup` | prereqs: `04-008` | test: `d:\Projects\bun-win32\doom_codex\test\wad\lump-lookup.test.ts` | verify: `bun test test/wad/lump-lookup.test.ts`
- [x] `05-002` `marker-range-resolution` | prereqs: `05-001` | test: `d:\Projects\bun-win32\doom_codex\test\wad\marker-range.test.ts` | verify: `bun test test/wad/marker-range.test.ts`
- [x] `05-003` `playpal-parser` | prereqs: `05-002` | test: `d:\Projects\bun-win32\doom_codex\test\wad\playpal.test.ts` | verify: `bun test test/wad/playpal.test.ts`
- [x] `05-004` `colormap-parser` | prereqs: `05-003` | test: `d:\Projects\bun-win32\doom_codex\test\wad\colormap.test.ts` | verify: `bun test test/wad/colormap.test.ts`
- [x] `05-005` `pnames-parser` | prereqs: `05-004` | test: `d:\Projects\bun-win32\doom_codex\test\wad\pnames.test.ts` | verify: `bun test test/wad/pnames.test.ts`
- [x] `05-006` `texture1-parser` | prereqs: `05-005` | test: `d:\Projects\bun-win32\doom_codex\test\wad\texture1.test.ts` | verify: `bun test test/wad/texture1.test.ts`
- [x] `05-007` `flat-catalog` | prereqs: `05-006` | test: `d:\Projects\bun-win32\doom_codex\test\wad\flats.test.ts` | verify: `bun test test/wad/flats.test.ts`
- [x] `05-008` `patch-and-sprite-catalog` | prereqs: `05-007` | test: `d:\Projects\bun-win32\doom_codex\test\wad\patches-sprites.test.ts` | verify: `bun test test/wad/patches-sprites.test.ts`
- [x] `05-009` `map-lump-bundle-parser` | prereqs: `05-008` | test: `d:\Projects\bun-win32\doom_codex\test\wad\map-bundle.test.ts` | verify: `bun test test/wad/map-bundle.test.ts`
- [x] `05-010` `mus-demo-and-endoom-readers` | prereqs: `05-009` | test: `d:\Projects\bun-win32\doom_codex\test\wad\misc-assets.test.ts` | verify: `bun test test/wad/misc-assets.test.ts`

## Phase 06: Host Timing And Input

- [x] `06-001` `query-performance-counter-clock` | prereqs: `05-010` | test: `d:\Projects\bun-win32\doom_codex\test\host\clock.test.ts` | verify: `bun test test/host/clock.test.ts`
- [x] `06-002` `exact-35hz-tic-accumulator` | prereqs: `06-001` | test: `d:\Projects\bun-win32\doom_codex\test\host\tic-accumulator.test.ts` | verify: `bun test test/host/tic-accumulator.test.ts`
- [x] `06-003` `message-pump-ordering` | prereqs: `06-002` | test: `d:\Projects\bun-win32\doom_codex\test\host\message-pump.test.ts` | verify: `bun test test/host/message-pump.test.ts`
- [x] `06-004` `keyboard-scan-code-mapping` | prereqs: `06-003` | test: `d:\Projects\bun-win32\doom_codex\test\input\keyboard-mapping.test.ts` | verify: `bun test test/input/keyboard-mapping.test.ts`
- [x] `06-005` `mouse-motion-and-buttons` | prereqs: `06-004` | test: `d:\Projects\bun-win32\doom_codex\test\input\mouse-sampling.test.ts` | verify: `bun test test/input/mouse-sampling.test.ts`
- [x] `06-006` `focus-pause-and-grab-policy` | prereqs: `06-005` | test: `d:\Projects\bun-win32\doom_codex\test\input\focus-policy.test.ts` | verify: `bun test test/input/focus-policy.test.ts`
- [x] `06-007` `ticcmd-packing` | prereqs: `06-006` | test: `d:\Projects\bun-win32\doom_codex\test\input\ticcmd.test.ts` | verify: `bun test test/input/ticcmd.test.ts`
- [x] `06-008` `window-scaling-and-aspect-policy` | prereqs: `06-007` | test: `d:\Projects\bun-win32\doom_codex\test\host\window-policy.test.ts` | verify: `bun test test/host/window-policy.test.ts`

## Phase 07: Bootstrap And Main Loop

- [x] `07-001` `command-line-parser` | prereqs: `06-008` | test: `d:\Projects\bun-win32\doom_codex\test\bootstrap\cmdline.test.ts` | verify: `bun test test/bootstrap/cmdline.test.ts`
- [x] `07-002` `config-load-precedence` | prereqs: `07-001` | test: `d:\Projects\bun-win32\doom_codex\test\bootstrap\config-precedence.test.ts` | verify: `bun test test/bootstrap/config-precedence.test.ts`
- [x] `07-003` `game-mode-identification` | prereqs: `07-002` | test: `d:\Projects\bun-win32\doom_codex\test\bootstrap\game-mode.test.ts` | verify: `bun test test/bootstrap/game-mode.test.ts`
- [x] `07-004` `d-doommain-init-order` | prereqs: `07-003` | test: `d:\Projects\bun-win32\doom_codex\test\bootstrap\init-order.test.ts` | verify: `bun test test/bootstrap/init-order.test.ts`
- [x] `07-005` `title-and-demo-loop-state-machine` | prereqs: `07-004` | test: `d:\Projects\bun-win32\doom_codex\test\bootstrap\title-loop.test.ts` | verify: `bun test test/bootstrap/title-loop.test.ts`
- [x] `07-006` `try-run-tics-equivalent` | prereqs: `07-005` | test: `d:\Projects\bun-win32\doom_codex\test\bootstrap\try-run-tics.test.ts` | verify: `bun test test/bootstrap/try-run-tics.test.ts`
- [x] `07-007` `main-loop-order` | prereqs: `07-006` | test: `d:\Projects\bun-win32\doom_codex\test\bootstrap\main-loop-order.test.ts` | verify: `bun test test/bootstrap/main-loop-order.test.ts`
- [x] `07-008` `quit-and-cleanup-flow` | prereqs: `07-007` | test: `d:\Projects\bun-win32\doom_codex\test\bootstrap\quit-flow.test.ts` | verify: `bun test test/bootstrap/quit-flow.test.ts`

## Phase 08: Map Geometry And Spatial

- [x] `08-001` `things-loader` | prereqs: `07-008` | test: `d:\Projects\bun-win32\doom_codex\test\map\things-loader.test.ts` | verify: `bun test test/map/things-loader.test.ts`
- [x] `08-002` `linedefs-sidedefs-sectors-vertexes-loaders` | prereqs: `08-001` | test: `d:\Projects\bun-win32\doom_codex\test\map\struct-loaders.test.ts` | verify: `bun test test/map/struct-loaders.test.ts`
- [x] `08-003` `nodes-ssectors-segs-loaders` | prereqs: `08-002` | test: `d:\Projects\bun-win32\doom_codex\test\map\bsp-struct-loaders.test.ts` | verify: `bun test test/map/bsp-struct-loaders.test.ts`
- [x] `08-004` `blockmap-loader` | prereqs: `08-003` | test: `d:\Projects\bun-win32\doom_codex\test\map\blockmap-loader.test.ts` | verify: `bun test test/map/blockmap-loader.test.ts`
- [x] `08-005` `reject-loader` | prereqs: `08-004` | test: `d:\Projects\bun-win32\doom_codex\test\map\reject-loader.test.ts` | verify: `bun test test/map/reject-loader.test.ts`
- [x] `08-006` `point-on-side-and-node-traversal` | prereqs: `08-005` | test: `d:\Projects\bun-win32\doom_codex\test\map\node-traversal.test.ts` | verify: `bun test test/map/node-traversal.test.ts`
- [x] `08-007` `subsector-and-sector-query` | prereqs: `08-006` | test: `d:\Projects\bun-win32\doom_codex\test\map\subsector-query.test.ts` | verify: `bun test test/map/subsector-query.test.ts`
- [x] `08-008` `blockmap-iteration-order` | prereqs: `08-007` | test: `d:\Projects\bun-win32\doom_codex\test\map\blockmap-iteration.test.ts` | verify: `bun test test/map/blockmap-iteration.test.ts`
- [x] `08-009` `intercepts-and-path-traversal` | prereqs: `08-008` | test: `d:\Projects\bun-win32\doom_codex\test\map\intercepts.test.ts` | verify: `bun test test/map/intercepts.test.ts`
- [x] `08-010` `map-setup-parity` | prereqs: `08-009` | test: `d:\Projects\bun-win32\doom_codex\test\map\map-setup-parity.test.ts` | verify: `bun test test/map/map-setup-parity.test.ts`

## Phase 09: Thinkers And Physics

- [x] `09-001` `thinker-list-lifecycle` | prereqs: `08-010` | test: `d:\Projects\bun-win32\doom_codex\test\world\thinker-list.test.ts` | verify: `bun test test/world/thinker-list.test.ts`
- [x] `09-002` `mobj-spawn-and-state-tables` | prereqs: `09-001` | test: `d:\Projects\bun-win32\doom_codex\test\world\mobj-spawn.test.ts` | verify: `bun test test/world/mobj-spawn.test.ts`
- [x] `09-003` `check-position` | prereqs: `09-002` | test: `d:\Projects\bun-win32\doom_codex\test\world\check-position.test.ts` | verify: `bun test test/world/check-position.test.ts`
- [x] `09-004` `try-move` | prereqs: `09-003` | test: `d:\Projects\bun-win32\doom_codex\test\world\try-move.test.ts` | verify: `bun test test/world/try-move.test.ts`
- [x] `09-005` `xy-movement` | prereqs: `09-004` | test: `d:\Projects\bun-win32\doom_codex\test\world\xy-movement.test.ts` | verify: `bun test test/world/xy-movement.test.ts`
- [x] `09-006` `z-movement` | prereqs: `09-005` | test: `d:\Projects\bun-win32\doom_codex\test\world\z-movement.test.ts` | verify: `bun test test/world/z-movement.test.ts`
- [x] `09-007` `slide-move` | prereqs: `09-006` | test: `d:\Projects\bun-win32\doom_codex\test\world\slide-move.test.ts` | verify: `bun test test/world/slide-move.test.ts`
- [x] `09-008` `sector-change-and-crush` | prereqs: `09-007` | test: `d:\Projects\bun-win32\doom_codex\test\world\sector-change.test.ts` | verify: `bun test test/world/sector-change.test.ts`
- [x] `09-009` `radius-attack-and-damage-spread` | prereqs: `09-008` | test: `d:\Projects\bun-win32\doom_codex\test\world\radius-attack.test.ts` | verify: `bun test test/world/radius-attack.test.ts`
- [x] `09-010` `use-lines-and-spechit-quirk` | prereqs: `09-009` | test: `d:\Projects\bun-win32\doom_codex\test\world\use-lines.test.ts` | verify: `bun test test/world/use-lines.test.ts`
- [x] `09-011` `teleport-and-mapthing-special-cases` | prereqs: `09-010` | test: `d:\Projects\bun-win32\doom_codex\test\world\teleport-spawn.test.ts` | verify: `bun test test/world/teleport-spawn.test.ts`

## Phase 10: Player, Weapons, Items

- [x] `10-001` `player-spawn-and-reset` | prereqs: `09-011` | test: `d:\Projects\bun-win32\doom_codex\test\player\player-spawn.test.ts` | verify: `bun test test/player/player-spawn.test.ts`
- [x] `10-002` `movement-bob-thrust-viewheight` | prereqs: `10-001` | test: `d:\Projects\bun-win32\doom_codex\test\player\movement-bob.test.ts` | verify: `bun test test/player/movement-bob.test.ts`
- [x] `10-003` `ammo-and-weapon-ownership` | prereqs: `10-002` | test: `d:\Projects\bun-win32\doom_codex\test\player\weapon-ownership.test.ts` | verify: `bun test test/player/weapon-ownership.test.ts`
- [x] `10-004` `weapon-state-machine` | prereqs: `10-003` | test: `d:\Projects\bun-win32\doom_codex\test\player\weapon-states.test.ts` | verify: `bun test test/player/weapon-states.test.ts`
- [x] `10-005` `hitscan-weapons` | prereqs: `10-004` | test: `d:\Projects\bun-win32\doom_codex\test\player\hitscan.test.ts` | verify: `bun test test/player/hitscan.test.ts`
- [x] `10-006` `projectile-weapons` | prereqs: `10-005` | test: `d:\Projects\bun-win32\doom_codex\test\player\projectiles.test.ts` | verify: `bun test test/player/projectiles.test.ts`
- [x] `10-007` `item-pickups` | prereqs: `10-006` | test: `d:\Projects\bun-win32\doom_codex\test\player\pickups.test.ts` | verify: `bun test test/player/pickups.test.ts`
- [x] `10-008` `powerup-timers-and-palette-effects` | prereqs: `10-007` | test: `d:\Projects\bun-win32\doom_codex\test\player\powerups.test.ts` | verify: `bun test test/player/powerups.test.ts`

## Phase 11: AI And Monsters

- [x] `11-001` `recursive-sound-propagation` | prereqs: `10-008` | test: `d:\Projects\bun-win32\doom_codex\test\ai\sound-propagation.test.ts` | verify: `bun test test/ai/sound-propagation.test.ts`
- [x] `11-002` `target-acquisition-and-sight` | prereqs: `11-001` | test: `d:\Projects\bun-win32\doom_codex\test\ai\target-acquisition.test.ts` | verify: `bun test test/ai/target-acquisition.test.ts`
- [x] `11-003` `chase-state-machine` | prereqs: `11-002` | test: `d:\Projects\bun-win32\doom_codex\test\ai\chase.test.ts` | verify: `bun test test/ai/chase.test.ts`
- [x] `11-004` `melee-range-checks` | prereqs: `11-003` | test: `d:\Projects\bun-win32\doom_codex\test\ai\melee-range.test.ts` | verify: `bun test test/ai/melee-range.test.ts`
- [x] `11-005` `missile-range-checks` | prereqs: `11-004` | test: `d:\Projects\bun-win32\doom_codex\test\ai\missile-range.test.ts` | verify: `bun test test/ai/missile-range.test.ts`
- [x] `11-006` `monster-attack-actions` | prereqs: `11-005` | test: `d:\Projects\bun-win32\doom_codex\test\ai\monster-attacks.test.ts` | verify: `bun test test/ai/monster-attacks.test.ts`
- [x] `11-007` `pain-death-raise-explode` | prereqs: `11-006` | test: `d:\Projects\bun-win32\doom_codex\test\ai\state-transitions.test.ts` | verify: `bun test test/ai/state-transitions.test.ts`
- [x] `11-008` `boss-and-death-special-cases` | prereqs: `11-007` | test: `d:\Projects\bun-win32\doom_codex\test\ai\boss-specials.test.ts` | verify: `bun test test/ai/boss-specials.test.ts`

## Phase 12: Specials And World Events

- [x] `12-001` `animated-textures-and-flats` | prereqs: `11-008` | test: `d:\Projects\bun-win32\doom_codex\test\specials\animations.test.ts` | verify: `bun test test/specials/animations.test.ts`
- [x] `12-002` `door-specials` | prereqs: `12-001` | test: `d:\Projects\bun-win32\doom_codex\test\specials\doors.test.ts` | verify: `bun test test/specials/doors.test.ts`
- [x] `12-003` `lift-and-platform-specials` | prereqs: `12-002` | test: `d:\Projects\bun-win32\doom_codex\test\specials\platforms.test.ts` | verify: `bun test test/specials/platforms.test.ts`
- [x] `12-004` `floor-movers` | prereqs: `12-003` | test: `d:\Projects\bun-win32\doom_codex\test\specials\floors.test.ts` | verify: `bun test test/specials/floors.test.ts`
- [x] `12-005` `ceiling-movers-and-crushers` | prereqs: `12-004` | test: `d:\Projects\bun-win32\doom_codex\test\specials\ceilings.test.ts` | verify: `bun test test/specials/ceilings.test.ts`
- [x] `12-006` `stairs-and-donut` | prereqs: `12-005` | test: `d:\Projects\bun-win32\doom_codex\test\specials\stairs-donut.test.ts` | verify: `bun test test/specials/stairs-donut.test.ts`
- [x] `12-007` `switches-and-buttons` | prereqs: `12-006` | test: `d:\Projects\bun-win32\doom_codex\test\specials\switches.test.ts` | verify: `bun test test/specials/switches.test.ts`
- [x] `12-008` `damage-secret-exit-sectors` | prereqs: `12-007` | test: `d:\Projects\bun-win32\doom_codex\test\specials\sector-specials.test.ts` | verify: `bun test test/specials/sector-specials.test.ts`
- [x] `12-009` `line-trigger-retrigger-semantics` | prereqs: `12-008` | test: `d:\Projects\bun-win32\doom_codex\test\specials\line-triggers.test.ts` | verify: `bun test test/specials/line-triggers.test.ts`
- [x] `12-010` `active-special-save-hooks` | prereqs: `12-009` | test: `d:\Projects\bun-win32\doom_codex\test\specials\active-specials.test.ts` | verify: `bun test test/specials/active-specials.test.ts`

## Phase 13: Renderer World

- [x] `13-001` `projection-and-detail-constants` | prereqs: `12-010` | test: `d:\Projects\bun-win32\doom_codex\test\render\projection-constants.test.ts` | verify: `bun test test/render/projection-constants.test.ts`
- [x] `13-002` `visplane-openings-and-clip-limits` | prereqs: `13-001` | test: `d:\Projects\bun-win32\doom_codex\test\render\render-limits.test.ts` | verify: `bun test test/render/render-limits.test.ts`
- [x] `13-003` `column-and-span-drawers` | prereqs: `13-002` | test: `d:\Projects\bun-win32\doom_codex\test\render\column-span-draw.test.ts` | verify: `bun test test/render/column-span-draw.test.ts`
- [x] `13-004` `patch-decode-and-draw` | prereqs: `13-003` | test: `d:\Projects\bun-win32\doom_codex\test\render\patch-draw.test.ts` | verify: `bun test test/render/patch-draw.test.ts`
- [x] `13-005` `wall-column-fetch` | prereqs: `13-004` | test: `d:\Projects\bun-win32\doom_codex\test\render\wall-column-fetch.test.ts` | verify: `bun test test/render/wall-column-fetch.test.ts`
- [x] `13-006` `solid-wall-path` | prereqs: `13-005` | test: `d:\Projects\bun-win32\doom_codex\test\render\solid-walls.test.ts` | verify: `bun test test/render/solid-walls.test.ts`
- [x] `13-007` `two-sided-wall-path` | prereqs: `13-006` | test: `d:\Projects\bun-win32\doom_codex\test\render\two-sided-walls.test.ts` | verify: `bun test test/render/two-sided-walls.test.ts`
- [x] `13-008` `visplane-build` | prereqs: `13-007` | test: `d:\Projects\bun-win32\doom_codex\test\render\visplane-build.test.ts` | verify: `bun test test/render/visplane-build.test.ts`
- [x] `13-009` `visplane-span-render` | prereqs: `13-008` | test: `d:\Projects\bun-win32\doom_codex\test\render\visplane-span-render.test.ts` | verify: `bun test test/render/visplane-span-render.test.ts`
- [x] `13-010` `sky-semantics` | prereqs: `13-009` | test: `d:\Projects\bun-win32\doom_codex\test\render\sky.test.ts` | verify: `bun test test/render/sky.test.ts`
- [x] `13-011` `sprite-projection` | prereqs: `13-010` | test: `d:\Projects\bun-win32\doom_codex\test\render\sprite-projection.test.ts` | verify: `bun test test/render/sprite-projection.test.ts`
- [x] `13-012` `sprite-sort-and-clip` | prereqs: `13-011` | test: `d:\Projects\bun-win32\doom_codex\test\render\sprite-sort-clip.test.ts` | verify: `bun test test/render/sprite-sort-clip.test.ts`
- [x] `13-013` `masked-midtextures` | prereqs: `13-012` | test: `d:\Projects\bun-win32\doom_codex\test\render\masked-midtextures.test.ts` | verify: `bun test test/render/masked-midtextures.test.ts`
- [x] `13-014` `fuzz-and-invisibility` | prereqs: `13-013` | test: `d:\Projects\bun-win32\doom_codex\test\render\fuzz.test.ts` | verify: `bun test test/render/fuzz.test.ts`

## Phase 14: UI And Front-End Flow

- [x] `14-001` `ui-font-and-patch-assets` | prereqs: `13-014` | test: `d:\Projects\bun-win32\doom_codex\test\ui\ui-assets.test.ts` | verify: `bun test test/ui/ui-assets.test.ts`
- [x] `14-002` `status-bar-widgets-and-face` | prereqs: `14-001` | test: `d:\Projects\bun-win32\doom_codex\test\ui\status-bar.test.ts` | verify: `bun test test/ui/status-bar.test.ts`
- [x] `14-003` `hud-messages` | prereqs: `14-002` | test: `d:\Projects\bun-win32\doom_codex\test\ui\hud-messages.test.ts` | verify: `bun test test/ui/hud-messages.test.ts`
- [x] `14-004` `automap` | prereqs: `14-003` | test: `d:\Projects\bun-win32\doom_codex\test\ui\automap.test.ts` | verify: `bun test test/ui/automap.test.ts`
- [x] `14-005` `menu-tree-and-repeat-timing` | prereqs: `14-004` | test: `d:\Projects\bun-win32\doom_codex\test\ui\menus.test.ts` | verify: `bun test test/ui/menus.test.ts`
- [x] `14-006` `intermission-stats` | prereqs: `14-005` | test: `d:\Projects\bun-win32\doom_codex\test\ui\intermission.test.ts` | verify: `bun test test/ui/intermission.test.ts`
- [x] `14-007` `finale-text-and-screens` | prereqs: `14-006` | test: `d:\Projects\bun-win32\doom_codex\test\ui\finale.test.ts` | verify: `bun test test/ui/finale.test.ts`
- [x] `14-008` `title-credit-help-demo-sequencing` | prereqs: `14-007` | test: `d:\Projects\bun-win32\doom_codex\test\ui\front-end-sequence.test.ts` | verify: `bun test test/ui/front-end-sequence.test.ts`

## Phase 15: Audio And Music

- [x] `15-001` `sfx-lump-loader` | prereqs: `14-008` | test: `d:\Projects\bun-win32\doom_codex\test\audio\sfx-loader.test.ts` | verify: `bun test test/audio/sfx-loader.test.ts`
- [x] `15-002` `eight-channel-allocator` | prereqs: `15-001` | test: `d:\Projects\bun-win32\doom_codex\test\audio\channel-allocation.test.ts` | verify: `bun test test/audio/channel-allocation.test.ts`
- [x] `15-003` `attenuation-and-stereo-separation` | prereqs: `15-002` | test: `d:\Projects\bun-win32\doom_codex\test\audio\attenuation.test.ts` | verify: `bun test test/audio/attenuation.test.ts`
- [x] `15-004` `sound-origin-updates` | prereqs: `15-003` | test: `d:\Projects\bun-win32\doom_codex\test\audio\sound-origins.test.ts` | verify: `bun test test/audio/sound-origins.test.ts`
- [x] `15-005` `sound-start-stop-update-order` | prereqs: `15-004` | test: `d:\Projects\bun-win32\doom_codex\test\audio\sound-order.test.ts` | verify: `bun test test/audio/sound-order.test.ts`
- [x] `15-006` `pcm-mixer-clipping-and-stepping` | prereqs: `15-005` | test: `d:\Projects\bun-win32\doom_codex\test\audio\pcm-mixer.test.ts` | verify: `bun test test/audio/pcm-mixer.test.ts`
- [x] `15-007` `mus-parser` | prereqs: `15-006` | test: `d:\Projects\bun-win32\doom_codex\test\audio\mus-parser.test.ts` | verify: `bun test test/audio/mus-parser.test.ts`
- [x] `15-008` `mus-event-scheduler` | prereqs: `15-007` | test: `d:\Projects\bun-win32\doom_codex\test\audio\mus-scheduler.test.ts` | verify: `bun test test/audio/mus-scheduler.test.ts`
- [x] `15-009` `opl-register-model` | prereqs: `15-008` | test: `d:\Projects\bun-win32\doom_codex\test\audio\opl-registers.test.ts` | verify: `bun test test/audio/opl-registers.test.ts`
- [x] `15-010` `opl-synthesis-core` | prereqs: `15-009` | test: `d:\Projects\bun-win32\doom_codex\test\audio\opl-synth.test.ts` | verify: `bun test test/audio/opl-synth.test.ts`
- [x] `15-011` `music-device-integration` | prereqs: `15-010` | test: `d:\Projects\bun-win32\doom_codex\test\audio\music-system.test.ts` | verify: `bun test test/audio/music-system.test.ts`
- [x] `15-012` `audio-parity-harness` | prereqs: `15-011` | test: `d:\Projects\bun-win32\doom_codex\test\audio\audio-parity.test.ts` | verify: `bun test test/audio/audio-parity.test.ts`

## Phase 16: Save, Config, Demo

- [x] `16-001` `default-cfg-parser` | prereqs: `15-012` | test: `d:\Projects\bun-win32\doom_codex\test\config\default-cfg-parse.test.ts` | verify: `bun test test/config/default-cfg-parse.test.ts`
- [x] `16-002` `host-extra-config-split` | prereqs: `16-001` | test: `d:\Projects\bun-win32\doom_codex\test\config\host-config.test.ts` | verify: `bun test test/config/host-config.test.ts`
- [x] `16-003` `demo-parser` | prereqs: `16-002` | test: `d:\Projects\bun-win32\doom_codex\test\demo\demo-parse.test.ts` | verify: `bun test test/demo/demo-parse.test.ts`
- [x] `16-004` `demo-recorder` | prereqs: `16-003` | test: `d:\Projects\bun-win32\doom_codex\test\demo\demo-record.test.ts` | verify: `bun test test/demo/demo-record.test.ts`
- [x] `16-005` `demo-playback` | prereqs: `16-004` | test: `d:\Projects\bun-win32\doom_codex\test\demo\demo-playback.test.ts` | verify: `bun test test/demo/demo-playback.test.ts`
- [x] `16-006` `savegame-header-and-versioning` | prereqs: `16-005` | test: `d:\Projects\bun-win32\doom_codex\test\save\save-header.test.ts` | verify: `bun test test/save/save-header.test.ts`
- [x] `16-007` `player-mobj-sector-serialization` | prereqs: `16-006` | test: `d:\Projects\bun-win32\doom_codex\test\save\core-serialization.test.ts` | verify: `bun test test/save/core-serialization.test.ts`
- [x] `16-008` `special-thinker-serialization` | prereqs: `16-007` | test: `d:\Projects\bun-win32\doom_codex\test\save\special-serialization.test.ts` | verify: `bun test test/save/special-serialization.test.ts`
- [x] `16-009` `loadgame-restore` | prereqs: `16-008` | test: `d:\Projects\bun-win32\doom_codex\test\save\loadgame.test.ts` | verify: `bun test test/save/loadgame.test.ts`
- [x] `16-010` `vanilla-limit-enforcement` | prereqs: `16-009` | test: `d:\Projects\bun-win32\doom_codex\test\save\vanilla-limits.test.ts` | verify: `bun test test/save/vanilla-limits.test.ts`

## Phase 17: Parity And Acceptance

- [x] `17-001` `level-start-state-hashes` | prereqs: `16-010` | test: `d:\Projects\bun-win32\doom_codex\test\parity\level-start-state-hash.test.ts` | verify: `bun test test/parity/level-start-state-hash.test.ts`
- [x] `17-002` `bundled-demo-sync` | prereqs: `17-001` | test: `d:\Projects\bun-win32\doom_codex\test\parity\bundled-demo-sync.test.ts` | verify: `bun test test/parity/bundled-demo-sync.test.ts`
- [x] `17-003` `scripted-input-core-mechanics` | prereqs: `17-002` | test: `d:\Projects\bun-win32\doom_codex\test\parity\scripted-mechanics.test.ts` | verify: `bun test test/parity/scripted-mechanics.test.ts`
- [x] `17-004` `framebuffer-crc-suite` | prereqs: `17-003` | test: `d:\Projects\bun-win32\doom_codex\test\parity\framebuffer-crc.test.ts` | verify: `bun test test/parity/framebuffer-crc.test.ts`
- [x] `17-005` `menu-and-ui-timing-suite` | prereqs: `17-004` | test: `d:\Projects\bun-win32\doom_codex\test\parity\menu-timing.test.ts` | verify: `bun test test/parity/menu-timing.test.ts`
- [x] `17-006` `sound-and-music-suite` | prereqs: `17-005` | test: `d:\Projects\bun-win32\doom_codex\test\parity\audio-suite.test.ts` | verify: `bun test test/parity/audio-suite.test.ts`
- [x] `17-007` `save-load-roundtrip-suite` | prereqs: `17-006` | test: `d:\Projects\bun-win32\doom_codex\test\parity\save-load-roundtrip.test.ts` | verify: `bun test test/parity/save-load-roundtrip.test.ts`
- [x] `17-008` `vanilla-quirk-regression-suite` | prereqs: `17-007` | test: `d:\Projects\bun-win32\doom_codex\test\parity\quirk-regressions.test.ts` | verify: `bun test test/parity/quirk-regressions.test.ts`
- [x] `17-009` `full-shareware-e1-acceptance` | prereqs: `17-008` | test: `d:\Projects\bun-win32\doom_codex\test\parity\full-e1-acceptance.test.ts` | verify: `bun test test/parity/full-e1-acceptance.test.ts`
- [x] `17-010` `side-by-side-final-gate-and-c2-open` | prereqs: `17-009` | test: `d:\Projects\bun-win32\doom_codex\test\parity\final-gate.test.ts` | verify: `bun test test/parity/final-gate.test.ts`
