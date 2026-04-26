# Create Plan Validation Script Contract

This document pins the canonical plan validation script contract that the executable validator at `plan_vanilla_parity/validate-plan.ts` must satisfy in the vanilla DOOM 1.9 parity rebuild. It freezes the canonical script path `plan_vanilla_parity/validate-plan.ts`, the canonical CLI invocation `bun run plan_vanilla_parity/validate-plan.ts` exported as `PLAN_VALIDATION_COMMAND`, the canonical four exported public surfaces (`validatePlan`, `runValidationCli`, `parseChecklist`, `PLAN_VALIDATION_COMMAND`) and the canonical two exported result types (`ValidationError`, `ValidationResult`), the canonical three `ValidationResult` fields in canonical order (`errors`, `firstStep`, `totalSteps`), the canonical default plan directory anchor (`import.meta.dir` resolves to `plan_vanilla_parity/`), the canonical pinned constants (`EXPECTED_FIRST_STEP = '00-001'`, `EXPECTED_TOTAL_STEPS = 398`, `FINAL_GATE_STEP_ID = '13-004'`), the canonical twelve `REQUIRED_FILES` entries enforced by `validateRequiredFiles`, the canonical fourteen `REQUIRED_STEP_FIELDS` entries enforced by `validateStepText`, the canonical ten `BANNED_COMMANDS` entries enforced by `usesBannedCommand`, the canonical three `READ_ONLY_ROOTS` entries enforced by `validateWritablePath`, the canonical twelve `REQUIRED_FINAL_GATE_PHRASES` entries enforced by `validateFinalGate`, the canonical five `REJECTED_FINAL_EVIDENCE_PATTERNS` entries enforced by `validateFinalGate`, the canonical `CHECKLIST_LINE_PATTERN` regular expression that `parseChecklist` matches, the canonical fourteen internal helper functions (`validateRequiredFiles`, `validateChecklistSummary`, `validateFinalGate`, `validateParallelWork`, `validateStepText`, `validateWritablePath`, `parseLaneWriteScopes`, `pathsConflict`, `usesBannedCommand`, `parsePrerequisites`, `extractSection`, `extractBullets`, `normalizePlanPath`, `addMissingFileError`, `collectStepFiles`, `readTextIfExists`), the canonical CLI exit-code contract (`0` on success with stdout `Validated <total> vanilla parity steps. First step: <firstStep>.`, `1` on errors with each error written to stderr as `<file>: <message>`), the canonical canonical-diagnostic messages emitted by every internal helper (each verbatim), and the canonical no-runtime-side-effects rule (the script writes no files, mutates no global state, and never opens a network connection while validating). Any future change to these invariants must update this document and its focused test in lockstep.

## scope name

vanilla DOOM 1.9 plan validation script contract

## emulated vanilla version

1.9

## reference engine

Chocolate Doom

## reference engine version

2.2.1

## script path

plan_vanilla_parity/validate-plan.ts

## script test path

plan_vanilla_parity/validate-plan.test.ts

## cli invocation

bun run plan_vanilla_parity/validate-plan.ts

## plan validation command export name

PLAN_VALIDATION_COMMAND

## exported public surface count

4

## exported public surfaces

- PLAN_VALIDATION_COMMAND
- parseChecklist
- runValidationCli
- validatePlan

## exported result type count

2

## exported result types

- ValidationError
- ValidationResult

## validation error fields

- file
- message

## validation result field count

3

## validation result fields

- errors
- firstStep
- totalSteps

## default plan directory anchor

The canonical default plan directory used by `validatePlan` and `runValidationCli` resolves at runtime via `const DEFAULT_PLAN_DIRECTORY = import.meta.dir;` so the script always validates the directory that physically contains it. The default is overridable: every public function accepts an explicit `planDirectory` argument so the focused test at `plan_vanilla_parity/validate-plan.test.ts` can validate fixture plans under a temporary directory without mutating the real `plan_vanilla_parity/` tree.

## expected first step constant

00-001

## expected total steps constant

398

## final gate step id constant

13-004

## required files count

12

## required files

- DEPENDENCY_GRAPH.md
- MASTER_CHECKLIST.md
- PARALLEL_WORK.md
- PRE_PROMPT.md
- PROMPT.md
- README.md
- REFERENCE_ORACLES.md
- RISK_REGISTER.md
- SOURCE_CATALOG.md
- STEP_TEMPLATE.md
- validate-plan.test.ts
- validate-plan.ts

## required step field count

14

