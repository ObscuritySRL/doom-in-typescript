# Define Read Only Reference Roots

This document pins the canonical read-only reference roots that every Ralph-loop step in the vanilla DOOM 1.9 parity rebuild must respect. It freezes the canonical three roots (`doom/`, `iwad/`, `reference/`) declared by the `READ_ONLY_ROOTS = ['doom/', 'iwad/', 'reference/']` literal in `plan_vanilla_parity/validate-plan.ts`, the canonical per-root content rule (the `doom/` root holds the user-supplied DOS executables, configs, and shareware IWAD bundle pinned by `plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md` and cataloged by `ASSET_BOUNDARIES`/`REFERENCE_BUNDLE_PATH` in `src/reference/policy.ts`; the `iwad/` root holds an alternate user-supplied shareware IWAD copy pinned by `plan_vanilla_parity/pin-user-supplied-registered-and-ultimate-iwad-scope.md`; the `reference/` root holds pre-captured derived JSON manifests under `reference/manifests/` that record local binary, IWAD, and configuration evidence and that may be regenerated only by an explicit oracle-capture step with its own write contract), the canonical per-root gitignore rule (`doom/` and `iwad/` are gitignored at the repository root and must never be staged for commit; `reference/` is committed but read-only for forward Ralph-loop steps), the canonical `validate-plan.ts` enforcement rule (`validateWritablePath` rejects any step-file `write lock` bullet whose normalized path begins with one of the three canonical roots and emits the verbatim diagnostic `Write lock is inside read-only reference root: <path>.`), the canonical `validate-plan.ts` workspace-escape rule (`validateWritablePath` also rejects any bullet beginning with `../` and emits the verbatim diagnostic `Write lock escapes the workspace: <path>.`), the canonical four forbidden write lock prefixes (`../`, `doom/`, `iwad/`, `reference/`) declared by `plan_vanilla_parity/define-lane-write-lock-contract.md`, the canonical `plan_vanilla_parity/PARALLEL_WORK.md` `must not touch` rule (every committed lane row lists `doom/; iwad/; reference/` under its `must not touch` column), the canonical oracle output redirect rule pinned by `plan_vanilla_parity/REFERENCE_ORACLES.md` (oracle artifacts must be generated under writable paths such as `test/vanilla_parity/oracles/`, `test/oracles/fixtures/`, `test/vanilla_parity/acceptance/`, or `plan_vanilla_parity/final-gates/` and must never write inside `doom/`, `iwad/`, or `reference/`), and the canonical four allowed oracle output roots (`plan_vanilla_parity/final-gates/`, `test/oracles/fixtures/`, `test/vanilla_parity/acceptance/`, `test/vanilla_parity/oracles/`). Any future change to these invariants must update this document and its focused test in lockstep.

## scope name

vanilla DOOM 1.9 read-only reference roots

## emulated vanilla version

1.9

## reference engine

Chocolate Doom

## reference engine version

2.2.1

## canonical read-only reference roots

- doom/
- iwad/
- reference/

## canonical read-only reference root count

3

## doom root rule

The `doom/` root is the user-supplied drop location for the local DOS DOOM executables, the local Chocolate Doom Windows executable, the local shareware IWAD `DOOM1.WAD`, and the local DOOM and Chocolate Doom configuration files. The bundle is cataloged by `ASSET_BOUNDARIES` in `src/reference/policy.ts` (eight entries: `DOOM.EXE`, `DOOM1.WAD`, `DOOMD.EXE`, `DOOMDUPX.EXE`, `DOOMWUPX.exe`, `chocolate-doom.cfg`, `default.cfg`, `smash.py`) and the absolute path is anchored by the `REFERENCE_BUNDLE_PATH` constant in the same module. The redistribution-forbidden subset of this bundle is pinned by `plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md`. The `doom/` root is gitignored at the repository root and must never be staged for commit by any Ralph-loop step. Forward Ralph-loop steps may read from `doom/` when their step file lists a `doom/` path under `read-only paths`, but no step file's `write lock` may declare a path beginning with `doom/`.

## iwad root rule

The `iwad/` root is the alternate user-supplied drop location for a shareware, registered, or Ultimate IWAD copy. The user-supplied IWAD scope is pinned by `plan_vanilla_parity/pin-user-supplied-registered-and-ultimate-iwad-scope.md`. The `iwad/` root is gitignored at the repository root and must never be staged for commit by any Ralph-loop step. Forward Ralph-loop steps may read from `iwad/` when their step file lists an `iwad/` path under `read-only paths`, but no step file's `write lock` may declare a path beginning with `iwad/`.

## reference root rule

The `reference/` root holds pre-captured derived JSON manifests under `reference/manifests/` that record local binary, IWAD, and configuration evidence (file hashes, package capability matrix, vanilla limits summary, WAD map summary, demo lump summary, configuration variable summary, source catalog, quirk manifest, title sequence, compatibility targets, and the C1 product target completeness manifest). Unlike `doom/` and `iwad/`, the `reference/` root is committed to the repository because the derived manifests carry no proprietary id Software bytes. Forward Ralph-loop steps must still treat `reference/` as read-only. Manifests under `reference/manifests/` may be regenerated only by an explicit oracle-capture step in the oracle lane that lists the specific manifest path under its `write lock` and that updates the manifest from local binary or IWAD evidence under `doom/` or `iwad/`. Forward Ralph-loop steps may read from `reference/` when their step file lists a `reference/` path under `read-only paths`, but no step file's `write lock` outside the oracle lane may declare a path beginning with `reference/`.

