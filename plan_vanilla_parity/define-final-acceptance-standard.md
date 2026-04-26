# Define Final Acceptance Standard

This document pins the canonical final acceptance standard that every Ralph-loop step in the vanilla DOOM 1.9 parity rebuild must satisfy when proving the implementation is indistinguishable from a clean local DOOM reference. It freezes the canonical acceptance lane identifier `acceptance` declared by `plan_vanilla_parity/PARALLEL_WORK.md`, the canonical acceptance gate phase identifier `13` and phase title `Final Proof / Handoff` declared by `plan_vanilla_parity/MASTER_CHECKLIST.md`, the canonical four acceptance gate ids in canonical order (`13-001` `gate-shareware-doom-one-full-playthrough`, `13-002` `gate-registered-doom-user-supplied-iwad-scope`, `13-003` `gate-ultimate-doom-user-supplied-iwad-scope`, `13-004` `gate-full-final-side-by-side-proof`), the canonical final side-by-side gate id `13-004` and slug `gate-full-final-side-by-side-proof` declared by `plan_vanilla_parity/establish-vanilla-parity-control-center.md` and enforced by `validateFinalGate` in `plan_vanilla_parity/validate-plan.ts`, the canonical four acceptance lane owned writable roots (`plan_vanilla_parity/final-gates/`, `src/oracles/`, `test/parity/`, `test/vanilla_parity/acceptance/`) declared by the `acceptance` row of `plan_vanilla_parity/PARALLEL_WORK.md`, the canonical eleven acceptance prerequisite gate ids in canonical order (`02-035`, `03-036`, `04-030`, `05-028`, `06-032`, `07-034`, `08-032`, `09-038`, `10-028`, `11-031`, `12-028`) declared verbatim by every Phase 13 acceptance gate's `## prerequisites` block in `plan_vanilla_parity/MASTER_CHECKLIST.md`, the canonical runtime target `bun run doom.ts` pinned by `plan_vanilla_parity/establish-vanilla-parity-control-center.md`, the canonical clean launch rule (both sides start from clean launch state with no prior process state, no prior config drift, and no prior input replay), the canonical deterministic input stream rule (the implementation and the selected local reference must be driven by the exact same deterministic input stream from launch), the canonical nine comparison surfaces in canonical order (deterministic state, framebuffer, audio, music events, menu transitions, level transitions, save/load bytes, demo playback, full-playthrough completion) declared verbatim by `plan_vanilla_parity/README.md` and `plan_vanilla_parity/establish-vanilla-parity-control-center.md` and enforced by the `REQUIRED_FINAL_GATE_PHRASES` array in `plan_vanilla_parity/validate-plan.ts`, the canonical zero default differences rule (the default allowed difference is none and the final side-by-side gate accepts only zero default differences), the canonical sampled hashes intermediate rule (intermediate gates may use sampled hashes; final gates may not), the canonical twelve required final gate phrases pinned verbatim by the `REQUIRED_FINAL_GATE_PHRASES` array in `plan_vanilla_parity/validate-plan.ts` (`bun run doom.ts`, `same deterministic input stream`, `deterministic state`, `framebuffer`, `audio`, `music events`, `menu transitions`, `level transitions`, `save/load bytes`, `demo playback`, `full-playthrough completion`, `zero default differences`), the canonical five rejected final evidence patterns pinned verbatim by the `REJECTED_FINAL_EVIDENCE_PATTERNS` array in `plan_vanilla_parity/validate-plan.ts` (`pending`, `manifest-only`, `sampled-only`, `intent-only`, `declared intent`), the canonical merge checkpoint identifier `G6` and merge checkpoint title `full final side-by-side proof` declared verbatim by `plan_vanilla_parity/PARALLEL_WORK.md`, the canonical OR-VP-012 final side-by-side family anchor pinned by `plan_vanilla_parity/REFERENCE_ORACLES.md` and `plan_vanilla_parity/define-oracle-capture-policy.md` (minimum evidence `Clean-launch paired run using the same input stream and zero default allowed differences.`), and the canonical no proprietary bytes rule pinned by `plan_vanilla_parity/define-oracle-capture-policy.md` (acceptance gate artifacts must encode SHA-256 hashes and structural metadata rather than proprietary id Software bytes). Any future change to these invariants must update this document and its focused test in lockstep.

## scope name

vanilla DOOM 1.9 final acceptance standard

## emulated vanilla version

1.9

## reference engine

