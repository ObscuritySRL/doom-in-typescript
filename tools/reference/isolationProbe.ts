/**
 * Reference run isolation probe.
 *
 * Proves that a reference sandbox can be created, populated with the
 * required reference files, integrity-verified via SHA-256, and torn
 * down — all from within doom_codex without modifying the source
 * bundle.  This is the feasibility proof for automated oracle capture
 * runs that require an isolated working directory.
 *
 * @example
 * ```ts
 * import { probeIsolation } from "../../tools/reference/isolationProbe.ts";
 * const result = await probeIsolation();
 * console.log(result.allHashesMatch); // true
 * ```
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { REFERENCE_SANDBOX_POLICY, SANDBOX_REQUIRED_FILES } from '../../src/oracles/referenceSandbox.ts';
import type { SandboxFileEntry } from '../../src/oracles/referenceSandbox.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of required files that must be present in every sandbox. */
export const REQUIRED_FILE_COUNT = SANDBOX_REQUIRED_FILES.length;

/** Number of required files that are mutable during a run. */
export const MUTABLE_FILE_COUNT = SANDBOX_REQUIRED_FILES.filter((entry) => entry.mutableDuringRun).length;

/** Number of required files that are immutable during a run. */
export const IMMUTABLE_FILE_COUNT = REQUIRED_FILE_COUNT - MUTABLE_FILE_COUNT;

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

/** Hash verification result for a single file. */
export interface FileHashResult {
  /** File basename. */
  readonly filename: string;
  /** Expected SHA-256 hash from the sandbox policy. */
  readonly expectedHash: string;
  /** Actual SHA-256 hash computed from the copied file. */
  readonly actualHash: string;
  /** Whether the hashes match. */
  readonly match: boolean;
  /** Actual file size in bytes. */
  readonly actualSize: number;
  /** Expected file size from the sandbox policy. */
  readonly expectedSize: number;
  /** Whether the sizes match. */
  readonly sizeMatch: boolean;
}

/** Isolation check result for a single config file. */
export interface ConfigIsolationResult {
  /** File basename. */
  readonly filename: string;
  /** Whether the sandbox copy is a true copy (not a link to the source). */
  readonly isTrueCopy: boolean;
}

