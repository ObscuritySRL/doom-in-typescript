# [ ] STEP 14-002: status-bar-widgets-and-face

## Goal

Implement status bar widgets and face so it matches the canonical reference behavior and is locked by the listed test coverage.

## Prerequisites

- 14-001

## Read Only

- d:\Projects\bun-win32\doom_codex\plans\FACT_LOG.md
- d:\Projects\bun-win32\doom\universal-doom\DOOM1.WAD
- https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/m_menu.c
- https://github.com/chocolate-doom/chocolate-doom/blob/master/src/doom/st_stuff.c

## Consult Only If Blocked

- 14-001
- 14-003

## Expected Changes

- d:\Projects\bun-win32\doom_codex\src\ui\statusBar.ts

## Test Files

- d:\Projects\bun-win32\doom_codex\test\ui\status-bar.test.ts

## Verification

- `bun test test/ui/status-bar.test.ts`
- `bun test`
- `bun x tsc --noEmit --project d:\Projects\bun-win32\doom_codex\tsconfig.json`

## Completion Criteria

- The implementation files listed for this step match the listed reference behavior without widening the agreed interface or behavior surface.
- The targeted test file `test/ui/status-bar.test.ts` covers the normal path and at least one parity-sensitive edge case, and every listed verification command passes.

## Required Log Updates

- `FACT_LOG.md`: add any newly discovered constants, quirks, or file-format facts with future step IDs before leaving the step.
- `DECISION_LOG.md`: update only if this step changes a chosen interface, host boundary, or parity rule.
- `REFERENCE_ORACLES.md`: add or update the oracle record if this step creates or refreshes a capture, manifest, or replay fixture.
- `HANDOFF_LOG.md`: append the completion summary, verification commands, results, next eligible steps, and open risks.

## Later Steps That May Benefit

- 14-003
- 17-010
