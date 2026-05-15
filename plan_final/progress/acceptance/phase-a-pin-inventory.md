# Phase A1 - Cross-plan doom.ts skeleton pin inventory

Owner governance decision 2026-05-15 ("Authorize unlock + build", via AskUserQuestion):
formally supersede plan_vanilla_parity + plan_fps prior-art skeleton pins so `doom.ts`
can become a real `bun run doom.ts` launcher. Authoritative plan:
`docs/superpowers/plans/2026-05-15-plan-final-acceptance-lane.md` (Phases A-E).

## Baseline (recorded before any edit)

- `bun test test/vanilla_parity/launch/add-root-doom-ts-bun-entrypoint.test.ts` -> 10 pass, 0 fail, 26 expect() (clean).

## Scope-narrowing decision: do NOT add a package.json `doom` script

`bun run doom.ts` runs the file directly; no package.json script is required. The plan
doc's optional `"doom"` alias is intentionally dropped to avoid the package.json
SHA-pin blast radius:

- `test/plan_fps/01-007-audit-missing-bun-run-doom-entrypoint.test.ts` SHA-pins
  `package.json` (`9075b8e3...`), `src/main.ts` (`019ea4be...`), `tsconfig.json`,
  `plan_fps/SOURCE_CATALOG.md`, and asserts `scripts.start === 'bun run src/main.ts'`.
  It does not read `doom.ts` content. Untouched by Phase A/B (no package.json /
  `src/main.ts` change).
- `test/plan_fps/01-013/01-014/01-015` SHA-pin `src/main.ts` only. `doom.ts` calls
  `src/vanilla/runDoomMain.ts` directly; `src/main.ts` stays byte-identical for
  `bun run start`. `03-002` remains accepted-BLOCKED; these pins never trip.

## Assertions that DO break when doom.ts gains `import { runDoomMain }` + top-level await (Phase B)

### Superseded prior art (owner-authorized retirement: formal supersession, not weakening)

- `test/vanilla_parity/launch/add-root-doom-ts-bun-entrypoint.test.ts`
  - `:39-45` "names canonical runtime target" - keep PASSING by retaining the
    `Vanilla DOOM 1.9` / `bun run doom.ts` / `plan_vanilla_parity` / `03-001` comment tokens.
  - `:47-53` "no top-level side effects beyond empty export marker" - BREAKS
    (`expect(toContain('export {}'))`; doom.ts no longer has `export {}`).
  - `:55-59` "no import declarations" (`/^\s*import[\s\(]/m`) - BREAKS.
  - `:74-78` "bun run doom.ts exits 0 / empty stderr" - STAYS GREEN after B
    (`runDoomMain([])` placeholder resolves; process exits 0). Re-evaluated in Phase C.
  - `:88-95` "package.json exposes no doom.ts script" - STAYS GREEN (no script added).
  - Failure-mode tests `:80-86`, `:97-109` - unaffected.
- `test/vanilla_parity/current-state/inventory-root-scripts-and-missing-doom-ts.test.ts`
  - `doom_ts_status` / missing-doom-ts inventory rows - BREAKS (governed inventory update).
- `test/vanilla_parity/current-state/gate-current-state-inventory.test.ts`
  - Rolls up the above inventory - BREAKS transitively (governed).
- `test/vanilla_parity/launch/implement-d-doommain-init-order-skeleton.test.ts`,
  `implement-d-doomloop-entry-timing.test.ts`
  - Assert `dDoomMain.ts` / `runDoomLoop.ts` skeleton; relevant in Phase C (not B).
    Listed for completeness.

### plan_final-internal skeleton assertions

Active plan owner build-authorization implies updating the now-superseded "doom.ts is NOT a launcher" invariant. Keep every non-skeleton assertion intact.

- `test/plan_final/launch/replace-root-doom-entrypoint.test.ts` (03-001)
  - `:123-128` "doom.ts remains the skeleton: export {} + no imports" - BREAKS.
    Update to assert the wired entrypoint shape (`import { runDoomMain }`, `runDoomMain(` call).
  - `:116-121` "bun run doom.ts exits 0 / empty stderr" - STAYS GREEN after B.
  - `:34-114` runDoomMain arity / InvalidArgumentError contract - STAYS GREEN after B
    (runDoomMain unchanged in B); re-evaluated when Phase C makes runDoomMain launch.
- `test/plan_final/launch/gate-clean-launch-to-title.test.ts` (03-010)
  - `:89-94` "doom.ts held at pinned skeleton (export {}, no `import {`)" - BREAKS.
    Update to assert wired entrypoint. All other assertions (prereq status/evidence,
    runDoomMain/wireTitleLoopRendering surface, oracle fixture, IWAD) STAY intact.
- `test/plan_final/launch/wire-vanilla-window-host.test.ts`
  - Inspect in A2 (matched the skeleton/import grep); update only a doom.ts-skeleton assertion if present.
- `test/plan_final/current-state/runtime-implementation-modules.test.ts` (01-004) plus its
  fixture `plan_final/current-state/runtime-implementation-modules.json`
  - `subsystems_reachable_from_doom_ts` / doom.ts-unwired rows - BREAKS; governed
    inventory update to the wired reality. Inspect exact rows in A2.

## Empirical confirmation requirement

Static list above is best-effort. Phase B lands `doom.ts` wiring then runs full
`bun test`; the exact failure set is whatever that run reports. Only
doom.ts-skeleton / doom.ts-inventory assertions are retired/updated (scoped tightly);
any unrelated failure is a real regression to fix, never a pin to relax. A2+B commit
atomically to avoid a red interval.
