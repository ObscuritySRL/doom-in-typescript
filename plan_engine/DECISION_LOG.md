# Decision Log

## D-001

- status: accepted
- date: 2026-04-11
- decision: Canonical C1 behavior target is shareware Doom 1.9 semantics.
- rationale: The local bundle includes the original shareware DOS binary and the shareware IWAD, and the local Windows executable reports Doom 1.9 emulation.
- evidence: S-001, S-002, S-005, S-006, S-007
- affected_steps: 00-001, 01-005, 17-010
- supersedes: none

## D-002

- status: accepted
- date: 2026-04-11
- decision: Use DOOM.EXE only as a secondary Windows-side oracle, and treat the DOS binary semantics as authoritative whenever they disagree.
- rationale: The Windows executable is a Chocolate Doom build rather than the original binary, so it is practical but not primary.
- evidence: S-001, S-002, S-006, S-007
- affected_steps: 02-001, 02-009, 17-010
- supersedes: none

## D-003

- status: accepted
- date: 2026-04-11
- decision: Use a TypeScript software framebuffer with GDI DIB presentation for C1.
- rationale: This matches the parity target more directly than introducing an OpenGL presentation dependency and stays within already present packages.
- evidence: S-015, S-016, PACKAGE_CAPABILITY_MATRIX.md
- affected_steps: 00-004, 06-008, 13-014
- supersedes: none

## D-004

- status: accepted
- date: 2026-04-11
- decision: Target TypeScript DMX-style digital SFX plus TypeScript OPL music for C1, not host General MIDI.
- rationale: Host MIDI is not sufficient for exact parity, while the bundled data and reference behavior demand deterministic music timing.
- evidence: S-017, S-038, S-042
- affected_steps: 00-005, 15-012, 17-006
- supersedes: none

## D-005

- status: accepted
- date: 2026-04-11
- decision: Keep controller and gamepad support out of C1.
- rationale: It is not required for shareware Doom 1.9 parity, and it would dilute the early exactness budget.
- evidence: S-003, S-004
- affected_steps: 06-004, 06-005
- supersedes: none

## D-006

- status: accepted
- date: 2026-04-11
- decision: All derived captures, sandboxes, and artifacts must live under doom_codex and never under doom.
- rationale: This preserves the read-only contract on the local reference bundle and avoids contaminating the oracle inputs.
- evidence: user task constraints, S-001
- affected_steps: 02-001, 02-009, 17-010
- supersedes: none

## D-007

- status: accepted
- date: 2026-04-23
- decision: Keep `createAutomapState().scale_ftom` normalized to the reciprocal of `scale_mtof`, even though vanilla leaves the file-static `scale_ftom` at zero before `AM_LevelInit`.
- rationale: The exported automap helpers assume a self-consistent scale pair, while the pre-`AM_LevelInit` `scale_ftom` value is unobservable in vanilla runtime behavior. The audit therefore corrects the docs and logs rather than widening the fix into later oracle fixtures.
- evidence: Chocolate Doom `src/doom/am_map.c` (`static fixed_t scale_mtof = (fixed_t)INITSCALEMTOF; static fixed_t scale_ftom;`), `src/ui/automap.ts`, `test/parity/level-start-state-hash.test.ts`
- affected_steps: 14-004, 17-001, 17-010
- supersedes: none
