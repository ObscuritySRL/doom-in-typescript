# Master Checklist

- Total steps: 223
- First eligible step: `00-001 Classify Existing Plan`
- Runtime target: `bun run doom.ts`
- Rule: choose the first unchecked step whose prerequisites are complete.

## Phase 00: Governance / Plan Foundation

- [x] `00-001` `classify-existing-plan` | prereqs: `none` | file: `plan_fps/steps/00-001-classify-existing-plan.md`
- [x] `00-002` `declare-plan-fps-control-center` | prereqs: `00-001` | file: `plan_fps/steps/00-002-declare-plan-fps-control-center.md`
- [x] `00-003` `pin-bun-run-doom-entrypoint` | prereqs: `00-002` | file: `plan_fps/steps/00-003-pin-bun-run-doom-entrypoint.md`
- [x] `00-004` `reject-compiled-exe-target` | prereqs: `00-003` | file: `plan_fps/steps/00-004-reject-compiled-exe-target.md`
- [x] `00-005` `pin-bun-runtime-and-package-manager` | prereqs: `00-004` | file: `plan_fps/steps/00-005-pin-bun-runtime-and-package-manager.md`
- [x] `00-006` `record-bun-native-api-preference` | prereqs: `00-005` | file: `plan_fps/steps/00-006-record-bun-native-api-preference.md`
- [x] `00-007` `pin-writable-workspace-boundaries` | prereqs: `00-006` | file: `plan_fps/steps/00-007-pin-writable-workspace-boundaries.md`
- [x] `00-008` `pin-read-only-reference-boundaries` | prereqs: `00-007` | file: `plan_fps/steps/00-008-pin-read-only-reference-boundaries.md`
- [x] `00-009` `pin-asset-license-boundaries` | prereqs: `00-008` | file: `plan_fps/steps/00-009-pin-asset-license-boundaries.md`
- [x] `00-010` `pin-windowed-only-difference` | prereqs: `00-009` | file: `plan_fps/steps/00-010-pin-windowed-only-difference.md`
- [x] `00-011` `define-side-by-side-acceptance-standard` | prereqs: `00-010` | file: `plan_fps/steps/00-011-define-side-by-side-acceptance-standard.md`
- [x] `00-012` `define-step-validation-rules` | prereqs: `00-011` | file: `plan_fps/steps/00-012-define-step-validation-rules.md`
- [x] `00-013` `create-plan-validation-script` | prereqs: `00-012` | file: `plan_fps/steps/00-013-create-plan-validation-script.md`
- [x] `00-014` `test-plan-validation-script` | prereqs: `00-013` | file: `plan_fps/steps/00-014-test-plan-validation-script.md`

## Phase 01: Current Engine Audit

- [x] `01-001` `audit-existing-modules` | prereqs: `00-014` | file: `plan_fps/steps/01-001-audit-existing-modules.md`
- [x] `01-002` `audit-existing-tests` | prereqs: `01-001` | file: `plan_fps/steps/01-002-audit-existing-tests.md`
- [x] `01-003` `audit-existing-oracle-fixtures` | prereqs: `01-002` | file: `plan_fps/steps/01-003-audit-existing-oracle-fixtures.md`
- [x] `01-004` `audit-existing-manifests` | prereqs: `01-003` | file: `plan_fps/steps/01-004-audit-existing-manifests.md`
- [x] `01-005` `audit-pure-engine-surface` | prereqs: `01-004` | file: `plan_fps/steps/01-005-audit-pure-engine-surface.md`
- [x] `01-006` `audit-playable-host-surface` | prereqs: `01-005` | file: `plan_fps/steps/01-006-audit-playable-host-surface.md`
- [x] `01-007` `audit-missing-bun-run-doom-entrypoint` | prereqs: `01-006` | file: `plan_fps/steps/01-007-audit-missing-bun-run-doom-entrypoint.md`
- [x] `01-008` `audit-missing-launch-to-menu` | prereqs: `01-007` | file: `plan_fps/steps/01-008-audit-missing-launch-to-menu.md`
- [x] `01-009` `audit-missing-menu-to-e1m1` | prereqs: `01-008` | file: `plan_fps/steps/01-009-audit-missing-menu-to-e1m1.md`
- [x] `01-010` `audit-missing-live-input` | prereqs: `01-009` | file: `plan_fps/steps/01-010-audit-missing-live-input.md`
- [x] `01-011` `audit-missing-live-audio` | prereqs: `01-010` | file: `plan_fps/steps/01-011-audit-missing-live-audio.md`
- [x] `01-012` `audit-missing-live-rendering` | prereqs: `01-011` | file: `plan_fps/steps/01-012-audit-missing-live-rendering.md`
- [x] `01-013` `audit-missing-save-load-ui` | prereqs: `01-012` | file: `plan_fps/steps/01-013-audit-missing-save-load-ui.md`
- [x] `01-014` `audit-missing-config-persistence` | prereqs: `01-013` | file: `plan_fps/steps/01-014-audit-missing-config-persistence.md`
- [x] `01-015` `audit-missing-side-by-side-replay` | prereqs: `01-014` | file: `plan_fps/steps/01-015-audit-missing-side-by-side-replay.md`

