/**
 * Canonical verification command conventions for doom_codex.
 *
 * Every step in the master checklist runs verification in a fixed
 * three-command sequence: focused test, full suite, typecheck.
 * This module locks those conventions as frozen constants so that
 * all steps and tooling agree on the exact commands and ordering.
 *
 * @example
 * ```ts
 * import { buildVerifySequence } from "../tools/verify.ts";
 * const commands = buildVerifySequence("test/core/fixed.constants.test.ts");
 * console.log(commands[0].kind); // "focused-test"
 * ```
 */

import { resolve } from 'node:path';

/** Root of the doom_codex package (one level up from tools/). */
const PACKAGE_ROOT = resolve(import.meta.dir, '..');

/** Absolute path to the doom_codex tsconfig used by the typecheck command. */
export const TSCONFIG_PATH = resolve(PACKAGE_ROOT, 'tsconfig.json');

/** Kind discriminant for a verification command. */
export type VerifyCommandKind = 'focused-test' | 'full-suite' | 'typecheck';

/** Frozen array of command kinds in mandatory execution order. */
export const VERIFY_COMMAND_KINDS: readonly VerifyCommandKind[] = Object.freeze(['focused-test', 'full-suite', 'typecheck'] as const);

/** Number of commands in the canonical verification sequence. */
export const VERIFY_COMMAND_COUNT = 3;

/** A single verification command in the canonical sequence. */
export interface VerifyCommand {
  /** Discriminant identifying the command's role. */
  readonly kind: VerifyCommandKind;
  /** Human-readable description of what this command verifies. */
  readonly description: string;
  /** The executable to run (always `"bun"`). */
  readonly command: string;
  /** Arguments to pass to the executable. */
  readonly args: readonly string[];
  /** Zero-based position in the execution sequence. */
  readonly order: number;
}

/**
 * Builds the canonical three-command verification sequence for a step.
 *
 * @param focusedTestPath - Relative path from the doom_codex package root
 *   to the step's focused test file (e.g., `"test/scaffold/verify-commands.test.ts"`).
 * @returns Frozen array of exactly {@link VERIFY_COMMAND_COUNT} commands
 *   in mandatory execution order.
 *
 * @example
 * ```ts
 * const commands = buildVerifySequence("test/core/fixed.constants.test.ts");
 * console.log(commands[0].args); // ["test", "test/core/fixed.constants.test.ts"]
 * ```
 */
export function buildVerifySequence(focusedTestPath: string): readonly VerifyCommand[] {
  return Object.freeze([
    Object.freeze({
      kind: 'focused-test' as const,
      description: `Run focused test: ${focusedTestPath}`,
      command: 'bun',
      args: Object.freeze(['test', focusedTestPath]),
      order: 0,
    }),
    Object.freeze({
      kind: 'full-suite' as const,
      description: 'Run full test suite',
      command: 'bun',
      args: Object.freeze(['test']),
      order: 1,
    }),
    Object.freeze({
      kind: 'typecheck' as const,
      description: 'Type-check with tsc --noEmit',
      command: 'bun',
      args: Object.freeze(['x', 'tsc', '--noEmit', '--project', TSCONFIG_PATH]),
      order: 2,
    }),
  ]);
}

/** Returns the absolute path to the doom_codex package root. */
export function verifyPackageRoot(): string {
  return PACKAGE_ROOT;
}