/** Complete result of the isolation probe. */
export interface IsolationProbeResult {
  /** Absolute path to the sandbox directory that was created. */
  readonly sandboxPath: string;
  /** Whether the sandbox directory was successfully created. */
  readonly sandboxCreated: boolean;
  /** Per-file hash verification results. */
  readonly fileResults: readonly FileHashResult[];
  /** Whether all file hashes matched their expected values. */
  readonly allHashesMatch: boolean;
  /** Whether all file sizes matched their expected values. */
  readonly allSizesMatch: boolean;
  /** Per-config-file isolation verification results. */
  readonly configIsolationResults: readonly ConfigIsolationResult[];
  /** Whether all config files are true copies (not links). */
  readonly allConfigsIsolated: boolean;
  /** Whether the sandbox was successfully cleaned up. */
  readonly cleanedUp: boolean;
  /** Number of files found in the sandbox after copy. */
  readonly filesCopied: number;
  /** Whether the source bundle files remain unmodified after the probe. */
  readonly sourceUnmodified: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Computes the SHA-256 hash of a file in uppercase hex.
 *
 * @param filePath - Absolute path to the file
 * @returns Uppercase hex SHA-256 hash string
 */
async function hashFile(filePath: string): Promise<string> {
  const file = Bun.file(filePath);
  const buffer = await file.arrayBuffer();
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(buffer);
  return hasher.digest('hex').toUpperCase();
}

/**
 * Copies a single file from the reference bundle into the sandbox.
 *
 * @param entry - Sandbox file entry describing the file
 * @param sandboxPath - Absolute path to the sandbox directory
 */
async function copyFileToSandbox(entry: SandboxFileEntry, sandboxPath: string): Promise<void> {
  const sourcePath = join(REFERENCE_SANDBOX_POLICY.sourcePath, entry.filename);
  const destinationPath = join(sandboxPath, entry.filename);
  const sourceFile = Bun.file(sourcePath);
  await Bun.write(destinationPath, sourceFile);
}

// ---------------------------------------------------------------------------
// Probe
// ---------------------------------------------------------------------------

/**
 * Runs the full isolation probe: create sandbox, copy files, verify
 * integrity and isolation, then clean up.
 *
 * The probe creates a temporary directory under the sandbox parent
 * defined by REFERENCE_SANDBOX_POLICY, copies all required files,
 * verifies SHA-256 hashes and file sizes, checks that config files
 * are true copies (not links to the source), confirms the source
 * bundle is unmodified, and removes the sandbox directory.
 *
 * @returns The complete probe result
 *
 * @example
 * ```ts
 * const result = await probeIsolation();
 * console.log(result.allHashesMatch); // true
 * console.log(result.cleanedUp);      // true
 * ```
 */
export async function probeIsolation(): Promise<IsolationProbeResult> {
  const sandboxParentPath = join(REFERENCE_SANDBOX_POLICY.workspaceRoot, REFERENCE_SANDBOX_POLICY.sandboxParent);

  await Bun.write(join(sandboxParentPath, '.gitkeep'), '');

  const sandboxPath = await mkdtemp(join(sandboxParentPath, REFERENCE_SANDBOX_POLICY.sandboxPrefix));

  let sandboxCreated = true;
  let filesCopied = 0;
  const fileResults: FileHashResult[] = [];
  const configIsolationResults: ConfigIsolationResult[] = [];
  let sourceUnmodified = true;
  let cleanedUp = false;

  try {
    // Hash source files before copy for later comparison
    const sourceHashesBefore = new Map<string, string>();
    for (const entry of SANDBOX_REQUIRED_FILES) {
      const sourcePath = join(REFERENCE_SANDBOX_POLICY.sourcePath, entry.filename);
      const hash = await hashFile(sourcePath);
      sourceHashesBefore.set(entry.filename, hash);
    }

    // Copy all required files into the sandbox
    for (const entry of SANDBOX_REQUIRED_FILES) {
      await copyFileToSandbox(entry, sandboxPath);
      filesCopied++;
    }

    // Verify SHA-256 hashes and sizes of copied files
    for (const entry of SANDBOX_REQUIRED_FILES) {
      const copiedPath = join(sandboxPath, entry.filename);
      const actualHash = await hashFile(copiedPath);
      const copiedFile = Bun.file(copiedPath);
      const actualSize = copiedFile.size;

      fileResults.push({
        filename: entry.filename,
        expectedHash: entry.expectedHash,
        actualHash,
        match: actualHash === entry.expectedHash,
        actualSize,
        expectedSize: entry.expectedSize,
        sizeMatch: actualSize === entry.expectedSize,
      });
    }

    // Verify config files are true copies by writing to the sandbox
    // copy and confirming the source file is unchanged
    for (const entry of SANDBOX_REQUIRED_FILES) {
      if (!entry.mutableDuringRun) {
        continue;
      }

      const copiedPath = join(sandboxPath, entry.filename);
      const sourcePath = join(REFERENCE_SANDBOX_POLICY.sourcePath, entry.filename);

      // Append a sentinel to the sandbox copy
      const sentinel = '\n# isolation-probe-sentinel\n';
      const originalContent = await Bun.file(copiedPath).text();
      await Bun.write(copiedPath, originalContent + sentinel);

      // Read the source and confirm it does NOT contain the sentinel
      const sourceContent = await Bun.file(sourcePath).text();
      const isTrueCopy = !sourceContent.includes('isolation-probe-sentinel');

      // Restore the sandbox copy to its original content
      await Bun.write(copiedPath, originalContent);

      configIsolationResults.push({ filename: entry.filename, isTrueCopy });
    }

    // Verify source files are still identical to their pre-copy state
    for (const entry of SANDBOX_REQUIRED_FILES) {
      const sourcePath = join(REFERENCE_SANDBOX_POLICY.sourcePath, entry.filename);
      const hashAfter = await hashFile(sourcePath);
      if (hashAfter !== sourceHashesBefore.get(entry.filename)) {
        sourceUnmodified = false;
      }
    }
  } finally {
    // Clean up the sandbox directory
    if (REFERENCE_SANDBOX_POLICY.cleanupAfterRun) {
      try {
        await rm(sandboxPath, { recursive: true, force: true });
        cleanedUp = true;
      } catch {
        cleanedUp = false;
      }
    }

    // Also remove .gitkeep if the parent is now empty
    try {
      const gitkeepPath = join(sandboxParentPath, '.gitkeep');
      await rm(gitkeepPath, { force: true });
    } catch {
      // Ignore cleanup of .gitkeep
    }

    try {
      await rm(sandboxParentPath, { recursive: false });
    } catch {
      // Directory may not be empty or already removed
    }
  }

  const allHashesMatch = fileResults.every((result) => result.match);
  const allSizesMatch = fileResults.every((result) => result.sizeMatch);
  const allConfigsIsolated = configIsolationResults.every((result) => result.isTrueCopy);

  return {
    sandboxPath,
    sandboxCreated,
    fileResults,
    allHashesMatch,
    allSizesMatch,
    configIsolationResults,
    allConfigsIsolated,
    cleanedUp,
    filesCopied,
    sourceUnmodified,
  };
}

/**
 * Creates a sandbox directory without running the full probe.
 *
 * Useful for testing sandbox creation and file copy in isolation.
 * The caller is responsible for cleanup.
 *
 * @returns The absolute path to the created sandbox directory
 *
 * @example
 * ```ts
 * const path = await createSandbox();
 * // ... use sandbox ...
 * await rm(path, { recursive: true });
 * ```
 */
export async function createSandbox(): Promise<string> {
  const sandboxParentPath = join(REFERENCE_SANDBOX_POLICY.workspaceRoot, REFERENCE_SANDBOX_POLICY.sandboxParent);

  await Bun.write(join(sandboxParentPath, '.gitkeep'), '');

  const sandboxPath = await mkdtemp(join(sandboxParentPath, REFERENCE_SANDBOX_POLICY.sandboxPrefix));

  for (const entry of SANDBOX_REQUIRED_FILES) {
    await copyFileToSandbox(entry, sandboxPath);
  }

  return sandboxPath;
}
