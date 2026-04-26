# Define Step File Required Fields

This document pins the canonical list of required step-file fields, their canonical order, and the per-field contract that every Ralph-loop step file under `plan_vanilla_parity/steps/` in the vanilla DOOM 1.9 parity rebuild must satisfy. It freezes the fourteen required fields enforced by `plan_vanilla_parity/validate-plan.ts` (`REQUIRED_STEP_FIELDS` literal) in the canonical order `id`, `lane`, `title`, `goal`, `prerequisites`, `parallel-safe-with`, `write lock`, `read-only paths`, `research sources`, `expected changes`, `test files`, `verification commands`, `completion criteria`, `final evidence`. It freezes the canonical step heading format `# [ ] STEP <id>: <Title>` enforced by `validateStepText` in the same validator, the canonical empty-section rejection rule (every required field must have at least one non-empty line of content), the canonical exact-heading-order rule (the step file's `## ` headings concatenated by newline must equal the canonical fourteen joined by newline), the canonical id-and-lane consistency rule (the `id` and `lane` field values must equal the corresponding columns in the `plan_vanilla_parity/MASTER_CHECKLIST.md` row that references the step file), the canonical prerequisites rule (every entry must equal `none` or an existing prior step id), the canonical write-lock path rules (no empty path, no `..` escape, no path inside the read-only reference roots `doom/`, `iwad/`, `reference/`), the canonical test-files rule (at least one focused `bun:test` path), and the canonical four verification commands (`bun run format`, `bun test <focused>`, `bun test`, `bun x tsc --noEmit --project tsconfig.json`) in the exact order pinned by `AGENTS.md` and `plan_vanilla_parity/PROMPT.md`. It cross-references the canonical step template at `plan_vanilla_parity/STEP_TEMPLATE.md` and the canonical reference example at `plan_vanilla_parity/steps/00-007-ban-non-bun-runtime-and-package-commands.md`. Any future change to these invariants must update this document and its focused test in lockstep.

## scope name

vanilla DOOM 1.9 step file required fields

## emulated vanilla version

1.9

## reference engine

Chocolate Doom

## reference engine version

2.2.1

## required step field count

14

## required step field order

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

## id field contract

The `id` field declares the canonical four-character step identifier in `NN-NNN` form (two-digit phase, hyphen, three-digit sequence) that uniquely names the step within `plan_vanilla_parity/`. The value must equal the id column of the corresponding row in `plan_vanilla_parity/MASTER_CHECKLIST.md` and the `<id>` token in the step file's heading `# [ ] STEP <id>: <Title>`. The `id` field must not be empty, must not contain whitespace, and must match the ASCII regular expression `^\d{2}-\d{3}$`.

## lane field contract

The `lane` field declares the lowercase lane slug that owns the step's write lock. The value must equal the lane column of the corresponding row in `plan_vanilla_parity/MASTER_CHECKLIST.md` and must be one of the lane slugs reserved in `plan_vanilla_parity/PARALLEL_WORK.md` (the immediate roots `governance`, `inventory`, `oracle`, `launch`, `core`, `wad`, plus any later-phase lane the parallel work table introduces). The `lane` field must not be empty.

## title field contract

The `title` field declares the human-readable Title-Cased description of the step. The value must equal the `<Title>` token in the step file's heading `# [ ] STEP <id>: <Title>`. The `title` field must not be empty.

## goal field contract

The `goal` field declares the smallest verified increment the step delivers in one sentence, written in imperative mood, mentioning vanilla DOOM 1.9 behavior preservation when the step changes runtime behavior. The `goal` field must not be empty and must not contain commit-message-style scopes such as `feat(scope):`.

## prerequisites field contract

The `prerequisites` field declares the exact prior step ids the step depends on as a bullet list. Each bullet must equal `none` (when no prerequisite exists) or an existing prior step id in `NN-NNN` form. The bullet list must equal the prereqs column of the corresponding row in `plan_vanilla_parity/MASTER_CHECKLIST.md`. The `prerequisites` field must list at least one bullet.

## parallel-safe-with field contract

The `parallel-safe-with` field declares which other lanes or step scopes may run concurrently with the step as a bullet list. Each bullet must name a lane (e.g. `oracle lane when write locks do not overlap and shared interfaces in DEPENDENCY_GRAPH.md are unchanged`) or a specific step scope. The `parallel-safe-with` field must list at least one bullet.

## write lock field contract

The `write lock` field declares the exact writable paths the step may modify as a bullet list. Each bullet must be a non-empty repository-relative path. No bullet may begin with `../` (the path must not escape the workspace) and no bullet may begin with the read-only reference roots `doom/`, `iwad/`, or `reference/`. The `write lock` field must list at least one bullet, and each bullet must also appear under the `expected changes` field.

## read-only paths field contract

The `read-only paths` field declares the exact files or directories the step may read but must never write as a bullet list. Each bullet must be a non-empty repository-relative path. The `read-only paths` field must list at least one bullet.

## research sources field contract

The `research sources` field declares the local binaries, IWADs, source files, configuration files, manifests, or oracle artifacts the step relies on for behavioral evidence as a bullet list. The `research sources` field must list at least one bullet.

## expected changes field contract

The `expected changes` field declares the exact set of files the step plans to create or modify as a bullet list. Every entry under the `write lock` field must also appear under the `expected changes` field. The `expected changes` field must list at least one bullet.

## test files field contract

The `test files` field declares one or more focused `bun:test` test paths the step adds or updates as a bullet list. The first bullet must be the focused test exercised by the second canonical verification command (`bun test <focused>`). The `test files` field must list at least one bullet.

## verification commands field contract

The `verification commands` field declares the bash commands that must pass before the step is considered verified, as a backtick-wrapped bullet list, in the exact canonical order. The list must contain `bun run format`, then `bun test <focused>` where `<focused>` equals the first bullet under `test files`, then `bun test`, then `bun x tsc --noEmit --project tsconfig.json`. No bullet may invoke a banned tool from the canonical forbidden command list (`jest`, `mocha`, `node`, `npm`, `npx`, `pnpm`, `ts-node`, `tsx`, `vitest`, `yarn`).

## completion criteria field contract

The `completion criteria` field declares the machine-verifiable acceptance criteria the step must satisfy before the row in `plan_vanilla_parity/MASTER_CHECKLIST.md` may be marked `[x]`, as a bullet list. The `completion criteria` field must list at least one bullet.

## final evidence field contract

The `final evidence` field declares the durable, machine-verifiable evidence the step produces (committed test files, captured oracle artifacts, manifest entries, and so on) as a bullet list. For non-final-gate steps the `final evidence` field must list at least one bullet. The final-gate step `13-004 gate-full-final-side-by-side-proof` carries the additional acceptance phrasing pinned by `validateFinalGate` in `plan_vanilla_parity/validate-plan.ts` and must not rely on pending, manifest-only, sampled-only, or intent-only proof.

## step heading format rule

Every step file under `plan_vanilla_parity/steps/` must begin with a single `# ` heading on line one whose text equals `# [ ] STEP <id>: <Title>` exactly, with `<id>` equal to the `id` field and `<Title>` equal to the `title` field. The leading `[ ]` checkbox is the canonical pending-step marker. The heading must not be `# [x] STEP <id>: <Title>` even after the step is marked complete in `plan_vanilla_parity/MASTER_CHECKLIST.md`; only the checklist row toggles `[ ]` to `[x]`, the step file heading is frozen at write time.

## fields exactly match rule

The list of `## ` headings in every step file under `plan_vanilla_parity/steps/`, taken in document order and joined with `\n`, must equal the list of fourteen required field names in this document's `required step field order` section, taken in document order and joined with `\n`. Adding, removing, renaming, or reordering any heading is a validator-rejected change. The `validateStepText` function in `plan_vanilla_parity/validate-plan.ts` enforces this rule with the exact diagnostic `Step fields must exactly match: id, lane, title, goal, prerequisites, parallel-safe-with, write lock, read-only paths, research sources, expected changes, test files, verification commands, completion criteria, final evidence.`

## non-empty field rule

Every required field in every step file under `plan_vanilla_parity/steps/` must contain at least one non-empty line of content between its `## ` heading and the next `## ` heading (or the end of file). An empty section body is a validator-rejected change with the exact diagnostic `Missing or empty required field: <field>.`

## id and lane consistency rule

For every step file under `plan_vanilla_parity/steps/<id>-<slug>.md`, the `id` field value must equal the id column and the `lane` field value must equal the lane column of the corresponding row in `plan_vanilla_parity/MASTER_CHECKLIST.md`. The `prerequisites` field bullets, joined by `,`, must equal the prereqs column of the same row.

## prerequisites entry rule

Every bullet in the `prerequisites` field of every step file under `plan_vanilla_parity/steps/` must equal `none` or an existing prior step id that appears earlier in `plan_vanilla_parity/MASTER_CHECKLIST.md`. A prerequisite that names a non-existent or later step is a validator-rejected change.

## write lock path rule

Every bullet in the `write lock` field of every step file under `plan_vanilla_parity/steps/` must be a non-empty repository-relative path. No bullet may begin with `../` (no workspace escape). No bullet may begin with the read-only reference roots `doom/`, `iwad/`, or `reference/`. The `validateWritablePath` function in `plan_vanilla_parity/validate-plan.ts` enforces these rules.

## read-only reference roots

- doom/
- iwad/
- reference/

## test files minimum rule

The `test files` field of every step file under `plan_vanilla_parity/steps/` must list at least one focused `bun:test` test path. A step file with no focused test is a validator-rejected change with the exact diagnostic `Step must list at least one focused test file.`

## canonical verification commands

- bun run format
- bun test <focused>
- bun test
- bun x tsc --noEmit --project tsconfig.json

## verification command inclusion rule

Every step file under `plan_vanilla_parity/steps/` must list, under the `verification commands` field, the four canonical verification commands above in the exact canonical order, with `<focused>` substituted for the first bullet under `test files`. The validator enforces this with four diagnostics: `Verification must include bun run format.`, `Verification must include the focused bun test command.`, `Verification must include full bun test.`, and `Verification must include the Bun typecheck command.`

## banned verification commands

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

## banned verification command rule

No bullet under the `verification commands` field of any step file under `plan_vanilla_parity/steps/` may invoke a banned tool from the canonical forbidden command list above, either as the first token of the command or as the second token after `bun x`. The `usesBannedCommand` helper in `plan_vanilla_parity/validate-plan.ts` enforces this rule against every step file's verification commands and emits the diagnostic `Verification command uses a banned tool: <command>.`

## evidence locations

- AGENTS.md
- CLAUDE.md
- plan_vanilla_parity/MASTER_CHECKLIST.md
- plan_vanilla_parity/PARALLEL_WORK.md
- plan_vanilla_parity/PROMPT.md
- plan_vanilla_parity/README.md
- plan_vanilla_parity/STEP_TEMPLATE.md
- plan_vanilla_parity/steps/00-007-ban-non-bun-runtime-and-package-commands.md
- plan_vanilla_parity/validate-plan.ts
- plan_vanilla_parity/validate-plan.test.ts

## acceptance phrasing

Every step file under `plan_vanilla_parity/steps/` declares the fourteen canonical fields `id`, `lane`, `title`, `goal`, `prerequisites`, `parallel-safe-with`, `write lock`, `read-only paths`, `research sources`, `expected changes`, `test files`, `verification commands`, `completion criteria`, `final evidence` in this exact order, with non-empty bodies, under the canonical heading `# [ ] STEP <id>: <Title>`.
