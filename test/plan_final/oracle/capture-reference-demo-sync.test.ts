import { existsSync } from 'node:fs';
import path from 'node:path';

import { afterAll, describe, expect, test } from 'bun:test';

import { REFERENCE_SANDBOX_POLICY, SANDBOX_REQUIRED_FILES } from '../../../src/oracles/referenceSandbox.ts';
import {
  type CaptureReferenceDemoSyncOverrides,
  type DemoCheckpointContract,
  type DemoCheckpointEvidence,
  type ReferenceDemoNumber,
  type ReferenceDemoSyncEvidence,
  type ReferenceDemoSyncTerminationCause,
  DEMO_CHECKPOINT_CONTRACTS,
  DEMO_LUMP_NAMES,
  DEMO_PLAYBACK_NUMBERS,
  ReferenceDemoSyncWindowNotFoundError,
  captureReferenceDemoSync,
  normalizeToInternalFramebuffer,
} from '../../../tools/reference/captureReferenceDemoSync.ts';
import { ReferenceBundleMissingError } from '../../../tools/reference/launchReferenceCleanly.ts';
import { liveReferenceTest } from './live-reference-test-gate.ts';

const ACCEPTED_TERMINATION_CAUSES: readonly ReferenceDemoSyncTerminationCause[] = ['natural-exit', 'sandbox-killed'];
const CAPTURE_BYTES_PER_PIXEL = 4;
const EXPECTED_DEMO_COUNT = 3;
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

