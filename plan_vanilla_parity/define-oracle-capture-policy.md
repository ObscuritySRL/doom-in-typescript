# Define Oracle Capture Policy

This document pins the canonical oracle capture policy that every Ralph-loop step in the vanilla DOOM 1.9 parity rebuild must follow when behavior cannot be verified from the canonical four verifiable evidence sources pinned by `plan_vanilla_parity/define-source-authority-order.md`. It freezes the canonical no-guess trigger rule pinned verbatim by `plan_vanilla_parity/PROMPT.md` (`If behavior cannot be verified from local binaries, IWAD data, id Software source, or Chocolate Doom source, create or update an oracle-capture step instead of guessing.`), the canonical four verifiable evidence sources (`local binaries`, `IWAD data`, `id Software source`, `Chocolate Doom source`), the canonical oracle capture phase identifier `02` pinned by `plan_vanilla_parity/MASTER_CHECKLIST.md` (Phase 02: Reference / Oracle Capture Foundation), the canonical oracle capture lane identifier `oracle` pinned by `plan_vanilla_parity/PARALLEL_WORK.md`, the canonical four allowed oracle output roots pinned by `plan_vanilla_parity/REFERENCE_ORACLES.md` (`plan_vanilla_parity/final-gates/`, `test/oracles/fixtures/`, `test/vanilla_parity/acceptance/`, `test/vanilla_parity/oracles/`), the canonical three read-only reference roots pinned by `plan_vanilla_parity/define-read-only-reference-roots.md` (`doom/`, `iwad/`, `reference/`) under which oracle artifacts must never be written, the canonical lane-to-output-root mapping (oracle lane owns `test/oracles/fixtures/` and `test/vanilla_parity/oracles/`; acceptance lane owns `plan_vanilla_parity/final-gates/` and `test/vanilla_parity/acceptance/`) declared by `plan_vanilla_parity/PARALLEL_WORK.md`, the canonical twelve oracle family identifiers `OR-VP-001`..`OR-VP-012` pinned by `plan_vanilla_parity/REFERENCE_ORACLES.md`, the canonical twelve oracle family minimum evidence summaries pinned verbatim by the same table (`OR-VP-001` clean launch, `OR-VP-002` input stream, `OR-VP-003` framebuffer, `OR-VP-004` state, `OR-VP-005` audio, `OR-VP-006` music, `OR-VP-007` menus, `OR-VP-008` levels, `OR-VP-009` save/load, `OR-VP-010` demos, `OR-VP-011` full playthrough, `OR-VP-012` final side by side), the canonical oracle artifact filename rule (`<slug>.json` next to `<slug>.test.ts` under one of the canonical four allowed oracle output roots, where `<slug>` matches the kebab-case slug after the `02-NNN-` step prefix), the canonical oracle artifact JSON encoding rule (UTF-8, parseable by `Bun.file().json()`, top-level value must be an `object`, no trailing commas, no comments, no JS-only literals `undefined`/`NaN`/`Infinity`), the canonical four required oracle artifact top-level fields in canonical order (`id`, `stepId`, `stepTitle`, `lane`), the canonical no-proprietary-bytes rule (no IWAD lump bytes, no DOS executable bytes, no save bytes, no demo bytes, no audio/music samples; only paths/sizes/hashes/derived metadata of files inside the read-only reference roots `doom/`, `iwad/`, `reference/` are allowed), and the canonical oracle redirect rule pinned verbatim by `plan_vanilla_parity/REFERENCE_ORACLES.md` (`Oracle artifacts must be generated under writable paths such as test/vanilla_parity/oracles/, test/oracles/fixtures/, test/vanilla_parity/acceptance/, or plan_vanilla_parity/final-gates/. Never write inside doom/, iwad/, or reference/. If behavior cannot be verified, add an oracle-capture step.`). Any future change to these invariants must update this document and its focused test in lockstep.

## scope name

vanilla DOOM 1.9 oracle capture policy

## emulated vanilla version

1.9

## reference engine

Chocolate Doom

## reference engine version

2.2.1

## no guess trigger rule

