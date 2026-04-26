# Define Current State Inventory Schema

This document pins the canonical schema that every current-state inventory artifact under `plan_vanilla_parity/current-state/<slug>.json` must satisfy. It freezes the canonical inventory artifact directory `plan_vanilla_parity/current-state/`, the canonical inventory lane owned-write-roots `plan_vanilla_parity/current-state/` and `test/vanilla_parity/current-state/` declared by the `inventory` row of `plan_vanilla_parity/PARALLEL_WORK.md`, the canonical inventory artifact filename rule (one `<slug>.json` file per inventory step where `<slug>` matches the step's `kebab-case` slug after the `01-NNN` prefix), the canonical inventory artifact JSON encoding (UTF-8, parseable by `Bun.file().json()`, top-level value must be an `object` not an `array`), the canonical nine required top-level inventory fields in canonical order (`id`, `title`, `lane`, `summary`, `captured_at_utc`, `evidence_method`, `repository_root`, `implications`, `follow_up_steps`), the canonical per-field contract (the `id` field equals the inventory step's `01-NNN` id verbatim; the `title` field equals the inventory step's title in title case; the `lane` field equals the literal `inventory`; the `summary` field is a non-empty string; the `captured_at_utc` field is an ISO 8601 UTC timestamp ending in the `Z` suffix; the `evidence_method` field is a non-empty string describing how evidence was collected from the local repository, local DOS executables, local IWAD bytes, local Chocolate Doom Windows executable, upstream Chocolate Doom source, or community documentation; the `repository_root` field is the absolute path of the repository root captured during evidence collection; the `implications` field is a non-empty array of one-sentence strings; the `follow_up_steps` field is a non-empty array of `<id> <slug>` strings whose `<id>-<slug>.md` step files exist under `plan_vanilla_parity/steps/`), the canonical extension rule (every inventory step file may declare additional step-specific fields beyond the canonical nine required fields, but no field name may collide with a canonical field name and every required field must appear), the canonical no-proprietary-bytes rule (no inventory artifact may embed proprietary id Software bytes; only file paths, file sizes, file hashes, and derived metadata of files inside the read-only reference roots `doom/`, `iwad/`, `reference/` are allowed; raw lump bytes, raw IWAD bytes, raw configuration file contents, and raw save bytes are forbidden), the canonical inventory step file contract (every inventory step file under `plan_vanilla_parity/steps/01-NNN-<slug>.md` declares `lane: inventory`, lists exactly one `plan_vanilla_parity/current-state/<slug>.json` path under `write lock`, and lists exactly one `test/vanilla_parity/current-state/<slug>.test.ts` path under `write lock`), the canonical inventory test contract (every inventory test file under `test/vanilla_parity/current-state/<slug>.test.ts` loads the inventory artifact with `Bun.file().json()`, asserts the canonical nine required fields are present and well-typed, asserts every `follow_up_steps` entry resolves to an existing step file under `plan_vanilla_parity/steps/`, and adds at least one failure-mode test). Any future change to these invariants must update this document and its focused test in lockstep.

## scope name

vanilla DOOM 1.9 current-state inventory artifact schema

## emulated vanilla version

1.9

## reference engine

Chocolate Doom

## reference engine version

2.2.1

## inventory artifact directory

plan_vanilla_parity/current-state/

## inventory lane owned write roots

- plan_vanilla_parity/current-state/
- test/vanilla_parity/current-state/

## inventory artifact filename rule

Every inventory step file under `plan_vanilla_parity/steps/01-NNN-<slug>.md` writes exactly one inventory artifact at the path `plan_vanilla_parity/current-state/<slug>.json` where `<slug>` is the kebab-case slug that follows the step's `01-NNN-` numeric prefix. The filename must use the `.json` extension. The artifact directory must contain at most one file per inventory step slug, and the artifact must be the only file under `plan_vanilla_parity/current-state/` that the step's `write lock` declares.

## inventory artifact encoding

Every inventory artifact under `plan_vanilla_parity/current-state/<slug>.json` must be UTF-8 encoded JSON parseable by `Bun.file(path).json()`. The top-level JSON value must be an `object` (not an `array`, `string`, `number`, `boolean`, or `null`). Trailing commas, comments, and JavaScript-only literals (`undefined`, `NaN`, `Infinity`) are not permitted. The artifact may be pretty-printed with two-space indentation for readability but must remain a valid JSON document.

## canonical required top level fields

- id
- title
- lane
- summary
- captured_at_utc
- evidence_method
- repository_root
- implications
- follow_up_steps

## canonical required top level field count

9

## id field contract

The `id` field is a string equal to the inventory step's checklist id verbatim. The id matches the regular expression `^01-\d{3}$` because every inventory step lives under Phase 01 in `plan_vanilla_parity/MASTER_CHECKLIST.md`. The recorded id must equal the `id` field declared by the corresponding step file under `plan_vanilla_parity/steps/`. The id is the canonical join key between the inventory artifact, the step file, and the focused test, so a mismatch is a rejection.

## title field contract

The `title` field is a non-empty string equal to the inventory step's title. The title is rendered in title case (each space-separated token's first character is uppercase) and matches the `## title` value declared by the corresponding step file under `plan_vanilla_parity/steps/`. The title carries no machine semantics beyond identification but is required so that downstream readers (other Ralph-loop steps, audit logs, oracle replay scripts) can resolve the artifact without re-reading the step file.

