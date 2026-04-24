/**
 * Temporary sandbox helper for doom_codex test harness.
 *
 * Creates isolated temporary directories under `.sandboxes/` for tests
 * that need writable disk space. Tracks all created directories and
 * provides bulk cleanup suitable for use in `afterEach` / `afterAll`.
 *
 * @example
 * ```ts
 * import { cleanupTempSandboxes, createTempSandbox } from "./tempSandbox.ts";
 * const path = await createTempSandbox();
 * // ... write test files into path ...
 * await cleanupTempSandboxes();
 * ```
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

/** Root of the doom_codex package (two levels up from test/_harness/). */
const PACKAGE_ROOT = resolve(import.meta.dir, '..', '..');

/** Parent directory for all test sandboxes. */
const SANDBOX_PARENT = resolve(PACKAGE_ROOT, '.sandboxes');

/** Prefix for test sandbox directory names. */
const SANDBOX_PREFIX = 'test-';

/** Set of sandbox paths currently tracked for cleanup. */
const tracked = new Set<string>();

/**
 * Creates a new temporary sandbox directory and tracks it for cleanup.
 *
 * The directory is created under `doom_codex/.sandboxes/test-{random}/`.
 * Each call produces a unique path. The caller may write files freely
 * inside the returned directory. Call {@link cleanupTempSandboxes} to
 * remove all tracked sandboxes.
 *
 * @returns Absolute path to the newly created sandbox directory.
 *
 * @example
 * ```ts
 * const sandbox = await createTempSandbox();
 * await Bun.write(join(sandbox, "test.txt"), "hello");
 * ```
 */
export async function createTempSandbox(): Promise<string> {
  await Bun.write(resolve(SANDBOX_PARENT, '.gitkeep'), '');
  const sandboxPath = await mkdtemp(resolve(SANDBOX_PARENT, SANDBOX_PREFIX));
  tracked.add(sandboxPath);
  return sandboxPath;
}

/**
 * Removes all tracked sandbox directories from disk and clears the
 * tracking set. Safe to call when no sandboxes exist.
 *
 * @example
 * ```ts
 * afterEach(async () => { await cleanupTempSandboxes(); });
 * ```
 */
export async function cleanupTempSandboxes(): Promise<void> {
  for (const sandboxPath of tracked) {
    try {
      await rm(sandboxPath, { recursive: true, force: true });
    } catch {
      // Best-effort removal; ignore errors from already-deleted paths.
    }
  }
  tracked.clear();

  // Remove .gitkeep and parent if empty.
  try {
    await rm(resolve(SANDBOX_PARENT, '.gitkeep'), { force: true });
  } catch {
    // Ignore.
  }
  try {
    await rm(SANDBOX_PARENT, { recursive: false });
  } catch {
    // Parent may not be empty or already removed.
  }
}

/** Returns the number of sandbox directories currently tracked. */
export function tempSandboxCount(): number {
  return tracked.size;
}

/** Returns the absolute path to the sandbox parent directory. */
export function tempSandboxParent(): string {
  return SANDBOX_PARENT;
}
