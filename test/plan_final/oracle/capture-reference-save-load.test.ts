import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { afterAll, describe, expect, test } from 'bun:test';

import { REFERENCE_SANDBOX_POLICY, SANDBOX_REQUIRED_FILES } from '../../../src/oracles/referenceSandbox.ts';
import {
  type CaptureReferenceSaveLoadOverrides,
  type ReferenceSaveLoadEvidence,
  type ReferenceSaveLoadTerminationCause,
  SAVE_LOAD_DEFAULT_SLOT,
  SAVE_LOAD_TRACE_NAMES,
  SAVE_LOAD_TRACE_ORDINALS,
  ReferenceSaveLoadSaveFileNotFoundError,
  ReferenceSaveLoadWindowNotFoundError,
  captureReferenceSaveLoad,
  normalizeToInternalFramebuffer,
} from '../../../tools/reference/captureReferenceSaveLoad.ts';
import { ReferenceBundleMissingError } from '../../../tools/reference/launchReferenceCleanly.ts';
import { liveReferenceTest } from './live-reference-test-gate.ts';

const ACCEPTED_TERMINATION_CAUSES: readonly ReferenceSaveLoadTerminationCause[] = ['natural-exit', 'sandbox-killed'];
const CAPTURE_BYTES_PER_PIXEL = 4;
const NORMALIZED_INTERNAL_HEIGHT = 200;
const NORMALIZED_INTERNAL_WIDTH = 320;
const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/;
const FIXTURE_PATH = 'test/oracles/fixtures/capture-live-save-load-roundtrip.json';

interface FixtureTraceEntry {
  readonly action: string;
  readonly ordinal: number;
}

interface FixtureDocument {
  readonly expectedTrace: readonly FixtureTraceEntry[];
}

function referenceBundleIsAvailable(): boolean {
  for (const requiredFile of SANDBOX_REQUIRED_FILES) {
    if (!existsSync(path.join(REFERENCE_SANDBOX_POLICY.sourcePath, requiredFile.filename))) {
      return false;
    }
  }
  return true;
}