describe('oracle: captureReferenceDemoSync', () => {
  test('exports the runner, normalizer, demo number list, lump map, checkpoint contracts, and error class', () => {
    expect(typeof captureReferenceDemoSync).toBe('function');
    expect(captureReferenceDemoSync.length).toBeLessThanOrEqual(2);
    expect(typeof normalizeToInternalFramebuffer).toBe('function');
    expect(normalizeToInternalFramebuffer.length).toBe(3);
    expect(typeof ReferenceDemoSyncWindowNotFoundError).toBe('function');
    const error = new ReferenceDemoSyncWindowNotFoundError('Chocolate Doom 2.2.1', 9999);
    expect(error.name).toBe('ReferenceDemoSyncWindowNotFoundError');
    expect(error.message).toContain('Chocolate Doom 2.2.1');
    expect(error.message).toContain('9999');
  });

  test('DEMO_PLAYBACK_NUMBERS pins exactly 3 ReferenceDemoNumber values (1, 2, 3) in ascending order', () => {
    expect(Object.isFrozen(DEMO_PLAYBACK_NUMBERS)).toBe(true);
    expect(DEMO_PLAYBACK_NUMBERS.length).toBe(EXPECTED_DEMO_COUNT);
    expect([...DEMO_PLAYBACK_NUMBERS]).toEqual([1, 2, 3]);
    for (const demoNumber of DEMO_PLAYBACK_NUMBERS) {
      const typed: ReferenceDemoNumber = demoNumber;
      expect(typeof typed).toBe('number');
    }
  });

  test('DEMO_LUMP_NAMES pins DEMO1/DEMO2/DEMO3 in uppercase and is frozen', () => {
    expect(Object.isFrozen(DEMO_LUMP_NAMES)).toBe(true);
    expect(DEMO_LUMP_NAMES[1]).toBe('DEMO1');
    expect(DEMO_LUMP_NAMES[2]).toBe('DEMO2');
    expect(DEMO_LUMP_NAMES[3]).toBe('DEMO3');
  });

  test('DEMO_CHECKPOINT_CONTRACTS is frozen and pins the read-only fixture checkpoint tic sequences', () => {
    expect(Object.isFrozen(DEMO_CHECKPOINT_CONTRACTS)).toBe(true);
    const expectedDemo1Tics = [0, 35, 70, 175, 350, 700];
    const expectedDemo2Tics = [0, 35, 70, 140, 280, 560, 840, 1120];
    const expectedDemo3Tics = [0, 1, 35, 350, 700];

    for (const demoNumber of DEMO_PLAYBACK_NUMBERS) {
      const contract: DemoCheckpointContract = DEMO_CHECKPOINT_CONTRACTS[demoNumber];
      expect(Object.isFrozen(contract)).toBe(true);
      expect(contract.demoNumber).toBe(demoNumber);
      expect(contract.demoLump).toBe(DEMO_LUMP_NAMES[demoNumber]);
      expect(contract.playdemoArgument).toBe(DEMO_LUMP_NAMES[demoNumber].toLowerCase());
      expect(Object.isFrozen(contract.checkpointTics)).toBe(true);
      for (let checkpointIndex = 0; checkpointIndex < contract.checkpointTics.length; checkpointIndex += 1) {
        const tic = contract.checkpointTics[checkpointIndex]!;
        expect(Number.isInteger(tic)).toBe(true);
        expect(tic).toBeGreaterThanOrEqual(0);
        if (checkpointIndex > 0) {
          expect(tic).toBeGreaterThan(contract.checkpointTics[checkpointIndex - 1]!);
        }
      }
    }

    expect([...DEMO_CHECKPOINT_CONTRACTS[1].checkpointTics]).toEqual(expectedDemo1Tics);
    expect([...DEMO_CHECKPOINT_CONTRACTS[2].checkpointTics]).toEqual(expectedDemo2Tics);
    expect([...DEMO_CHECKPOINT_CONTRACTS[3].checkpointTics]).toEqual(expectedDemo3Tics);
  });

  test('accepts the documented override keys via the CaptureReferenceDemoSyncOverrides shape', () => {
    const overrides: CaptureReferenceDemoSyncOverrides = {
      checkpointLeadMs: 50,
      executableFilename: 'DOOM.EXE',
      findWindowPollIntervalMs: 25,
      findWindowTimeoutMs: 15_000,
      killWaitMs: 8_000,
      sandboxIdOverride: 'override-id',
      settleAfterWindowFoundMs: 500,
    };
    expect(Object.keys(overrides).length).toBe(7);
  });

  test('normalizeToInternalFramebuffer produces a 320x200x4 byte BGRA buffer', () => {
    const sourceWidth = 640;
    const sourceHeight = 480;
    const sourcePixels = Buffer.alloc(sourceWidth * sourceHeight * CAPTURE_BYTES_PER_PIXEL);
    for (let pixelIndex = 0; pixelIndex < sourceWidth * sourceHeight; pixelIndex += 1) {
      sourcePixels[pixelIndex * CAPTURE_BYTES_PER_PIXEL] = 0x10;
      sourcePixels[pixelIndex * CAPTURE_BYTES_PER_PIXEL + 1] = 0x20;
      sourcePixels[pixelIndex * CAPTURE_BYTES_PER_PIXEL + 2] = 0x30;
      sourcePixels[pixelIndex * CAPTURE_BYTES_PER_PIXEL + 3] = 0xff;
    }
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
    await expect(captureReferenceDemoSync(1, { executableFilename: 'NON_EXISTENT_BINARY.EXE' })).rejects.toBeInstanceOf(ReferenceBundleMissingError);
  });

  if (referenceBundleIsAvailable()) {
    let lastCapturedSandboxPath: string | null = null;

    afterAll(async () => {
      if (lastCapturedSandboxPath !== null && existsSync(lastCapturedSandboxPath)) {
        const { destroyReferenceSandbox } = await import('../../../tools/reference/createReferenceSandbox.ts');
        await destroyReferenceSandbox(lastCapturedSandboxPath);
      }
    });

    liveReferenceTest(
      'captures DEMO3 from clean launch with -playdemo demo3 and produces ordered checkpoint evidence at the contracted tic offsets',
      async () => {
        const evidence: ReferenceDemoSyncEvidence = await captureReferenceDemoSync(3, { findWindowTimeoutMs: 30_000, killWaitMs: 8_000, settleAfterWindowFoundMs: 1_500 });
        lastCapturedSandboxPath = evidence.sandboxAbsolutePath;

        expect(evidence.demoNumber).toBe(3);
        expect(evidence.demoLump).toBe('DEMO3');
        expect(evidence.playdemoArgument).toBe('demo3');
        expect(evidence.windowTitle).toContain('Chocolate Doom 2.2.1');
        expect(evidence.executableFilename).toBe('DOOM.EXE');
        expect(evidence.sandboxId.length).toBeGreaterThan(0);
        expect(evidence.sandboxAbsolutePath.includes(REFERENCE_SANDBOX_POLICY.sandboxPrefix)).toBe(true);
        expect(evidence.spawnedAtElapsedMs).toBeGreaterThanOrEqual(0);
        expect(evidence.windowFoundAtElapsedMs).toBeGreaterThanOrEqual(evidence.spawnedAtElapsedMs);
        expect(evidence.ticBaselineAtElapsedMs).toBeGreaterThanOrEqual(evidence.windowFoundAtElapsedMs);
        expect(evidence.killedAtElapsedMs).toBeGreaterThanOrEqual(evidence.ticBaselineAtElapsedMs);
        expect(evidence.exitedAtElapsedMs).toBeGreaterThanOrEqual(evidence.killedAtElapsedMs);
        expect(evidence.totalElapsedMs).toBe(evidence.exitedAtElapsedMs);

        expect(evidence.framebufferWidth).toBeGreaterThan(0);
        expect(evidence.framebufferHeight).toBeGreaterThan(0);

        const contract = DEMO_CHECKPOINT_CONTRACTS[3];
        expect(evidence.checkpoints.length).toBe(contract.checkpointTics.length);
        for (let checkpointIndex = 0; checkpointIndex < evidence.checkpoints.length; checkpointIndex += 1) {
          const checkpoint: DemoCheckpointEvidence = evidence.checkpoints[checkpointIndex]!;
          const expectedTic = contract.checkpointTics[checkpointIndex]!;
          expect(checkpoint.checkpointIndex).toBe(checkpointIndex);
          expect(checkpoint.checkpointTic).toBe(expectedTic);
          expect(checkpoint.framebufferByteLength).toBe(evidence.framebufferWidth * evidence.framebufferHeight * CAPTURE_BYTES_PER_PIXEL);
          expect(checkpoint.normalizedByteLength).toBe(NORMALIZED_INTERNAL_WIDTH * NORMALIZED_INTERNAL_HEIGHT * CAPTURE_BYTES_PER_PIXEL);
          expect(SHA256_HEX_REGEX.test(checkpoint.framebufferSha256)).toBe(true);
          expect(SHA256_HEX_REGEX.test(checkpoint.normalizedSha256)).toBe(true);
          expect(checkpoint.scheduledAtElapsedMs).toBeGreaterThanOrEqual(evidence.ticBaselineAtElapsedMs);
          expect(checkpoint.capturedAtElapsedMs).toBeGreaterThanOrEqual(checkpoint.scheduledAtElapsedMs);
          if (checkpointIndex > 0) {
            const previous = evidence.checkpoints[checkpointIndex - 1]!;
            expect(checkpoint.checkpointTic).toBeGreaterThan(previous.checkpointTic);
            expect(checkpoint.capturedAtElapsedMs).toBeGreaterThanOrEqual(previous.capturedAtElapsedMs);
          }
        }

        expect(ACCEPTED_TERMINATION_CAUSES).toContain(evidence.terminationCause);
        expect(evidence.cleanShutdown).toBe(true);
        expect(existsSync(evidence.sandboxAbsolutePath)).toBe(false);
      },
      120_000,
    );
  } else {
    test.skip('skipped live demo sync capture because the reference bundle is not present on this host', () => {
      expect(true).toBe(true);
    });
  }
});