The canonical trigger that converts an unverifiable behavioral question into an oracle-capture step is the verbatim sentence pinned by `plan_vanilla_parity/PROMPT.md`: `If behavior cannot be verified from local binaries, IWAD data, id Software source, or Chocolate Doom source, create or update an oracle-capture step instead of guessing.` Forward Ralph-loop agents must never substitute fabricated behavior, community lore, or DoomWiki claims for an oracle capture. When the canonical four verifiable evidence sources cannot answer a behavioral question, the responsible step must either depend on an existing Phase 02 oracle-capture step that already provides the evidence, or write a new step file under `plan_vanilla_parity/steps/02-NNN-<slug>.md` whose owned write roots are one of the canonical four allowed oracle output roots. The trigger rule is also anchored verbatim by `plan_vanilla_parity/define-source-authority-order.md` under its `## no guess rule` section.

## verifiable evidence sources

- local binaries
- IWAD data
- id Software source
- Chocolate Doom source

## oracle capture phase

02

## oracle capture lane

oracle

## oracle capture phase title

Reference / Oracle Capture Foundation

## allowed oracle output roots

- plan_vanilla_parity/final-gates/
- test/oracles/fixtures/
- test/vanilla_parity/acceptance/
- test/vanilla_parity/oracles/

## allowed oracle output root count

4

## read-only reference roots

- doom/
- iwad/
- reference/

## oracle redirect rule

The canonical oracle redirect rule pinned verbatim by `plan_vanilla_parity/REFERENCE_ORACLES.md` reads: `Oracle artifacts must be generated under writable paths such as test/vanilla_parity/oracles/, test/oracles/fixtures/, test/vanilla_parity/acceptance/, or plan_vanilla_parity/final-gates/. Never write inside doom/, iwad/, or reference/. If behavior cannot be verified, add an oracle-capture step.` The redirect rule is enforced for every step file `## write lock` bullet and every `plan_vanilla_parity/PARALLEL_WORK.md` `owns` cell by the `validateWritablePath` helper in `plan_vanilla_parity/validate-plan.ts`, which lowercases the candidate path with `normalizePlanPath`, rejects any path beginning with `doom/`, `iwad/`, or `reference/` with the verbatim diagnostic `Write lock is inside read-only reference root: <path>.`, and rejects any path beginning with `../` with the verbatim diagnostic `Write lock escapes the workspace: <path>.`.

## oracle lane owned output roots

- test/oracles/fixtures/
- test/vanilla_parity/oracles/

## acceptance lane owned output roots

- plan_vanilla_parity/final-gates/
- test/vanilla_parity/acceptance/

## lane to output root mapping

The canonical lane-to-output-root mapping is declared by the `owns` column of `plan_vanilla_parity/PARALLEL_WORK.md`. The `oracle` lane owns the writable roots `tools/reference/`, `test/oracles/fixtures/`, and `test/vanilla_parity/oracles/`; oracle-capture step files under `plan_vanilla_parity/steps/02-NNN-<slug>.md` whose `## lane` field is `oracle` must declare write-locked artifact paths under `test/oracles/fixtures/` or `test/vanilla_parity/oracles/`. The `acceptance` lane owns the writable roots `src/oracles/`, `test/parity/`, `test/vanilla_parity/acceptance/`, and `plan_vanilla_parity/final-gates/`; acceptance gate step files must declare write-locked artifact paths under `plan_vanilla_parity/final-gates/` or `test/vanilla_parity/acceptance/`. The disjoint-lane-scope rule pinned by `plan_vanilla_parity/define-lane-write-lock-contract.md` and enforced by `validateParallelWork` in `plan_vanilla_parity/validate-plan.ts` keeps the canonical four allowed oracle output roots split between exactly these two lanes.

## oracle family count

12

## oracle family identifiers

- OR-VP-001
- OR-VP-002
- OR-VP-003
- OR-VP-004
- OR-VP-005
- OR-VP-006
- OR-VP-007
- OR-VP-008
- OR-VP-009
- OR-VP-010
- OR-VP-011
- OR-VP-012

## OR-VP-001 family