## Phase 02: Reference / Oracle Expansion

- [x] `02-001` `capture-implementation-clean-launch-expectations` | prereqs: `01-015` | file: `plan_fps/steps/02-001-capture-implementation-clean-launch-expectations.md`
- [x] `02-002` `capture-reference-clean-launch` | prereqs: `02-001` | file: `plan_fps/steps/02-002-capture-reference-clean-launch.md`
- [x] `02-003` `capture-startup-sequence` | prereqs: `02-002` | file: `plan_fps/steps/02-003-capture-startup-sequence.md`
- [x] `02-004` `capture-initial-title-frame` | prereqs: `02-003` | file: `plan_fps/steps/02-004-capture-initial-title-frame.md`
- [x] `02-005` `capture-first-menu-frame` | prereqs: `02-004` | file: `plan_fps/steps/02-005-capture-first-menu-frame.md`
- [x] `02-006` `capture-full-attract-loop-cycle` | prereqs: `02-005` | file: `plan_fps/steps/02-006-capture-full-attract-loop-cycle.md`
- [x] `02-007` `capture-demo1-playback-checkpoints` | prereqs: `02-006` | file: `plan_fps/steps/02-007-capture-demo1-playback-checkpoints.md`
- [x] `02-008` `capture-demo2-playback-checkpoints` | prereqs: `02-007` | file: `plan_fps/steps/02-008-capture-demo2-playback-checkpoints.md`
- [x] `02-009` `capture-demo3-playback-checkpoints` | prereqs: `02-008` | file: `plan_fps/steps/02-009-capture-demo3-playback-checkpoints.md`
- [x] `02-010` `capture-menu-open-close-behavior` | prereqs: `02-009` | file: `plan_fps/steps/02-010-capture-menu-open-close-behavior.md`
- [x] `02-011` `capture-new-game-menu-path` | prereqs: `02-010` | file: `plan_fps/steps/02-011-capture-new-game-menu-path.md`
- [x] `02-012` `capture-episode-menu-path` | prereqs: `02-011` | file: `plan_fps/steps/02-012-capture-episode-menu-path.md`
- [x] `02-013` `capture-skill-menu-path` | prereqs: `02-012` | file: `plan_fps/steps/02-013-capture-skill-menu-path.md`
- [x] `02-014` `capture-options-menu-path` | prereqs: `02-013` | file: `plan_fps/steps/02-014-capture-options-menu-path.md`
- [x] `02-015` `capture-sound-volume-menu-path` | prereqs: `02-014` | file: `plan_fps/steps/02-015-capture-sound-volume-menu-path.md`
- [x] `02-016` `capture-screen-size-detail-gamma-paths` | prereqs: `02-015` | file: `plan_fps/steps/02-016-capture-screen-size-detail-gamma-paths.md`
- [x] `02-017` `capture-save-load-menu-path` | prereqs: `02-016` | file: `plan_fps/steps/02-017-capture-save-load-menu-path.md`
- [x] `02-018` `capture-quit-confirmation-path` | prereqs: `02-017` | file: `plan_fps/steps/02-018-capture-quit-confirmation-path.md`
- [x] `02-019` `capture-e1m1-start-from-clean-launch` | prereqs: `02-018` | file: `plan_fps/steps/02-019-capture-e1m1-start-from-clean-launch.md`
- [x] `02-020` `capture-scripted-movement-path` | prereqs: `02-019` | file: `plan_fps/steps/02-020-capture-scripted-movement-path.md`
- [x] `02-021` `capture-scripted-combat-path` | prereqs: `02-020` | file: `plan_fps/steps/02-021-capture-scripted-combat-path.md`
- [x] `02-022` `capture-scripted-pickup-path` | prereqs: `02-021` | file: `plan_fps/steps/02-022-capture-scripted-pickup-path.md`
- [x] `02-023` `capture-scripted-door-use-path` | prereqs: `02-022` | file: `plan_fps/steps/02-023-capture-scripted-door-use-path.md`
- [x] `02-024` `capture-scripted-damage-death-path` | prereqs: `02-023` | file: `plan_fps/steps/02-024-capture-scripted-damage-death-path.md`
- [x] `02-025` `capture-scripted-intermission-path` | prereqs: `02-024` | file: `plan_fps/steps/02-025-capture-scripted-intermission-path.md`
- [x] `02-026` `capture-live-save-load-roundtrip` | prereqs: `02-025` | file: `plan_fps/steps/02-026-capture-live-save-load-roundtrip.md`
- [x] `02-027` `capture-sfx-hash-windows` | prereqs: `02-026` | file: `plan_fps/steps/02-027-capture-sfx-hash-windows.md`
- [x] `02-028` `capture-music-event-hash-windows` | prereqs: `02-027` | file: `plan_fps/steps/02-028-capture-music-event-hash-windows.md`
- [x] `02-029` `capture-framebuffer-hash-windows` | prereqs: `02-028` | file: `plan_fps/steps/02-029-capture-framebuffer-hash-windows.md`
- [x] `02-030` `capture-state-hash-windows` | prereqs: `02-029` | file: `plan_fps/steps/02-030-capture-state-hash-windows.md`
- [x] `02-031` `capture-final-side-by-side-replay` | prereqs: `02-030` | file: `plan_fps/steps/02-031-capture-final-side-by-side-replay.md`