Chocolate Doom

## reference engine version

2.2.1

## acceptance lane identifier

acceptance

## acceptance gate phase

13

## acceptance gate phase title

Final Proof / Handoff

## acceptance gate count

4

## acceptance gate ids

- 13-001
- 13-002
- 13-003
- 13-004

## acceptance gate slugs

- gate-shareware-doom-one-full-playthrough
- gate-registered-doom-user-supplied-iwad-scope
- gate-ultimate-doom-user-supplied-iwad-scope
- gate-full-final-side-by-side-proof

## 13-001 acceptance gate

The `13-001` acceptance gate `gate-shareware-doom-one-full-playthrough` proves the implementation completes a full shareware DOOM 1.9 episode end-to-end against the canonical primary target `doom/DOOM1.WAD` pinned by `plan_vanilla_parity/establish-vanilla-parity-control-center.md`. The gate's write-locked artifact lives at `test/vanilla_parity/acceptance/gate-shareware-doom-one-full-playthrough.json` next to its focused test at `test/vanilla_parity/acceptance/gate-shareware-doom-one-full-playthrough.test.ts` under the canonical acceptance lane writable root `test/vanilla_parity/acceptance/`. The gate cites the `OR-VP-011` full playthrough family captured by Phase 02 step `02-033 capture-full-e1-route-oracle`.

## 13-002 acceptance gate

The `13-002` acceptance gate `gate-registered-doom-user-supplied-iwad-scope` proves the implementation handles the user-supplied registered DOOM scope (`DOOM.WAD` with `E3M1` present and `E4M1` absent) pinned by `plan_vanilla_parity/pin-user-supplied-registered-and-ultimate-iwad-scope.md`. The gate's write-locked artifact lives at `test/vanilla_parity/acceptance/gate-registered-doom-user-supplied-iwad-scope.json` next to its focused test at `test/vanilla_parity/acceptance/gate-registered-doom-user-supplied-iwad-scope.test.ts` under the canonical acceptance lane writable root `test/vanilla_parity/acceptance/`. The gate must skip cleanly when no `DOOM.WAD` is on disk under `doom/` or `iwad/` because the proprietary asset boundary pinned by `plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md` forbids bundling, regenerating, staging, or substituting the asset.

## 13-003 acceptance gate

The `13-003` acceptance gate `gate-ultimate-doom-user-supplied-iwad-scope` proves the implementation handles the user-supplied Ultimate DOOM scope (`DOOM.WAD` with `E4M1` present) pinned by `plan_vanilla_parity/pin-user-supplied-registered-and-ultimate-iwad-scope.md`. The gate's write-locked artifact lives at `test/vanilla_parity/acceptance/gate-ultimate-doom-user-supplied-iwad-scope.json` next to its focused test at `test/vanilla_parity/acceptance/gate-ultimate-doom-user-supplied-iwad-scope.test.ts` under the canonical acceptance lane writable root `test/vanilla_parity/acceptance/`. The gate must skip cleanly when no `DOOM.WAD` is on disk under `doom/` or `iwad/` because the proprietary asset boundary pinned by `plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md` forbids bundling, regenerating, staging, or substituting the asset.

## 13-004 acceptance gate

The `13-004` acceptance gate `gate-full-final-side-by-side-proof` proves clean-launch paired runs of the implementation under `bun run doom.ts` and the selected local reference using the same deterministic input stream from launch produce zero default differences across every canonical comparison surface. The gate's write-locked artifact lives at `test/vanilla_parity/acceptance/gate-full-final-side-by-side-proof.json` next to its focused test at `test/vanilla_parity/acceptance/gate-full-final-side-by-side-proof.test.ts` under the canonical acceptance lane writable root `test/vanilla_parity/acceptance/`. This gate is the canonical final side-by-side gate referenced by `plan_vanilla_parity/establish-vanilla-parity-control-center.md` (`final gate step id`, `final gate step slug`, `final gate step file path`) and enforced by `validateFinalGate` in `plan_vanilla_parity/validate-plan.ts` (the `FINAL_GATE_STEP_ID = '13-004'` constant, the canonical twelve required final gate phrases, and the canonical five rejected final evidence patterns). The gate cites the `OR-VP-012` final side-by-side family captured by the acceptance lane itself.

## final side-by-side gate id

13-004

## final side-by-side gate slug

gate-full-final-side-by-side-proof

## final side-by-side gate file path

plan_vanilla_parity/steps/13-004-gate-full-final-side-by-side-proof.md