## lane field contract

The `lane` field is the literal string `inventory`. No other lane slug from the canonical fourteen lane slugs in `plan_vanilla_parity/PARALLEL_WORK.md` is permitted because every artifact under `plan_vanilla_parity/current-state/` is owned by the `inventory` lane. The `inventory` lane row in `plan_vanilla_parity/PARALLEL_WORK.md` declares `plan_vanilla_parity/current-state/` and `test/vanilla_parity/current-state/` as its owned write roots.

## summary field contract

The `summary` field is a non-empty string of human-readable prose that summarizes the inventory artifact's evidence, scope, and conclusion. The summary must be a single field (not an array) so that downstream readers can quote it verbatim. Forward Ralph-loop agents must keep the summary scoped to evidence captured at `captured_at_utc`; subsequent state changes belong in a follow-up inventory step, not in a backfilled summary.

## captured at utc field contract

The `captured_at_utc` field is an ISO 8601 UTC timestamp string ending in the `Z` suffix (for example `2026-04-26T14:30:00Z`). The timestamp records when evidence collection happened. Inventory readers must treat the artifact as a frozen snapshot from `captured_at_utc`; if subsequent edits to the repository invalidate the snapshot, the responsible follow-up inventory step must capture a new artifact with a fresh `captured_at_utc`, not patch the existing one in place.

## evidence method field contract

The `evidence_method` field is a non-empty string that describes how evidence was collected. The string must name the inventory lane that collected the evidence and the concrete data sources actually consulted (for example `direct local repository audit performed by the inventory lane: ls of repository root, Bun.file existence checks, package.json read, and bun run doom.ts launch attempt.`). Acceptable evidence sources are the local repository working tree, local DOS executables under `doom/`, local IWAD bytes under `doom/` or `iwad/`, the local Chocolate Doom Windows executable under `doom/`, upstream Chocolate Doom source, and community documentation cataloged by `plan_vanilla_parity/SOURCE_CATALOG.md`.

## repository root field contract

The `repository_root` field is a string containing the absolute path of the repository root at the moment evidence was collected. The path uses the operating system's native separator at capture time (forward slashes on Unix-like systems, forward or back slashes on Windows). The field exists so that inventory artifacts captured on different machines remain self-describing for downstream readers.

## implications field contract

The `implications` field is a non-empty array of strings. Each entry is a single-sentence statement that articulates what the captured evidence implies for the vanilla parity rebuild. The array must contain at least one entry; an empty `implications` array is a rejection because an inventory artifact whose evidence carries no implications would not justify a step. Implications may reference forward Ralph-loop steps by `<id> <slug>` so downstream readers can chain to the next decision point.

## follow up steps field contract

The `follow_up_steps` field is a non-empty array of `<id> <slug>` strings (for example `03-001 add-root-doom-ts-bun-entrypoint`) where `<id>` matches `\d{2}-\d{3}` and `<slug>` matches `[a-z][a-z0-9-]*`. Every entry must resolve to an existing step file at `plan_vanilla_parity/steps/<id>-<slug>.md`. The array must contain at least one entry so that the inventory artifact always points at the next concrete action the captured evidence motivates. The `follow_up_steps` field is the inventory schema's contribution to plan continuity; it bridges the inventory lane to the launch, core, wad, and acceptance lanes.

## inventory extension rule

