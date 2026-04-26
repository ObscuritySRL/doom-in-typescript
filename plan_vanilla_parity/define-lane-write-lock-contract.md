# Define Lane Write Lock Contract

This document pins the canonical lane write lock contract that every Ralph-loop step in the vanilla DOOM 1.9 parity rebuild must satisfy. It freezes the canonical lane slug pattern enforced by `plan_vanilla_parity/lane-lock.ts` (`VALID_LANE_PATTERN = /^[a-z][a-z0-9-]*$/`), the canonical fourteen lane slugs declared in the `plan_vanilla_parity/PARALLEL_WORK.md` lane table (`governance`, `inventory`, `oracle`, `launch`, `core`, `wad`, `map`, `gameplay`, `ai`, `render`, `ui`, `audio`, `save`, `acceptance`), the canonical six immediate lane roots (`governance`, `inventory`, `oracle`, `launch`, `core`, `wad`) declared in `plan_vanilla_parity/README.md`, the canonical owned-write-root rule (the `owns` column of every lane row in `plan_vanilla_parity/PARALLEL_WORK.md` lists the lane's writable roots, the `must not touch` column lists the read-only reference roots `doom/`, `iwad/`, `reference/`), the canonical disjoint-lane-scope rule enforced by `validateParallelWork` and `pathsConflict` in `plan_vanilla_parity/validate-plan.ts` (no two lanes may own overlapping write roots), the canonical no-lane-switch rule pinned by `plan_vanilla_parity/PROMPT.md` (the selected step's lane is fixed for the Ralph-loop turn), the canonical step-file `write lock` field contract enforced by `validateWritablePath` in `plan_vanilla_parity/validate-plan.ts` (no empty bullet, no `../` workspace escape, no read-only-root prefix, every bullet also listed under `expected changes`), the canonical lane lock directory `plan_vanilla_parity/lane_locks/`, the canonical lane lock file path pattern `plan_vanilla_parity/lane_locks/<lane>.lock/lock.json`, the canonical eleven-field lane lock JSON record schema (`acquiredAtUtc`, `expiresAtUtc`, `heartbeatUtc`, `lane`, `lockId`, `owner`, `planDirectory`, `processIdentifier`, `stepId`, `stepTitle`, `version`) defined by the `LaneLockRecord` interface in `plan_vanilla_parity/lane-lock.ts`, the canonical atomic acquisition rule (`mkdir` of `<lane>.lock/` followed by `writeFile` of `lock.json` recovers expired locks via `removeExpiredLockDirectory`), the canonical heartbeat rule (heartbeat refreshes `heartbeatUtc` and `expiresAtUtc` only when the supplied lock id matches), the canonical release rule (release removes the `<lane>.lock/` directory only when the supplied lock id matches), the canonical lease-based expiration rule, and the canonical default lease minutes constant `DEFAULT_LEASE_MINUTES = 120`. Any future change to these invariants must update this document and its focused test in lockstep.

## scope name

vanilla DOOM 1.9 lane write lock contract

## emulated vanilla version

1.9

## reference engine

Chocolate Doom

## reference engine version

2.2.1

## lane slug pattern

The canonical lane slug pattern enforced by `VALID_LANE_PATTERN` in `plan_vanilla_parity/lane-lock.ts` is the ASCII regular expression `^[a-z][a-z0-9-]*$`. Every lane slug must begin with a lowercase ASCII letter and may continue with lowercase ASCII letters, ASCII digits, and ASCII hyphens. Underscores, uppercase letters, dots, slashes, and whitespace are not allowed.

## canonical lane slugs

- acceptance
- ai
- audio
- core
- gameplay
- governance
- inventory
- launch
- map
- oracle
- render
- save
- ui
- wad

## immediate lane roots

- governance
- inventory
- oracle
- launch
- core
- wad

## lane definition source

The single source of truth for every lane definition is the lane table in `plan_vanilla_parity/PARALLEL_WORK.md`. Every committed lane row declares the lane slug in the first column, the immediate-readiness summary in the second column, the blocked-by summary in the third column, the lane's owned writable roots in the fourth column (`owns`), and the lane's read-only roots in the fifth column (`must not touch`). The `parseLaneWriteScopes` helper in `plan_vanilla_parity/validate-plan.ts` parses this table into the `LaneWriteScope` records the validator uses to enforce the disjoint-lane-scope rule.

## lane owned write root rule

Every lane row in `plan_vanilla_parity/PARALLEL_WORK.md` must list at least one repository-relative path under its `owns` column. The `validateParallelWork` helper in `plan_vanilla_parity/validate-plan.ts` emits the diagnostic `Lane <lane> must list at least one owned write root.` when a lane's `owns` cell parses to zero paths. Every entry under the `owns` column must satisfy the same `validateWritablePath` rules that step-file `write lock` bullets satisfy: the path must be a non-empty repository-relative path that does not begin with `../` and does not begin with the read-only reference roots `doom/`, `iwad/`, or `reference/`.

## lane read-only roots

- doom/
- iwad/
- reference/

## lane disjoint scope rule

No two lane rows in `plan_vanilla_parity/PARALLEL_WORK.md` may declare overlapping owned write roots. The `pathsConflict` helper in `plan_vanilla_parity/validate-plan.ts` returns `true` when two paths are equal, when the left path ends with `/` and the right path is inside it, or when the right path ends with `/` and the left path is inside it. The `validateParallelWork` helper iterates every pair of lane scopes and emits the diagnostic `Lane write scopes overlap: <leftLane> owns <leftRoot> and <rightLane> owns <rightRoot>.` when it finds an overlap, which keeps lane writes disjoint and lets parallel lanes run without write-write contention.

