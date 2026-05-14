import { existsSync } from 'node:fs';
import path from 'node:path';

import { afterAll, describe, expect, test } from 'bun:test';

import { REFERENCE_SANDBOX_POLICY, SANDBOX_REQUIRED_FILES } from '../../../src/oracles/referenceSandbox.ts';
import {
  type CaptureReferenceE1M1ActionOverrides,
  type ReferenceE1M1ActionEvidence,
  type ReferenceE1M1ActionTerminationCause,
  type ScriptedActionHoldEvidence,
  type ScriptedActionKind,
  type ScriptedActionSequence,
  type ScriptedKeyHold,
  ReferenceE1M1ActionWindowNotFoundError,
  SCRIPTED_E1M1_ACTION_KINDS,
  SCRIPTED_E1M1_ACTION_SEQUENCES,
  captureReferenceE1M1Action,
  normalizeToInternalFramebuffer,
} from '../../../tools/reference/captureReferenceE1M1Actions.ts';
import { ReferenceBundleMissingError } from '../../../tools/reference/launchReferenceCleanly.ts';

const ACCEPTED_TERMINATION_CAUSES: readonly ReferenceE1M1ActionTerminationCause[] = ['natural-exit', 'sandbox-killed'];
const CAPTURE_BYTES_PER_PIXEL = 4;
const EXPECTED_ACTION_COUNT = 6;
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