Every inventory step file may declare additional step-specific fields beyond the canonical nine required top-level fields. Step-specific fields encode the concrete evidence the step captures (for example `package_json`, `doom_ts_status`, `current_simplified_launcher`, `root_typescript_entrypoints` declared by the 01-001 inventory artifact). No additional field name may collide with a canonical required field name. Every additional field must be parseable by `Bun.file().json()` and must respect the same no-proprietary-bytes rule as the canonical fields.

## inventory no proprietary bytes rule

No inventory artifact under `plan_vanilla_parity/current-state/<slug>.json` may embed proprietary id Software bytes. Only file paths, file sizes, file hashes (SHA-256 or other one-way digests), and derived metadata of files inside the read-only reference roots `doom/`, `iwad/`, `reference/` are allowed. Raw IWAD lump bytes, raw IWAD bytes, raw DOS executable bytes, raw configuration file contents, raw save bytes, raw demo bytes, and raw audio/music samples are forbidden. The rule preserves the proprietary asset boundary pinned by `plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md` and the read-only reference root rule pinned by `plan_vanilla_parity/define-read-only-reference-roots.md`.

## inventory step file contract

Every inventory step file under `plan_vanilla_parity/steps/01-NNN-<slug>.md` must declare `lane: inventory` under its `## lane` section. The step file's `## write lock` section must list exactly two paths: `plan_vanilla_parity/current-state/<slug>.json` (the inventory artifact) and `test/vanilla_parity/current-state/<slug>.test.ts` (the focused test). Both paths must also appear under `## expected changes`. The step file's `## test files` section must list `test/vanilla_parity/current-state/<slug>.test.ts`. The step file must satisfy the canonical fourteen-field shape pinned by `plan_vanilla_parity/define-step-file-required-fields.md`.

## inventory test contract

Every inventory test file under `test/vanilla_parity/current-state/<slug>.test.ts` must load its inventory artifact via `Bun.file('plan_vanilla_parity/current-state/<slug>.json').json()`. The test must assert that every canonical required top-level field is present, that the `id` field equals the step id verbatim, that the `lane` field equals the literal `inventory`, that the `captured_at_utc` field is parseable as a UTC timestamp, that the `implications` array is non-empty, that every `follow_up_steps` entry resolves to an existing step file under `plan_vanilla_parity/steps/`, and that the artifact respects the canonical extension rule (any step-specific fields are validated against the on-disk evidence the inventory step claims). The test must include at least one failure-mode test that proves the parser rejects a tampered or malformed artifact.

## evidence locations

- AGENTS.md
- CLAUDE.md
- plan_vanilla_parity/MASTER_CHECKLIST.md
- plan_vanilla_parity/PARALLEL_WORK.md
- plan_vanilla_parity/PROMPT.md
- plan_vanilla_parity/README.md
- plan_vanilla_parity/SOURCE_CATALOG.md
- plan_vanilla_parity/current-state/inventory-root-scripts-and-missing-doom-ts.json
- plan_vanilla_parity/define-lane-write-lock-contract.md
- plan_vanilla_parity/define-read-only-reference-roots.md
- plan_vanilla_parity/define-step-file-required-fields.md
- plan_vanilla_parity/pin-proprietary-asset-non-redistribution-boundary.md
- plan_vanilla_parity/steps/01-001-inventory-root-scripts-and-missing-doom-ts.md
- plan_vanilla_parity/validate-plan.ts
- plan_vanilla_parity/validate-plan.test.ts
- src/reference/policy.ts
- test/vanilla_parity/current-state/inventory-root-scripts-and-missing-doom-ts.test.ts

## acceptance phrasing

Every current-state inventory artifact under `plan_vanilla_parity/current-state/<slug>.json` is a UTF-8 JSON object that declares the canonical nine required top-level fields (`id`, `title`, `lane`, `summary`, `captured_at_utc`, `evidence_method`, `repository_root`, `implications`, `follow_up_steps`) in canonical order, sets `lane` to the literal `inventory`, embeds no proprietary id Software bytes from the read-only reference roots `doom/`, `iwad/`, or `reference/`, lists at least one entry under `implications` and `follow_up_steps`, points every `follow_up_steps` entry at an existing `plan_vanilla_parity/steps/<id>-<slug>.md` file, and is locked by exactly one focused test under `test/vanilla_parity/current-state/<slug>.test.ts` whose step file under `plan_vanilla_parity/steps/01-NNN-<slug>.md` declares `lane: inventory` and lists the two write-locked paths under both `write lock` and `expected changes`.
