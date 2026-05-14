import { existsSync } from 'node:fs';
import path from 'node:path';

import { afterAll, describe, expect, test } from 'bun:test';

import { REFERENCE_SANDBOX_POLICY, SANDBOX_REQUIRED_FILES } from '../../../src/oracles/referenceSandbox.ts';
import { type ReferenceLaunchEvidence, ReferenceBundleMissingError, launchReferenceCleanly } from '../../../tools/reference/launchReferenceCleanly.ts';

const ACCEPTED_TERMINATION_CAUSES: readonly ReferenceLaunchEvidence['terminationCause'][] = ['natural-exit', 'sandbox-killed'];

function referenceBundleIsAvailable(): boolean {
  for (const requiredFile of SANDBOX_REQUIRED_FILES) {
    if (!existsSync(path.join(REFERENCE_SANDBOX_POLICY.sourcePath, requiredFile.filename))) {
      return false;
    }
  }

  return true;
}

describe('oracle: launchReferenceCleanly', () => {
  test('exports the runner and termination cause enum', () => {
    expect(typeof launchReferenceCleanly).toBe('function');
    expect(launchReferenceCleanly.length).toBeLessThanOrEqual(1);
  });

  test('throws ReferenceBundleMissingError when the sandbox executable is absent on disk', async () => {
    const overrides = { executableFilename: 'NON_EXISTENT_BINARY.EXE' };

    if (!referenceBundleIsAvailable()) {
      // Even when the source bundle is absent, createReferenceSandbox throws first.
      // Skip the missing-binary path on hosts without the bundle.
      return;
    }

    await expect(launchReferenceCleanly(overrides)).rejects.toBeInstanceOf(ReferenceBundleMissingError);
  });

  if (referenceBundleIsAvailable()) {
    let capturedSandboxPath: string | null = null;

    afterAll(async () => {
      if (capturedSandboxPath !== null && existsSync(capturedSandboxPath)) {
        const { destroyReferenceSandbox } = await import('../../../tools/reference/createReferenceSandbox.ts');
        await destroyReferenceSandbox(capturedSandboxPath);
      }
    });

    test('captures a live clean-launch evidence record from a sandbox copy of DOOM.EXE', async () => {
      const evidence = await launchReferenceCleanly({ settleDurationMs: 250, killWaitMs: 8_000 });
      capturedSandboxPath = evidence.sandboxAbsolutePath;

      expect(evidence.executableFilename).toBe('DOOM.EXE');
      expect(evidence.sandboxId.length).toBeGreaterThan(0);
      expect(evidence.sandboxAbsolutePath.includes(REFERENCE_SANDBOX_POLICY.sandboxPrefix)).toBe(true);
      expect(evidence.spawnedAtElapsedMs).toBeGreaterThanOrEqual(0);
      expect(evidence.settleDurationMs).toBeGreaterThanOrEqual(0);
      expect(evidence.exitedAtElapsedMs).toBeGreaterThanOrEqual(evidence.spawnedAtElapsedMs);
      expect(evidence.totalElapsedMs).toBeGreaterThanOrEqual(evidence.spawnedAtElapsedMs);
      expect(ACCEPTED_TERMINATION_CAUSES).toContain(evidence.terminationCause);
      expect(evidence.cleanShutdown).toBe(true);
    });

    test('removes the sandbox directory after the runner returns', async () => {
      const evidence = await launchReferenceCleanly({ settleDurationMs: 100, killWaitMs: 8_000 });

      expect(existsSync(evidence.sandboxAbsolutePath)).toBe(false);
    });
  } else {
    test.skip('skipped live clean-launch capture because the reference bundle is not present on this host', () => {
      expect(true).toBe(true);
    });
  }
});
