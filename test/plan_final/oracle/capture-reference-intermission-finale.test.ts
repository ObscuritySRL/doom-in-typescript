import { existsSync } from 'node:fs';
import path from 'node:path';

import { afterAll, describe, expect, test } from 'bun:test';

import { REFERENCE_SANDBOX_POLICY, SANDBOX_REQUIRED_FILES } from '../../../src/oracles/referenceSandbox.ts';
import {
  type AttractLoopCheckpointContract,
  type AttractLoopCheckpointEvidence,
  type AttractLoopPhase,
  type CaptureReferenceIntermissionFinaleOverrides,
  type ReferenceIntermissionFinaleEvidence,
  type ReferenceIntermissionFinaleTerminationCause,
  ATTRACT_LOOP_CHECKPOINTS,
  ATTRACT_LOOP_PHASES,
  ReferenceIntermissionFinaleWindowNotFoundError,
  captureReferenceIntermissionFinale,
  normalizeToInternalFramebuffer,
} from '../../../tools/reference/captureReferenceIntermissionFinale.ts';
import { ReferenceBundleMissingError } from '../../../tools/reference/launchReferenceCleanly.ts';

const ACCEPTED_TERMINATION_CAUSES: readonly ReferenceIntermissionFinaleTerminationCause[] = ['natural-exit', 'sandbox-killed'];
const CAPTURE_BYTES_PER_PIXEL = 4;
const NORMALIZED_INTERNAL_HEIGHT = 200;
const NORMALIZED_INTERNAL_WIDTH = 320;
const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/;

function referenceBundleIsAvailable(): boolean {
  for (const requiredFile of SANDBOX_REQUIRED_FILES) {
    if (!existsSync(path.join(REFERENCE_SANDBOX_POLICY.sourcePath, requiredFile.filename))) {
      return false;
    }
  }
  return true;
}