## Phase 03: Bun Runtime Entry Point

- [x] `03-001` `add-root-doom-ts-command-contract` | prereqs: `02-031` | file: `plan_fps/steps/03-001-add-root-doom-ts-command-contract.md`
- [x] `03-002` `wire-root-doom-ts-entrypoint` | prereqs: `03-001` | file: `plan_fps/steps/03-002-wire-root-doom-ts-entrypoint.md`
- [x] `03-003` `add-dev-launch-smoke-test` | prereqs: `03-002` | file: `plan_fps/steps/03-003-add-dev-launch-smoke-test.md`
- [x] `03-004` `wire-bun-native-file-loading` | prereqs: `03-003` | file: `plan_fps/steps/03-004-wire-bun-native-file-loading.md`
- [x] `03-005` `wire-bun-native-process-oracle-helpers` | prereqs: `03-004` | file: `plan_fps/steps/03-005-wire-bun-native-process-oracle-helpers.md`
- [x] `03-006` `wire-bun-test-integration` | prereqs: `03-005` | file: `plan_fps/steps/03-006-wire-bun-test-integration.md`
- [x] `03-007` `implement-iwad-discovery` | prereqs: `03-006` | file: `plan_fps/steps/03-007-implement-iwad-discovery.md`
- [x] `03-008` `implement-missing-iwad-error` | prereqs: `03-007` | file: `plan_fps/steps/03-008-implement-missing-iwad-error.md`
- [x] `03-009` `implement-default-config-loading` | prereqs: `03-008` | file: `plan_fps/steps/03-009-implement-default-config-loading.md`
- [x] `03-010` `create-game-context` | prereqs: `03-009` | file: `plan_fps/steps/03-010-create-game-context.md`
- [x] `03-011` `enter-default-title-loop` | prereqs: `03-010` | file: `plan_fps/steps/03-011-enter-default-title-loop.md`
- [x] `03-012` `implement-clean-quit` | prereqs: `03-011` | file: `plan_fps/steps/03-012-implement-clean-quit.md`
- [x] `03-013` `implement-fatal-error-handling` | prereqs: `03-012` | file: `plan_fps/steps/03-013-implement-fatal-error-handling.md`
- [x] `03-014` `implement-startup-logging` | prereqs: `03-013` | file: `plan_fps/steps/03-014-implement-startup-logging.md`
- [x] `03-015` `implement-deterministic-reset-seed` | prereqs: `03-014` | file: `plan_fps/steps/03-015-implement-deterministic-reset-seed.md`

## Phase 04: Window Host

