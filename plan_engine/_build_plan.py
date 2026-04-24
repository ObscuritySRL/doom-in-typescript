from __future__ import annotations

import hashlib
import json
import re
import struct
from pathlib import Path

ROOT = Path(r'd:\Projects\bun-win32\doom_codex\plans')
DOOM_CODEX_ROOT = ROOT.parent
REPO_ROOT = DOOM_CODEX_ROOT.parent
UNIVERSAL_DOOM_ROOT = REPO_ROOT / 'doom' / 'universal-doom'
PACKAGES_ROOT = REPO_ROOT / 'packages'
TODAY = '2026-04-11'

PHASE_READ_ONLY = {
    '00-governance': [str(ROOT / 'README.md'), str(ROOT / 'FACT_LOG.md'), str(UNIVERSAL_DOOM_ROOT / 'README.md'), str(UNIVERSAL_DOOM_ROOT / 'stdout.txt')],
    '01-reference-inventory': [str(ROOT / 'FACT_LOG.md'), str(ROOT / 'SOURCE_CATALOG.md'), str(UNIVERSAL_DOOM_ROOT / 'DOOM1.WAD'), str(UNIVERSAL_DOOM_ROOT / 'default.cfg')],
    '02-oracle-foundation': [str(ROOT / 'FACT_LOG.md'), str(ROOT / 'REFERENCE_ORACLES.md'), str(UNIVERSAL_DOOM_ROOT / 'DOOM.EXE'), str(UNIVERSAL_DOOM_ROOT / 'chocolate-doom.cfg')],
    '03-scaffold-and-test-harness': [str(ROOT / 'README.md'), str(ROOT / 'PACKAGE_CAPABILITY_MATRIX.md'), str(PACKAGES_ROOT / 'core' / 'README.md'), str(PACKAGES_ROOT / 'user32' / 'AI.md')],
    '04-core-math-and-binary': [str(ROOT / 'FACT_LOG.md'), 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/doomdef.h', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/m_fixed.c', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/tables.c'],
    '05-wad-and-assets': [str(ROOT / 'FACT_LOG.md'), str(ROOT / 'manifests' / 'wad-directory-summary.json'), str(UNIVERSAL_DOOM_ROOT / 'DOOM1.WAD'), 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/r_data.c'],
    '06-host-timing-and-input': [str(ROOT / 'FACT_LOG.md'), str(ROOT / 'PACKAGE_CAPABILITY_MATRIX.md'), str(PACKAGES_ROOT / 'kernel32' / 'AI.md'), str(PACKAGES_ROOT / 'user32' / 'AI.md')],
    '07-bootstrap-and-main-loop': [str(ROOT / 'FACT_LOG.md'), str(ROOT / 'REFERENCE_ORACLES.md'), str(UNIVERSAL_DOOM_ROOT / 'stdout.txt'), 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/d_main.c'],
    '08-map-geometry-and-spatial': [str(ROOT / 'FACT_LOG.md'), str(UNIVERSAL_DOOM_ROOT / 'DOOM1.WAD'), 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/p_map.c', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/r_bsp.c'],
    '09-thinkers-and-physics': [str(ROOT / 'FACT_LOG.md'), str(UNIVERSAL_DOOM_ROOT / 'DOOM1.WAD'), 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/p_map.c', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/p_mobj.c'],
    '10-player-weapons-items': [str(ROOT / 'FACT_LOG.md'), str(UNIVERSAL_DOOM_ROOT / 'default.cfg'), 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/g_game.c', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/p_pspr.c'],
    '11-ai-and-monsters': [str(ROOT / 'FACT_LOG.md'), str(UNIVERSAL_DOOM_ROOT / 'DOOM1.WAD'), 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/p_enemy.c', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/p_map.c'],
    '12-specials-and-world-events': [str(ROOT / 'FACT_LOG.md'), str(UNIVERSAL_DOOM_ROOT / 'DOOM1.WAD'), 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/p_spec.c', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/p_map.c'],
    '13-renderer-world': [str(ROOT / 'FACT_LOG.md'), str(UNIVERSAL_DOOM_ROOT / 'DOOM1.WAD'), 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/r_bsp.c', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/r_plane.c'],
    '14-ui-and-front-end-flow': [str(ROOT / 'FACT_LOG.md'), str(UNIVERSAL_DOOM_ROOT / 'DOOM1.WAD'), 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/m_menu.c', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/st_stuff.c'],
    '15-audio-and-music': [str(ROOT / 'FACT_LOG.md'), str(UNIVERSAL_DOOM_ROOT / 'DOOM1.WAD'), 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/s_sound.c', str(PACKAGES_ROOT / 'winmm' / 'AI.md')],
    '16-save-config-demo': [str(ROOT / 'FACT_LOG.md'), str(UNIVERSAL_DOOM_ROOT / 'default.cfg'), 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/g_game.c', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/p_saveg.c'],
    '17-parity-and-acceptance': [str(ROOT / 'FACT_LOG.md'), str(ROOT / 'REFERENCE_ORACLES.md'), str(UNIVERSAL_DOOM_ROOT / 'DOOM.EXE'), str(UNIVERSAL_DOOM_ROOT / 'DOOMD.EXE')],
}

PHASE_NAMES = {
    '00-governance': 'Phase 00: Governance',
    '01-reference-inventory': 'Phase 01: Reference Inventory',
    '02-oracle-foundation': 'Phase 02: Oracle Foundation',
    '03-scaffold-and-test-harness': 'Phase 03: Scaffold And Test Harness',
    '04-core-math-and-binary': 'Phase 04: Core Math And Binary',
    '05-wad-and-assets': 'Phase 05: WAD And Assets',
    '06-host-timing-and-input': 'Phase 06: Host Timing And Input',
    '07-bootstrap-and-main-loop': 'Phase 07: Bootstrap And Main Loop',
    '08-map-geometry-and-spatial': 'Phase 08: Map Geometry And Spatial',
    '09-thinkers-and-physics': 'Phase 09: Thinkers And Physics',
    '10-player-weapons-items': 'Phase 10: Player, Weapons, Items',
    '11-ai-and-monsters': 'Phase 11: AI And Monsters',
    '12-specials-and-world-events': 'Phase 12: Specials And World Events',
    '13-renderer-world': 'Phase 13: Renderer World',
    '14-ui-and-front-end-flow': 'Phase 14: UI And Front-End Flow',
    '15-audio-and-music': 'Phase 15: Audio And Music',
    '16-save-config-demo': 'Phase 16: Save, Config, Demo',
    '17-parity-and-acceptance': 'Phase 17: Parity And Acceptance',
}

STEP_DATA_LINES = []
SOURCE_CATALOG = []
DECISIONS = []
FACTS = []
REFERENCE_ORACLES = []
PACKAGE_OVERRIDES = {}
VANILLA_LIMITS = []
ORACLE_SCHEMAS = {}
STEP_DATA_LINES += '''
00-governance|00-001|pin-primary-target|test/reference/target.test.ts|src/reference/target.ts
00-governance|00-002|record-reference-hashes|test/reference/hash-manifest.test.ts|reference/manifests/file-hashes.json
00-governance|00-003|create-source-catalog|test/reference/source-catalog.test.ts|reference/manifests/source-catalog.json
00-governance|00-004|create-package-capability-matrix|test/reference/package-capability-matrix.test.ts|reference/manifests/package-capability-matrix.json
00-governance|00-005|define-oracle-schemas|test/oracles/oracle-schema.test.ts|src/oracles/schema.ts
00-governance|00-006|lock-asset-and-license-boundaries|test/reference/license-boundary.test.ts|src/reference/policy.ts
01-reference-inventory|01-001|parse-wad-header-and-directory|test/wad/header-directory.test.ts|src/wad/header.ts;src/wad/directory.ts
01-reference-inventory|01-002|record-map-and-lump-inventory|test/reference/wad-map-summary.test.ts|reference/manifests/wad-map-summary.json
01-reference-inventory|01-003|record-demo-lump-metadata|test/reference/demo-lump-summary.test.ts|reference/manifests/demo-lump-summary.json
01-reference-inventory|01-004|record-config-variable-summary|test/reference/config-summary.test.ts|reference/manifests/config-variable-summary.json
01-reference-inventory|01-005|record-vanilla-limit-summary|test/reference/vanilla-limit-summary.test.ts|reference/manifests/vanilla-limit-summary.json
01-reference-inventory|01-006|record-title-demo-sequence-reference|test/reference/title-sequence.test.ts|reference/manifests/title-sequence.json
01-reference-inventory|01-007|record-render-and-audio-quirk-list|test/reference/quirk-manifest.test.ts|reference/manifests/quirk-manifest.json
01-reference-inventory|01-008|define-later-compatibility-targets|test/reference/compatibility-targets.test.ts|reference/manifests/compatibility-targets.json
02-oracle-foundation|02-001|define-reference-sandbox-copy-policy|test/oracles/reference-sandbox-policy.test.ts|src/oracles/referenceSandbox.ts
02-oracle-foundation|02-002|define-reference-run-manifest|test/oracles/reference-run-manifest.test.ts|src/oracles/referenceRunManifest.ts
02-oracle-foundation|02-003|define-input-script-format|test/oracles/input-script-format.test.ts|src/oracles/inputScript.ts
02-oracle-foundation|02-004|define-state-hash-format|test/oracles/state-hash-format.test.ts|src/oracles/stateHash.ts
02-oracle-foundation|02-005|define-framebuffer-hash-format|test/oracles/framebuffer-hash-format.test.ts|src/oracles/framebufferHash.ts
02-oracle-foundation|02-006|define-audio-hash-format|test/oracles/audio-hash-format.test.ts|src/oracles/audioHash.ts
02-oracle-foundation|02-007|define-music-event-log-format|test/oracles/music-event-log-format.test.ts|src/oracles/musicEventLog.ts
02-oracle-foundation|02-008|prove-window-capture-feasibility|test/oracles/window-capture-feasibility.test.ts|tools/reference/windowCaptureProbe.ts
02-oracle-foundation|02-009|prove-reference-run-isolation|test/oracles/reference-run-isolation.test.ts|tools/reference/isolationProbe.ts
02-oracle-foundation|02-010|define-manual-a-b-gates|test/oracles/manual-gates.test.ts|src/oracles/manualGatePolicy.ts
03-scaffold-and-test-harness|03-001|scaffold-doom-codex-package|test/scaffold/package.test.ts|package.json;tsconfig.json
03-scaffold-and-test-harness|03-002|scaffold-test-layout|test/scaffold/test-layout.test.ts|test/_harness/index.ts
03-scaffold-and-test-harness|03-003|add-golden-file-loader|test/_harness/golden-loader.test.ts|test/_harness/golden.ts
03-scaffold-and-test-harness|03-004|add-temp-sandbox-helper|test/_harness/temp-sandbox.test.ts|test/_harness/tempSandbox.ts
03-scaffold-and-test-harness|03-005|add-binary-buffer-assertions|test/_harness/binary-assert.test.ts|test/_harness/binaryAssert.ts
03-scaffold-and-test-harness|03-006|add-cli-smoke-harness|test/scaffold/cli-smoke.test.ts|test/_harness/cli.ts
03-scaffold-and-test-harness|03-007|add-deterministic-time-freeze-harness|test/_harness/determinism.test.ts|test/_harness/determinism.ts
03-scaffold-and-test-harness|03-008|lock-verify-command-conventions|test/scaffold/verify-commands.test.ts|tools/verify.ts
04-core-math-and-binary|04-001|fixed-constants-and-type|test/core/fixed.constants.test.ts|src/core/fixed.ts
04-core-math-and-binary|04-002|fixed-add-sub-overflow|test/core/fixed.add-sub.test.ts|src/core/fixed.ts
04-core-math-and-binary|04-003|fixed-multiply|test/core/fixed.multiply.test.ts|src/core/fixed.ts
04-core-math-and-binary|04-004|fixed-divide|test/core/fixed.divide.test.ts|src/core/fixed.ts
04-core-math-and-binary|04-005|angle-type-and-wrap|test/core/angle.wrap.test.ts|src/core/angle.ts
04-core-math-and-binary|04-006|trig-lookups|test/core/trig-lookup.test.ts|src/core/trig.ts
04-core-math-and-binary|04-007|deterministic-rng-stream|test/core/rng.test.ts|src/core/rng.ts
04-core-math-and-binary|04-008|little-endian-binary-reader|test/core/binary-reader.test.ts|src/core/binaryReader.ts
'''.strip().splitlines()
STEP_DATA_LINES += '''
05-wad-and-assets|05-001|lump-name-lookup|test/wad/lump-lookup.test.ts|src/wad/lumpLookup.ts
05-wad-and-assets|05-002|marker-range-resolution|test/wad/marker-range.test.ts|src/wad/markerRange.ts
05-wad-and-assets|05-003|playpal-parser|test/wad/playpal.test.ts|src/assets/playpal.ts
05-wad-and-assets|05-004|colormap-parser|test/wad/colormap.test.ts|src/assets/colormap.ts
05-wad-and-assets|05-005|pnames-parser|test/wad/pnames.test.ts|src/assets/pnames.ts
05-wad-and-assets|05-006|texture1-parser|test/wad/texture1.test.ts|src/assets/texture1.ts
05-wad-and-assets|05-007|flat-catalog|test/wad/flats.test.ts|src/assets/flats.ts
05-wad-and-assets|05-008|patch-and-sprite-catalog|test/wad/patches-sprites.test.ts|src/assets/patchCatalog.ts
05-wad-and-assets|05-009|map-lump-bundle-parser|test/wad/map-bundle.test.ts|src/map/mapBundle.ts
05-wad-and-assets|05-010|mus-demo-and-endoom-readers|test/wad/misc-assets.test.ts|src/assets/mus.ts;src/demo/demoFile.ts;src/ui/endoom.ts
06-host-timing-and-input|06-001|query-performance-counter-clock|test/host/clock.test.ts|src/host/win32/clock.ts
06-host-timing-and-input|06-002|exact-35hz-tic-accumulator|test/host/tic-accumulator.test.ts|src/host/ticAccumulator.ts
06-host-timing-and-input|06-003|message-pump-ordering|test/host/message-pump.test.ts|src/host/win32/messagePump.ts
06-host-timing-and-input|06-004|keyboard-scan-code-mapping|test/input/keyboard-mapping.test.ts|src/input/keyboard.ts
06-host-timing-and-input|06-005|mouse-motion-and-buttons|test/input/mouse-sampling.test.ts|src/input/mouse.ts
06-host-timing-and-input|06-006|focus-pause-and-grab-policy|test/input/focus-policy.test.ts|src/input/focusPolicy.ts
06-host-timing-and-input|06-007|ticcmd-packing|test/input/ticcmd.test.ts|src/input/ticcmd.ts
06-host-timing-and-input|06-008|window-scaling-and-aspect-policy|test/host/window-policy.test.ts|src/host/windowPolicy.ts
07-bootstrap-and-main-loop|07-001|command-line-parser|test/bootstrap/cmdline.test.ts|src/bootstrap/cmdline.ts
07-bootstrap-and-main-loop|07-002|config-load-precedence|test/bootstrap/config-precedence.test.ts|src/bootstrap/config.ts
07-bootstrap-and-main-loop|07-003|game-mode-identification|test/bootstrap/game-mode.test.ts|src/bootstrap/gameMode.ts
07-bootstrap-and-main-loop|07-004|d-doommain-init-order|test/bootstrap/init-order.test.ts|src/bootstrap/initOrder.ts
07-bootstrap-and-main-loop|07-005|title-and-demo-loop-state-machine|test/bootstrap/title-loop.test.ts|src/bootstrap/titleLoop.ts
07-bootstrap-and-main-loop|07-006|try-run-tics-equivalent|test/bootstrap/try-run-tics.test.ts|src/bootstrap/tryRunTics.ts
07-bootstrap-and-main-loop|07-007|main-loop-order|test/bootstrap/main-loop-order.test.ts|src/mainLoop.ts
07-bootstrap-and-main-loop|07-008|quit-and-cleanup-flow|test/bootstrap/quit-flow.test.ts|src/bootstrap/quitFlow.ts
08-map-geometry-and-spatial|08-001|things-loader|test/map/things-loader.test.ts|src/map/things.ts
08-map-geometry-and-spatial|08-002|linedefs-sidedefs-sectors-vertexes-loaders|test/map/struct-loaders.test.ts|src/map/lineSectorGeometry.ts
08-map-geometry-and-spatial|08-003|nodes-ssectors-segs-loaders|test/map/bsp-struct-loaders.test.ts|src/map/bspStructs.ts
08-map-geometry-and-spatial|08-004|blockmap-loader|test/map/blockmap-loader.test.ts|src/map/blockmap.ts
08-map-geometry-and-spatial|08-005|reject-loader|test/map/reject-loader.test.ts|src/map/reject.ts
08-map-geometry-and-spatial|08-006|point-on-side-and-node-traversal|test/map/node-traversal.test.ts|src/map/nodeTraversal.ts
08-map-geometry-and-spatial|08-007|subsector-and-sector-query|test/map/subsector-query.test.ts|src/map/subsectorQuery.ts
08-map-geometry-and-spatial|08-008|blockmap-iteration-order|test/map/blockmap-iteration.test.ts|src/map/blockmapIter.ts
08-map-geometry-and-spatial|08-009|intercepts-and-path-traversal|test/map/intercepts.test.ts|src/map/intercepts.ts
08-map-geometry-and-spatial|08-010|map-setup-parity|test/map/map-setup-parity.test.ts|src/map/mapSetup.ts
09-thinkers-and-physics|09-001|thinker-list-lifecycle|test/world/thinker-list.test.ts|src/world/thinkers.ts
09-thinkers-and-physics|09-002|mobj-spawn-and-state-tables|test/world/mobj-spawn.test.ts|src/world/mobj.ts
09-thinkers-and-physics|09-003|check-position|test/world/check-position.test.ts|src/world/checkPosition.ts
09-thinkers-and-physics|09-004|try-move|test/world/try-move.test.ts|src/world/tryMove.ts
09-thinkers-and-physics|09-005|xy-movement|test/world/xy-movement.test.ts|src/world/xyMovement.ts
09-thinkers-and-physics|09-006|z-movement|test/world/z-movement.test.ts|src/world/zMovement.ts
09-thinkers-and-physics|09-007|slide-move|test/world/slide-move.test.ts|src/world/slideMove.ts
09-thinkers-and-physics|09-008|sector-change-and-crush|test/world/sector-change.test.ts|src/world/sectorChange.ts
09-thinkers-and-physics|09-009|radius-attack-and-damage-spread|test/world/radius-attack.test.ts|src/world/radiusAttack.ts
09-thinkers-and-physics|09-010|use-lines-and-spechit-quirk|test/world/use-lines.test.ts|src/world/useLines.ts
09-thinkers-and-physics|09-011|teleport-and-mapthing-special-cases|test/world/teleport-spawn.test.ts|src/world/teleport.ts
'''.strip().splitlines()
STEP_DATA_LINES += '''
10-player-weapons-items|10-001|player-spawn-and-reset|test/player/player-spawn.test.ts|src/player/playerSpawn.ts
10-player-weapons-items|10-002|movement-bob-thrust-viewheight|test/player/movement-bob.test.ts|src/player/movement.ts
10-player-weapons-items|10-003|ammo-and-weapon-ownership|test/player/weapon-ownership.test.ts|src/player/weapons.ts
10-player-weapons-items|10-004|weapon-state-machine|test/player/weapon-states.test.ts|src/player/weaponStates.ts
10-player-weapons-items|10-005|hitscan-weapons|test/player/hitscan.test.ts|src/player/hitscan.ts
10-player-weapons-items|10-006|projectile-weapons|test/player/projectiles.test.ts|src/player/projectiles.ts
10-player-weapons-items|10-007|item-pickups|test/player/pickups.test.ts|src/player/pickups.ts
10-player-weapons-items|10-008|powerup-timers-and-palette-effects|test/player/powerups.test.ts|src/player/powerups.ts
11-ai-and-monsters|11-001|recursive-sound-propagation|test/ai/sound-propagation.test.ts|src/ai/soundPropagation.ts
11-ai-and-monsters|11-002|target-acquisition-and-sight|test/ai/target-acquisition.test.ts|src/ai/targeting.ts
11-ai-and-monsters|11-003|chase-state-machine|test/ai/chase.test.ts|src/ai/chase.ts
11-ai-and-monsters|11-004|melee-range-checks|test/ai/melee-range.test.ts|src/ai/meleeRange.ts
11-ai-and-monsters|11-005|missile-range-checks|test/ai/missile-range.test.ts|src/ai/missileRange.ts
11-ai-and-monsters|11-006|monster-attack-actions|test/ai/monster-attacks.test.ts|src/ai/attacks.ts
11-ai-and-monsters|11-007|pain-death-raise-explode|test/ai/state-transitions.test.ts|src/ai/stateTransitions.ts
11-ai-and-monsters|11-008|boss-and-death-special-cases|test/ai/boss-specials.test.ts|src/ai/bossSpecials.ts
12-specials-and-world-events|12-001|animated-textures-and-flats|test/specials/animations.test.ts|src/specials/animations.ts
12-specials-and-world-events|12-002|door-specials|test/specials/doors.test.ts|src/specials/doors.ts
12-specials-and-world-events|12-003|lift-and-platform-specials|test/specials/platforms.test.ts|src/specials/platforms.ts
12-specials-and-world-events|12-004|floor-movers|test/specials/floors.test.ts|src/specials/floors.ts
12-specials-and-world-events|12-005|ceiling-movers-and-crushers|test/specials/ceilings.test.ts|src/specials/ceilings.ts
12-specials-and-world-events|12-006|stairs-and-donut|test/specials/stairs-donut.test.ts|src/specials/stairsDonut.ts
12-specials-and-world-events|12-007|switches-and-buttons|test/specials/switches.test.ts|src/specials/switches.ts
12-specials-and-world-events|12-008|damage-secret-exit-sectors|test/specials/sector-specials.test.ts|src/specials/sectorSpecials.ts
12-specials-and-world-events|12-009|line-trigger-retrigger-semantics|test/specials/line-triggers.test.ts|src/specials/lineTriggers.ts
12-specials-and-world-events|12-010|active-special-save-hooks|test/specials/active-specials.test.ts|src/specials/activeSpecials.ts
13-renderer-world|13-001|projection-and-detail-constants|test/render/projection-constants.test.ts|src/render/projection.ts
13-renderer-world|13-002|visplane-openings-and-clip-limits|test/render/render-limits.test.ts|src/render/renderLimits.ts
13-renderer-world|13-003|column-and-span-drawers|test/render/column-span-draw.test.ts|src/render/drawPrimitives.ts
13-renderer-world|13-004|patch-decode-and-draw|test/render/patch-draw.test.ts|src/render/patchDraw.ts
13-renderer-world|13-005|wall-column-fetch|test/render/wall-column-fetch.test.ts|src/render/wallColumns.ts
13-renderer-world|13-006|solid-wall-path|test/render/solid-walls.test.ts|src/render/solidWalls.ts
13-renderer-world|13-007|two-sided-wall-path|test/render/two-sided-walls.test.ts|src/render/twoSidedWalls.ts
13-renderer-world|13-008|visplane-build|test/render/visplane-build.test.ts|src/render/visplanes.ts
13-renderer-world|13-009|visplane-span-render|test/render/visplane-span-render.test.ts|src/render/visplaneSpans.ts
13-renderer-world|13-010|sky-semantics|test/render/sky.test.ts|src/render/sky.ts
13-renderer-world|13-011|sprite-projection|test/render/sprite-projection.test.ts|src/render/spriteProjection.ts
13-renderer-world|13-012|sprite-sort-and-clip|test/render/sprite-sort-clip.test.ts|src/render/spriteClip.ts
13-renderer-world|13-013|masked-midtextures|test/render/masked-midtextures.test.ts|src/render/maskedTextures.ts
13-renderer-world|13-014|fuzz-and-invisibility|test/render/fuzz.test.ts|src/render/fuzz.ts
14-ui-and-front-end-flow|14-001|ui-font-and-patch-assets|test/ui/ui-assets.test.ts|src/ui/assets.ts
14-ui-and-front-end-flow|14-002|status-bar-widgets-and-face|test/ui/status-bar.test.ts|src/ui/statusBar.ts
14-ui-and-front-end-flow|14-003|hud-messages|test/ui/hud-messages.test.ts|src/ui/hudMessages.ts
14-ui-and-front-end-flow|14-004|automap|test/ui/automap.test.ts|src/ui/automap.ts
14-ui-and-front-end-flow|14-005|menu-tree-and-repeat-timing|test/ui/menus.test.ts|src/ui/menus.ts
14-ui-and-front-end-flow|14-006|intermission-stats|test/ui/intermission.test.ts|src/ui/intermission.ts
14-ui-and-front-end-flow|14-007|finale-text-and-screens|test/ui/finale.test.ts|src/ui/finale.ts
14-ui-and-front-end-flow|14-008|title-credit-help-demo-sequencing|test/ui/front-end-sequence.test.ts|src/ui/frontEndSequence.ts
'''.strip().splitlines()
STEP_DATA_LINES += '''
15-audio-and-music|15-001|sfx-lump-loader|test/audio/sfx-loader.test.ts|src/audio/sfxLumps.ts
15-audio-and-music|15-002|eight-channel-allocator|test/audio/channel-allocation.test.ts|src/audio/channels.ts
15-audio-and-music|15-003|attenuation-and-stereo-separation|test/audio/attenuation.test.ts|src/audio/spatial.ts
15-audio-and-music|15-004|sound-origin-updates|test/audio/sound-origins.test.ts|src/audio/soundOrigins.ts
15-audio-and-music|15-005|sound-start-stop-update-order|test/audio/sound-order.test.ts|src/audio/soundSystem.ts
15-audio-and-music|15-006|pcm-mixer-clipping-and-stepping|test/audio/pcm-mixer.test.ts|src/audio/pcmMixer.ts
15-audio-and-music|15-007|mus-parser|test/audio/mus-parser.test.ts|src/audio/musParser.ts
15-audio-and-music|15-008|mus-event-scheduler|test/audio/mus-scheduler.test.ts|src/audio/musScheduler.ts
15-audio-and-music|15-009|opl-register-model|test/audio/opl-registers.test.ts|src/audio/oplRegisters.ts
15-audio-and-music|15-010|opl-synthesis-core|test/audio/opl-synth.test.ts|src/audio/oplSynth.ts
15-audio-and-music|15-011|music-device-integration|test/audio/music-system.test.ts|src/audio/musicSystem.ts
15-audio-and-music|15-012|audio-parity-harness|test/audio/audio-parity.test.ts|src/audio/audioParity.ts
16-save-config-demo|16-001|default-cfg-parser|test/config/default-cfg-parse.test.ts|src/config/defaultCfg.ts
16-save-config-demo|16-002|host-extra-config-split|test/config/host-config.test.ts|src/config/hostConfig.ts
16-save-config-demo|16-003|demo-parser|test/demo/demo-parse.test.ts|src/demo/demoParse.ts
16-save-config-demo|16-004|demo-recorder|test/demo/demo-record.test.ts|src/demo/demoRecord.ts
16-save-config-demo|16-005|demo-playback|test/demo/demo-playback.test.ts|src/demo/demoPlayback.ts
16-save-config-demo|16-006|savegame-header-and-versioning|test/save/save-header.test.ts|src/save/saveHeader.ts
16-save-config-demo|16-007|player-mobj-sector-serialization|test/save/core-serialization.test.ts|src/save/coreSerialization.ts
16-save-config-demo|16-008|special-thinker-serialization|test/save/special-serialization.test.ts|src/save/specialSerialization.ts
16-save-config-demo|16-009|loadgame-restore|test/save/loadgame.test.ts|src/save/loadgame.ts
16-save-config-demo|16-010|vanilla-limit-enforcement|test/save/vanilla-limits.test.ts|src/save/vanillaLimits.ts
17-parity-and-acceptance|17-001|level-start-state-hashes|test/parity/level-start-state-hash.test.ts|test/parity/fixtures/levelStartHashes.json
17-parity-and-acceptance|17-002|bundled-demo-sync|test/parity/bundled-demo-sync.test.ts|test/parity/fixtures/demoSync.json
17-parity-and-acceptance|17-003|scripted-input-core-mechanics|test/parity/scripted-mechanics.test.ts|test/parity/fixtures/scriptedMechanics.json
17-parity-and-acceptance|17-004|framebuffer-crc-suite|test/parity/framebuffer-crc.test.ts|test/parity/fixtures/framebufferHashes.json
17-parity-and-acceptance|17-005|menu-and-ui-timing-suite|test/parity/menu-timing.test.ts|test/parity/fixtures/menuTiming.json
17-parity-and-acceptance|17-006|sound-and-music-suite|test/parity/audio-suite.test.ts|test/parity/fixtures/audioHashes.json
17-parity-and-acceptance|17-007|save-load-roundtrip-suite|test/parity/save-load-roundtrip.test.ts|test/parity/fixtures/saveLoad.json
17-parity-and-acceptance|17-008|vanilla-quirk-regression-suite|test/parity/quirk-regressions.test.ts|test/parity/fixtures/quirkCases.json
17-parity-and-acceptance|17-009|full-shareware-e1-acceptance|test/parity/full-e1-acceptance.test.ts|test/parity/fixtures/e1Acceptance.json
17-parity-and-acceptance|17-010|side-by-side-final-gate-and-c2-open|test/parity/final-gate.test.ts|reference/manifests/c1-complete.json
'''.strip().splitlines()
SOURCE_CATALOG += [
    ('S-001', 'local bundle README', 'file', 'local-primary', str(UNIVERSAL_DOOM_ROOT / 'README.md'), 'Primary local packaging note for the universal build and its Chocolate Doom 2.2.1 Windows half.'),
    ('S-002', 'local runtime stdout log', 'file', 'local-primary', str(UNIVERSAL_DOOM_ROOT / 'stdout.txt'), 'Confirms the local Windows oracle reports Chocolate Doom 2.2.1 and Doom 1.9 emulation.'),
    ('S-003', 'local vanilla config', 'file', 'local-primary', str(UNIVERSAL_DOOM_ROOT / 'default.cfg'), 'Vanilla control, audio, and UI defaults bundled beside the reference binaries.'),
    ('S-004', 'local Chocolate config', 'file', 'local-secondary', str(UNIVERSAL_DOOM_ROOT / 'chocolate-doom.cfg'), 'Host-side oracle configuration, including vanilla compatibility flags.'),
    ('S-005', 'local IWAD', 'file', 'local-primary-data', str(UNIVERSAL_DOOM_ROOT / 'DOOM1.WAD'), 'Canonical shareware data set for C1.'),
    ('S-006', 'local DOS executable', 'file', 'local-primary-binary', str(UNIVERSAL_DOOM_ROOT / 'DOOMD.EXE'), 'Behavioral authority for vanilla shareware Doom 1.9 semantics.'),
    ('S-007', 'local Windows executable', 'file', 'local-secondary-binary', str(UNIVERSAL_DOOM_ROOT / 'DOOM.EXE'), 'Practical Windows-side oracle when it agrees with vanilla.'),
    ('S-008', 'Chocolate Doom upstream repo', 'repo', 'upstream-secondary', 'https://github.com/chocolate-doom/chocolate-doom', 'Secondary reference for code structure, bug compatibility notes, and parity-oriented behavior.'),
    ('S-009', 'Chocolate Doom src/doom/d_main.c', 'source', 'upstream-secondary', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/d_main.c', 'Startup, title loop, init order, and main Doom loop.'),
    ('S-010', 'Chocolate Doom src/doom/doomdef.h', 'source', 'upstream-secondary', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/doomdef.h', 'Core constants including TICRATE and game version markers.'),
    ('S-011', 'Chocolate Doom src/doom/g_game.c', 'source', 'upstream-secondary', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/g_game.c', 'Input, ticcmd generation, savegame size limit, demos, and game flow.'),
    ('S-012', 'Chocolate Doom src/doom/p_map.c', 'source', 'upstream-secondary', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/p_map.c', 'Movement, collision, intercepts, and special-line edge cases.'),
    ('S-013', 'Chocolate Doom src/doom/p_spec.c', 'source', 'upstream-secondary', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/p_spec.c', 'World specials, sector effects, and donut/animation behavior.'),
    ('S-014', 'Chocolate Doom src/doom/p_enemy.c', 'source', 'upstream-secondary', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/p_enemy.c', 'AI, sound propagation, missile checks, and monster action flow.'),
    ('S-015', 'Chocolate Doom src/doom/r_bsp.c', 'source', 'upstream-secondary', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/r_bsp.c', 'BSP traversal, clipping ranges, and subsector walk order.'),
    ('S-016', 'Chocolate Doom src/doom/r_plane.c', 'source', 'upstream-secondary', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/r_plane.c', 'Visplanes, openings, and sky/light handling.'),
    ('S-017', 'Chocolate Doom src/doom/s_sound.c', 'source', 'upstream-secondary', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/s_sound.c', 'Sound attenuation, channel rules, and music selection.'),
    ('S-018', 'Chocolate Doom src/doom/p_saveg.c', 'source', 'upstream-secondary', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/p_saveg.c', 'Savegame layout, versioning, and EOF marker handling.'),
    ('S-019', 'Chocolate Doom project README', 'doc', 'upstream-secondary', 'https://github.com/chocolate-doom/chocolate-doom', 'Project-level rationale and scope.'),
    ('S-020', 'DoomWiki community references', 'doc-set', 'community-secondary', 'https://doomwiki.org', 'Community reference only; never primary authority over binaries or source.'),
    ('S-021', 'Chocolate Doom src/m_fixed.c', 'source', 'upstream-secondary', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/m_fixed.c', 'Fixed-point multiply and divide behavior.'),
    ('S-022', 'Chocolate Doom src/tables.c', 'source', 'upstream-secondary', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/tables.c', 'Trig and angle lookup tables.'),
]
SOURCE_CATALOG += [
    ('S-023', 'Chocolate Doom src/doom/r_draw.c', 'source', 'upstream-secondary', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/r_draw.c', 'Column and span drawers, fuzz, and screen detail paths.'),
    ('S-024', 'Chocolate Doom src/doom/r_things.c', 'source', 'upstream-secondary', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/r_things.c', 'Sprite projection, clipping, and masked drawing.'),
    ('S-025', 'Chocolate Doom src/doom/r_main.c', 'source', 'upstream-secondary', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/r_main.c', 'View setup, lighting, and render loop glue.'),
    ('S-026', 'Chocolate Doom src/doom/st_stuff.c', 'source', 'upstream-secondary', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/st_stuff.c', 'Status bar widgets, palette flashes, and face logic.'),
    ('S-027', 'Chocolate Doom src/doom/am_map.c', 'source', 'upstream-secondary', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/am_map.c', 'Automap behavior, scrolling, and zoom controls.'),
    ('S-028', 'Chocolate Doom src/doom/m_menu.c', 'source', 'upstream-secondary', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/m_menu.c', 'Menus, repeat timing, and front-end input.'),
    ('S-029', 'Chocolate Doom src/doom/wi_stuff.c', 'source', 'upstream-secondary', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/wi_stuff.c', 'Intermission stats flow.'),
    ('S-030', 'Chocolate Doom src/doom/f_finale.c', 'source', 'upstream-secondary', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/f_finale.c', 'Finale text and screen sequencing.'),
    ('S-031', 'Chocolate Doom src/doom/hu_stuff.c', 'source', 'upstream-secondary', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/hu_stuff.c', 'HUD messages and chat behavior.'),
    ('S-032', 'Chocolate Doom src/doom/p_mobj.c', 'source', 'upstream-secondary', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/p_mobj.c', 'Mobj spawn, thinker setup, XY and Z movement helpers.'),
    ('S-033', 'Chocolate Doom src/doom/p_pspr.c', 'source', 'upstream-secondary', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/p_pspr.c', 'Weapon state machine and player weapon actions.'),
    ('S-034', 'Chocolate Doom src/doom/p_user.c', 'source', 'upstream-secondary', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/p_user.c', 'Player movement, bob, thrust, and viewheight behavior.'),
    ('S-035', 'Chocolate Doom src/doom/r_segs.c', 'source', 'upstream-secondary', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/r_segs.c', 'Wall segment rendering details and clipping.'),
    ('S-036', 'Chocolate Doom src/doom/r_data.c', 'source', 'upstream-secondary', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/r_data.c', 'Texture, flat, and patch data preparation.'),
    ('S-037', 'Chocolate Doom src/doom/r_sky.c', 'source', 'upstream-secondary', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/r_sky.c', 'Sky selection and draw constants.'),
    ('S-038', 'Chocolate Doom src/i_sound.c', 'source', 'upstream-secondary', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/i_sound.c', 'Host audio device behavior and music backend integration.'),
    ('S-039', 'Chocolate Doom src/i_timer.c', 'source', 'upstream-secondary', 'https://github.com/chocolate-doom/chocolate-doom/blob/master/src/i_timer.c', 'Timer behavior and frame pacing host layer.'),
    ('S-040', 'DoomWiki WAD format', 'doc', 'community-secondary', 'https://doomwiki.org/wiki/WAD', 'Community explanation of WAD structure; use only as a convenience reference.'),
    ('S-041', 'DoomWiki Demo', 'doc', 'community-secondary', 'https://doomwiki.org/wiki/Demo', 'Community explanation of demo concepts and compatibility.'),
    ('S-042', 'DoomWiki MUS', 'doc', 'community-secondary', 'https://doomwiki.org/wiki/MUS', 'Community explanation of MUS music format.'),
    ('S-043', 'DoomWiki Savegame', 'doc', 'community-secondary', 'https://doomwiki.org/wiki/Savegame', 'Community explanation of savegame behavior.'),
]

DECISIONS += [
    ('D-001', 'accepted', 'Canonical C1 behavior target is shareware Doom 1.9 semantics.', 'The local bundle includes the original shareware DOS binary and the shareware IWAD, and the local Windows executable reports Doom 1.9 emulation.', 'S-001, S-002, S-005, S-006, S-007', '00-001, 01-005, 17-010', 'none'),
    ('D-002', 'accepted', 'Use DOOM.EXE only as a secondary Windows-side oracle, and treat the DOS binary semantics as authoritative whenever they disagree.', 'The Windows executable is a Chocolate Doom build rather than the original binary, so it is practical but not primary.', 'S-001, S-002, S-006, S-007', '02-001, 02-009, 17-010', 'none'),
    ('D-003', 'accepted', 'Use a TypeScript software framebuffer with GDI DIB presentation for C1.', 'This matches the parity target more directly than introducing an OpenGL presentation dependency and stays within already present packages.', 'S-015, S-016, PACKAGE_CAPABILITY_MATRIX.md', '00-004, 06-008, 13-014', 'none'),
    ('D-004', 'accepted', 'Target TypeScript DMX-style digital SFX plus TypeScript OPL music for C1, not host General MIDI.', 'Host MIDI is not sufficient for exact parity, while the bundled data and reference behavior demand deterministic music timing.', 'S-017, S-038, S-042', '00-005, 15-012, 17-006', 'none'),
    ('D-005', 'accepted', 'Keep controller and gamepad support out of C1.', 'It is not required for shareware Doom 1.9 parity, and it would dilute the early exactness budget.', 'S-003, S-004', '06-004, 06-005', 'none'),
    ('D-006', 'accepted', 'All derived captures, sandboxes, and artifacts must live under doom_codex and never under doom.', 'This preserves the read-only contract on the local reference bundle and avoids contaminating the oracle inputs.', 'user task constraints, S-001', '02-001, 02-009, 17-010', 'none'),
]

FACTS += [
    ('F-001', 'DOOM.EXE identifies as Chocolate Doom 2.2.1 and reports Doom 1.9 emulation.', str(UNIVERSAL_DOOM_ROOT / 'stdout.txt'), 'high', 'verified', '02-001, 07-003, 17-010'),
    ('F-002', 'DOOM1.WAD SHA-256 is 1D7D43BE501E67D927E415E0B8F3E29C3BF33075E859721816F652A526CAC771.', 'Local hash manifest generated from DOOM1.WAD', 'high', 'verified', '01-001, 05-001, 17-010'),
    ('F-003', 'DOOM.EXE SHA-256 is 5CA97717FD79F833B248AE5985FFFADBEE39533F5E0529BC9D7B439E08B8F1D2.', 'Local hash manifest generated from DOOM.EXE', 'high', 'verified', '02-001, 17-010'),
    ('F-004', 'DOOMD.EXE SHA-256 is 9D3216605417888D5A699FA3794E46638EB4CB8634501AE748D74F9C2CFAE37B.', 'Local hash manifest generated from DOOMD.EXE', 'high', 'verified', '00-001, 17-010'),
    ('F-005', 'DOOM1.WAD is an IWAD with 1264 lumps and maps E1M1 through E1M9.', 'Local WAD directory parse', 'high', 'verified', '01-001, 08-010, 17-009'),
    ('F-006', 'The bundled shareware IWAD contains TEXTURE1 and does not contain TEXTURE2.', 'Local WAD directory parse', 'high', 'verified', '05-006, 13-005'),
    ('F-007', 'PLAYPAL, COLORMAP, DEMO1, DEMO2, DEMO3, GENMIDI, and DMXGUS are present in DOOM1.WAD.', 'Local WAD directory parse', 'high', 'verified', '05-003, 15-007, 16-003'),
    ('F-008', 'Both default.cfg and chocolate-doom.cfg are present, and the Chocolate config enables vanilla savegame and demo limits.', 'Local config files', 'high', 'verified', '01-004, 07-002, 16-010'),
    ('F-009', 'Bun exposes JSCallback and the repo already includes the Win32 bindings needed for a native message loop and waveOut.', 'Local bun-types and package examples', 'high', 'verified', '03-001, 06-003, 15-011'),
]
REFERENCE_ORACLES += [
    ('O-001', 'reference-file-hashes', 'S-001 through S-007', 'Hash the local reference files before any later oracle capture work.', str(ROOT / 'manifests' / 'reference-file-hashes.json'), 'generated-at-plan-build', '00-002, 02-001, 17-010', 'high'),
    ('O-002', 'startup-console-log', 'S-002', 'Treat the bundled stdout log as the initial startup oracle until automated capture replaces it.', str(UNIVERSAL_DOOM_ROOT / 'stdout.txt'), 'AC40714D3088DA7CFC6A63E23D226CB6C0B03978FB1A0778868C0B0E72A24681', '00-001, 07-003, 17-010', 'high'),
    ('O-003', 'wad-directory-summary', 'S-005', 'Parse the IWAD directory once and store the result as a stable derived manifest for later steps.', str(ROOT / 'manifests' / 'wad-directory-summary.json'), 'generated-at-plan-build', '01-001, 05-001, 08-010', 'high'),
]

PACKAGE_OVERRIDES.update({
    'core': {'used_in_c1': True, 'capabilities': 'Shared Win32 base class, pointer helpers, and type aliases used by every C1 host binding.', 'blocked_capabilities': 'No known blocker; treat as foundational.', 'proof_step': '03-001'},
    'kernel32': {'used_in_c1': True, 'capabilities': 'File I/O, timing, process, mapping, and basic OS primitives needed for reference sandboxes and the host loop.', 'blocked_capabilities': 'Confirm exact timer and sandbox behavior before leaning on less common APIs.', 'proof_step': '06-001'},
    'user32': {'used_in_c1': True, 'capabilities': 'Window creation, message pump, keyboard and mouse input, cursor control, and raw-input-adjacent APIs.', 'blocked_capabilities': 'Validate message ordering and scan-code mapping before gameplay integration.', 'proof_step': '06-003'},
    'gdi32': {'used_in_c1': True, 'capabilities': 'DIB creation and blit path for exact software-framebuffer presentation.', 'blocked_capabilities': 'Need a dedicated proof step if any scaling or color-conversion path diverges from parity needs.', 'proof_step': '06-008'},
    'winmm': {'used_in_c1': True, 'capabilities': 'waveOut, MIDI-related exports, and timer helpers for the host audio boundary.', 'blocked_capabilities': 'Treat host MIDI as diagnostic only; waveOut timing and buffer semantics still need proof.', 'proof_step': '15-011'},
    'opengl32': {'used_in_c1': False, 'capabilities': 'OpenGL presentation path available as a contingency only.', 'blocked_capabilities': 'Disallowed for C1 unless a later decision-log exception is approved.', 'proof_step': 'later-target-only'},
    'glu32': {'used_in_c1': False, 'capabilities': 'OpenGL utility helpers available with opengl32.', 'blocked_capabilities': 'No C1 need under the chosen GDI presentation decision.', 'proof_step': 'later-target-only'},
    'xinput1_4': {'used_in_c1': False, 'capabilities': 'Modern XInput controller bindings.', 'blocked_capabilities': 'Controller support is out of C1.', 'proof_step': 'none'},
    'xinput9_1_0': {'used_in_c1': False, 'capabilities': 'Legacy XInput controller bindings.', 'blocked_capabilities': 'Controller support is out of C1.', 'proof_step': 'none'},
    'hid': {'used_in_c1': False, 'capabilities': 'Potential future raw HID input or device work.', 'blocked_capabilities': 'Not needed for C1 keyboard and mouse parity.', 'proof_step': 'none'},
    'version': {'used_in_c1': False, 'capabilities': 'Version-resource inspection for reference executables and diagnostics.', 'blocked_capabilities': 'Not required at runtime once hashes are recorded.', 'proof_step': '00-002'},
    'shlwapi': {'used_in_c1': False, 'capabilities': 'Path helper APIs that may simplify later Windows host integration.', 'blocked_capabilities': 'Avoid unless core path handling proves insufficient.', 'proof_step': 'none'},
    'shell32': {'used_in_c1': False, 'capabilities': 'Shell-folder and shell-integration helpers.', 'blocked_capabilities': 'Avoid in C1; keep config and save path logic explicit.', 'proof_step': 'none'},
    'psapi': {'used_in_c1': False, 'capabilities': 'Process inspection helpers that could aid advanced oracle capture diagnostics.', 'blocked_capabilities': 'No current C1 requirement.', 'proof_step': 'none'},
})

VANILLA_LIMITS += [
    ('TICRATE', '35', 'doomdef.h', 'Core simulation cadence.'), ('SAVEGAMESIZE', '0x2c000', 'g_game.c', 'Vanilla savegame size ceiling.'), ('MAXVISPLANES', '128', 'r_plane.c', 'Visplane overflow compatibility limit.'), ('MAXOPENINGS', 'SCREENWIDTH * 64', 'r_plane.c', 'Openings buffer limit.'), ('snd_channels', '8', 'default.cfg and s_sound.c', 'Default digital sound channels.'), ('step_height', '24 * FRACUNIT', 'p_map.c', 'Step-up height limit.'), ('S_CLIPPING_DIST', '1200 * FRACUNIT', 's_sound.c', 'Maximum attenuated sound distance.'), ('S_CLOSE_DIST', '200 * FRACUNIT', 's_sound.c', 'Near-field sound distance.'), ('S_STEREO_SWING', '96 * FRACUNIT', 's_sound.c', 'Stereo panning swing.'), ('NORM_SEP', '128', 's_sound.c', 'Neutral stereo separation.'), ('DEFAULT_SPECHIT_MAGIC', '0x01C09C98', 'p_map.c', 'Vanilla spechit overrun emulation value.'), ('vanilla_demo_limit', '1', 'chocolate-doom.cfg', 'Local oracle flag for demo size behavior.'), ('vanilla_savegame_limit', '1', 'chocolate-doom.cfg', 'Local oracle flag for savegame size behavior.'),
]

ORACLE_SCHEMAS.update({
    'ReferenceManifest': {'required': ['targetId', 'referenceFiles', 'version', 'wadHash'], 'notes': 'Stable identity for a captured reference configuration.', 'fields': {'targetId': 'string', 'version': 'string', 'wadHash': 'string', 'referenceFiles': 'array', 'notes': 'string?'}},
    'OracleInputScript': {'required': ['name', 'initialTics', 'commands'], 'notes': 'Deterministic input script for oracle playback.', 'fields': {'name': 'string', 'initialTics': 'number', 'commands': 'array', 'expectedDurationTics': 'number?'}},
    'StateHashRecord': {'required': ['tic', 'hash', 'scope'], 'notes': 'Deterministic simulation hash at a specific tic.', 'fields': {'tic': 'number', 'scope': 'string', 'hash': 'string', 'notes': 'string?'}},
    'FramebufferHashRecord': {'required': ['tic', 'hash', 'width', 'height', 'palette'], 'notes': 'Hash of a fully rendered frame.', 'fields': {'tic': 'number', 'width': 'number', 'height': 'number', 'palette': 'string', 'hash': 'string'}},
    'AudioHashRecord': {'required': ['startTic', 'endTic', 'hash', 'sampleRate'], 'notes': 'Hash over a deterministic audio window.', 'fields': {'startTic': 'number', 'endTic': 'number', 'sampleRate': 'number', 'channels': 'number', 'hash': 'string'}},
    'MusicEventLog': {'required': ['track', 'events'], 'notes': 'Ordered register or note events emitted by the music path.', 'fields': {'track': 'string', 'events': 'array', 'device': 'string?'}},
})
def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.rstrip() + '\n', encoding='utf-8')


def absolute_from_rel(relative_path: str) -> str:
    return str(DOOM_CODEX_ROOT / Path(relative_path))


def hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest().upper()


def parse_config(path: Path) -> dict[str, object]:
    entries = []
    for raw_line in path.read_text(encoding='utf-8', errors='replace').splitlines():
        line = raw_line.strip()
        if not line or line.startswith('#'):
            continue
        parts = line.split()
        if len(parts) < 2:
            continue
        entries.append({'name': parts[0], 'value': ' '.join(parts[1:])})
    return {'path': str(path), 'count': len(entries), 'entries': entries}


def parse_wad_summary(path: Path) -> tuple[dict[str, object], dict[str, object]]:
    data = path.read_bytes()
    identification, num_lumps, info_table_offset = struct.unpack_from('<4sii', data, 0)
    directory = []
    for index in range(num_lumps):
        offset, size, raw_name = struct.unpack_from('<ii8s', data, info_table_offset + index * 16)
        name = raw_name.split(b'\0', 1)[0].decode('ascii', 'replace')
        directory.append({'index': index, 'name': name, 'offset': offset, 'size': size})
    maps = [entry['name'] for entry in directory if re.fullmatch(r'E\dM\d', entry['name'])]
    markers = {marker: next(entry['index'] for entry in directory if entry['name'] == marker) for marker in ['S_START', 'S_END', 'P_START', 'P_END', 'F_START', 'F_END']}
    summary = {
        'path': str(path),
        'identification': identification.decode('ascii'),
        'numLumps': num_lumps,
        'infoTableOffset': info_table_offset,
        'maps': maps,
        'keyLumps': {
            'PLAYPAL': next(entry for entry in directory if entry['name'] == 'PLAYPAL'),
            'COLORMAP': next(entry for entry in directory if entry['name'] == 'COLORMAP'),
            'TEXTURE1': next(entry for entry in directory if entry['name'] == 'TEXTURE1'),
            'TEXTURE2Present': any(entry['name'] == 'TEXTURE2' for entry in directory),
            'DEMO': [entry for entry in directory if entry['name'].startswith('DEMO')],
            'MUSIC': [entry['name'] for entry in directory if entry['name'].startswith('D_')],
            'SOUND': [entry['name'] for entry in directory if entry['name'].startswith('DS')],
        },
        'markerCounts': {'sprites': markers['S_END'] - markers['S_START'] - 1, 'patches': markers['P_END'] - markers['P_START'] - 1, 'flats': markers['F_END'] - markers['F_START'] - 1},
        'mapBundleOrder': {map_name: [directory[next(entry['index'] for entry in directory if entry['name'] == map_name) + offset]['name'] for offset in range(11)] for map_name in ['E1M1', 'E1M9']},
    }
    map_summary = {'path': str(path), 'maps': [{'name': map_name, 'markerIndex': next(entry['index'] for entry in directory if entry['name'] == map_name), 'bundleOrder': [directory[next(entry['index'] for entry in directory if entry['name'] == map_name) + offset]['name'] for offset in range(11)]} for map_name in maps]}
    return summary, map_summary


def build_package_matrix() -> list[dict[str, object]]:
    entries = []
    for package_name in sorted(path.name for path in PACKAGES_ROOT.iterdir() if path.is_dir()):
        override = PACKAGE_OVERRIDES.get(package_name)
        if override is None:
            override = {'used_in_c1': False, 'capabilities': 'Repository Win32 binding package present in inventory; no direct C1 Doom dependency identified during planning.', 'blocked_capabilities': 'Keep out of C1 unless a dedicated proof step demonstrates a concrete need.', 'proof_step': 'none'}
        entries.append({'package': f'@bun-win32/{package_name}', **override})
    return entries


def humanize(slug: str) -> str:
    return slug.replace('-', ' ')


def goal_sentence(slug: str) -> str:
    return f'Implement {humanize(slug)} so it matches the canonical reference behavior and is locked by the listed test coverage.'


def completion_criteria(changes: list[str], test_path: str) -> list[str]:
    artifact_only = all(change.startswith('reference/') or change.startswith('test/parity/fixtures/') or change.startswith('tools/') or change in {'package.json', 'tsconfig.json'} for change in changes)
    first = 'The derived artifact or tooling described for this step is reproducible from the listed reference material and remains confined to doom_codex.' if artifact_only else 'The implementation files listed for this step match the listed reference behavior without widening the agreed interface or behavior surface.'
    second = f'The targeted test file `{test_path}` covers the normal path and at least one parity-sensitive edge case, and every listed verification command passes.'
    return [first, second]


def step_file_path(phase: str, step_id: str, slug: str) -> Path:
    return ROOT / 'phases' / phase / f'{step_id}-{slug}.md'
STEPS = []
PHASE_ORDER = []
for raw_line in STEP_DATA_LINES:
    phase, step_id, slug, test_rel, change_rel = raw_line.split('|')
    if phase not in PHASE_ORDER:
        PHASE_ORDER.append(phase)
    STEPS.append({'phase': phase, 'id': step_id, 'slug': slug, 'test': test_rel, 'changes': change_rel.split(';')})


def build_readme() -> str:
    return f'''# DOOM Codex Planning System

## Start Here

- Active workspace: `D:\\Projects\\bun-win32\\doom_codex`
- Planning workspace: `D:\\Projects\\bun-win32\\doom_codex\\plans`
- Read-only reference bundle: `D:\\Projects\\bun-win32\\doom\\universal-doom`
- First eligible step in a fresh checkout: `00-001 pin-primary-target`
- Total planned implementation steps: `{len(STEPS)}`

## Ralph-Loop Workflow

1. Open `README.md`.
2. Open `MASTER_CHECKLIST.md`.
3. Pick the first unchecked step whose prerequisites are complete.
4. Open only that step file, `FACT_LOG.md`, and the exact files or docs named under `Read Only`.
5. Do not open related steps unless blocked.
6. Implement the step, run the listed verification commands in order, update the shared logs, mark the step complete, append a handoff entry, and stop.

## Shared Files

- `MASTER_CHECKLIST.md`: phase-grouped global queue; treat the first eligible unchecked item as the default next task.
- `DECISION_LOG.md`: durable record of target, runtime, and interface choices.
- `FACT_LOG.md`: durable memory for quirks, constants, and file-format findings; log them once and reuse them later.
- `HANDOFF_LOG.md`: append-only execution history for stop-and-resume work.
- `REFERENCE_ORACLES.md`: every capture, hash manifest, and oracle artifact with its trust level and consumers.
- `SOURCE_CATALOG.md`: authoritative source inventory; prefer local bundle and upstream source before community explanations.
- `PACKAGE_CAPABILITY_MATRIX.md`: repo package inventory and whether each package is in scope for C1.
- `STEP_TEMPLATE.md`: exact required shape for future step additions.

## Execution Rules

- Keep every implementation diff surgical.
- Keep all writable outputs inside `D:\\Projects\\bun-win32\\doom_codex`.
- Do not write under `D:\\Projects\\bun-win32\\doom\\`.
- Do not mark a step `[x]` unless the focused test, `bun test`, and typecheck all pass.
- If a behavior is unclear, add a research or oracle-capture step instead of guessing.
'''


def build_master_checklist() -> str:
    lines = ['# Master Checklist', '', f'- Total steps: {len(STEPS)}', '- Initial next eligible step: `00-001 pin-primary-target`', '- Rule: the first unchecked step whose prerequisites are complete is the default next task.']
    for phase in PHASE_ORDER:
        lines.extend(['', f'## {PHASE_NAMES[phase]}'])
        for step in [item for item in STEPS if item['phase'] == phase]:
            global_index = STEPS.index(step)
            prereq = 'none' if global_index == 0 else STEPS[global_index - 1]['id']
            lines.append(f"- [ ] `{step['id']}` `{step['slug']}` | prereqs: `{prereq}` | test: `{absolute_from_rel(step['test'])}` | verify: `bun test {step['test']}`")
    return '\n'.join(lines)


def build_decision_log() -> str:
    lines = ['# Decision Log', '']
    for identifier, status, decision, rationale, evidence, affected_steps, supersedes in DECISIONS:
        lines.extend([f'## {identifier}', f'- status: {status}', f'- date: {TODAY}', f'- decision: {decision}', f'- rationale: {rationale}', f'- evidence: {evidence}', f'- affected_steps: {affected_steps}', f'- supersedes: {supersedes}', ''])
    return '\n'.join(lines).rstrip() + '\n'


def build_fact_log() -> str:
    lines = ['# Fact Log', '']
    for identifier, fact, source, confidence, verified, future_steps in FACTS:
        lines.extend([f'## {identifier}', f'- fact: {fact}', f'- source: {source}', f'- confidence: {confidence}', f'- verified: {verified}', f'- future_steps: {future_steps}', ''])
    return '\n'.join(lines).rstrip() + '\n'


def build_handoff_log() -> str:
    return '# Handoff Log\n\n## 2026-04-11 planning-system-bootstrap\n- completed_step: planning-system-bootstrap\n- tests_run: structural generation and validation of the planning tree\n- results: shared files, manifests, and all phase step files created under `plans/`\n- new_facts: none beyond the seeded fact log\n- next_eligible_steps: 00-001\n- open_risks: none at plan-bootstrap time\n'


def build_reference_oracles_md() -> str:
    lines = ['# Reference Oracles', '']
    for identifier, oracle, source, method, artifact_path, hash_value, consumers, trust_level in REFERENCE_ORACLES:
        lines.extend([f'## {identifier}', f'- oracle: {oracle}', f'- source: {source}', f'- generation_method: {method}', f'- artifact_path: {artifact_path}', f'- hash: {hash_value}', f'- consumers: {consumers}', f'- trust_level: {trust_level}', ''])
    return '\n'.join(lines).rstrip() + '\n'


def build_source_catalog_md() -> str:
    lines = ['# Source Catalog', '', '| id | source | kind | authority | path_or_url | notes |', '| --- | --- | --- | --- | --- | --- |']
    for identifier, source, kind, authority, path_or_url, notes in SOURCE_CATALOG:
        lines.append(f'| {identifier} | {source} | {kind} | {authority} | {path_or_url} | {notes} |')
    return '\n'.join(lines) + '\n'


def build_package_matrix_md(matrix: list[dict[str, object]]) -> str:
    lines = ['# Package Capability Matrix', '', '- Scope note: every repo package is inventoried below; only packages explicitly marked `yes` are in C1 scope.', '', '| package | used_in_c1 | capabilities | blocked_capabilities | proof_step |', '| --- | --- | --- | --- | --- |']
    for entry in matrix:
        lines.append(f"| {entry['package']} | {'yes' if entry['used_in_c1'] else 'no'} | {entry['capabilities']} | {entry['blocked_capabilities']} | {entry['proof_step']} |")
    return '\n'.join(lines) + '\n'

def build_step_template() -> str:
    return '# [ ] STEP <ID>: <Short Title>\n\n## Goal\n<one sentence>\n\n## Prerequisites\n- <exact step IDs>\n\n## Read Only\n- <absolute or workspace-rooted path 1>\n- <absolute or workspace-rooted path 2>\n\n## Consult Only If Blocked\n- <related step IDs only>\n\n## Expected Changes\n- <exact path under D:\\Projects\\bun-win32\\doom_codex\\...>\n- <exact path under D:\\Projects\\bun-win32\\doom_codex\\...>\n\n## Test Files\n- <exact path>\n\n## Verification\n- `bun test <exact path>`\n- `bun test`\n- `bun x tsc --noEmit --project D:\\Projects\\bun-win32\\doom_codex\\tsconfig.json`\n- <extra command only if needed>\n\n## Completion Criteria\n- <objective condition 1>\n- <objective condition 2>\n\n## Required Log Updates\n- `FACT_LOG.md`: <what to add if learned>\n- `DECISION_LOG.md`: <if a decision changed>\n- `REFERENCE_ORACLES.md`: <if an oracle was created/updated>\n- `HANDOFF_LOG.md`: append completion entry\n\n## Later Steps That May Benefit\n- <step IDs>\n'


def build_step_content(step: dict[str, object], phase_steps: list[dict[str, object]], phase_index: int) -> str:
    global_index = STEPS.index(step)
    local_index = phase_steps.index(step)
    prereqs = ['None.'] if global_index == 0 else [STEPS[global_index - 1]['id']]
    consult = []
    if local_index > 0:
        consult.append(phase_steps[local_index - 1]['id'])
    if local_index + 1 < len(phase_steps):
        consult.append(phase_steps[local_index + 1]['id'])
    if not consult:
        consult = ['None.']
    later = []
    if local_index + 1 < len(phase_steps):
        later.append(phase_steps[local_index + 1]['id'])
    elif phase_index + 1 < len(PHASE_ORDER):
        next_phase = PHASE_ORDER[phase_index + 1]
        later.append(next(item['id'] for item in STEPS if item['phase'] == next_phase))
    later.append('17-010')
    lines = [f"# [ ] STEP {step['id']}: {step['slug']}", '', '## Goal', goal_sentence(step['slug']), '', '## Prerequisites']
    lines.extend([f'- {item}' for item in prereqs])
    lines.extend(['', '## Read Only'])
    lines.extend([f'- {item}' for item in PHASE_READ_ONLY[step['phase']]])
    lines.extend(['', '## Consult Only If Blocked'])
    lines.extend([f'- {item}' for item in consult])
    lines.extend(['', '## Expected Changes'])
    lines.extend([f"- {absolute_from_rel(change)}" for change in step['changes']])
    lines.extend(['', '## Test Files', f"- {absolute_from_rel(step['test'])}", '', '## Verification', f"- `bun test {step['test']}`", '- `bun test`', f"- `bun x tsc --noEmit --project {DOOM_CODEX_ROOT / 'tsconfig.json'}`", '', '## Completion Criteria'])
    lines.extend([f'- {item}' for item in completion_criteria(step['changes'], step['test'])])
    lines.extend(['', '## Required Log Updates', '- `FACT_LOG.md`: add any newly discovered constants, quirks, or file-format facts with future step IDs before leaving the step.', '- `DECISION_LOG.md`: update only if this step changes a chosen interface, host boundary, or parity rule.', '- `REFERENCE_ORACLES.md`: add or update the oracle record if this step creates or refreshes a capture, manifest, or replay fixture.', '- `HANDOFF_LOG.md`: append the completion summary, verification commands, results, next eligible steps, and open risks.', '', '## Later Steps That May Benefit'])
    lines.extend([f'- {item}' for item in later])
    return '\n'.join(lines)


def validate_outputs() -> dict[str, object]:
    shared = [ROOT / 'README.md', ROOT / 'MASTER_CHECKLIST.md', ROOT / 'DECISION_LOG.md', ROOT / 'FACT_LOG.md', ROOT / 'HANDOFF_LOG.md', ROOT / 'REFERENCE_ORACLES.md', ROOT / 'SOURCE_CATALOG.md', ROOT / 'PACKAGE_CAPABILITY_MATRIX.md', ROOT / 'STEP_TEMPLATE.md']
    manifests = [ROOT / 'manifests' / 'reference-file-hashes.json', ROOT / 'manifests' / 'wad-directory-summary.json', ROOT / 'manifests' / 'wad-map-summary.json', ROOT / 'manifests' / 'config-variable-summary.json', ROOT / 'manifests' / 'vanilla-limit-summary.json', ROOT / 'manifests' / 'package-capability-matrix.json', ROOT / 'manifests' / 'oracle-schemas.json', ROOT / 'manifests' / 'step-index.tsv']
    step_paths = [step_file_path(step['phase'], step['id'], step['slug']) for step in STEPS]
    missing = [str(path) for path in [*shared, *manifests, *step_paths] if not path.exists()]
    checklist_count = sum(1 for line in (ROOT / 'MASTER_CHECKLIST.md').read_text(encoding='utf-8').splitlines() if line.startswith('- [ ]'))
    invalid = [str(path) for path in step_paths if not path.read_text(encoding='utf-8').startswith('# [ ] STEP ')]
    return {'missing': missing, 'stepCount': len(step_paths), 'checklistCount': checklist_count, 'invalidHeadings': invalid}


ROOT.mkdir(parents=True, exist_ok=True)
(ROOT / 'manifests').mkdir(parents=True, exist_ok=True)
for phase in PHASE_ORDER:
    (ROOT / 'phases' / phase).mkdir(parents=True, exist_ok=True)
matrix = build_package_matrix()
wad_summary, wad_map_summary = parse_wad_summary(UNIVERSAL_DOOM_ROOT / 'DOOM1.WAD')
config_summary = {'defaultCfg': parse_config(UNIVERSAL_DOOM_ROOT / 'default.cfg'), 'chocolateCfg': parse_config(UNIVERSAL_DOOM_ROOT / 'chocolate-doom.cfg')}
config_summary['importantFlags'] = {'vanillaFlags': [entry for entry in config_summary['chocolateCfg']['entries'] if entry['name'] in {'vanilla_demo_limit', 'vanilla_keyboard_mapping', 'vanilla_savegame_limit'}], 'inputDefaults': [entry for entry in config_summary['defaultCfg']['entries'] if entry['name'].startswith('key_') or entry['name'].startswith('mouse') or entry['name'].startswith('joy')]}
reference_hashes = {'algorithm': 'sha256', 'generatedOn': TODAY, 'files': [{'path': str(UNIVERSAL_DOOM_ROOT / file_name), 'hash': hash_file(UNIVERSAL_DOOM_ROOT / file_name)} for file_name in ['README.md', 'stdout.txt', 'default.cfg', 'chocolate-doom.cfg', 'DOOM1.WAD', 'DOOMD.EXE', 'DOOM.EXE']]}
write_text(ROOT / 'README.md', build_readme())
write_text(ROOT / 'MASTER_CHECKLIST.md', build_master_checklist())
write_text(ROOT / 'DECISION_LOG.md', build_decision_log())
write_text(ROOT / 'FACT_LOG.md', build_fact_log())
write_text(ROOT / 'HANDOFF_LOG.md', build_handoff_log())
write_text(ROOT / 'REFERENCE_ORACLES.md', build_reference_oracles_md())
write_text(ROOT / 'SOURCE_CATALOG.md', build_source_catalog_md())
write_text(ROOT / 'PACKAGE_CAPABILITY_MATRIX.md', build_package_matrix_md(matrix))
write_text(ROOT / 'STEP_TEMPLATE.md', build_step_template())
write_text(ROOT / 'manifests' / 'step-index.tsv', '\n'.join(STEP_DATA_LINES))
(ROOT / 'manifests' / 'reference-file-hashes.json').write_text(json.dumps(reference_hashes, indent=2) + '\n', encoding='utf-8')
(ROOT / 'manifests' / 'wad-directory-summary.json').write_text(json.dumps(wad_summary, indent=2) + '\n', encoding='utf-8')
(ROOT / 'manifests' / 'wad-map-summary.json').write_text(json.dumps(wad_map_summary, indent=2) + '\n', encoding='utf-8')
(ROOT / 'manifests' / 'config-variable-summary.json').write_text(json.dumps(config_summary, indent=2) + '\n', encoding='utf-8')
(ROOT / 'manifests' / 'vanilla-limit-summary.json').write_text(json.dumps({'generatedOn': TODAY, 'limits': [{'name': name, 'value': value, 'source': source, 'notes': notes} for name, value, source, notes in VANILLA_LIMITS]}, indent=2) + '\n', encoding='utf-8')
(ROOT / 'manifests' / 'package-capability-matrix.json').write_text(json.dumps({'generatedOn': TODAY, 'packages': matrix}, indent=2) + '\n', encoding='utf-8')
(ROOT / 'manifests' / 'oracle-schemas.json').write_text(json.dumps({'generatedOn': TODAY, 'schemas': ORACLE_SCHEMAS}, indent=2) + '\n', encoding='utf-8')
for phase_index, phase in enumerate(PHASE_ORDER):
    phase_steps = [item for item in STEPS if item['phase'] == phase]
    for step in phase_steps:
        write_text(step_file_path(step['phase'], step['id'], step['slug']), build_step_content(step, phase_steps, phase_index))
validation = validate_outputs()
print(json.dumps(validation, indent=2))
if validation['missing'] or validation['stepCount'] != validation['checklistCount'] or validation['invalidHeadings']:
    raise SystemExit(1)
