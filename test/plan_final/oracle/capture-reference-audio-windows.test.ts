import { existsSync } from 'node:fs';
import path from 'node:path';

import { afterAll, describe, expect, test } from 'bun:test';

import { REFERENCE_SANDBOX_POLICY, SANDBOX_REQUIRED_FILES } from '../../../src/oracles/referenceSandbox.ts';
import {
  type AudioHashWindow,
  type AudioHashWindowKind,
  type AudioHashWindowPhase,
  type CaptureReferenceAudioWindowsOverrides,
  type CapturedAudioFormat,
  type ReferenceAudioCaptureStatus,
  type ReferenceAudioWindowEvidence,
  type ReferenceAudioWindowsEvidence,
  type ReferenceAudioWindowsTerminationCause,
  AUDIO_HASH_WINDOW_KINDS,
  MUSIC_EVENT_HASH_WINDOWS,
  REFERENCE_AUDIO_HASH_WINDOWS,
  ReferenceAudioWindowNotFoundError,
  ReferenceAudioWindowsComError,
  SFX_HASH_WINDOWS,
  buildGuidBuffer,
  captureReferenceAudioWindows,
} from '../../../tools/reference/captureReferenceAudioWindows.ts';
import { ReferenceBundleMissingError } from '../../../tools/reference/launchReferenceCleanly.ts';

const ACCEPTED_TERMINATION_CAUSES: readonly ReferenceAudioWindowsTerminationCause[] = ['natural-exit', 'sandbox-killed'];
const ACCEPTED_CAPTURE_STATUSES: readonly ReferenceAudioCaptureStatus[] = ['captured'];
const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/;
const TIC_DURATION_MS = 29;

const SFX_FIXTURE_PATH = 'test/oracles/fixtures/capture-sfx-hash-windows.json';
const MUSIC_FIXTURE_PATH = 'test/oracles/fixtures/capture-music-event-hash-windows.json';

interface ScriptedSfxFixture {
  readonly hashWindows: readonly {
    readonly name: string;
    readonly window: { readonly ticEnd: number; readonly ticStart: number };
  }[];
}

interface ScriptedMusicFixture {
  readonly musicEventHashTrace: readonly {
    readonly ticWindow: { readonly end: number; readonly start: number };
    readonly windowId: string;
  }[];
}

async function loadScriptedSfxFixture(): Promise<ScriptedSfxFixture> {
  return (await Bun.file(SFX_FIXTURE_PATH).json()) as ScriptedSfxFixture;
}

async function loadScriptedMusicFixture(): Promise<ScriptedMusicFixture> {
  return (await Bun.file(MUSIC_FIXTURE_PATH).json()) as ScriptedMusicFixture;
}

function referenceBundleIsAvailable(): boolean {
  for (const requiredFile of SANDBOX_REQUIRED_FILES) {
    if (!existsSync(path.join(REFERENCE_SANDBOX_POLICY.sourcePath, requiredFile.filename))) {
      return false;
    }
  }
  return true;
}

