import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { REFERENCE_SANDBOX_POLICY, type SandboxFileEntry } from '../../src/oracles/referenceSandbox.ts';

export interface CopiedSandboxFile {
  readonly destinationPath: string;
  readonly filename: string;
  readonly observedSha256Upper: string;
  readonly observedSizeBytes: number;
  readonly role: SandboxFileEntry['role'];
}

export interface ReferenceSandboxDescriptor {
  readonly sandboxAbsolutePath: string;
  readonly sandboxId: string;
  readonly copiedFiles: readonly CopiedSandboxFile[];
  readonly sourceBundleAbsolutePath: string;
}

export interface ReferenceSandboxOverrides {
  readonly sandboxParentAbsolutePath?: string;
  readonly sourceBundleAbsolutePath?: string;
  readonly sandboxIdOverride?: string;
}

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

function createSandboxIdFromTimestampAndRandom(): string {
  const isoTimestampNoSeparators = new Date().toISOString().replaceAll(/[-:.TZ]/g, '');
  const randomSuffix = Math.random().toString(36).slice(2, 10);
  return `${isoTimestampNoSeparators}-${randomSuffix}`;
}

export async function createReferenceSandbox(overrides: ReferenceSandboxOverrides = {}): Promise<ReferenceSandboxDescriptor> {
  const sourceBundleAbsolutePath = overrides.sourceBundleAbsolutePath ?? REFERENCE_SANDBOX_POLICY.sourcePath;
  const sandboxParentAbsolutePath = overrides.sandboxParentAbsolutePath ?? path.join(REFERENCE_SANDBOX_POLICY.workspaceRoot, REFERENCE_SANDBOX_POLICY.sandboxParent);
  const sandboxId = overrides.sandboxIdOverride ?? createSandboxIdFromTimestampAndRandom();
  const sandboxAbsolutePath = path.join(sandboxParentAbsolutePath, `${REFERENCE_SANDBOX_POLICY.sandboxPrefix}${sandboxId}`);

  if (!(await pathExists(sourceBundleAbsolutePath))) {
    throw new Error(`Reference bundle source path does not exist: ${sourceBundleAbsolutePath}`);
  }

  await mkdir(sandboxAbsolutePath, { recursive: true });

  const copiedFiles: CopiedSandboxFile[] = [];

  for (const requiredFileEntry of REFERENCE_SANDBOX_POLICY.requiredFiles) {
    const sourceFileAbsolutePath = path.join(sourceBundleAbsolutePath, requiredFileEntry.filename);
    const destinationFileAbsolutePath = path.join(sandboxAbsolutePath, requiredFileEntry.filename);

    if (!(await pathExists(sourceFileAbsolutePath))) {
      throw new Error(`Required reference file is missing from source bundle: ${sourceFileAbsolutePath}`);
    }

    const sourceBytes = await readFile(sourceFileAbsolutePath);

    if (REFERENCE_SANDBOX_POLICY.verifyHashesAfterCopy) {
      const observedSourceSha = computeSha256UpperHex(sourceBytes);
      if (observedSourceSha !== requiredFileEntry.expectedHash) {
        throw new Error(`Source reference file SHA-256 mismatch for ${requiredFileEntry.filename}: expected ${requiredFileEntry.expectedHash}, observed ${observedSourceSha}`);
      }
      if (sourceBytes.byteLength !== requiredFileEntry.expectedSize) {
        throw new Error(`Source reference file size mismatch for ${requiredFileEntry.filename}: expected ${requiredFileEntry.expectedSize}, observed ${sourceBytes.byteLength}`);
      }
    }

    await writeFile(destinationFileAbsolutePath, sourceBytes);

    const destinationBytes = await readFile(destinationFileAbsolutePath);
    const observedDestinationSha = computeSha256UpperHex(destinationBytes);

    if (observedDestinationSha !== requiredFileEntry.expectedHash) {
      throw new Error(`Destination sandbox file SHA-256 mismatch for ${requiredFileEntry.filename}: expected ${requiredFileEntry.expectedHash}, observed ${observedDestinationSha}`);
    }

    copiedFiles.push({
      destinationPath: destinationFileAbsolutePath,
      filename: requiredFileEntry.filename,
      observedSha256Upper: observedDestinationSha,
      observedSizeBytes: destinationBytes.byteLength,
      role: requiredFileEntry.role,
    });
  }

  return {
    sandboxAbsolutePath,
    sandboxId,
    copiedFiles: Object.freeze(copiedFiles),
    sourceBundleAbsolutePath,
  };
}

export async function destroyReferenceSandbox(sandboxAbsolutePath: string): Promise<void> {
  await rm(sandboxAbsolutePath, { recursive: true, force: true });
}