The `OR-VP-001` clean launch family pins the minimum evidence `Paired implementation/reference launch logs and startup state from clean sandbox.` declared verbatim by `plan_vanilla_parity/REFERENCE_ORACLES.md`. Phase 02 steps in this family include `02-005 capture-doomd-clean-launch-feasibility`, `02-006 capture-doom-exe-clean-launch-feasibility`, and `02-016 capture-startup-sequence-oracle`. The captured artifact must record paired launch logs and startup state from a clean sandbox so the implementation can prove byte-for-byte clean-launch parity against the reference.

## OR-VP-002 family

The `OR-VP-002` input stream family pins the minimum evidence `Shared deterministic keyboard and mouse stream, with hash and injection transcript.` declared verbatim by `plan_vanilla_parity/REFERENCE_ORACLES.md`. Phase 02 steps in this family include `02-009 define-deterministic-input-stream-format` and `02-010 define-keyboard-and-mouse-injection-oracle`. The captured artifact must record a shared deterministic keyboard and mouse stream with hash and injection transcript so both the implementation and the reference can replay identical input.

## OR-VP-003 family

The `OR-VP-003` framebuffer family pins the minimum evidence `320x200 indexed framebuffer captures and hashes at required points.` declared verbatim by `plan_vanilla_parity/REFERENCE_ORACLES.md`. Phase 02 steps in this family include `02-011 define-framebuffer-capture-format` and `02-017 capture-initial-title-frame-oracle`. The captured artifact must record 320x200 indexed framebuffer captures and hashes at required points so the implementation can prove pixel-identical render parity.

## OR-VP-004 family

The `OR-VP-004` state family pins the minimum evidence `Deterministic state snapshots covering tic, RNG, gamestate, player, map, thinkers, and specials.` declared verbatim by `plan_vanilla_parity/REFERENCE_ORACLES.md`. Phase 02 steps in this family include `02-012 define-state-snapshot-format` and `02-020 capture-e1m1-spawn-state-oracle`. The captured artifact must record deterministic state snapshots covering tic, RNG, gamestate, player, map, thinkers, and specials so the implementation can prove deterministic-state parity tic-by-tic.

## OR-VP-005 family

The `OR-VP-005` audio family pins the minimum evidence `SFX mixer windows and hashes with source event transcript.` declared verbatim by `plan_vanilla_parity/REFERENCE_ORACLES.md`. Phase 02 steps in this family include `02-013 define-audio-window-capture-format` and `02-032 capture-sfx-and-music-oracle-windows`. The captured artifact must record SFX mixer windows and hashes with the source event transcript so the implementation can prove audio mixer parity.

## OR-VP-006 family

The `OR-VP-006` music family pins the minimum evidence `MUS/OPL event log and timing comparison.` declared verbatim by `plan_vanilla_parity/REFERENCE_ORACLES.md`. Phase 02 steps in this family include `02-014 define-music-event-capture-format` and `02-032 capture-sfx-and-music-oracle-windows`. The captured artifact must record a MUS/OPL event log and timing comparison so the implementation can prove music event parity.

## OR-VP-007 family

The `OR-VP-007` menus family pins the minimum evidence `Menu transition and rendering transcript from clean launch.` declared verbatim by `plan_vanilla_parity/REFERENCE_ORACLES.md`. Phase 02 steps in this family include `02-018 capture-main-menu-open-oracle` and `02-019 capture-new-game-episode-skill-path-oracle`. The captured artifact must record a menu transition and rendering transcript from clean launch so the implementation can prove menu navigation and rendering parity.

## OR-VP-008 family

The `OR-VP-008` levels family pins the minimum evidence `Level transition transcript including E1M1 start and E1 exits.` declared verbatim by `plan_vanilla_parity/REFERENCE_ORACLES.md`. Phase 02 steps in this family include `02-020 capture-e1m1-spawn-state-oracle`, `02-026 capture-intermission-transition-oracle`, and `02-027 capture-finale-transition-oracle`. The captured artifact must record a level transition transcript including E1M1 start and E1 exits so the implementation can prove level entry and exit parity.

## OR-VP-009 family

The `OR-VP-009` save/load family pins the minimum evidence `Byte-level save and load roundtrip comparison.` declared verbatim by `plan_vanilla_parity/REFERENCE_ORACLES.md`. Phase 02 steps in this family include `02-015 define-save-byte-capture-format` and `02-031 capture-save-load-roundtrip-oracle`. The captured artifact must record a byte-level save and load roundtrip comparison so the implementation can prove save/load parity at the byte level.

