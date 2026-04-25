# Reference Oracles

## Authority Order

1. Local original DOS binary if present and usable.
2. Local IWAD/data files.
3. Local Windows DOOM.EXE or Chocolate Doom oracle only where appropriate.
4. Upstream Chocolate Doom source as secondary behavioral reference.
5. Community documentation for orientation only.

## Local References

| id | path | role |
| --- | --- | --- |
| OR-FPS-001 | `doom/DOOMD.EXE` | local DOS binary authority when usable |
| OR-FPS-002 | `doom/DOOM.EXE` | local Windows/Chocolate Doom practical oracle |
| OR-FPS-003 | `doom/DOOM1.WAD` | local shareware IWAD data |
| OR-FPS-004 | `iwad/DOOM1.WAD` | local IWAD copy |
| OR-FPS-005 | `reference/manifests/` | prior derived manifests |

## Planned Oracle Artifact Roots

- `test/oracles/fixtures/`
- `test/parity/fixtures/`
- `plan_fps/manifests/`

Do not write oracle artifacts inside `doom/`, `iwad/`, or `reference/`.

## Captured Oracle Artifacts

| id | artifact | authority | refresh_command |
| --- | --- | --- | --- |
| OR-FPS-006 | `test/oracles/fixtures/capture-implementation-clean-launch-expectations.json` | derived implementation clean-launch expectation from `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-implementation-clean-launch-expectations.test.ts` |
| OR-FPS-007 | `test/oracles/fixtures/capture-reference-clean-launch.json` | reference clean-launch capture contract from local DOS binary authority | `bun test test/oracles/capture-reference-clean-launch.test.ts` |
| OR-FPS-008 | `test/oracles/fixtures/capture-startup-sequence.json` | startup sequence capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-startup-sequence.test.ts` |
| OR-FPS-009 | `test/oracles/fixtures/capture-initial-title-frame.json` | initial title frame capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-initial-title-frame.test.ts` |
| OR-FPS-010 | `test/oracles/fixtures/capture-first-menu-frame.json` | first menu frame capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-first-menu-frame.test.ts` |
| OR-FPS-011 | `test/oracles/fixtures/capture-full-attract-loop-cycle.json` | full attract loop cycle capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-full-attract-loop-cycle.test.ts` |
| OR-FPS-012 | `test/oracles/fixtures/capture-demo1-playback-checkpoints.json` | demo1 playback checkpoint capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-demo1-playback-checkpoints.test.ts` |
| OR-FPS-013 | `test/oracles/fixtures/capture-demo2-playback-checkpoints.json` | demo2 playback checkpoint capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-demo2-playback-checkpoints.test.ts` |
| OR-FPS-014 | `test/oracles/fixtures/capture-demo3-playback-checkpoints.json` | demo3 playback checkpoint capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-demo3-playback-checkpoints.test.ts` |
| OR-FPS-015 | `test/oracles/fixtures/capture-menu-open-close-behavior.json` | menu open/close capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-menu-open-close-behavior.test.ts` |
| OR-FPS-016 | `test/oracles/fixtures/capture-new-game-menu-path.json` | new game menu path capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-new-game-menu-path.test.ts` |
| OR-FPS-017 | `test/oracles/fixtures/capture-episode-menu-path.json` | episode menu path capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-episode-menu-path.test.ts` |
| OR-FPS-018 | `test/oracles/fixtures/capture-skill-menu-path.json` | skill menu path capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-skill-menu-path.test.ts` |
| OR-FPS-019 | `test/oracles/fixtures/capture-options-menu-path.json` | options menu path capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-options-menu-path.test.ts` |
| OR-FPS-020 | `test/oracles/fixtures/capture-sound-volume-menu-path.json` | sound volume menu path capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-sound-volume-menu-path.test.ts` |
| OR-FPS-021 | `test/oracles/fixtures/capture-screen-size-detail-gamma-paths.json` | screen size, detail, and gamma path capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-screen-size-detail-gamma-paths.test.ts` |
| OR-FPS-022 | `test/oracles/fixtures/capture-save-load-menu-path.json` | save/load menu path capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-save-load-menu-path.test.ts` |
| OR-FPS-023 | `test/oracles/fixtures/capture-quit-confirmation-path.json` | quit confirmation path capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-quit-confirmation-path.test.ts` |
| OR-FPS-024 | `test/oracles/fixtures/capture-e1m1-start-from-clean-launch.json` | e1m1 start from clean launch capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-e1m1-start-from-clean-launch.test.ts` |
| OR-FPS-025 | `test/oracles/fixtures/capture-scripted-movement-path.json` | scripted movement path capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-scripted-movement-path.test.ts` |