## acceptance lane owned writable roots

- plan_vanilla_parity/final-gates/
- src/oracles/
- test/parity/
- test/vanilla_parity/acceptance/

## acceptance lane owned writable root count

4

## acceptance prerequisite gate count

11

## acceptance prerequisite gate ids

- 02-035
- 03-036
- 04-030
- 05-028
- 06-032
- 07-034
- 08-032
- 09-038
- 10-028
- 11-031
- 12-028

## acceptance prerequisite gate slugs

- 02-035 gate-oracle-foundation-without-deferred-status
- 03-036 gate-clean-launch-host-and-input
- 04-030 gate-demo-sync-primitives
- 05-028 gate-user-supplied-doom-wad-detection
- 06-032 gate-world-movement-against-oracle
- 07-034 gate-player-oracle-replay
- 08-032 gate-boss-and-episode-exit-semantics
- 09-038 gate-status-bar-and-automap-parity
- 10-028 gate-intermission-and-finale-parity
- 11-031 gate-music-opl-parity
- 12-028 gate-save-load-byte-parity

## runtime target

bun run doom.ts

## local reference rule

The canonical local reference selected for every acceptance gate is one of the local primary sources cataloged by `plan_vanilla_parity/SOURCE_CATALOG.md` and pinned by `plan_vanilla_parity/define-source-authority-order.md` under tier one. The practical executable secondary authority is the local Chocolate Doom Windows executable `doom/DOOM.EXE` cataloged as `SRC-LOCAL-002` when the local DOS executable `doom/DOOMD.EXE` cataloged as `SRC-LOCAL-001` cannot be run or instrumented on the host. The selected reference must be reproducible at the time the gate runs (its on-disk SHA-256 hash must be recorded in the gate's artifact alongside the implementation hash) and must never be redistributed because the proprietary asset boundary pinned by `plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md` and cataloged by `ASSET_BOUNDARIES`/`REFERENCE_BUNDLE_PATH` in `src/reference/policy.ts` forbids bundling, regenerating, staging, or publishing the asset.

## clean launch rule

Both the implementation and the selected local reference must start from clean launch state before any compared interaction. Clean launch state means no prior process state survives between the launcher invocation and the first compared interaction, no prior config drift survives across runs, and no prior input replay leaks into the new run. The canonical clean launch sequence under `bun run doom.ts` is the `D_DoomMain` init order followed by the `D_DoomLoop` per-frame schedule pinned by `plan_vanilla_parity/MASTER_CHECKLIST.md` Phase 03 launch lane steps; the reference clean launch sequence is its own DOS or Windows entrypoint. Both sides must reach the same comparable starting state (the title loop, the main menu, or a scripted scenario start point) before the deterministic input stream is replayed.

## deterministic input stream rule

The implementation and the selected local reference must be driven by the exact same deterministic input stream from launch. The deterministic input stream is the `OR-VP-002` input stream family pinned by `plan_vanilla_parity/REFERENCE_ORACLES.md` and `plan_vanilla_parity/define-oracle-capture-policy.md`, captured by Phase 02 steps `02-009 define-deterministic-input-stream-format` and `02-010 define-keyboard-and-mouse-injection-oracle`. The stream is a shared keyboard and mouse injection transcript with a hash that both sides re-play tic by tic. No human-typed input or wall-clock timing variance is allowed during the compared interaction; all input must come from the shared transcript. The acceptance gate artifact must record the input stream's SHA-256 hash so the comparison can be re-derived.

## comparison surface count

9

## comparison surfaces

- deterministic state
- framebuffer
- audio
- music events
- menu transitions
- level transitions
- save/load bytes
- demo playback
- full-playthrough completion

## zero default differences rule

The default allowed difference between the implementation and the selected local reference across every canonical comparison surface is none. The final side-by-side gate accepts only zero default differences. Any non-zero allowed difference must be a documented exception pinned by a separate governance document and cited by id in the gate artifact; no bare numeric tolerance is allowed without such a citation. The phrase `zero default differences` appears verbatim in the canonical twelve required final gate phrases pinned by `plan_vanilla_parity/validate-plan.ts` and is enforced by `validateFinalGate` against every Phase 13 acceptance gate's `## final evidence` section.

## sampled hashes intermediate rule

Intermediate gates may use sampled hashes (a finite number of representative tic snapshots, framebuffer windows, audio mixer windows, music event windows, or save byte snapshots) when the full evidence is captured in a paired Phase 02 oracle. Final gates may not. Every Phase 13 acceptance gate must reach the canonical zero default differences rule against the full deterministic input stream, not against a sampled subset. The phrase pinned verbatim by `plan_vanilla_parity/README.md` and `plan_vanilla_parity/establish-vanilla-parity-control-center.md` reads: `Intermediate gates may use sampled hashes. Final gates must run the implementation and reference from clean launch with the same deterministic input stream and compare deterministic state, framebuffer, audio, music events, menu transitions, level transitions, save/load bytes, demo playback, and full-playthrough completion.`

## required final gate phrase count

12

## required final gate phrases

- bun run doom.ts
- same deterministic input stream
- deterministic state
- framebuffer
- audio
- music events
- menu transitions
- level transitions
- save/load bytes
- demo playback
- full-playthrough completion
- zero default differences

## required final gate phrase enforcement

The canonical twelve required final gate phrases are pinned verbatim by the `REQUIRED_FINAL_GATE_PHRASES` array in `plan_vanilla_parity/validate-plan.ts`. The `validateFinalGate` helper extracts the `## final evidence` section of the final gate step file `plan_vanilla_parity/steps/13-004-gate-full-final-side-by-side-proof.md`, lowercases the section body, and emits the verbatim diagnostic `Final gate evidence must include <phrase>.` for every phrase that does not appear case-insensitively. This is the canonical mechanical enforcement of the final acceptance standard against the final gate step file.

## rejected final evidence pattern count

5

## rejected final evidence patterns

- pending
- manifest-only
- sampled-only
- intent-only
- declared intent

## rejected final evidence pattern enforcement

The canonical five rejected final evidence patterns are pinned verbatim by the `REJECTED_FINAL_EVIDENCE_PATTERNS` array in `plan_vanilla_parity/validate-plan.ts`. The `validateFinalGate` helper tests every pattern against the raw `## final evidence` section of the final gate step file `plan_vanilla_parity/steps/13-004-gate-full-final-side-by-side-proof.md` and emits the verbatim diagnostic `Final gate evidence must not rely on pending, manifest-only, sampled-only, or intent-only proof.` when any pattern matches. This is the canonical mechanical rejection of deferred, manifest-only, sampled-only, intent-only, or declared-intent proof for the final side-by-side gate.

## merge checkpoint identifier

G6

## merge checkpoint title

full final side-by-side proof

## merge checkpoint anchor

The canonical merge checkpoint identifier `G6` and merge checkpoint title `full final side-by-side proof` are declared verbatim by the `Merge checkpoints:` line of `plan_vanilla_parity/PARALLEL_WORK.md`: `Merge checkpoints: G0 plan validation, G1 real clean launch, G2 title/menu parity, G3 E1M1 entry parity, G4 demo-sync parity, G5 save/load parity, G6 full final side-by-side proof.` `G6` is the seventh and final merge checkpoint and corresponds to the `13-004` acceptance gate `gate-full-final-side-by-side-proof`. Every prior merge checkpoint (`G0` through `G5`) is a precondition that the eleven canonical acceptance prerequisite gates collectively satisfy.

## OR-VP-012 family anchor

The canonical `OR-VP-012` final side-by-side family is pinned by `plan_vanilla_parity/REFERENCE_ORACLES.md` and `plan_vanilla_parity/define-oracle-capture-policy.md` with the verbatim minimum evidence sentence `Clean-launch paired run using the same input stream and zero default allowed differences.` The acceptance lane owns the `OR-VP-012` family artifacts under the canonical acceptance lane writable roots `plan_vanilla_parity/final-gates/` and `test/vanilla_parity/acceptance/`. Every Phase 13 acceptance gate must record an `id` field equal to `OR-VP-012` or a slug-derived family token derived from the gate's title (for example `OR-VP-VP-013-001`), a `stepId` field equal to the gate's `13-NNN` step id, a `stepTitle` field equal to the gate's title, and a `lane` field equal to the literal `acceptance`, per the canonical four required oracle artifact fields pinned by `plan_vanilla_parity/define-oracle-capture-policy.md`.

## no proprietary bytes rule

Every Phase 13 acceptance gate artifact must satisfy the canonical no proprietary bytes rule pinned by `plan_vanilla_parity/define-oracle-capture-policy.md`. Specifically: no IWAD/PWAD lump bytes, no DOS executable bytes, no Chocolate Doom Windows executable bytes, no save bytes from a captured save file, no demo bytes from a captured demo lump, no audio sample bytes, and no music sample bytes. Acceptance gate artifacts may record paths, sizes, SHA-256 hashes, and derived structural metadata of files inside the read-only reference roots `doom/`, `iwad/`, and `reference/`, but the proprietary bytes themselves must remain inside those read-only roots. The proprietary asset boundary that motivates this rule is pinned by `plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md` and cataloged by `ASSET_BOUNDARIES`/`REFERENCE_BUNDLE_PATH` in `src/reference/policy.ts`.

## evidence locations

- AGENTS.md
- CLAUDE.md
- plan_vanilla_parity/MASTER_CHECKLIST.md
- plan_vanilla_parity/PARALLEL_WORK.md
- plan_vanilla_parity/PROMPT.md
- plan_vanilla_parity/README.md
- plan_vanilla_parity/REFERENCE_ORACLES.md
- plan_vanilla_parity/SOURCE_CATALOG.md
- plan_vanilla_parity/define-oracle-capture-policy.md
- plan_vanilla_parity/define-read-only-reference-roots.md
- plan_vanilla_parity/define-source-authority-order.md
- plan_vanilla_parity/define-step-file-required-fields.md
- plan_vanilla_parity/establish-vanilla-parity-control-center.md
- plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md
- plan_vanilla_parity/pin-user-supplied-registered-and-ultimate-iwad-scope.md
- plan_vanilla_parity/steps/13-001-gate-shareware-doom-one-full-playthrough.md
- plan_vanilla_parity/steps/13-002-gate-registered-doom-user-supplied-iwad-scope.md
- plan_vanilla_parity/steps/13-003-gate-ultimate-doom-user-supplied-iwad-scope.md
- plan_vanilla_parity/steps/13-004-gate-full-final-side-by-side-proof.md
- plan_vanilla_parity/validate-plan.test.ts
- plan_vanilla_parity/validate-plan.ts
- src/reference/policy.ts

## acceptance phrasing

Every Phase 13 acceptance gate in the vanilla DOOM 1.9 parity rebuild must run the implementation under the canonical runtime target `bun run doom.ts` and the selected local reference (cataloged by `plan_vanilla_parity/SOURCE_CATALOG.md` and pinned by `plan_vanilla_parity/define-source-authority-order.md`) from clean launch with the same deterministic input stream from launch. The four canonical Phase 13 acceptance gate ids `13-001`, `13-002`, `13-003`, and `13-004` and their corresponding slugs `gate-shareware-doom-one-full-playthrough`, `gate-registered-doom-user-supplied-iwad-scope`, `gate-ultimate-doom-user-supplied-iwad-scope`, and `gate-full-final-side-by-side-proof` are owned by the canonical `acceptance` lane declared by `plan_vanilla_parity/PARALLEL_WORK.md`, whose four canonical writable roots are `plan_vanilla_parity/final-gates/`, `src/oracles/`, `test/parity/`, and `test/vanilla_parity/acceptance/`. Every gate must compare the canonical nine surfaces `deterministic state`, `framebuffer`, `audio`, `music events`, `menu transitions`, `level transitions`, `save/load bytes`, `demo playback`, and `full-playthrough completion` with zero default differences; intermediate gates may use sampled hashes but final gates may not. The canonical eleven acceptance prerequisite gates `02-035`, `03-036`, `04-030`, `05-028`, `06-032`, `07-034`, `08-032`, `09-038`, `10-028`, `11-031`, and `12-028` must complete before any acceptance gate runs. The canonical final side-by-side gate `13-004 gate-full-final-side-by-side-proof` corresponds to the canonical merge checkpoint `G6 full final side-by-side proof` declared by `plan_vanilla_parity/PARALLEL_WORK.md` and the canonical `OR-VP-012` final side-by-side family pinned by `plan_vanilla_parity/REFERENCE_ORACLES.md`, and is mechanically enforced by `validateFinalGate` in `plan_vanilla_parity/validate-plan.ts` against the canonical twelve required final gate phrases (`bun run doom.ts`, `same deterministic input stream`, `deterministic state`, `framebuffer`, `audio`, `music events`, `menu transitions`, `level transitions`, `save/load bytes`, `demo playback`, `full-playthrough completion`, `zero default differences`) and the canonical five rejected final evidence patterns (`pending`, `manifest-only`, `sampled-only`, `intent-only`, `declared intent`).
