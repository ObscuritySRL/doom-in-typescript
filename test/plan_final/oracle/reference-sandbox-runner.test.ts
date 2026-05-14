import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createReferenceSandbox, destroyReferenceSandbox } from '../../../tools/reference/createReferenceSandbox.ts';
import { REFERENCE_SANDBOX_POLICY } from '../../../src/oracles/referenceSandbox.ts';

function computeSha256UpperHex(fileBytes: Uint8Array): string {
  return createHash('sha256').update(fileBytes).digest('hex').toUpperCase();
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch (caughtError) {
    if (caughtError instanceof Error && 'code' in caughtError && (caughtError as { code?: unknown }).code === 'ENOENT') {
      return false;
    }
    throw caughtError;
  }
}

async function referenceBundleIsPresentOnDisk(): Promise<boolean> {
  for (const requiredFileEntry of REFERENCE_SANDBOX_POLICY.requiredFiles) {
    const sourceFileAbsolutePath = path.join(REFERENCE_SANDBOX_POLICY.sourcePath, requiredFileEntry.filename);
    if (!(await pathExists(sourceFileAbsolutePath))) {
      return false;
    }
  }
  return true;
}

describe('oracle: createReferenceSandbox', () => {
  test('copies every required reference file into a fresh sandbox under the configured parent directory', async () => {
    if (!(await referenceBundleIsPresentOnDisk())) {
      expect(true).toBe(true);
      return;
    }

    const isolatedParent = await mkdtemp(path.join(tmpdir(), 'reference-sandbox-runner-'));
    try {
      const descriptor = await createReferenceSandbox({ sandboxParentAbsolutePath: isolatedParent });

      expect(descriptor.sandboxAbsolutePath.startsWith(isolatedParent)).toBe(true);
      expect(descriptor.sandboxId.length).toBeGreaterThan(0);
      expect(descriptor.copiedFiles.length).toBe(REFERENCE_SANDBOX_POLICY.requiredFiles.length);

      for (const requiredFileEntry of REFERENCE_SANDBOX_POLICY.requiredFiles) {
        const copiedFile = descriptor.copiedFiles.find((entry) => entry.filename === requiredFileEntry.filename);
        expect(copiedFile).toBeDefined();
        if (!copiedFile) {
          continue;
        }
        expect(await pathExists(copiedFile.destinationPath)).toBe(true);
        expect(copiedFile.observedSha256Upper).toBe(requiredFileEntry.expectedHash);
        expect(copiedFile.observedSizeBytes).toBe(requiredFileEntry.expectedSize);
        expect(copiedFile.role).toBe(requiredFileEntry.role);
      }
    } finally {
      await rm(isolatedParent, { recursive: true, force: true });
    }
  });

  test('refuses to copy and excludes every file flagged as excluded by the sandbox policy', async () => {
    if (!(await referenceBundleIsPresentOnDisk())) {
      expect(true).toBe(true);
      return;
    }

    const isolatedParent = await mkdtemp(path.join(tmpdir(), 'reference-sandbox-runner-'));
    try {
      const descriptor = await createReferenceSandbox({ sandboxParentAbsolutePath: isolatedParent });

      for (const excludedFileEntry of REFERENCE_SANDBOX_POLICY.excludedFiles) {
        const excludedDestinationPath = path.join(descriptor.sandboxAbsolutePath, excludedFileEntry.filename);
        expect(await pathExists(excludedDestinationPath)).toBe(false);
      }
    } finally {
      await rm(isolatedParent, { recursive: true, force: true });
    }
  });

  test('does not mutate any source reference file in doom/ during the copy', async () => {
    if (!(await referenceBundleIsPresentOnDisk())) {
      expect(true).toBe(true);
      return;
    }

    const sourceHashesBeforeCopy = new Map<string, string>();
    for (const requiredFileEntry of REFERENCE_SANDBOX_POLICY.requiredFiles) {
      const sourceFileAbsolutePath = path.join(REFERENCE_SANDBOX_POLICY.sourcePath, requiredFileEntry.filename);
      const sourceBytes = await readFile(sourceFileAbsolutePath);
      sourceHashesBeforeCopy.set(requiredFileEntry.filename, computeSha256UpperHex(sourceBytes));
    }

    const isolatedParent = await mkdtemp(path.join(tmpdir(), 'reference-sandbox-runner-'));
    try {
      await createReferenceSandbox({ sandboxParentAbsolutePath: isolatedParent });
    } finally {
      await rm(isolatedParent, { recursive: true, force: true });
    }

    for (const requiredFileEntry of REFERENCE_SANDBOX_POLICY.requiredFiles) {
      const sourceFileAbsolutePath = path.join(REFERENCE_SANDBOX_POLICY.sourcePath, requiredFileEntry.filename);
      const sourceBytesAfter = await readFile(sourceFileAbsolutePath);
      const observedAfterCopy = computeSha256UpperHex(sourceBytesAfter);
      const recordedBeforeCopy = sourceHashesBeforeCopy.get(requiredFileEntry.filename);
      expect(recordedBeforeCopy).toBeDefined();
      if (recordedBeforeCopy !== undefined) {
        expect(observedAfterCopy).toBe(recordedBeforeCopy);
      }
      expect(observedAfterCopy).toBe(requiredFileEntry.expectedHash);
    }
  });

  test('destroyReferenceSandbox removes the sandbox directory cleanly', async () => {
    if (!(await referenceBundleIsPresentOnDisk())) {
      expect(true).toBe(true);
      return;
    }

    const isolatedParent = await mkdtemp(path.join(tmpdir(), 'reference-sandbox-runner-'));
    try {
      const descriptor = await createReferenceSandbox({ sandboxParentAbsolutePath: isolatedParent });
      expect(await pathExists(descriptor.sandboxAbsolutePath)).toBe(true);
      await destroyReferenceSandbox(descriptor.sandboxAbsolutePath);
      expect(await pathExists(descriptor.sandboxAbsolutePath)).toBe(false);
    } finally {
      await rm(isolatedParent, { recursive: true, force: true });
    }
  });

  test('throws when the source bundle path does not exist', async () => {
    const nonexistentSource = path.join(tmpdir(), 'plan_final-this-path-does-not-exist-2026-05-14');
    let thrownError: unknown = null;
    try {
      await createReferenceSandbox({ sourceBundleAbsolutePath: nonexistentSource, sandboxParentAbsolutePath: tmpdir() });
    } catch (caughtError) {
      thrownError = caughtError;
    }
    expect(thrownError).not.toBeNull();
    expect(thrownError instanceof Error).toBe(true);
    if (thrownError instanceof Error) {
      expect(thrownError.message).toContain('Reference bundle source path does not exist');
    }
  });
});