## no lane switch rule

The lane assigned by the Ralph-loop launcher is fixed for the duration of the loop turn. The `plan_vanilla_parity/PROMPT.md` Ralph-loop prompt pins the rule with the wording `Do not switch lanes.` Forward Ralph-loop agents must select the first unchecked step in the assigned lane whose prerequisites are complete, and must return `RLP_STATUS: NO_ELIGIBLE_STEP` with the assigned lane in `RLP_LANE` when no eligible step remains in that lane. Switching to a different lane mid-turn, even when other lanes have eligible steps, is forbidden.

## step file write lock field contract

Every step file under `plan_vanilla_parity/steps/` must declare a `## write lock` section that lists at least one repository-relative path as a bullet. The `validateWritablePath` helper in `plan_vanilla_parity/validate-plan.ts` enforces four rules per bullet: the path must not be empty, the path must not begin with `../` (no workspace escape), the path must not begin with the read-only reference roots `doom/`, `iwad/`, or `reference/`, and the path's lane ownership must be consistent with the lane row in `plan_vanilla_parity/PARALLEL_WORK.md`. Every bullet under the `write lock` section must also appear under the step file's `expected changes` section.

## forbidden write lock prefixes

- ../
- doom/
- iwad/
- reference/

## validate plan helper names

- parseLaneWriteScopes
- pathsConflict
- validateParallelWork
- validateWritablePath

## validate plan diagnostic messages

- `Lane <lane> must list at least one owned write root.`
- `Lane write scopes overlap: <leftLane> owns <leftRoot> and <rightLane> owns <rightRoot>.`
- `Write lock escapes the workspace: <path>.`
- `Write lock is inside read-only reference root: <path>.`
- `Write lock path must not be empty.`

## lane lock directory

plan_vanilla_parity/lane_locks/

## lane lock file path pattern

plan_vanilla_parity/lane_locks/<lane>.lock/lock.json

## lane lock record version

1

## lane lock record fields

- acquiredAtUtc
- expiresAtUtc
- heartbeatUtc
- lane
- lockId
- owner
- planDirectory
- processIdentifier
- stepId
- stepTitle
- version

## lane lock record field count

11

## lane lock acquisition rule

The `acquireLaneLock` function in `plan_vanilla_parity/lane-lock.ts` reads the candidate lane definitions from `plan_vanilla_parity/PARALLEL_WORK.md` and the candidate step rows from `plan_vanilla_parity/MASTER_CHECKLIST.md`, filters to unchecked steps whose prerequisites are all complete, and either restricts the candidate set to the requested lane (when `--lane` is supplied) or considers every eligible lane in checklist order (when no lane is supplied). For each candidate step the helper attempts to atomically create the lane lock directory `<lockDirectory>/<lane>.lock/` with `mkdir`, then writes a `lock.json` record under that directory. If the directory already exists and the existing record has not expired, the helper returns `acquired: false` with `Lane is locked: <lane>...`. If the directory already exists and the existing record has expired, the helper removes the directory via `removeExpiredLockDirectory` and retries the atomic create. The lock id is a `crypto.randomUUID()` value bound to the new record so future heartbeat and release calls can be authenticated.

## lane lock heartbeat rule

The `heartbeatLaneLock` function in `plan_vanilla_parity/lane-lock.ts` refuses every call that does not name a lane, that does not name a lock id, that targets a missing lane lock directory, or that supplies a lock id that does not match the one stored in `lock.json`. When all four checks pass, the helper writes a fresh `heartbeatUtc` and a fresh `expiresAtUtc` (now plus `--lease-minutes`) to the existing record, leaving every other field unchanged.

## lane lock release rule

The `releaseLaneLock` function in `plan_vanilla_parity/lane-lock.ts` refuses every call that does not name a lane, that does not name a lock id, that targets a missing lane lock directory, or that supplies a lock id that does not match the one stored in `lock.json`. When all four checks pass, the helper removes the lane lock directory recursively. A lane that has been released cleanly is immediately available for the next acquisition.

## lane lock expiration rule

A lane lock record is expired when `Date.parse(record.expiresAtUtc) <= now.getTime()`. The `removeExpiredLockDirectory` helper in `plan_vanilla_parity/lane-lock.ts` removes the lane lock directory recursively only when the parsed record is missing, malformed, or expired. A live record that has not yet reached its `expiresAtUtc` is preserved, which protects an in-flight lane from being preempted by a parallel acquisition.

## default lease minutes

120

## lane lock command surface

- acquire
- heartbeat
- list
- release

## lane lock command source

plan_vanilla_parity/lane-lock.ts

## lane lock test source

plan_vanilla_parity/lane-lock.test.ts

## evidence locations

- AGENTS.md
- CLAUDE.md
- plan_vanilla_parity/MASTER_CHECKLIST.md
- plan_vanilla_parity/PARALLEL_WORK.md
- plan_vanilla_parity/PROMPT.md
- plan_vanilla_parity/README.md
- plan_vanilla_parity/lane-lock.ts
- plan_vanilla_parity/lane-lock.test.ts
- plan_vanilla_parity/validate-plan.ts
- plan_vanilla_parity/validate-plan.test.ts

## acceptance phrasing

Every Ralph-loop step is owned by exactly one lane from `plan_vanilla_parity/PARALLEL_WORK.md`, holds a lease-based lane lock under `plan_vanilla_parity/lane_locks/<lane>.lock/lock.json` while it runs, writes only paths declared under its step file's `write lock` field (no empty bullet, no `../` workspace escape, no `doom/`, `iwad/`, or `reference/` read-only-root prefix, every bullet also under `expected changes`), and never switches lanes mid-turn.
