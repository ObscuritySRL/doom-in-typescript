# Ban Non Bun Runtime And Package Commands

This document pins the Bun-exclusive runtime and package command rule that every Ralph-loop step in the vanilla DOOM 1.9 parity rebuild must follow when invoking, installing, building, testing, or executing scripts in this repository. It freezes the canonical Bun-only declaration from `AGENTS.md` (Runtime section: Bun is the runtime, the package manager, the test runner, and the script executor with no exceptions and no Node.js fallbacks), the canonical Bun-native API preference from `AGENTS.md` and `CLAUDE.md` (`Bun.file`, `Bun.write`, `Bun.serve`, `Bun.argv`, `Bun.env`, `Bun.sleep`, `Bun.spawn`, `bun:test`, `bun:ffi`, `bun:sqlite`), the canonical list of forbidden non-Bun runtime, package manager, and test runner commands pinned in `AGENTS.md`, `CLAUDE.md`, and the `BANNED_COMMANDS` literal of `plan_vanilla_parity/validate-plan.ts` (`jest`, `mocha`, `node`, `npm`, `npx`, `pnpm`, `ts-node`, `tsx`, `vitest`, `yarn`), the canonical list of forbidden non-Bun lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`), the canonical sanctioned Bun lockfile (`bun.lock`), and the verification-command implication that no step's `verification commands` section may shell out to a forbidden runtime, package manager, or test runner. Any future change to these invariants must update this document and its focused test in lockstep.

## scope name

vanilla DOOM 1.9 Bun runtime and package command exclusivity

## emulated vanilla version

1.9

## reference engine

Chocolate Doom

## reference engine version

2.2.1

## bun exclusivity rule

Bun is the only sanctioned runtime, package manager, script runner, and test runner for this repository, as pinned by the `AGENTS.md` Runtime section ("This project uses Bun. Always.") and the `CLAUDE.md` Runtime constraints section ("Bun only. Runtime, package manager, script runner, and test runner."). Forward Ralph-loop agents must use only `bun`, `bun add`, `bun build`, `bun install`, `bun remove`, `bun run`, `bun test`, and `bun x` to operate on the working tree. The repository must never invoke `node`, `npm`, `yarn`, `pnpm`, `npx`, `ts-node`, `tsx`, `vitest`, `jest`, or `mocha` from any committed script, command, test, documentation example, or verification command. There are no "if Bun is installed" conditional fallbacks, no Node.js compatibility paths, and no cross-runtime polyfills.

## sanctioned bun commands

- bun
- bun add
- bun build
- bun install
- bun remove
- bun run
- bun test
- bun x

## forbidden runtime commands

- node
- ts-node
- tsx

## forbidden package manager commands

- npm
- npx
- pnpm
- yarn

## forbidden test runner commands

- jest
- mocha
- vitest

## forbidden command list

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

## forbidden lockfiles

- package-lock.json
- pnpm-lock.yaml
- yarn.lock

## sanctioned lockfile

bun.lock

## bun native api preference

Forward Ralph-loop agents must prefer Bun-native APIs over Node equivalents whenever both exist, as pinned by the `AGENTS.md` Runtime section. The canonical preferred surfaces include `Bun.file`, `Bun.write`, `Bun.serve`, `Bun.argv`, `Bun.env`, `Bun.sleep`, `Bun.spawn`, `bun:test`, `bun:ffi`, and `bun:sqlite`. Tests must use the `bun:test` framework and run via `bun test`. The Bun-only repository never adds Node-only tooling, polyfills, or test runners; introducing `ts-node`, `tsx`, `vitest`, `jest`, or `mocha` is forbidden because `bun` and `bun:test` cover all of it. The Win32 host and launcher use Bun's `bun:ffi` plus the `@bun-win32/*` bindings (`@bun-win32/core`, `@bun-win32/gdi32`, `@bun-win32/kernel32`, `@bun-win32/user32`, `@bun-win32/winmm`), and no cross-runtime FFI shim may be introduced.

## verification command rule

Every Ralph-loop step's `verification commands` section must list only Bun-native commands. The four canonical verification commands pinned by `AGENTS.md`, `CLAUDE.md`, and `plan_vanilla_parity/PROMPT.md` (`bun run format`, `bun test <path>`, `bun test`, `bun x tsc --noEmit --project tsconfig.json`) must not be replaced by, paired with, or routed through any forbidden runtime, package manager, or test runner. The plan validation script `plan_vanilla_parity/validate-plan.ts` enforces this rule against every step file by parsing its `verification commands` section and rejecting any command whose first token (or `bun x` second token) appears in the canonical `BANNED_COMMANDS` set (`jest`, `mocha`, `node`, `npm`, `npx`, `pnpm`, `ts-node`, `tsx`, `vitest`, `yarn`). Forward Ralph-loop agents must not weaken or remove this enforcement.

## evidence locations

- AGENTS.md
- CLAUDE.md
- package.json
- plan_vanilla_parity/MASTER_CHECKLIST.md
- plan_vanilla_parity/PROMPT.md
- plan_vanilla_parity/README.md
- plan_vanilla_parity/validate-plan.ts

## acceptance phrasing

Bun is the only sanctioned runtime, package manager, script runner, and test runner; never `jest`, `mocha`, `node`, `npm`, `npx`, `pnpm`, `ts-node`, `tsx`, `vitest`, or `yarn`.