## required step fields

- id
- lane
- title
- goal
- prerequisites
- parallel-safe-with
- write lock
- read-only paths
- research sources
- expected changes
- test files
- verification commands
- completion criteria
- final evidence

## banned commands count

10

## banned commands

- jest
- mocha
- node
- npm
- npx
- pnpm
- ts-node
- tsx
- vitest
- yarn

## read-only roots count

3

## read-only roots

- doom/
- iwad/
- reference/

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

## rejected final evidence pattern count

5

## rejected final evidence patterns

- pending
- manifest-only
- sampled-only
- intent-only
- declared intent

## checklist line pattern

The canonical regular expression `CHECKLIST_LINE_PATTERN` parsed by `parseChecklist` is `/^- \[[ x]\] \`(?<id>\d{2}-\d{3})\` \`(?<slug>[^\`]+)\` \| lane: \`(?<lane>[^\`]+)\` \| prereqs: \`(?<prerequisites>[^\`]+)\` \| file: \`(?<filePath>plan_vanilla_parity\/steps\/[^\`]+\.md)\`$/`. Every checklist row in `plan_vanilla_parity/MASTER_CHECKLIST.md` must satisfy this pattern, and the named capture groups `id`, `slug`, `lane`, `prerequisites`, and `filePath` are the canonical five row columns parsed into a `ChecklistStep` record. Both pending `[ ]` and completed `[x]` checkboxes match.

## checklist line pattern named capture groups

- id
- slug
- lane
- prerequisites
- filePath

## internal helper count

16

## internal helpers

- addMissingFileError
- collectStepFiles
- extractBullets
- extractSection
- normalizePlanPath
- parseLaneWriteScopes
- parsePrerequisites
- pathsConflict
- readTextIfExists
- usesBannedCommand
- validateChecklistSummary
- validateFinalGate
- validateParallelWork
- validateRequiredFiles
- validateStepText
- validateWritablePath

## validate required files helper

The `validateRequiredFiles` helper iterates the canonical twelve `REQUIRED_FILES` entries and checks `Bun.file(\`${planDirectory}/${relativePath}\`).exists()` for each. When a required file is missing, the helper emits the canonical diagnostic `Required plan file is missing.` against the verbatim path `plan_vanilla_parity/<relativePath>` via `addMissingFileError`. The twelve required files cover every governance index file plus the validator script itself and its focused test so a missing file blocks the validator before any later stage runs.

## validate checklist summary helper

The `validateChecklistSummary` helper checks the literal summary lines of `plan_vanilla_parity/MASTER_CHECKLIST.md`. It emits `Checklist must declare total steps 398.` when the checklist text does not contain `- Total steps: 398`, emits `Checklist must declare the first eligible vanilla parity step.` when the checklist text does not contain `- First eligible step: \`00-001 establish-vanilla-parity-control-center\``, emits `Checklist must declare the bun run doom.ts runtime target.` when the checklist text does not contain `Runtime target: \`bun run doom.ts\``, emits `Checklist must contain 398 steps, got <count>.` when the parsed step count is not 398, and emits `First parsed step must be 00-001.` when the first parsed checklist step's id is not `00-001`.

## validate final gate helper

The `validateFinalGate` helper extracts the `## final evidence` section of the final gate step file `plan_vanilla_parity/steps/13-004-gate-full-final-side-by-side-proof.md`, lowercases the section body, and tests every entry in `REQUIRED_FINAL_GATE_PHRASES`: when a required phrase is missing it emits `Final gate evidence must include <phrase>.`. It also tests every entry in `REJECTED_FINAL_EVIDENCE_PATTERNS` (case-insensitive word-boundary regular expressions for `pending`, `manifest-only`, `sampled-only`, `intent-only`, `declared intent`): when any pattern matches the raw section it emits `Final gate evidence must not rely on pending, manifest-only, sampled-only, or intent-only proof.`. When the final gate step file is missing entirely the helper emits `Missing final gate step 13-004.` against the checklist file.

## validate parallel work helper

The `validateParallelWork` helper reads `plan_vanilla_parity/PARALLEL_WORK.md`, parses every lane row via `parseLaneWriteScopes`, and emits `Lane <lane> must list at least one owned write root.` when a lane row's `owns` cell parses to zero paths. It then runs `validateWritablePath` on every owned write root and iterates every pair of lane scopes via `pathsConflict`: when two lanes own overlapping roots it emits `Lane write scopes overlap: <leftLane> owns <leftRoot> and <rightLane> owns <rightRoot>.`. The `pathsConflict` helper returns `true` when two paths are equal, when the left path ends with `/` and the right path is inside it, or when the right path ends with `/` and the left path is inside it.

