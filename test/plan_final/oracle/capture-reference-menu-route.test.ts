import { existsSync } from 'node:fs';
import path from 'node:path';

import { afterAll, describe, expect, test } from 'bun:test';

import { REFERENCE_SANDBOX_POLICY, SANDBOX_REQUIRED_FILES } from '../../../src/oracles/referenceSandbox.ts';
import {
  type CaptureReferenceMenuRouteOverrides,
  type MenuRouteKeyStep,
  type MenuRouteStepEvidence,
  type ReferenceMenuRouteEvidence,
  type ReferenceMenuRouteTerminationCause,
  MENU_ROUTE_KEY_STEPS,
  ReferenceMenuRouteWindowNotFoundError,
  captureReferenceMenuRoute,
  normalizeToInternalFramebuffer,
} from '../../../tools/reference/captureReferenceMenuRoute.ts';
import { ReferenceBundleMissingError } from '../../../tools/reference/launchReferenceCleanly.ts';
import { liveReferenceTest } from './live-reference-test-gate.ts';

const ACCEPTED_TERMINATION_CAUSES: readonly ReferenceMenuRouteTerminationCause[] = ['natural-exit', 'sandbox-killed'];
const CAPTURE_BYTES_PER_PIXEL = 4;
const EXPECTED_STEP_COUNT = 4;
const NORMALIZED_INTERNAL_HEIGHT = 200;
const NORMALIZED_INTERNAL_WIDTH = 320;
const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/;
const VK_RETURN = 0x0d;
const VK_ESCAPE = 0x1b;

function referenceBundleIsAvailable(): boolean {
  for (const requiredFile of SANDBOX_REQUIRED_FILES) {
    if (!existsSync(path.join(REFERENCE_SANDBOX_POLICY.sourcePath, requiredFile.filename))) {
      return false;
    }
  }
  return true;
}