- [x] `04-001` `create-bun-compatible-win32-window` | prereqs: `03-015` | file: `plan_fps/steps/04-001-create-bun-compatible-win32-window.md`
- [x] `04-002` `set-window-title-policy` | prereqs: `04-001` | file: `plan_fps/steps/04-002-set-window-title-policy.md`
- [x] `04-003` `lock-internal-320x200-framebuffer` | prereqs: `04-002` | file: `plan_fps/steps/04-003-lock-internal-320x200-framebuffer.md`
- [x] `04-004` `present-windowed-framebuffer` | prereqs: `04-003` | file: `plan_fps/steps/04-004-present-windowed-framebuffer.md`
- [x] `04-005` `define-aspect-correction-policy` | prereqs: `04-004` | file: `plan_fps/steps/04-005-define-aspect-correction-policy.md`
- [x] `04-006` `define-integer-nearest-scaling-policy` | prereqs: `04-005` | file: `plan_fps/steps/04-006-define-integer-nearest-scaling-policy.md`
- [x] `04-007` `define-resize-policy` | prereqs: `04-006` | file: `plan_fps/steps/04-007-define-resize-policy.md`
- [x] `04-008` `handle-window-focus` | prereqs: `04-007` | file: `plan_fps/steps/04-008-handle-window-focus.md`
- [x] `04-009` `handle-close-button` | prereqs: `04-008` | file: `plan_fps/steps/04-009-handle-close-button.md`
- [x] `04-010` `run-message-pump` | prereqs: `04-009` | file: `plan_fps/steps/04-010-run-message-pump.md`
- [x] `04-011` `blit-framebuffer-to-window` | prereqs: `04-010` | file: `plan_fps/steps/04-011-blit-framebuffer-to-window.md`
- [x] `04-012` `apply-playpal-palette` | prereqs: `04-011` | file: `plan_fps/steps/04-012-apply-playpal-palette.md`
- [x] `04-013` `prevent-host-filtering` | prereqs: `04-012` | file: `plan_fps/steps/04-013-prevent-host-filtering.md`
- [x] `04-014` `add-screenshot-capture-hooks` | prereqs: `04-013` | file: `plan_fps/steps/04-014-add-screenshot-capture-hooks.md`

## Phase 05: Real-Time Main Loop

- [x] `05-001` `schedule-35hz-game-tics` | prereqs: `04-014` | file: `plan_fps/steps/05-001-schedule-35hz-game-tics.md`
- [x] `05-002` `implement-bun-compatible-timing` | prereqs: `05-001` | file: `plan_fps/steps/05-002-implement-bun-compatible-timing.md`
- [x] `05-003` `implement-tic-accumulation` | prereqs: `05-002` | file: `plan_fps/steps/05-003-implement-tic-accumulation.md`
- [x] `05-004` `implement-deterministic-replay-mode` | prereqs: `05-003` | file: `plan_fps/steps/05-004-implement-deterministic-replay-mode.md`
- [x] `05-005` `schedule-presentation` | prereqs: `05-004` | file: `plan_fps/steps/05-005-schedule-presentation.md`
- [x] `05-006` `handle-long-stall-panic` | prereqs: `05-005` | file: `plan_fps/steps/05-006-handle-long-stall-panic.md`
- [x] `05-007` `handle-pause-focus-timing` | prereqs: `05-006` | file: `plan_fps/steps/05-007-handle-pause-focus-timing.md`
- [x] `05-008` `prevent-frame-rate-dependent-simulation` | prereqs: `05-007` | file: `plan_fps/steps/05-008-prevent-frame-rate-dependent-simulation.md`
- [x] `05-009` `reject-visible-interpolation` | prereqs: `05-008` | file: `plan_fps/steps/05-009-reject-visible-interpolation.md`
- [x] `05-010` `implement-clean-main-loop-shutdown` | prereqs: `05-009` | file: `plan_fps/steps/05-010-implement-clean-main-loop-shutdown.md`
- [x] `05-011` `add-timing-instrumentation` | prereqs: `05-010` | file: `plan_fps/steps/05-011-add-timing-instrumentation.md`

## Phase 06: Input

- [x] `06-001` `translate-keyboard-events` | prereqs: `05-011` | file: `plan_fps/steps/06-001-translate-keyboard-events.md`
- [x] `06-002` `map-internal-doom-keys` | prereqs: `06-001` | file: `plan_fps/steps/06-002-map-internal-doom-keys.md`
- [x] `06-003` `preserve-scan-code-config-relationship` | prereqs: `06-002` | file: `plan_fps/steps/06-003-preserve-scan-code-config-relationship.md`
- [x] `06-004` `preserve-key-down-up-ordering` | prereqs: `06-003` | file: `plan_fps/steps/06-004-preserve-key-down-up-ordering.md`
- [x] `06-005` `preserve-key-repeat-behavior` | prereqs: `06-004` | file: `plan_fps/steps/06-005-preserve-key-repeat-behavior.md`
- [x] `06-006` `map-mouse-buttons` | prereqs: `06-005` | file: `plan_fps/steps/06-006-map-mouse-buttons.md`
- [x] `06-007` `accumulate-mouse-movement` | prereqs: `06-006` | file: `plan_fps/steps/06-007-accumulate-mouse-movement.md`
- [x] `06-008` `define-mouse-capture-policy` | prereqs: `06-007` | file: `plan_fps/steps/06-008-define-mouse-capture-policy.md`
- [x] `06-009` `release-input-on-focus-loss` | prereqs: `06-008` | file: `plan_fps/steps/06-009-release-input-on-focus-loss.md`
- [x] `06-010` `route-menu-input` | prereqs: `06-009` | file: `plan_fps/steps/06-010-route-menu-input.md`
- [x] `06-011` `route-gameplay-input` | prereqs: `06-010` | file: `plan_fps/steps/06-011-route-gameplay-input.md`
- [x] `06-012` `inject-demo-scripted-input` | prereqs: `06-011` | file: `plan_fps/steps/06-012-inject-demo-scripted-input.md`
- [x] `06-013` `record-input-trace-format` | prereqs: `06-012` | file: `plan_fps/steps/06-013-record-input-trace-format.md`
- [x] `06-014` `replay-deterministic-input` | prereqs: `06-013` | file: `plan_fps/steps/06-014-replay-deterministic-input.md`