## validate step text helper

The `validateStepText` helper enforces every per-step rule. It emits `Step heading must match the id and title fields.` when the file does not begin with `# [ ] STEP <id>: <title>`, emits `Step fields must exactly match: <fields>.` when the document's `## ` headings concatenated by newline do not equal the canonical fourteen `REQUIRED_STEP_FIELDS` joined by newline, emits `Missing or empty required field: <field>.` for every required field that is absent or has an empty body, emits `id field must be <id>.` and `lane field must be <lane>.` when the parsed values disagree with the corresponding `MASTER_CHECKLIST.md` row, emits `Step prerequisites must match MASTER_CHECKLIST.md.` when the bullet list disagrees with the checklist row, emits `Prerequisite <id> does not point to an existing prior step.` when a non-`none` prerequisite does not name an earlier step, emits `Step must list at least one focused test file.` when the `test files` section is empty, emits `Verification must include bun run format.`, `Verification must include the focused bun test command.`, `Verification must include full bun test.`, and `Verification must include the Bun typecheck command.` when the canonical four verification commands are absent in canonical order, and emits `Verification command uses a banned tool: <command>.` when any verification command first token (or first token after `bun x`) is in `BANNED_COMMANDS`. Every emitted diagnostic is attached to the step file's relative path under `plan_vanilla_parity/steps/`.

## validate writable path helper

The `validateWritablePath` helper enforces three rules per write-lock or owned-root path: it emits `Write lock path must not be empty.` when the normalized path has zero length, emits `Write lock escapes the workspace: <path>.` when the normalized path begins with `../`, and emits `Write lock is inside read-only reference root: <path>.` when the normalized path begins with one of the canonical three `READ_ONLY_ROOTS` entries. The helper normalizes input via `normalizePlanPath`, which converts backslashes to forward slashes, strips leading `./`, and strips wrapping backticks, before the prefix tests run.

## diagnostic count

19

## diagnostics

- `Required plan file is missing.`
- `Checklist must declare total steps 398.`
- `Checklist must declare the first eligible vanilla parity step.`
- `Checklist must declare the bun run doom.ts runtime target.`
- `Checklist must contain 398 steps, got <count>.`
- `First parsed step must be 00-001.`
- `Checklist step <id> points to missing file <path>.`
- `Step file is not referenced by MASTER_CHECKLIST.md.`
- `Missing final gate step 13-004.`
- `Final gate evidence must include <phrase>.`
- `Final gate evidence must not rely on pending, manifest-only, sampled-only, or intent-only proof.`
- `Lane <lane> must list at least one owned write root.`
- `Lane write scopes overlap: <leftLane> owns <leftRoot> and <rightLane> owns <rightRoot>.`
- `Step heading must match the id and title fields.`
- `Step fields must exactly match: id, lane, title, goal, prerequisites, parallel-safe-with, write lock, read-only paths, research sources, expected changes, test files, verification commands, completion criteria, final evidence.`
- `Missing or empty required field: <field>.`
- `Verification command uses a banned tool: <command>.`
- `Write lock escapes the workspace: <path>.`
- `Write lock is inside read-only reference root: <path>.`

## cli success behavior

The `runValidationCli` function calls `validatePlan(planDirectory)` and, when `result.errors.length === 0`, writes the single line `Validated <result.totalSteps> vanilla parity steps. First step: <result.firstStep ?? 'NONE'>.` to `stdout` and returns exit code `0`. The `if (import.meta.main)` guard at the bottom of the script invokes `process.exit(await runValidationCli())` so the script may be executed directly with `bun run plan_vanilla_parity/validate-plan.ts` and surface the canonical exit code to the calling shell.

## cli failure behavior

When `result.errors.length > 0`, the `runValidationCli` function writes one line per error to `stderr` in the format `<error.file>: <error.message>` and returns exit code `1`. The function never throws on validation failure (it returns the integer exit code) so callers may capture both the exit code and the diagnostic stream in tests.

## no runtime side effects rule

The validator must remain a pure read-only script: `validatePlan` and every helper read files via `Bun.file(...).text()` or `Bun.file(...).exists()` and never call `Bun.write`, `node:fs/promises#writeFile`, `node:fs#mkdir`, network APIs (`fetch`, `Bun.connect`, `Bun.listen`), or any global-state mutation. The fixture-driven test at `plan_vanilla_parity/validate-plan.test.ts` is the only writer; it builds a temporary directory under `.cache/plan-vanilla-parity-fixture-*` and validates the fixture plan via the explicit `planDirectory` argument so the real `plan_vanilla_parity/` tree is never written.

