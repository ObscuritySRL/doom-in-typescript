# Decision Log

## D-FPS-001

- status: accepted
- date: 2026-04-24
- decision: Use `plan_fps/` as the active playable parity control center.
- rationale: The playable parity effort needs a self-contained control center that does not rewrite the prior `plan_engine/` engine plan.
- evidence: user request, repository inspection, `plan_fps/manifests/00-002-declare-plan-fps-control-center.json`
- affected_steps: 00-001, 00-002
- supersedes: none

## D-FPS-002

- status: accepted
- date: 2026-04-24
- decision: Classify the old `plan_engine/` work as `mixed`.
- rationale: The existing checklist includes deterministic engine, host, UI, audio, save, demo, and parity-gate work, but it does not make `bun run doom.ts` the active playable launch target.
- evidence: `plan_engine/MASTER_CHECKLIST.md`, `src/main.ts`, `package.json`
- affected_steps: 00-001
- supersedes: none

## D-FPS-003

- status: accepted
- date: 2026-04-24
- decision: The C1 runtime target is exactly `bun run doom.ts`.
- rationale: Playable parity must be achieved through Bun and TypeScript directly, not through a wrapper executable or packaged binary.
- evidence: user request
- affected_steps: 00-003, 03-001, 14-001, 15-010
- supersedes: none

## D-FPS-004

- status: accepted
- date: 2026-04-24
- decision: The only intentional presentation difference from the reference target is windowed launch instead of fullscreen launch.
- rationale: All other observable behavior remains parity-critical until proven otherwise and recorded.
- evidence: user request
- affected_steps: 00-010, 04-004, 15-010
- supersedes: none