describe('oracle: captureReferenceMenuRoute', () => {
  test('exports the runner, route constant, normalizer, and error class with the expected static surface', () => {
    expect(typeof captureReferenceMenuRoute).toBe('function');
    expect(captureReferenceMenuRoute.length).toBeLessThanOrEqual(1);
    expect(typeof normalizeToInternalFramebuffer).toBe('function');
    expect(normalizeToInternalFramebuffer.length).toBe(3);
    expect(typeof ReferenceMenuRouteWindowNotFoundError).toBe('function');
    const error = new ReferenceMenuRouteWindowNotFoundError('Chocolate Doom 2.2.1', 1234);
    expect(error.name).toBe('ReferenceMenuRouteWindowNotFoundError');
    expect(error.message).toContain('Chocolate Doom 2.2.1');
    expect(error.message).toContain('1234');
  });

  test('MENU_ROUTE_KEY_STEPS is a frozen 4-step sequence: Escape → Main, Enter → Episode, Enter → Skill, Enter → E1M1', () => {
    expect(Object.isFrozen(MENU_ROUTE_KEY_STEPS)).toBe(true);
    expect(MENU_ROUTE_KEY_STEPS.length).toBe(EXPECTED_STEP_COUNT);

    expect(MENU_ROUTE_KEY_STEPS[0]!.virtualKeyCode).toBe(VK_ESCAPE);
    expect(MENU_ROUTE_KEY_STEPS[0]!.virtualKeyName).toBe('VK_ESCAPE');
    expect(MENU_ROUTE_KEY_STEPS[0]!.expectedMenuState).toBe('main-menu');

    expect(MENU_ROUTE_KEY_STEPS[1]!.virtualKeyCode).toBe(VK_RETURN);
    expect(MENU_ROUTE_KEY_STEPS[1]!.virtualKeyName).toBe('VK_RETURN');
    expect(MENU_ROUTE_KEY_STEPS[1]!.expectedMenuState).toBe('episode-menu');

    expect(MENU_ROUTE_KEY_STEPS[2]!.virtualKeyCode).toBe(VK_RETURN);
    expect(MENU_ROUTE_KEY_STEPS[2]!.virtualKeyName).toBe('VK_RETURN');
    expect(MENU_ROUTE_KEY_STEPS[2]!.expectedMenuState).toBe('skill-menu');

    expect(MENU_ROUTE_KEY_STEPS[3]!.virtualKeyCode).toBe(VK_RETURN);
    expect(MENU_ROUTE_KEY_STEPS[3]!.virtualKeyName).toBe('VK_RETURN');
    expect(MENU_ROUTE_KEY_STEPS[3]!.expectedMenuState).toBe('gameplay-e1m1');

    for (const step of MENU_ROUTE_KEY_STEPS) {
      expect(Object.isFrozen(step)).toBe(true);
      expect(step.description.length).toBeGreaterThan(0);
    }
  });

  test('MenuRouteKeyStep type is satisfied by every constant entry', () => {
    for (const step of MENU_ROUTE_KEY_STEPS) {
      const typed: MenuRouteKeyStep = step;
      expect(typed.virtualKeyCode).toBeTypeOf('number');
      expect(typed.virtualKeyName).toBeTypeOf('string');
      expect(typed.expectedMenuState).toBeTypeOf('string');
      expect(typed.description).toBeTypeOf('string');
    }
  });

  test('accepts the documented override keys via the CaptureReferenceMenuRouteOverrides shape', () => {
    const overrides: CaptureReferenceMenuRouteOverrides = {
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
      sourcePixels[pixelIndex * CAPTURE_BYTES_PER_PIXEL] = 0x42;
      sourcePixels[pixelIndex * CAPTURE_BYTES_PER_PIXEL + 1] = 0x43;
      sourcePixels[pixelIndex * CAPTURE_BYTES_PER_PIXEL + 2] = 0x44;
      sourcePixels[pixelIndex * CAPTURE_BYTES_PER_PIXEL + 3] = 0xff;
    }
    const normalized = normalizeToInternalFramebuffer(sourcePixels, sourceWidth, sourceHeight);
    expect(normalized.byteLength).toBe(NORMALIZED_INTERNAL_WIDTH * NORMALIZED_INTERNAL_HEIGHT * CAPTURE_BYTES_PER_PIXEL);
    expect(normalized.byteLength).toBe(256_000);
    expect(normalized[0]).toBe(0x42);
    expect(normalized[1]).toBe(0x43);
    expect(normalized[2]).toBe(0x44);
    expect(normalized[3]).toBe(0xff);
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
    await expect(captureReferenceMenuRoute({ executableFilename: 'NON_EXISTENT_BINARY.EXE' })).rejects.toBeInstanceOf(ReferenceBundleMissingError);
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
      'captures a live menu route from a sandboxed Chocolate Doom 2.2.1 window',
      async () => {
        const evidence: ReferenceMenuRouteEvidence = await captureReferenceMenuRoute({ findWindowTimeoutMs: 30_000, killWaitMs: 8_000, settleAfterKeyMs: 500, settleAfterWindowFoundMs: 1_500 });
        lastCapturedSandboxPath = evidence.sandboxAbsolutePath;

        expect(evidence.windowTitle).toContain('Chocolate Doom 2.2.1');
        expect(evidence.executableFilename).toBe('DOOM.EXE');
        expect(evidence.sandboxId.length).toBeGreaterThan(0);
        expect(evidence.sandboxAbsolutePath.includes(REFERENCE_SANDBOX_POLICY.sandboxPrefix)).toBe(true);
        expect(evidence.spawnedAtElapsedMs).toBeGreaterThanOrEqual(0);
        expect(evidence.windowFoundAtElapsedMs).toBeGreaterThanOrEqual(evidence.spawnedAtElapsedMs);
        expect(evidence.titleFrameCapturedAtElapsedMs).toBeGreaterThanOrEqual(evidence.windowFoundAtElapsedMs);
        expect(evidence.killedAtElapsedMs).toBeGreaterThanOrEqual(evidence.titleFrameCapturedAtElapsedMs);
        expect(evidence.exitedAtElapsedMs).toBeGreaterThanOrEqual(evidence.killedAtElapsedMs);
        expect(evidence.totalElapsedMs).toBe(evidence.exitedAtElapsedMs);

        expect(evidence.framebufferWidth).toBeGreaterThan(0);
        expect(evidence.framebufferHeight).toBeGreaterThan(0);
        expect(SHA256_HEX_REGEX.test(evidence.titleFrameSha256)).toBe(true);
        expect(SHA256_HEX_REGEX.test(evidence.titleFrameNormalizedSha256)).toBe(true);

        expect(evidence.steps.length).toBe(EXPECTED_STEP_COUNT);
        let previousCapturedAtElapsedMs = evidence.titleFrameCapturedAtElapsedMs;
        for (let stepIndex = 0; stepIndex < evidence.steps.length; stepIndex += 1) {
          const step: MenuRouteStepEvidence = evidence.steps[stepIndex]!;
          expect(step.stepIndex).toBe(stepIndex);
          expect(step.virtualKeyCode).toBe(MENU_ROUTE_KEY_STEPS[stepIndex]!.virtualKeyCode);
          expect(step.virtualKeyName).toBe(MENU_ROUTE_KEY_STEPS[stepIndex]!.virtualKeyName);
          expect(step.expectedMenuState).toBe(MENU_ROUTE_KEY_STEPS[stepIndex]!.expectedMenuState);
          expect(step.framebufferByteLength).toBe(evidence.framebufferWidth * evidence.framebufferHeight * CAPTURE_BYTES_PER_PIXEL);
          expect(step.normalizedByteLength).toBe(NORMALIZED_INTERNAL_WIDTH * NORMALIZED_INTERNAL_HEIGHT * CAPTURE_BYTES_PER_PIXEL);
          expect(SHA256_HEX_REGEX.test(step.framebufferSha256)).toBe(true);
          expect(SHA256_HEX_REGEX.test(step.normalizedSha256)).toBe(true);
          expect(step.capturedAtElapsedMs).toBeGreaterThanOrEqual(previousCapturedAtElapsedMs);
          previousCapturedAtElapsedMs = step.capturedAtElapsedMs;
        }

        expect(ACCEPTED_TERMINATION_CAUSES).toContain(evidence.terminationCause);
        expect(evidence.cleanShutdown).toBe(true);
      },
      120_000,
    );

    liveReferenceTest(
      'removes the sandbox directory after the runner returns',
      async () => {
        const evidence = await captureReferenceMenuRoute({ findWindowTimeoutMs: 30_000, killWaitMs: 8_000, settleAfterKeyMs: 400, settleAfterWindowFoundMs: 1_000 });
        lastCapturedSandboxPath = evidence.sandboxAbsolutePath;
        expect(existsSync(evidence.sandboxAbsolutePath)).toBe(false);
      },
      120_000,
    );
  } else {
    test.skip('skipped live menu-route capture because the reference bundle is not present on this host', () => {
      expect(true).toBe(true);
    });
  }
});