## OR-VP-010 family

The `OR-VP-010` demos family pins the minimum evidence `DEMO1, DEMO2, and DEMO3 playback sync through termination.` declared verbatim by `plan_vanilla_parity/REFERENCE_ORACLES.md`. Phase 02 steps in this family include `02-028 capture-demo-one-playback-oracle`, `02-029 capture-demo-two-playback-oracle`, and `02-030 capture-demo-three-playback-oracle`. The captured artifact must record DEMO1, DEMO2, and DEMO3 playback sync through termination so the implementation can prove demo playback parity through the final tic.

## OR-VP-011 family

The `OR-VP-011` full playthrough family pins the minimum evidence `Full shareware episode route with state, video, audio, and transition evidence.` declared verbatim by `plan_vanilla_parity/REFERENCE_ORACLES.md`. The Phase 02 step in this family is `02-033 capture-full-e1-route-oracle`. The captured artifact must record a full shareware episode route with state, video, audio, and transition evidence so the implementation can prove end-to-end shareware episode parity.

## OR-VP-012 family

The `OR-VP-012` final side by side family pins the minimum evidence `Clean-launch paired run using the same input stream and zero default allowed differences.` declared verbatim by `plan_vanilla_parity/REFERENCE_ORACLES.md`. The acceptance lane owns the final side-by-side artifact under `plan_vanilla_parity/final-gates/` or `test/vanilla_parity/acceptance/`. The captured artifact must record a clean-launch paired run using the same input stream with zero default allowed differences so the implementation can prove final acceptance parity against the reference.

## oracle artifact filename rule

Every oracle-capture step file under `plan_vanilla_parity/steps/02-NNN-<slug>.md` must declare exactly one JSON artifact path of the form `<root><slug>.json` and exactly one focused-test path of the form `<root><slug>.test.ts` under its `## write lock` and `## expected changes` sections, where `<root>` is one of the canonical four allowed oracle output roots and `<slug>` matches the kebab-case slug that follows the `02-NNN-` prefix in the step file's basename. Both paths must satisfy the canonical `validateWritablePath` rules (non-empty repository-relative path, no `../` prefix, no `doom/`/`iwad/`/`reference/` prefix). Acceptance lane gate steps follow the same rule with `<root>` equal to `plan_vanilla_parity/final-gates/` or `test/vanilla_parity/acceptance/`.

## oracle artifact json encoding rule

Every committed oracle artifact under one of the canonical four allowed oracle output roots must be a UTF-8 encoded JSON file parseable by `Bun.file().json()`. The top-level value must be an `object`. The artifact must not contain trailing commas, JavaScript comments, or JS-only literals such as `undefined`, `NaN`, or `Infinity`. The artifact must round-trip through `JSON.parse(JSON.stringify(parsedValue))` with no loss.

## oracle artifact required field count

4

## oracle artifact required fields

- id
- stepId
- stepTitle
- lane

## oracle artifact id field rule

The `id` field declares the canonical oracle identifier for the captured artifact. The value must be a non-empty string in the form `OR-VP-<family>` or `OR-VP-<family>-<NNN>` where `<family>` is one of the canonical twelve oracle family identifiers `OR-VP-001`..`OR-VP-012` or a slug-derived family token derived from the step's title (for example `OR-VP-CATALOG-001`). The `id` field is the join key between the artifact, the corresponding step file under `plan_vanilla_parity/steps/02-NNN-<slug>.md`, and the focused test file `<root><slug>.test.ts`.

## oracle artifact stepid field rule

The `stepId` field declares the Phase 02 step identifier the artifact captures evidence for. The value must be a non-empty string in `02-NNN` form that matches the step file's `## id` field and the corresponding row in `plan_vanilla_parity/MASTER_CHECKLIST.md`.

## oracle artifact steptitle field rule

The `stepTitle` field declares the human-readable Title-Cased description of the Phase 02 step. The value must be a non-empty string that equals the step file's `## title` field.

## oracle artifact lane field rule