## Phase 07: Front-End / Menus

- [x] `07-001` `render-title-screen` | prereqs: `06-014` | file: `plan_fps/steps/07-001-render-title-screen.md`
- [x] `07-002` `implement-attract-loop-state-machine` | prereqs: `07-001` | file: `plan_fps/steps/07-002-implement-attract-loop-state-machine.md`
- [x] `07-003` `preserve-demo-playback-menu-interaction` | prereqs: `07-002` | file: `plan_fps/steps/07-003-preserve-demo-playback-menu-interaction.md`
- [x] `07-004` `implement-main-menu` | prereqs: `07-003` | file: `plan_fps/steps/07-004-implement-main-menu.md`
- [x] `07-005` `implement-new-game-menu` | prereqs: `07-004` | file: `plan_fps/steps/07-005-implement-new-game-menu.md`
- [x] `07-006` `implement-episode-select-menu` | prereqs: `07-005` | file: `plan_fps/steps/07-006-implement-episode-select-menu.md`
- [x] `07-007` `implement-skill-select-menu` | prereqs: `07-006` | file: `plan_fps/steps/07-007-implement-skill-select-menu.md`
- [x] `07-008` `implement-options-menu` | prereqs: `07-007` | file: `plan_fps/steps/07-008-implement-options-menu.md`
- [x] `07-009` `implement-sound-volume-menu` | prereqs: `07-008` | file: `plan_fps/steps/07-009-implement-sound-volume-menu.md`
- [x] `07-010` `implement-screen-size-detail-gamma-controls` | prereqs: `07-009` | file: `plan_fps/steps/07-010-implement-screen-size-detail-gamma-controls.md`
- [x] `07-011` `implement-messages-toggle` | prereqs: `07-010` | file: `plan_fps/steps/07-011-implement-messages-toggle.md`
- [x] `07-012` `implement-save-game-menu` | prereqs: `07-011` | file: `plan_fps/steps/07-012-implement-save-game-menu.md`
- [x] `07-013` `implement-load-game-menu` | prereqs: `07-012` | file: `plan_fps/steps/07-013-implement-load-game-menu.md`
- [x] `07-014` `implement-read-this-help-pages` | prereqs: `07-013` | file: `plan_fps/steps/07-014-implement-read-this-help-pages.md`
- [x] `07-015` `implement-quit-confirmation` | prereqs: `07-014` | file: `plan_fps/steps/07-015-implement-quit-confirmation.md`
- [x] `07-016` `implement-menu-sound-events` | prereqs: `07-015` | file: `plan_fps/steps/07-016-implement-menu-sound-events.md`
- [x] `07-017` `render-skull-cursor` | prereqs: `07-016` | file: `plan_fps/steps/07-017-render-skull-cursor.md`
- [x] `07-018` `render-menu-text` | prereqs: `07-017` | file: `plan_fps/steps/07-018-render-menu-text.md`
- [x] `07-019` `preserve-menu-timing-idle-behavior` | prereqs: `07-018` | file: `plan_fps/steps/07-019-preserve-menu-timing-idle-behavior.md`
- [x] `07-020` `implement-return-to-title-flow` | prereqs: `07-019` | file: `plan_fps/steps/07-020-implement-return-to-title-flow.md`

## Phase 08: Game Session Wiring