describe('oracle: captureReferenceAudioWindows', () => {
  test('exports the runner, window constants, GUID helper, and error classes with the expected static surface', () => {
    expect(typeof captureReferenceAudioWindows).toBe('function');
    expect(captureReferenceAudioWindows.length).toBeLessThanOrEqual(1);
    expect(typeof buildGuidBuffer).toBe('function');
    expect(typeof ReferenceAudioWindowNotFoundError).toBe('function');
    const notFoundError = new ReferenceAudioWindowNotFoundError('Chocolate Doom 2.2.1', 1234);
    expect(notFoundError.name).toBe('ReferenceAudioWindowNotFoundError');
    expect(notFoundError.message).toContain('Chocolate Doom 2.2.1');
    expect(notFoundError.message).toContain('1234');
    expect(typeof ReferenceAudioWindowsComError).toBe('function');
    const comError = new ReferenceAudioWindowsComError('IAudioClient::Initialize', 0x88890008);
    expect(comError.name).toBe('ReferenceAudioWindowsComError');
    expect(comError.message).toContain('IAudioClient::Initialize');
    expect(comError.message).toContain('88890008');
    expect(comError.hresult).toBe(0x88890008);
  });

  test('buildGuidBuffer packs a 16-byte little-endian GUID for the IMMDeviceEnumerator CLSID', () => {
    const buffer = buildGuidBuffer('BCDE0395-E52F-467C-8E3D-C4579291692E');
    expect(buffer.byteLength).toBe(16);
    expect(buffer.readUInt32LE(0)).toBe(0xbcde0395);
    expect(buffer.readUInt16LE(4)).toBe(0xe52f);
    expect(buffer.readUInt16LE(6)).toBe(0x467c);
    expect(buffer[8]).toBe(0x8e);
    expect(buffer[9]).toBe(0x3d);
    expect(buffer[10]).toBe(0xc4);
    expect(buffer[11]).toBe(0x57);
    expect(buffer[12]).toBe(0x92);
    expect(buffer[13]).toBe(0x91);
    expect(buffer[14]).toBe(0x69);
    expect(buffer[15]).toBe(0x2e);
  });

  test('buildGuidBuffer rejects malformed GUID strings', () => {
    expect(() => buildGuidBuffer('not-a-guid')).toThrow(RangeError);
    expect(() => buildGuidBuffer('BCDE0395-E52F-467C-8E3D')).toThrow(RangeError);
    expect(() => buildGuidBuffer('BCDE039-E52F-467C-8E3D-C4579291692E')).toThrow(RangeError);
  });

  test('AUDIO_HASH_WINDOW_KINDS is a frozen 2-element ASCII-sorted list of the two kinds', () => {
    expect(Object.isFrozen(AUDIO_HASH_WINDOW_KINDS)).toBe(true);
    expect([...AUDIO_HASH_WINDOW_KINDS]).toEqual(['music-event', 'sfx']);
    for (const kind of AUDIO_HASH_WINDOW_KINDS) {
      const typed: AudioHashWindowKind = kind;
      expect(typeof typed).toBe('string');
    }
  });

  test('SFX_HASH_WINDOWS is a frozen 4-element sequence covering clean-launch, menu, weapon, world-interaction phases', () => {
    expect(Object.isFrozen(SFX_HASH_WINDOWS)).toBe(true);
    expect(SFX_HASH_WINDOWS.length).toBe(4);
    const namesInOrder = SFX_HASH_WINDOWS.map((window) => window.name);
    expect(namesInOrder).toEqual(['clean-launch-menu-sfx-window', 'menu-navigation-sfx-window', 'gameplay-weapon-sfx-window', 'gameplay-world-interaction-sfx-window']);
    for (const window of SFX_HASH_WINDOWS) {
      expect(Object.isFrozen(window)).toBe(true);
      expect(window.kind).toBe('sfx');
      expect(window.startTic).toBeGreaterThanOrEqual(0);
      expect(window.endTic).toBeGreaterThanOrEqual(window.startTic);
      expect(window.description.length).toBeGreaterThan(0);
      const typed: AudioHashWindow = window;
      expect(typeof typed.phase).toBe('string');
    }
  });

  test('MUSIC_EVENT_HASH_WINDOWS is a frozen 3-element sequence covering clean-launch-title, menu-navigation, e1m1-start phases', () => {
    expect(Object.isFrozen(MUSIC_EVENT_HASH_WINDOWS)).toBe(true);
    expect(MUSIC_EVENT_HASH_WINDOWS.length).toBe(3);
    const namesInOrder = MUSIC_EVENT_HASH_WINDOWS.map((window) => window.name);
    expect(namesInOrder).toEqual(['music-clean-launch-title-window', 'music-menu-navigation-window', 'music-e1m1-start-window']);
    for (const window of MUSIC_EVENT_HASH_WINDOWS) {
      expect(Object.isFrozen(window)).toBe(true);
      expect(window.kind).toBe('music-event');
      expect(window.startTic).toBeGreaterThanOrEqual(0);
      expect(window.endTic).toBeGreaterThanOrEqual(window.startTic);
      expect(window.description.length).toBeGreaterThan(0);
      const typed: AudioHashWindow = window;
      const phase: AudioHashWindowPhase = typed.phase;
      expect(typeof phase).toBe('string');
    }
  });

  test('REFERENCE_AUDIO_HASH_WINDOWS concatenates SFX then music windows for a frozen 7-element total surface', () => {
    expect(Object.isFrozen(REFERENCE_AUDIO_HASH_WINDOWS)).toBe(true);
    expect(REFERENCE_AUDIO_HASH_WINDOWS.length).toBe(SFX_HASH_WINDOWS.length + MUSIC_EVENT_HASH_WINDOWS.length);
    expect(REFERENCE_AUDIO_HASH_WINDOWS.length).toBe(7);
    for (let windowIndex = 0; windowIndex < SFX_HASH_WINDOWS.length; windowIndex += 1) {
      expect(REFERENCE_AUDIO_HASH_WINDOWS[windowIndex]).toBe(SFX_HASH_WINDOWS[windowIndex]!);
    }
    for (let windowIndex = 0; windowIndex < MUSIC_EVENT_HASH_WINDOWS.length; windowIndex += 1) {
      expect(REFERENCE_AUDIO_HASH_WINDOWS[SFX_HASH_WINDOWS.length + windowIndex]).toBe(MUSIC_EVENT_HASH_WINDOWS[windowIndex]!);
    }
  });

  test('SFX_HASH_WINDOWS startTic/endTic match the plan_fps capture-sfx-hash-windows.json window ranges', async () => {
    const fixture = await loadScriptedSfxFixture();
    expect(fixture.hashWindows.length).toBe(SFX_HASH_WINDOWS.length);
    for (let windowIndex = 0; windowIndex < SFX_HASH_WINDOWS.length; windowIndex += 1) {
      const localWindow = SFX_HASH_WINDOWS[windowIndex]!;
      const fixtureWindow = fixture.hashWindows[windowIndex]!;
      expect(localWindow.name).toBe(fixtureWindow.name);
      expect(localWindow.startTic).toBe(fixtureWindow.window.ticStart);
      expect(localWindow.endTic).toBe(fixtureWindow.window.ticEnd);
    }
  });

  test('MUSIC_EVENT_HASH_WINDOWS startTic/endTic match the plan_fps capture-music-event-hash-windows.json window ranges', async () => {
    const fixture = await loadScriptedMusicFixture();
    expect(fixture.musicEventHashTrace.length).toBe(MUSIC_EVENT_HASH_WINDOWS.length);
    for (let windowIndex = 0; windowIndex < MUSIC_EVENT_HASH_WINDOWS.length; windowIndex += 1) {
      const localWindow = MUSIC_EVENT_HASH_WINDOWS[windowIndex]!;
      const fixtureWindow = fixture.musicEventHashTrace[windowIndex]!;
      expect(localWindow.name).toBe(fixtureWindow.windowId);
      expect(localWindow.startTic).toBe(fixtureWindow.ticWindow.start);
      expect(localWindow.endTic).toBe(fixtureWindow.ticWindow.end);
    }
  });

  test('accepts the documented override keys via the CaptureReferenceAudioWindowsOverrides shape', () => {
    const overrides: CaptureReferenceAudioWindowsOverrides = {
      executableFilename: 'DOOM.EXE',
      findWindowPollIntervalMs: 25,
      findWindowTimeoutMs: 15_000,
      killWaitMs: 3_000,
      menuKeyFirstAtTic: 140,
      sandboxIdOverride: 'override-id',
      settleAfterKeyMs: 250,
      settleAfterWindowFoundMs: 500,
    };
    expect(Object.keys(overrides).length).toBe(8);
  });

  test('throws ReferenceBundleMissingError when the sandbox executable filename does not exist after sandbox creation', async () => {
    if (!referenceBundleIsAvailable()) {
      return;
    }
    await expect(captureReferenceAudioWindows({ executableFilename: 'NON_EXISTENT_BINARY.EXE' })).rejects.toBeInstanceOf(ReferenceBundleMissingError);
  });

  if (referenceBundleIsAvailable()) {
    let lastCapturedSandboxPath: string | null = null;

    afterAll(async () => {
      if (lastCapturedSandboxPath !== null && existsSync(lastCapturedSandboxPath)) {
        const { destroyReferenceSandbox } = await import('../../../tools/reference/createReferenceSandbox.ts');
        await destroyReferenceSandbox(lastCapturedSandboxPath);
      }
    });

    test('captures a live WASAPI loopback audio recording from clean launch through Main → Episode → Skill → E1M1 spawn and hashes each of the 7 fixture-aligned tic windows', async () => {
      const evidence: ReferenceAudioWindowsEvidence = await captureReferenceAudioWindows({ findWindowTimeoutMs: 30_000, killWaitMs: 8_000, settleAfterKeyMs: 400, settleAfterWindowFoundMs: 1_500 });
      lastCapturedSandboxPath = evidence.sandboxAbsolutePath;

      expect(evidence.windowTitle).toContain('Chocolate Doom 2.2.1');
      expect(evidence.executableFilename).toBe('DOOM.EXE');
      expect(evidence.sandboxId.length).toBeGreaterThan(0);
      expect(evidence.sandboxAbsolutePath.includes(REFERENCE_SANDBOX_POLICY.sandboxPrefix)).toBe(true);
      expect(evidence.spawnedAtElapsedMs).toBeGreaterThanOrEqual(0);
      expect(evidence.windowFoundAtElapsedMs).toBeGreaterThanOrEqual(evidence.spawnedAtElapsedMs);
      expect(evidence.captureStartElapsedMs).toBeGreaterThanOrEqual(evidence.windowFoundAtElapsedMs);
      expect(evidence.captureEndElapsedMs).toBeGreaterThanOrEqual(evidence.captureStartElapsedMs);
      expect(evidence.killedAtElapsedMs).toBeGreaterThanOrEqual(evidence.captureEndElapsedMs);
      expect(evidence.exitedAtElapsedMs).toBeGreaterThanOrEqual(evidence.killedAtElapsedMs);
      expect(evidence.totalElapsedMs).toBe(evidence.exitedAtElapsedMs);

      expect(ACCEPTED_CAPTURE_STATUSES).toContain(evidence.captureStatus);
      expect(evidence.captureStatus).toBe('captured');

      expect(evidence.ticDurationMs).toBe(TIC_DURATION_MS);
      const longestEndTic = REFERENCE_AUDIO_HASH_WINDOWS.reduce((maximum, window) => (window.endTic > maximum ? window.endTic : maximum), 0);
      expect(evidence.totalCapturedTics).toBe(longestEndTic);
      expect(evidence.menuKeyFirstAtTic).toBeGreaterThan(0);

      const capturedFormat: CapturedAudioFormat = evidence.capturedFormat;
      expect(capturedFormat.channelCount).toBeGreaterThan(0);
      expect(capturedFormat.bitsPerSample).toBeGreaterThan(0);
      expect(capturedFormat.blockAlign).toBeGreaterThan(0);
      expect(capturedFormat.samplesPerSecond).toBeGreaterThan(0);
      expect(capturedFormat.averageBytesPerSecond).toBeGreaterThan(0);
      expect(capturedFormat.formatTag).toBeGreaterThan(0);

      expect(evidence.framesCapturedTotal).toBeGreaterThan(0);
      expect(evidence.pcmByteLengthTotal).toBe(evidence.framesCapturedTotal * capturedFormat.blockAlign);
      expect(evidence.silentPacketCount).toBeGreaterThanOrEqual(0);

      expect(SHA256_HEX_REGEX.test(evidence.mixedSha256)).toBe(true);
      expect(SHA256_HEX_REGEX.test(evidence.musicEventSha256)).toBe(true);
      expect(SHA256_HEX_REGEX.test(evidence.sfxSha256)).toBe(true);

      expect(evidence.windows.length).toBe(REFERENCE_AUDIO_HASH_WINDOWS.length);
      for (let windowIndex = 0; windowIndex < evidence.windows.length; windowIndex += 1) {
        const capturedWindow: ReferenceAudioWindowEvidence = evidence.windows[windowIndex]!;
        const expectedWindow = REFERENCE_AUDIO_HASH_WINDOWS[windowIndex]!;
        expect(capturedWindow.name).toBe(expectedWindow.name);
        expect(capturedWindow.kind).toBe(expectedWindow.kind);
        expect(capturedWindow.phase).toBe(expectedWindow.phase);
        expect(capturedWindow.startTic).toBe(expectedWindow.startTic);
        expect(capturedWindow.endTic).toBe(expectedWindow.endTic);
        expect(capturedWindow.description).toBe(expectedWindow.description);
        expect(capturedWindow.observedEndElapsedMs).toBeGreaterThanOrEqual(capturedWindow.observedStartElapsedMs);
        expect(capturedWindow.audioByteLength).toBeGreaterThanOrEqual(0);
        expect(SHA256_HEX_REGEX.test(capturedWindow.audioSha256)).toBe(true);
        expect(SHA256_HEX_REGEX.test(capturedWindow.mixedSha256)).toBe(true);
        expect(SHA256_HEX_REGEX.test(capturedWindow.musicEventSha256)).toBe(true);
        expect(SHA256_HEX_REGEX.test(capturedWindow.sfxSha256)).toBe(true);
        expect(capturedWindow.audioByteLength % capturedFormat.blockAlign).toBe(0);
      }

      expect(ACCEPTED_TERMINATION_CAUSES).toContain(evidence.terminationCause);
      expect(evidence.cleanShutdown).toBe(true);
      expect(existsSync(evidence.sandboxAbsolutePath)).toBe(false);
    }, 240_000);
  } else {
    test.skip('skipped live WASAPI loopback audio capture because the reference bundle is not present on this host', () => {
      expect(true).toBe(true);
    });
  }
});