The `lane` field declares the lane that owns the artifact's write lock. The value must be the literal string `oracle` for artifacts under the oracle lane's owned output roots (`test/oracles/fixtures/`, `test/vanilla_parity/oracles/`) or the literal string `acceptance` for artifacts under the acceptance lane's owned output roots (`plan_vanilla_parity/final-gates/`, `test/vanilla_parity/acceptance/`).

## no proprietary bytes rule

Oracle artifacts must never embed proprietary id Software bytes. Specifically: no IWAD/PWAD lump bytes, no DOS executable bytes, no Chocolate Doom Windows executable bytes, no save bytes from a captured save file, no demo bytes from a captured demo lump, no audio sample bytes, and no music sample bytes. Oracle artifacts may record paths, sizes, SHA-256 hashes, and derived structural metadata of files inside the read-only reference roots `doom/`, `iwad/`, and `reference/`, but the proprietary bytes themselves must remain inside those read-only roots. The proprietary asset boundary that motivates this rule is pinned by `plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md` and cataloged by `ASSET_BOUNDARIES`/`REFERENCE_BUNDLE_PATH` in `src/reference/policy.ts`.

## oracle test focused field rule

Every committed `<slug>.test.ts` under one of the canonical four allowed oracle output roots must be a focused `bun:test` test that loads its sibling `<slug>.json` via `Bun.file().json()` or `import` and asserts every canonical required oracle artifact field is present and well-typed. The focused test must include at least one failure-mode test that proves the parser rejects a malformed or proprietary-byte-bearing artifact.

## authority anchor

The canonical source authority order pinned by `plan_vanilla_parity/define-source-authority-order.md` is the upstream binding rule for every oracle capture decision. The canonical four verifiable evidence sources `local binaries`, `IWAD data`, `id Software source`, and `Chocolate Doom source` are the only acceptable inputs to an oracle capture. When a behavioral question can be answered from any of the four, no oracle capture is required and the responsible step proceeds without one. When none of the four can answer the question, the responsible step must add or depend on a Phase 02 oracle-capture step.

## evidence locations

- AGENTS.md
- CLAUDE.md
- plan_fps/REFERENCE_ORACLES.md
- plan_vanilla_parity/MASTER_CHECKLIST.md
- plan_vanilla_parity/PARALLEL_WORK.md
- plan_vanilla_parity/PROMPT.md
- plan_vanilla_parity/README.md
- plan_vanilla_parity/REFERENCE_ORACLES.md
- plan_vanilla_parity/SOURCE_CATALOG.md
- plan_vanilla_parity/define-lane-write-lock-contract.md
- plan_vanilla_parity/define-read-only-reference-roots.md
- plan_vanilla_parity/define-source-authority-order.md
- plan_vanilla_parity/define-step-file-required-fields.md
- plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md
- plan_vanilla_parity/validate-plan.ts
- plan_vanilla_parity/validate-plan.test.ts
- src/reference/policy.ts

## acceptance phrasing

Every Ralph-loop step in the vanilla DOOM 1.9 parity rebuild that cannot answer a behavioral question from the canonical four verifiable evidence sources `local binaries`, `IWAD data`, `id Software source`, or `Chocolate Doom source` must add or depend on a Phase 02 oracle-capture step in the `oracle` lane (or, for final acceptance evidence, an acceptance lane gate step) whose write-locked artifact lives under one of the canonical four allowed oracle output roots `plan_vanilla_parity/final-gates/`, `test/oracles/fixtures/`, `test/vanilla_parity/acceptance/`, or `test/vanilla_parity/oracles/` and never inside the read-only reference roots `doom/`, `iwad/`, or `reference/`. The captured artifact must satisfy the canonical four required top-level fields `id`, `stepId`, `stepTitle`, `lane`, must encode SHA-256 hashes and structural metadata rather than proprietary id Software bytes, must declare an `id` drawn from the canonical twelve oracle family identifiers `OR-VP-001` clean launch, `OR-VP-002` input stream, `OR-VP-003` framebuffer, `OR-VP-004` state, `OR-VP-005` audio, `OR-VP-006` music, `OR-VP-007` menus, `OR-VP-008` levels, `OR-VP-009` save/load, `OR-VP-010` demos, `OR-VP-011` full playthrough, `OR-VP-012` final side by side, and must be paired with a focused `bun:test` test under the same allowed oracle output root.