- [x] `08-001` `start-e1m1-from-menu` | prereqs: `07-020` | file: `plan_fps/steps/08-001-start-e1m1-from-menu.md`
- [x] `08-002` `start-shareware-maps-through-valid-routes` | prereqs: `08-001` | file: `plan_fps/steps/08-002-start-shareware-maps-through-valid-routes.md`
- [x] `08-003` `wire-player-spawn-session` | prereqs: `08-002` | file: `plan_fps/steps/08-003-wire-player-spawn-session.md`
- [x] `08-004` `enforce-game-tick-order` | prereqs: `08-003` | file: `plan_fps/steps/08-004-enforce-game-tick-order.md`
- [x] `08-005` `wire-world-thinker-ticking` | prereqs: `08-004` | file: `plan_fps/steps/08-005-wire-world-thinker-ticking.md`
- [x] `08-006` `wire-player-command-application` | prereqs: `08-005` | file: `plan_fps/steps/08-006-wire-player-command-application.md`
- [x] `08-007` `wire-gameplay-renderer-invocation` | prereqs: `08-006` | file: `plan_fps/steps/08-007-wire-gameplay-renderer-invocation.md`
- [x] `08-008` `wire-status-bar-invocation` | prereqs: `08-007` | file: `plan_fps/steps/08-008-wire-status-bar-invocation.md`
- [x] `08-009` `wire-automap-toggle-render-path` | prereqs: `08-008` | file: `plan_fps/steps/08-009-wire-automap-toggle-render-path.md`
- [x] `08-010` `wire-intermission-and-finale-transitions` | prereqs: `08-009` | file: `plan_fps/steps/08-010-wire-intermission-and-finale-transitions.md`
- [x] `08-011` `wire-death-reborn-flow` | prereqs: `08-010` | file: `plan_fps/steps/08-011-wire-death-reborn-flow.md`
- [x] `08-012` `wire-level-exit-flow` | prereqs: `08-011` | file: `plan_fps/steps/08-012-wire-level-exit-flow.md`
- [x] `08-013` `wire-pause-menu-overlay-flow` | prereqs: `08-012` | file: `plan_fps/steps/08-013-wire-pause-menu-overlay-flow.md`
- [x] `08-014` `wire-live-sound-music-triggers` | prereqs: `08-013` | file: `plan_fps/steps/08-014-wire-live-sound-music-triggers.md`

## Phase 09: Rendering Product Integration

- [x] `09-001` `render-full-frame-every-visible-tic` | prereqs: `08-014` | file: `plan_fps/steps/09-001-render-full-frame-every-visible-tic.md`
- [x] `09-002` `render-viewport-borders` | prereqs: `09-001` | file: `plan_fps/steps/09-002-render-viewport-borders.md`
- [x] `09-003` `render-status-bar-product-frame` | prereqs: `09-002` | file: `plan_fps/steps/09-003-render-status-bar-product-frame.md`
- [x] `09-004` `compose-menu-overlay` | prereqs: `09-003` | file: `plan_fps/steps/09-004-compose-menu-overlay.md`
- [x] `09-005` `render-title-help-credit-pages` | prereqs: `09-004` | file: `plan_fps/steps/09-005-render-title-help-credit-pages.md`
- [x] `09-006` `render-intermission-screens` | prereqs: `09-005` | file: `plan_fps/steps/09-006-render-intermission-screens.md`
- [x] `09-007` `render-finale-screens` | prereqs: `09-006` | file: `plan_fps/steps/09-007-render-finale-screens.md`
- [x] `09-008` `render-automap-overlay-and-full-mode` | prereqs: `09-007` | file: `plan_fps/steps/09-008-render-automap-overlay-and-full-mode.md`
- [x] `09-009` `apply-palette-effects-and-gamma` | prereqs: `09-008` | file: `plan_fps/steps/09-009-apply-palette-effects-and-gamma.md`
- [x] `09-010` `render-detail-mode` | prereqs: `09-009` | file: `plan_fps/steps/09-010-render-detail-mode.md`
- [x] `09-011` `render-screenblocks` | prereqs: `09-010` | file: `plan_fps/steps/09-011-render-screenblocks.md`
- [x] `09-012` `render-wipe-transition-effects` | prereqs: `09-011` | file: `plan_fps/steps/09-012-render-wipe-transition-effects.md`
- [x] `09-013` `add-framebuffer-hash-test-hooks` | prereqs: `09-012` | file: `plan_fps/steps/09-013-add-framebuffer-hash-test-hooks.md`

## Phase 10: Audio Product Integration