describe('oracle: captureReferenceIntermissionFinale', () => {
  test('exports the runner, normalizer, phase list, checkpoint contracts, and error class', () => {
    expect(typeof captureReferenceIntermissionFinale).toBe('function');
    expect(captureReferenceIntermissionFinale.length).toBeLessThanOrEqual(1);
    expect(typeof normalizeToInternalFramebuffer).toBe('function');
    expect(normalizeToInternalFramebuffer.length).toBe(3);
    expect(typeof ReferenceIntermissionFinaleWindowNotFoundError).toBe('function');
    const error = new ReferenceIntermissionFinaleWindowNotFoundError('Chocolate Doom 2.2.1', 9999);
    expect(error.name).toBe('ReferenceIntermissionFinaleWindowNotFoundError');
    expect(error.message).toContain('Chocolate Doom 2.2.1');
    expect(error.message).toContain('9999');
  });

  test('ATTRACT_LOOP_PHASES is frozen and ASCII-sorted with 7 distinct attract phases', () => {
    expect(Object.isFrozen(ATTRACT_LOOP_PHASES)).toBe(true);
    expect(ATTRACT_LOOP_PHASES.length).toBe(7);
    expect([...ATTRACT_LOOP_PHASES]).toEqual(['demo-one', 'demo-three', 'demo-two', 'post-demo-one-interstitial', 'post-demo-three-interstitial', 'post-demo-two-interstitial', 'title']);
    for (const phase of ATTRACT_LOOP_PHASES) {
      const typed: AttractLoopPhase = phase;
      expect(typeof typed).toBe('string');
    }
  });

  test('ATTRACT_LOOP_CHECKPOINTS is a frozen non-empty contract list with strictly increasing scheduled times and known phases', () => {
    expect(Object.isFrozen(ATTRACT_LOOP_CHECKPOINTS)).toBe(true);
    expect(ATTRACT_LOOP_CHECKPOINTS.length).toBeGreaterThan(0);
    let lastScheduledMs = -1;
    for (const checkpoint of ATTRACT_LOOP_CHECKPOINTS) {
      const typed: AttractLoopCheckpointContract = checkpoint;
      expect(Object.isFrozen(typed)).toBe(true);
      expect(typed.description.length).toBeGreaterThan(0);
      expect(ATTRACT_LOOP_PHASES).toContain(typed.phase);
      expect(typed.scheduledAtElapsedMs).toBeGreaterThanOrEqual(0);
      expect(typed.scheduledAtElapsedMs).toBeGreaterThan(lastScheduledMs);
      lastScheduledMs = typed.scheduledAtElapsedMs;
    }
  });

  test('accepts the documented override keys via the CaptureReferenceIntermissionFinaleOverrides shape', () => {
    const overrides: CaptureReferenceIntermissionFinaleOverrides = {
      executableFilename: 'DOOM.EXE',
      findWindowPollIntervalMs: 25,
      findWindowTimeoutMs: 15_000,
      killWaitMs: 3_000,
      sandboxIdOverride: 'override-id',
      settleAfterWindowFoundMs: 500,
    };
    expect(Object.keys(overrides).length).toBe(6);
  });

  test('normalizeToInternalFramebuffer produces a 320x200x4 byte BGRA buffer', () => {
    const sourceWidth = 640;
    const sourceHeight = 480;
    const sourcePixels = Buffer.alloc(sourceWidth * sourceHeight * CAPTURE_BYTES_PER_PIXEL);
    const normalized = normalizeToInternalFramebuffer(sourcePixels, sourceWidth, sourceHeight);
    expect(normalized.byteLength).toBe(NORMALIZED_INTERNAL_WIDTH * NORMALIZED_INTERNAL_HEIGHT * CAPTURE_BYTES_PER_PIXEL);
    expect(normalized.byteLength).toBe(256_000);
  });

  test('normalizeToInternalFramebuffer rejects invalid inputs', () => {
    expect(() => normalizeToInternalFramebuffer(Buffer.alloc(0), 0, 100)).toThrow(RangeError);
    expect(() => normalizeToInternalFramebuffer(Buffer.alloc(0), 100, 0)).toThrow(RangeError);
    expect(() => normalizeToInternalFramebuffer(Buffer.alloc(10), 100, 100)).toThrow(RangeError);
  });

  test('throws ReferenceBundleMissingError when the sandbox executable filename does not exist after sandbox creation', async () => {
    if (!referenceBundleIsAvailable()) {
      return;
    }
    await expect(captureReferenceIntermissionFinale({ executableFilename: 'NON_EXISTENT_BINARY.EXE' })).rejects.toBeInstanceOf(ReferenceBundleMissingError);
  });

  if (referenceBundleIsAvailable()) {
    let lastCapturedSandboxPath: string | null = null;

    afterAll(async () => {
      if (lastCapturedSandboxPath !== null && existsSync(lastCapturedSandboxPath)) {
        const { destroyReferenceSandbox } = await import('../../../tools/reference/createReferenceSandbox.ts');
        await destroyReferenceSandbox(lastCapturedSandboxPath);
      }
    });

    test('captures the attract-loop checkpoint sequence from clean launch with ordered timestamps and 320x200 normalized framebuffer hashes', async () => {
      const evidence: ReferenceIntermissionFinaleEvidence = await captureReferenceIntermissionFinale({ findWindowTimeoutMs: 30_000, killWaitMs: 8_000, settleAfterWindowFoundMs: 1_500 });
      lastCapturedSandboxPath = evidence.sandboxAbsolutePath;

      expect(evidence.executableFilename).toBe('DOOM.EXE');
      expect(evidence.windowTitle).toContain('Chocolate Doom 2.2.1');
      expect(evidence.sandboxId.length).toBeGreaterThan(0);
      expect(evidence.sandboxAbsolutePath.includes(REFERENCE_SANDBOX_POLICY.sandboxPrefix)).toBe(true);

      expect(evidence.spawnedAtElapsedMs).toBeGreaterThanOrEqual(0);
      expect(evidence.windowFoundAtElapsedMs).toBeGreaterThanOrEqual(evidence.spawnedAtElapsedMs);
      expect(evidence.killedAtElapsedMs).toBeGreaterThanOrEqual(evidence.windowFoundAtElapsedMs);
      expect(evidence.exitedAtElapsedMs).toBeGreaterThanOrEqual(evidence.killedAtElapsedMs);
      expect(evidence.totalElapsedMs).toBe(evidence.exitedAtElapsedMs);
      expect(evidence.ticDurationMs).toBeGreaterThan(0);

      expect(evidence.framebufferWidth).toBeGreaterThan(0);
      expect(evidence.framebufferHeight).toBeGreaterThan(0);

      expect(evidence.attractCheckpoints.length).toBe(ATTRACT_LOOP_CHECKPOINTS.length);
      let lastCapturedAtElapsedMs = 0;
      for (let checkpointIndex = 0; checkpointIndex < evidence.attractCheckpoints.length; checkpointIndex += 1) {
        const checkpoint: AttractLoopCheckpointEvidence = evidence.attractCheckpoints[checkpointIndex]!;
        const contract = ATTRACT_LOOP_CHECKPOINTS[checkpointIndex]!;
        expect(checkpoint.checkpointIndex).toBe(checkpointIndex);
        expect(checkpoint.phase).toBe(contract.phase);
        expect(checkpoint.description).toBe(contract.description);
        expect(checkpoint.scheduledAtElapsedMs).toBe(contract.scheduledAtElapsedMs);
        expect(checkpoint.capturedAtElapsedMs).toBeGreaterThanOrEqual(checkpoint.scheduledAtElapsedMs);
        expect(checkpoint.capturedAtElapsedMs).toBeGreaterThanOrEqual(lastCapturedAtElapsedMs);
        expect(checkpoint.framebufferByteLength).toBe(evidence.framebufferWidth * evidence.framebufferHeight * CAPTURE_BYTES_PER_PIXEL);
        expect(checkpoint.normalizedByteLength).toBe(NORMALIZED_INTERNAL_WIDTH * NORMALIZED_INTERNAL_HEIGHT * CAPTURE_BYTES_PER_PIXEL);
        expect(SHA256_HEX_REGEX.test(checkpoint.framebufferSha256)).toBe(true);
        expect(SHA256_HEX_REGEX.test(checkpoint.normalizedSha256)).toBe(true);
        lastCapturedAtElapsedMs = checkpoint.capturedAtElapsedMs;
      }

      expect(ACCEPTED_TERMINATION_CAUSES).toContain(evidence.terminationCause);
      expect(evidence.cleanShutdown).toBe(true);
      expect(existsSync(evidence.sandboxAbsolutePath)).toBe(false);
    }, 180_000);
  } else {
    test.skip('skipped live attract-loop capture because the reference bundle is not present on this host', () => {
      expect(true).toBe(true);
    });
  }
});
