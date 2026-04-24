/**
 * Reference sandbox copy policy for oracle capture runs.
 *
 * Defines which reference bundle files are copied into an isolated
 * sandbox directory, their expected integrity hashes, and the rules
 * governing sandbox creation and lifecycle.  This is the policy
 * definition only; actual sandbox creation is a later step.
 *
 * @example
 * ```ts
 * import { REFERENCE_SANDBOX_POLICY } from "../src/oracles/referenceSandbox.ts";
 * console.log(REFERENCE_SANDBOX_POLICY.requiredFiles.length); // 4
 * ```
 */

import { CODEX_WORKSPACE_PATH, REFERENCE_BUNDLE_PATH } from '../reference/policy.ts';

/** Role a file plays inside a reference sandbox. */
export type SandboxFileRole = 'config' | 'executable' | 'iwad';

/** A single file that must be present in a reference sandbox. */
export interface SandboxFileEntry {
  /** File basename within the reference bundle. */
  readonly filename: string;
  /** Expected SHA-256 hash for integrity verification. */
  readonly expectedHash: string;
  /** Expected file size in bytes. */
  readonly expectedSize: number;
  /** Role this file plays in the reference run. */
  readonly role: SandboxFileRole;
  /** Whether the reference executable may modify this file during a run. */
  readonly mutableDuringRun: boolean;
}

/** A reference bundle file excluded from the sandbox, with justification. */
export interface ExcludedFileEntry {
  /** File basename within the reference bundle. */
  readonly filename: string;
  /** Why this file is not needed in the sandbox. */
  readonly reason: string;
}

/** Rules governing the lifecycle of a reference sandbox. */
export interface SandboxPolicy {
  /** Absolute path to the read-only source of reference files. */
  readonly sourcePath: string;
  /** Directory name prefix for sandbox directories created under the workspace. */
  readonly sandboxPrefix: string;
  /** Relative path from the workspace root to the sandbox parent directory. */
  readonly sandboxParent: string;
  /** Absolute path to the workspace root under which sandboxes are created. */
  readonly workspaceRoot: string;
  /** Ordered list of files required in every sandbox. */
  readonly requiredFiles: readonly SandboxFileEntry[];
  /** Files explicitly excluded from the sandbox, with reasons. */
  readonly excludedFiles: readonly ExcludedFileEntry[];
  /** Whether to verify SHA-256 hashes after copying files into the sandbox. */
  readonly verifyHashesAfterCopy: boolean;
  /** Whether to delete the sandbox directory after a run completes. */
  readonly cleanupAfterRun: boolean;
  /** Whether config files should be copied fresh (not linked) to allow mutation. */
  readonly copyConfigsAsMutable: boolean;
}

/**
 * Frozen, ASCIIbetically sorted list of files required in every
 * reference sandbox.  Config files are marked mutable because
 * Chocolate Doom may write settings on exit.
 */
export const SANDBOX_REQUIRED_FILES: readonly SandboxFileEntry[] = Object.freeze([
  Object.freeze({
    filename: 'DOOM.EXE',
    expectedHash: '5CA97717FD79F833B248AE5985FFFADBEE39533F5E0529BC9D7B439E08B8F1D2',
    expectedSize: 1_893_888,
    role: 'executable',
    mutableDuringRun: false,
  } satisfies SandboxFileEntry),
  Object.freeze({
    filename: 'DOOM1.WAD',
    expectedHash: '1D7D43BE501E67D927E415E0B8F3E29C3BF33075E859721816F652A526CAC771',
    expectedSize: 4_196_020,
    role: 'iwad',
    mutableDuringRun: false,
  } satisfies SandboxFileEntry),
  Object.freeze({
    filename: 'chocolate-doom.cfg',
    expectedHash: 'A4FB5E9C3EB88091E41F088AFC885F628812A4A1EBD37A71B08474229A8CB770',
    expectedSize: 3_838,
    role: 'config',
    mutableDuringRun: true,
  } satisfies SandboxFileEntry),
  Object.freeze({
    filename: 'default.cfg',
    expectedHash: '0E1854B8109FE9D3C3BBDC1407F2AA0F75BA7A89807CB7EE21E146AF6CFAFABC',
    expectedSize: 1_565,
    role: 'config',
    mutableDuringRun: true,
  } satisfies SandboxFileEntry),
]);

/**
 * Frozen, ASCIIbetically sorted list of reference bundle files
 * explicitly excluded from the sandbox.
 */
export const SANDBOX_EXCLUDED_FILES: readonly ExcludedFileEntry[] = Object.freeze([
  Object.freeze({
    filename: 'DOOMD.EXE',
    reason: 'DOS-only binary; cannot execute on Windows host',
  } satisfies ExcludedFileEntry),
  Object.freeze({
    filename: 'DOOMDUPX.EXE',
    reason: 'UPX-packed DOS binary; cannot execute on Windows host',
  } satisfies ExcludedFileEntry),
  Object.freeze({
    filename: 'DOOMWUPX.exe',
    reason: 'UPX-packed alternative; DOOM.EXE is the primary executable',
  } satisfies ExcludedFileEntry),
  Object.freeze({
    filename: 'smash.py',
    reason: 'Bundle merge utility; not needed for reference runs',
  } satisfies ExcludedFileEntry),
]);

/**
 * Frozen policy object governing reference sandbox creation and lifecycle.
 *
 * Sandboxes are created under `{workspaceRoot}/{sandboxParent}/{sandboxPrefix}{id}/`.
 */
export const REFERENCE_SANDBOX_POLICY: SandboxPolicy = Object.freeze({
  sourcePath: REFERENCE_BUNDLE_PATH,
  sandboxPrefix: 'sandbox-',
  sandboxParent: '.sandboxes',
  workspaceRoot: CODEX_WORKSPACE_PATH,
  requiredFiles: SANDBOX_REQUIRED_FILES,
  excludedFiles: SANDBOX_EXCLUDED_FILES,
  verifyHashesAfterCopy: true,
  cleanupAfterRun: true,
  copyConfigsAsMutable: true,
} satisfies SandboxPolicy);