- [x] `10-001` `select-and-open-bun-win32-audio-host` | prereqs: `09-013` | file: `plan_fps/steps/10-001-select-and-open-bun-win32-audio-host.md`
- [x] `10-002` `connect-sfx-mixer` | prereqs: `10-001` | file: `plan_fps/steps/10-002-connect-sfx-mixer.md`
- [x] `10-003` `lock-sfx-channel-count` | prereqs: `10-002` | file: `plan_fps/steps/10-003-lock-sfx-channel-count.md`
- [ ] `10-004` `implement-sfx-priority-eviction` | prereqs: `10-003` | file: `plan_fps/steps/10-004-implement-sfx-priority-eviction.md`
- [ ] `10-005` `update-sfx-spatialization` | prereqs: `10-004` | file: `plan_fps/steps/10-005-update-sfx-spatialization.md`
- [ ] `10-006` `connect-music-system` | prereqs: `10-005` | file: `plan_fps/steps/10-006-connect-music-system.md`
- [ ] `10-007` `preserve-opl-mus-timing` | prereqs: `10-006` | file: `plan_fps/steps/10-007-preserve-opl-mus-timing.md`
- [ ] `10-008` `pause-and-resume-audio` | prereqs: `10-007` | file: `plan_fps/steps/10-008-pause-and-resume-audio.md`
- [ ] `10-009` `play-menu-sounds` | prereqs: `10-008` | file: `plan_fps/steps/10-009-play-menu-sounds.md`
- [ ] `10-010` `play-level-music` | prereqs: `10-009` | file: `plan_fps/steps/10-010-play-level-music.md`
- [ ] `10-011` `play-intermission-finale-music` | prereqs: `10-010` | file: `plan_fps/steps/10-011-play-intermission-finale-music.md`
- [ ] `10-012` `wire-volume-controls` | prereqs: `10-011` | file: `plan_fps/steps/10-012-wire-volume-controls.md`
- [ ] `10-013` `shutdown-audio-cleanly` | prereqs: `10-012` | file: `plan_fps/steps/10-013-shutdown-audio-cleanly.md`
- [ ] `10-014` `capture-audio-hash-windows` | prereqs: `10-013` | file: `plan_fps/steps/10-014-capture-audio-hash-windows.md`

## Phase 11: Save / Load Playability

- [ ] `11-001` `implement-save-slot-ui` | prereqs: `10-014` | file: `plan_fps/steps/11-001-implement-save-slot-ui.md`
- [ ] `11-002` `implement-save-descriptions` | prereqs: `11-001` | file: `plan_fps/steps/11-002-implement-save-descriptions.md`
- [ ] `11-003` `define-save-file-path-policy` | prereqs: `11-002` | file: `plan_fps/steps/11-003-define-save-file-path-policy.md`
- [ ] `11-004` `wire-bun-native-save-read-write` | prereqs: `11-003` | file: `plan_fps/steps/11-004-wire-bun-native-save-read-write.md`
- [ ] `11-005` `implement-live-game-save-load` | prereqs: `11-004` | file: `plan_fps/steps/11-005-implement-live-game-save-load.md`
- [ ] `11-006` `validate-savegame-version` | prereqs: `11-005` | file: `plan_fps/steps/11-006-validate-savegame-version.md`
- [ ] `11-007` `handle-corrupted-save` | prereqs: `11-006` | file: `plan_fps/steps/11-007-handle-corrupted-save.md`
- [ ] `11-008` `display-save-load-menu-messages` | prereqs: `11-007` | file: `plan_fps/steps/11-008-display-save-load-menu-messages.md`
- [ ] `11-009` `restore-game-state-from-save` | prereqs: `11-008` | file: `plan_fps/steps/11-009-restore-game-state-from-save.md`
- [ ] `11-010` `restore-post-load-render-audio-input-state` | prereqs: `11-009` | file: `plan_fps/steps/11-010-restore-post-load-render-audio-input-state.md`
- [ ] `11-011` `add-live-save-load-roundtrip-hash-tests` | prereqs: `11-010` | file: `plan_fps/steps/11-011-add-live-save-load-roundtrip-hash-tests.md`

## Phase 12: Config / Persistence

- [ ] `12-001` `load-default-config` | prereqs: `11-011` | file: `plan_fps/steps/12-001-load-default-config.md`
- [ ] `12-002` `write-config-back` | prereqs: `12-001` | file: `plan_fps/steps/12-002-write-config-back.md`
- [ ] `12-003` `persist-key-bindings` | prereqs: `12-002` | file: `plan_fps/steps/12-003-persist-key-bindings.md`
- [ ] `12-004` `persist-mouse-settings` | prereqs: `12-003` | file: `plan_fps/steps/12-004-persist-mouse-settings.md`
- [ ] `12-005` `persist-sound-settings` | prereqs: `12-004` | file: `plan_fps/steps/12-005-persist-sound-settings.md`
- [ ] `12-006` `persist-screen-settings` | prereqs: `12-005` | file: `plan_fps/steps/12-006-persist-screen-settings.md`
- [ ] `12-007` `define-save-and-window-path-policies` | prereqs: `12-006` | file: `plan_fps/steps/12-007-define-save-and-window-path-policies.md`
- [ ] `12-008` `persist-vanilla-compatibility-flags` | prereqs: `12-007` | file: `plan_fps/steps/12-008-persist-vanilla-compatibility-flags.md`
- [ ] `12-009` `isolate-tests-from-user-local-config` | prereqs: `12-008` | file: `plan_fps/steps/12-009-isolate-tests-from-user-local-config.md`

## Phase 13: Demo / Replay