## evidence locations

- AGENTS.md
- CLAUDE.md
- plan_vanilla_parity/MASTER_CHECKLIST.md
- plan_vanilla_parity/PARALLEL_WORK.md
- plan_vanilla_parity/PROMPT.md
- plan_vanilla_parity/README.md
- plan_vanilla_parity/define-final-acceptance-standard.md
- plan_vanilla_parity/define-lane-write-lock-contract.md
- plan_vanilla_parity/define-step-file-required-fields.md
- plan_vanilla_parity/establish-vanilla-parity-control-center.md
- plan_vanilla_parity/steps/00-015-create-plan-validation-script-contract.md
- plan_vanilla_parity/validate-plan.test.ts
- plan_vanilla_parity/validate-plan.ts

## acceptance phrasing

The canonical plan validation script in the vanilla DOOM 1.9 parity rebuild is the read-only Bun script at `plan_vanilla_parity/validate-plan.ts`, invoked via the canonical CLI command `bun run plan_vanilla_parity/validate-plan.ts` exported as `PLAN_VALIDATION_COMMAND`. The script exports the canonical four public surfaces `PLAN_VALIDATION_COMMAND`, `parseChecklist`, `runValidationCli`, and `validatePlan` plus the canonical two result types `ValidationError` and `ValidationResult`. The `ValidationResult` interface declares the canonical three fields `errors`, `firstStep`, and `totalSteps` in canonical order. The script pins the canonical constants `EXPECTED_FIRST_STEP = '00-001'`, `EXPECTED_TOTAL_STEPS = 398`, and `FINAL_GATE_STEP_ID = '13-004'`. The canonical twelve `REQUIRED_FILES` entries `DEPENDENCY_GRAPH.md`, `MASTER_CHECKLIST.md`, `PARALLEL_WORK.md`, `PRE_PROMPT.md`, `PROMPT.md`, `README.md`, `REFERENCE_ORACLES.md`, `RISK_REGISTER.md`, `SOURCE_CATALOG.md`, `STEP_TEMPLATE.md`, `validate-plan.test.ts`, and `validate-plan.ts` are enforced by `validateRequiredFiles`. The canonical fourteen `REQUIRED_STEP_FIELDS` entries `id`, `lane`, `title`, `goal`, `prerequisites`, `parallel-safe-with`, `write lock`, `read-only paths`, `research sources`, `expected changes`, `test files`, `verification commands`, `completion criteria`, and `final evidence` are enforced by `validateStepText`. The canonical ten `BANNED_COMMANDS` entries `jest`, `mocha`, `node`, `npm`, `npx`, `pnpm`, `ts-node`, `tsx`, `vitest`, and `yarn` are enforced by `usesBannedCommand`. The canonical three `READ_ONLY_ROOTS` entries `doom/`, `iwad/`, and `reference/` are enforced by `validateWritablePath`. The canonical twelve `REQUIRED_FINAL_GATE_PHRASES` entries `bun run doom.ts`, `same deterministic input stream`, `deterministic state`, `framebuffer`, `audio`, `music events`, `menu transitions`, `level transitions`, `save/load bytes`, `demo playback`, `full-playthrough completion`, and `zero default differences` are enforced by `validateFinalGate`. The canonical five `REJECTED_FINAL_EVIDENCE_PATTERNS` entries `pending`, `manifest-only`, `sampled-only`, `intent-only`, and `declared intent` are enforced by `validateFinalGate`. The canonical sixteen internal helper functions `addMissingFileError`, `collectStepFiles`, `extractBullets`, `extractSection`, `normalizePlanPath`, `parseLaneWriteScopes`, `parsePrerequisites`, `pathsConflict`, `readTextIfExists`, `usesBannedCommand`, `validateChecklistSummary`, `validateFinalGate`, `validateParallelWork`, `validateRequiredFiles`, `validateStepText`, and `validateWritablePath` compose the validator. The CLI returns exit code `0` and writes `Validated <total> vanilla parity steps. First step: <firstStep>.` to stdout when the validator finds zero errors, and returns exit code `1` and writes one `<file>: <message>` line per error to stderr otherwise. The validator is read-only: it never writes files, mutates global state, or opens network connections.