describe('oracle: captureReferenceSaveLoad', () => {
  test('exports the runner, normalizer, default-slot constant, and error classes with the expected static surface', () => {
    expect(typeof captureReferenceSaveLoad).toBe('function');
    expect(captureReferenceSaveLoad.length).toBeLessThanOrEqual(1);
    expect(typeof normalizeToInternalFramebuffer).toBe('function');
    expect(normalizeToInternalFramebuffer.length).toBe(3);
    expect(SAVE_LOAD_DEFAULT_SLOT).toBe(0);
    expect(typeof ReferenceSaveLoadWindowNotFoundError).toBe('function');
    const windowError = new ReferenceSaveLoadWindowNotFoundError('Chocolate Doom 2.2.1', 1234);
    expect(windowError.name).toBe('ReferenceSaveLoadWindowNotFoundError');
    expect(windowError.message).toContain('Chocolate Doom 2.2.1');
    expect(windowError.message).toContain('1234');
    expect(typeof ReferenceSaveLoadSaveFileNotFoundError).toBe('function');
    const saveError = new ReferenceSaveLoadSaveFileNotFoundError('C:/sandbox/doomsav0.dsg');
    expect(saveError.name).toBe('ReferenceSaveLoadSaveFileNotFoundError');
    expect(saveError.message).toContain('C:/sandbox/doomsav0.dsg');
    expect(saveError.absolutePath).toBe('C:/sandbox/doomsav0.dsg');
  });

  test('SAVE_LOAD_TRACE_ORDINALS is a frozen [1..10] readonly array', () => {
    expect(Object.isFrozen(SAVE_LOAD_TRACE_ORDINALS)).toBe(true);
    expect(SAVE_LOAD_TRACE_ORDINALS.length).toBe(10);
    expect([...SAVE_LOAD_TRACE_ORDINALS]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  test('SAVE_LOAD_TRACE_NAMES is a frozen 10-element list matching the fixture expectedTrace[*].action in ordinal order', () => {
    expect(Object.isFrozen(SAVE_LOAD_TRACE_NAMES)).toBe(true);
    expect(SAVE_LOAD_TRACE_NAMES.length).toBe(10);
    expect([...SAVE_LOAD_TRACE_NAMES]).toEqual([
      'clean-launch',
      'open-main-menu',
      'start-e1m1',
      'open-save-menu',
      'write-save-slot-zero',
      'return-to-gameplay-after-save',
      'mutate-live-state-after-save',
      'open-load-menu',
      'load-save-slot-zero',
      'verify-restored-frame',
    ]);
  });

  test('fixture round-trip: SAVE_LOAD_TRACE_NAMES + SAVE_LOAD_TRACE_ORDINALS match capture-live-save-load-roundtrip.json expectedTrace ordering', () => {
    const fixtureText = readFileSync(FIXTURE_PATH, 'utf8');
    const fixture = JSON.parse(fixtureText) as FixtureDocument;
    expect(fixture.expectedTrace.length).toBe(SAVE_LOAD_TRACE_NAMES.length);
    expect(fixture.expectedTrace.length).toBe(SAVE_LOAD_TRACE_ORDINALS.length);
    for (let entryIndex = 0; entryIndex < fixture.expectedTrace.length; entryIndex += 1) {
      const entry = fixture.expectedTrace[entryIndex]!;
      expect(entry.ordinal).toBe(SAVE_LOAD_TRACE_ORDINALS[entryIndex]!);
      expect(entry.action).toBe(SAVE_LOAD_TRACE_NAMES[entryIndex]!);
    }
  });

  test('accepts the documented override keys via the CaptureReferenceSaveLoadOverrides shape', () => {
    const overrides: CaptureReferenceSaveLoadOverrides = {
      executableFilename: 'DOOM.EXE',
      findWindowPollIntervalMs: 25,
      findWindowTimeoutMs: 15_000,
      killWaitMs: 3_000,
      sandboxIdOverride: 'override-id',
      saveSlotIndex: 0,
      settleAfterE1M1SpawnMs: 800,
      settleAfterKeyMs: 250,
      settleAfterLoadCompleteMs: 800,
      settleAfterSaveWriteMs: 600,
      settleAfterWindowFoundMs: 500,
    };
    expect(Object.keys(overrides).length).toBe(11);
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
    await expect(captureReferenceSaveLoad({ executableFilename: 'NON_EXISTENT_BINARY.EXE' })).rejects.toBeInstanceOf(ReferenceBundleMissingError);
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
      'captures a live save/load roundtrip with non-decreasing timestamps, byte-identical .dsg roundtrip, mutation-driven frame divergence, and post-run sandbox cleanup',
      async () => {
        const evidence: ReferenceSaveLoadEvidence = await captureReferenceSaveLoad({ findWindowTimeoutMs: 30_000, killWaitMs: 8_000, settleAfterKeyMs: 400, settleAfterWindowFoundMs: 1_500 });
        lastCapturedSandboxPath = evidence.sandboxAbsolutePath;

        expect(evidence.executableFilename).toBe('DOOM.EXE');
        expect(evidence.windowTitle).toContain('Chocolate Doom 2.2.1');
        expect(evidence.sandboxId.length).toBeGreaterThan(0);
        expect(evidence.sandboxAbsolutePath.includes(REFERENCE_SANDBOX_POLICY.sandboxPrefix)).toBe(true);
        expect(evidence.saveSlotIndex).toBe(SAVE_LOAD_DEFAULT_SLOT);

        expect(evidence.spawnedAtElapsedMs).toBeGreaterThanOrEqual(0);
        expect(evidence.windowFoundAtElapsedMs).toBeGreaterThanOrEqual(evidence.spawnedAtElapsedMs);
        expect(evidence.savedAtElapsedMs).toBeGreaterThanOrEqual(evidence.windowFoundAtElapsedMs);
        expect(evidence.mutatedAtElapsedMs).toBeGreaterThanOrEqual(evidence.savedAtElapsedMs);
        expect(evidence.postLoadAtElapsedMs).toBeGreaterThanOrEqual(evidence.mutatedAtElapsedMs);
        expect(evidence.verifyCapturedAtElapsedMs).toBeGreaterThanOrEqual(evidence.postLoadAtElapsedMs);
        expect(evidence.killedAtElapsedMs).toBeGreaterThanOrEqual(evidence.verifyCapturedAtElapsedMs);
        expect(evidence.exitedAtElapsedMs).toBeGreaterThanOrEqual(evidence.killedAtElapsedMs);
        expect(evidence.totalElapsedMs).toBe(evidence.exitedAtElapsedMs);

        expect(SHA256_HEX_REGEX.test(evidence.e1m1EntrySha256)).toBe(true);
        expect(SHA256_HEX_REGEX.test(evidence.preSaveSha256)).toBe(true);
        expect(SHA256_HEX_REGEX.test(evidence.postSaveSha256)).toBe(true);
        expect(SHA256_HEX_REGEX.test(evidence.mutatedSha256)).toBe(true);
        expect(SHA256_HEX_REGEX.test(evidence.postLoadSha256)).toBe(true);
        expect(SHA256_HEX_REGEX.test(evidence.verifySha256)).toBe(true);
        expect(SHA256_HEX_REGEX.test(evidence.savedFileSha256)).toBe(true);
        expect(SHA256_HEX_REGEX.test(evidence.roundtripSavedFileSha256)).toBe(true);

        expect(evidence.savedFileByteLength).toBeGreaterThan(0);
        expect(evidence.roundtripSavedFileByteLength).toBe(evidence.savedFileByteLength);
        expect(evidence.roundtripSavedFileSha256).toBe(evidence.savedFileSha256);

        expect(evidence.mutatedSha256).not.toBe(evidence.preSaveSha256);

        expect(evidence.framebufferWidth).toBeGreaterThan(0);
        expect(evidence.framebufferHeight).toBeGreaterThan(0);

        expect(typeof evidence.saveDescription).toBe('string');

        expect(ACCEPTED_TERMINATION_CAUSES).toContain(evidence.terminationCause);
        expect(evidence.cleanShutdown).toBe(true);
        expect(existsSync(evidence.sandboxAbsolutePath)).toBe(false);
      },
      240_000,
    );
  } else {
    test.skip('skipped live save/load roundtrip because the reference bundle is not present on this host', () => {
      expect(true).toBe(true);
    });
  }
});