describe('oracle: captureReferenceE1M1Action', () => {
  test('exports the runner, normalizer, action kinds, action sequences, and error class', () => {
    expect(typeof captureReferenceE1M1Action).toBe('function');
    expect(captureReferenceE1M1Action.length).toBeLessThanOrEqual(2);
    expect(typeof normalizeToInternalFramebuffer).toBe('function');
    expect(normalizeToInternalFramebuffer.length).toBe(3);
    expect(typeof ReferenceE1M1ActionWindowNotFoundError).toBe('function');
    const error = new ReferenceE1M1ActionWindowNotFoundError('Chocolate Doom 2.2.1', 1234);
    expect(error.name).toBe('ReferenceE1M1ActionWindowNotFoundError');
    expect(error.message).toContain('Chocolate Doom 2.2.1');
    expect(error.message).toContain('1234');
  });

  test('SCRIPTED_E1M1_ACTION_KINDS pins exactly 6 ScriptedActionKind names (combat, damage, death-reborn, door-use, movement, pickup)', () => {
    expect(Object.isFrozen(SCRIPTED_E1M1_ACTION_KINDS)).toBe(true);
    expect(SCRIPTED_E1M1_ACTION_KINDS.length).toBe(EXPECTED_ACTION_COUNT);
    expect([...SCRIPTED_E1M1_ACTION_KINDS]).toEqual(['combat', 'damage', 'death-reborn', 'door-use', 'movement', 'pickup']);
    for (const actionKind of SCRIPTED_E1M1_ACTION_KINDS) {
      const typed: ScriptedActionKind = actionKind;
      expect(typeof typed).toBe('string');
    }
  });

  test('SCRIPTED_E1M1_ACTION_SEQUENCES is frozen and covers every ScriptedActionKind with a non-empty keyHolds sequence', () => {
    expect(Object.isFrozen(SCRIPTED_E1M1_ACTION_SEQUENCES)).toBe(true);
    for (const actionKind of SCRIPTED_E1M1_ACTION_KINDS) {
      const sequence: ScriptedActionSequence = SCRIPTED_E1M1_ACTION_SEQUENCES[actionKind];
      expect(sequence.action).toBe(actionKind);
      expect(sequence.description.length).toBeGreaterThan(0);
      expect(Object.isFrozen(sequence)).toBe(true);
      expect(Object.isFrozen(sequence.keyHolds)).toBe(true);
      expect(sequence.keyHolds.length).toBeGreaterThan(0);
      for (const hold of sequence.keyHolds) {
        const typed: ScriptedKeyHold = hold;
        expect(Object.isFrozen(typed)).toBe(true);
        expect(typed.description.length).toBeGreaterThan(0);
        expect(typed.durationMs).toBeGreaterThan(0);
        expect(typed.virtualKeyCodes.length).toBeGreaterThan(0);
        for (const virtualKeyCode of typed.virtualKeyCodes) {
          expect(typeof virtualKeyCode).toBe('number');
          expect(virtualKeyCode).toBeGreaterThan(0);
          expect(virtualKeyCode).toBeLessThanOrEqual(0xff);
        }
      }
    }
  });

  test('accepts the documented override keys via the CaptureReferenceE1M1ActionOverrides shape', () => {
    const overrides: CaptureReferenceE1M1ActionOverrides = {
      executableFilename: 'DOOM.EXE',
      findWindowPollIntervalMs: 25,
      findWindowTimeoutMs: 15_000,
      killWaitMs: 3_000,
      sandboxIdOverride: 'override-id',
      settleAfterKeyMs: 250,
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
    await expect(captureReferenceE1M1Action('movement', { executableFilename: 'NON_EXISTENT_BINARY.EXE' })).rejects.toBeInstanceOf(ReferenceBundleMissingError);
  });

  if (referenceBundleIsAvailable()) {
    let lastCapturedSandboxPath: string | null = null;

    afterAll(async () => {
      if (lastCapturedSandboxPath !== null && existsSync(lastCapturedSandboxPath)) {
        const { destroyReferenceSandbox } = await import('../../../tools/reference/createReferenceSandbox.ts');
        await destroyReferenceSandbox(lastCapturedSandboxPath);
      }
    });

    test('captures a live movement action from clean launch through Main → Episode → Skill → E1M1 spawn → 56 tics of forward+turn input', async () => {
      const evidence: ReferenceE1M1ActionEvidence = await captureReferenceE1M1Action('movement', { findWindowTimeoutMs: 30_000, killWaitMs: 8_000, settleAfterKeyMs: 500, settleAfterWindowFoundMs: 1_500 });
      lastCapturedSandboxPath = evidence.sandboxAbsolutePath;

      expect(evidence.action).toBe('movement');
      expect(evidence.description).toBe(SCRIPTED_E1M1_ACTION_SEQUENCES.movement.description);
      expect(evidence.windowTitle).toContain('Chocolate Doom 2.2.1');
      expect(evidence.executableFilename).toBe('DOOM.EXE');
      expect(evidence.sandboxId.length).toBeGreaterThan(0);
      expect(evidence.sandboxAbsolutePath.includes(REFERENCE_SANDBOX_POLICY.sandboxPrefix)).toBe(true);
      expect(evidence.spawnedAtElapsedMs).toBeGreaterThanOrEqual(0);
      expect(evidence.windowFoundAtElapsedMs).toBeGreaterThanOrEqual(evidence.spawnedAtElapsedMs);
      expect(evidence.killedAtElapsedMs).toBeGreaterThanOrEqual(evidence.windowFoundAtElapsedMs);
      expect(evidence.exitedAtElapsedMs).toBeGreaterThanOrEqual(evidence.killedAtElapsedMs);
      expect(evidence.totalElapsedMs).toBe(evidence.exitedAtElapsedMs);

      expect(evidence.framebufferWidth).toBeGreaterThan(0);
      expect(evidence.framebufferHeight).toBeGreaterThan(0);
      expect(SHA256_HEX_REGEX.test(evidence.e1m1EntrySha256)).toBe(true);

      const movementSequence = SCRIPTED_E1M1_ACTION_SEQUENCES.movement;
      expect(evidence.holds.length).toBe(movementSequence.keyHolds.length);
      for (let holdIndex = 0; holdIndex < evidence.holds.length; holdIndex += 1) {
        const hold: ScriptedActionHoldEvidence = evidence.holds[holdIndex]!;
        const expectedHold = movementSequence.keyHolds[holdIndex]!;
        expect(hold.holdIndex).toBe(holdIndex);
        expect(hold.description).toBe(expectedHold.description);
        expect(hold.durationMs).toBe(expectedHold.durationMs);
        expect([...hold.virtualKeyCodes]).toEqual([...expectedHold.virtualKeyCodes]);
        expect(hold.framebufferByteLength).toBe(evidence.framebufferWidth * evidence.framebufferHeight * CAPTURE_BYTES_PER_PIXEL);
        expect(hold.normalizedByteLength).toBe(NORMALIZED_INTERNAL_WIDTH * NORMALIZED_INTERNAL_HEIGHT * CAPTURE_BYTES_PER_PIXEL);
        expect(SHA256_HEX_REGEX.test(hold.framebufferSha256)).toBe(true);
        expect(SHA256_HEX_REGEX.test(hold.normalizedSha256)).toBe(true);
      }

      expect(ACCEPTED_TERMINATION_CAUSES).toContain(evidence.terminationCause);
      expect(evidence.cleanShutdown).toBe(true);
      expect(existsSync(evidence.sandboxAbsolutePath)).toBe(false);
    }, 180_000);
  } else {
    test.skip('skipped live E1M1 action capture because the reference bundle is not present on this host', () => {
      expect(true).toBe(true);
    });
  }
});