- [ ] `13-001` `play-bundled-demos-through-title-loop` | prereqs: `12-009` | file: `plan_fps/steps/13-001-play-bundled-demos-through-title-loop.md`
- [ ] `13-002` `replay-demo1-deterministically` | prereqs: `13-001` | file: `plan_fps/steps/13-002-replay-demo1-deterministically.md`
- [ ] `13-003` `replay-demo2-deterministically` | prereqs: `13-002` | file: `plan_fps/steps/13-003-replay-demo2-deterministically.md`
- [ ] `13-004` `replay-demo3-deterministically` | prereqs: `13-003` | file: `plan_fps/steps/13-004-replay-demo3-deterministically.md`
- [ ] `13-005` `convert-demo-input-stream` | prereqs: `13-004` | file: `plan_fps/steps/13-005-convert-demo-input-stream.md`
- [ ] `13-006` `preserve-demo-termination-behavior` | prereqs: `13-005` | file: `plan_fps/steps/13-006-preserve-demo-termination-behavior.md`
- [ ] `13-007` `replay-scripted-input-from-clean-launch` | prereqs: `13-006` | file: `plan_fps/steps/13-007-replay-scripted-input-from-clean-launch.md`
- [ ] `13-008` `capture-replay-framebuffer-state-audio-music` | prereqs: `13-007` | file: `plan_fps/steps/13-008-capture-replay-framebuffer-state-audio-music.md`
- [ ] `13-009` `detect-long-run-drift` | prereqs: `13-008` | file: `plan_fps/steps/13-009-detect-long-run-drift.md`
- [ ] `13-010` `accept-clean-launch-to-gameplay-replay` | prereqs: `13-009` | file: `plan_fps/steps/13-010-accept-clean-launch-to-gameplay-replay.md`
- [ ] `13-011` `accept-attract-loop-and-long-run-replays` | prereqs: `13-010` | file: `plan_fps/steps/13-011-accept-attract-loop-and-long-run-replays.md`

## Phase 14: Bun Launch / Local Distribution Boundary

- [ ] `14-001` `lock-bun-run-doom-command` | prereqs: `13-011` | file: `plan_fps/steps/14-001-lock-bun-run-doom-command.md`
- [ ] `14-002` `document-required-local-files` | prereqs: `14-001` | file: `plan_fps/steps/14-002-document-required-local-files.md`
- [ ] `14-003` `verify-iwad-discovery-at-launch` | prereqs: `14-002` | file: `plan_fps/steps/14-003-verify-iwad-discovery-at-launch.md`
- [ ] `14-004` `verify-missing-data-error-path` | prereqs: `14-003` | file: `plan_fps/steps/14-004-verify-missing-data-error-path.md`
- [ ] `14-005` `prevent-forbidden-asset-redistribution` | prereqs: `14-004` | file: `plan_fps/steps/14-005-prevent-forbidden-asset-redistribution.md`
- [ ] `14-006` `write-readme-usage-instructions` | prereqs: `14-005` | file: `plan_fps/steps/14-006-write-readme-usage-instructions.md`
- [ ] `14-007` `smoke-test-clean-local-working-tree` | prereqs: `14-006` | file: `plan_fps/steps/14-007-smoke-test-clean-local-working-tree.md`

## Phase 15: Acceptance Gates

- [ ] `15-001` `gate-plan-structure` | prereqs: `14-007` | file: `plan_fps/steps/15-001-gate-plan-structure.md`
- [ ] `15-002` `gate-bun-launch-smoke` | prereqs: `15-001` | file: `plan_fps/steps/15-002-gate-bun-launch-smoke.md`
- [ ] `15-003` `gate-title-frame` | prereqs: `15-002` | file: `plan_fps/steps/15-003-gate-title-frame.md`
- [ ] `15-004` `gate-menu-navigation` | prereqs: `15-003` | file: `plan_fps/steps/15-004-gate-menu-navigation.md`
- [ ] `15-005` `gate-e1m1-start` | prereqs: `15-004` | file: `plan_fps/steps/15-005-gate-e1m1-start.md`
- [ ] `15-006` `gate-input-replay` | prereqs: `15-005` | file: `plan_fps/steps/15-006-gate-input-replay.md`
- [ ] `15-007` `gate-audio` | prereqs: `15-006` | file: `plan_fps/steps/15-007-gate-audio.md`
- [ ] `15-008` `gate-save-load` | prereqs: `15-007` | file: `plan_fps/steps/15-008-gate-save-load.md`
- [ ] `15-009` `gate-attract-loop-and-long-run` | prereqs: `15-008` | file: `plan_fps/steps/15-009-gate-attract-loop-and-long-run.md`
- [ ] `15-010` `gate-final-side-by-side` | prereqs: `15-009` | file: `plan_fps/steps/15-010-gate-final-side-by-side.md`