## validate-plan literal

The single source of truth for the canonical three roots in TypeScript is the `READ_ONLY_ROOTS` literal in `plan_vanilla_parity/validate-plan.ts`. The literal must be declared verbatim as `const READ_ONLY_ROOTS = ['doom/', 'iwad/', 'reference/'] as const;` so that it is a frozen `readonly ['doom/', 'iwad/', 'reference/']` tuple at compile time and so that grep against `plan_vanilla_parity/validate-plan.ts` deterministically locates every read-only-root enforcement site.

## validate-plan helper rule

The `validateWritablePath` function in `plan_vanilla_parity/validate-plan.ts` enforces the read-only-root rule for every step-file `write lock` bullet and every `plan_vanilla_parity/PARALLEL_WORK.md` `owns` cell. The helper normalizes the candidate path with `normalizePlanPath` (replaces `\\` with `/`, strips a leading `./`, and strips wrapping backticks), lowercases the result, rejects an empty path with the diagnostic `Write lock path must not be empty.`, rejects a `../` prefix with the diagnostic `Write lock escapes the workspace: <path>.`, and rejects a normalized path that begins with any entry in `READ_ONLY_ROOTS` with the diagnostic `Write lock is inside read-only reference root: <path>.`.

## validate-plan diagnostic messages

- `Write lock escapes the workspace: <path>.`
- `Write lock is inside read-only reference root: <path>.`
- `Write lock path must not be empty.`

## forbidden write lock prefixes

- ../
- doom/
- iwad/
- reference/

## parallel work must-not-touch rule

Every committed lane row in `plan_vanilla_parity/PARALLEL_WORK.md` must list the canonical three read-only reference roots under the fifth column `must not touch` as the literal cell `doom/; iwad/; reference/`. The `parseLaneWriteScopes` helper in `plan_vanilla_parity/validate-plan.ts` parses the fourth column `owns` into the `LaneWriteScope` records used to enforce the disjoint-lane-scope rule, and the same parse pass anchors the read-only-root prohibition by treating the canonical three roots as forbidden lane-owned-write-root prefixes via `validateWritablePath`. The `must not touch` column has no separate parser because the `validateWritablePath` rejection already enforces the rule at the point where any step-file `write lock` or any lane-row `owns` cell would otherwise declare a read-only-root prefix.

## gitignore rule

The two user-supplied drop locations `doom/` and `iwad/` must be gitignored at the repository root so that proprietary id Software assets are never staged for commit. The `.gitignore` file at the repository root must list both directories on their own lines (`doom/` and `iwad/`). The `reference/` root is intentionally not gitignored because its committed `reference/manifests/` JSON files are derived artifacts that carry no proprietary bytes; forward Ralph-loop steps must nevertheless treat `reference/` as read-only via the `validateWritablePath` rule pinned above.

## oracle output redirect rule

When an oracle-capture step needs to record evidence derived from a read-only reference root, the captured artifacts must be written under one of the canonical four allowed oracle output roots pinned by `plan_vanilla_parity/REFERENCE_ORACLES.md`. The redirect rule reads in full: oracle artifacts must be generated under writable paths such as `test/vanilla_parity/oracles/`, `test/oracles/fixtures/`, `test/vanilla_parity/acceptance/`, or `plan_vanilla_parity/final-gates/`, and must never write inside `doom/`, `iwad/`, or `reference/`. If behavior cannot be verified from the read-only reference roots, the responsible step must add an oracle-capture step that writes its derived artifact under one of the four allowed oracle output roots.

## allowed oracle output roots

- plan_vanilla_parity/final-gates/
- test/oracles/fixtures/
- test/vanilla_parity/acceptance/
- test/vanilla_parity/oracles/

## evidence locations

- .gitignore
- AGENTS.md
- CLAUDE.md
- plan_vanilla_parity/MASTER_CHECKLIST.md
- plan_vanilla_parity/PARALLEL_WORK.md
- plan_vanilla_parity/PROMPT.md
- plan_vanilla_parity/README.md
- plan_vanilla_parity/REFERENCE_ORACLES.md
- plan_vanilla_parity/SOURCE_CATALOG.md
- plan_vanilla_parity/define-lane-write-lock-contract.md
- plan_vanilla_parity/define-step-file-required-fields.md
- plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md
- plan_vanilla_parity/pin-user-supplied-registered-and-ultimate-iwad-scope.md
- plan_vanilla_parity/validate-plan.ts
- plan_vanilla_parity/validate-plan.test.ts
- src/reference/policy.ts

## acceptance phrasing

Every Ralph-loop step in the vanilla DOOM 1.9 parity rebuild treats `doom/`, `iwad/`, and `reference/` as read-only reference roots: no step file's `write lock` may declare a path beginning with `doom/`, `iwad/`, or `reference/` (or with the workspace-escape prefix `../`), every committed lane row in `plan_vanilla_parity/PARALLEL_WORK.md` lists `doom/; iwad/; reference/` under `must not touch`, and oracle artifacts derived from these roots are written under `test/vanilla_parity/oracles/`, `test/oracles/fixtures/`, `test/vanilla_parity/acceptance/`, or `plan_vanilla_parity/final-gates/` rather than back into the read-only roots.
