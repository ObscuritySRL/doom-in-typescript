import { describe, expect, test } from 'bun:test';

import { CONNECT_SFX_MIXER_RUNTIME_COMMAND, connectSfxMixer } from '../../../src/playable/audio-product-integration/connectSfxMixer.ts';
import type { SfxMixerStartAction } from '../../../src/playable/audio-product-integration/connectSfxMixer.ts';
import type { StartSoundResult } from '../../../src/audio/soundSystem.ts';

const SOURCE_PATH = 'src/playable/audio-product-integration/connectSfxMixer.ts';
const SOURCE_SHA256 = 'a41b91aa1a85f4a2f499301e4c0f461c6ca5ce71e0058aca73c57573608c12a6';

describe('connectSfxMixer', () => {
  test('locks the Bun runtime command contract and live-audio audit schema', async () => {
    expect(CONNECT_SFX_MIXER_RUNTIME_COMMAND).toBe('bun run doom.ts');

    const manifest = await readJson('plan_fps/manifests/01-011-audit-missing-live-audio.json');
    expect(readNumber(manifest, 'schemaVersion')).toBe(1);

    const commandContracts = readRecord(manifest, 'commandContracts');
    const target = readRecord(commandContracts, 'target');
    expect(readString(target, 'runtimeCommand')).toBe(CONNECT_SFX_MIXER_RUNTIME_COMMAND);
    expect(readString(target, 'entryFile')).toBe('doom.ts');

    const explicitNullSurfaces = readArray(manifest, 'explicitNullSurfaces');
    expect(explicitNullSurfaces.some(hasLiveSfxMixerSurface)).toBe(true);
  });

  test('locks source text hash', async () => {
    const sourceText = await Bun.file(SOURCE_PATH).text();
    expect(sha256Hex(sourceText)).toBe(SOURCE_SHA256);
  });

  test('dispatches started results to the mixer and returns deterministic handle-free evidence', () => {
    const dispatchedActions: SfxMixerStartAction[] = [];
    const soundResults = [
      { kind: 'started', cnum: 1, sfxId: 1, volume: 15, separation: 128, pitch: 127 },
      { kind: 'inaudible' },
      { kind: 'started', cnum: 3, sfxId: 10, volume: 9, separation: 64, pitch: 135 },
      { kind: 'no-channel' },
    ] satisfies readonly StartSoundResult[];

    const evidence = connectSfxMixer({
      mixer: {
        startSound(action) {
          dispatchedActions.push(action);
          return { liveHandle: 0xfeedn };
        },
      },
      runtimeCommand: CONNECT_SFX_MIXER_RUNTIME_COMMAND,
      soundResults,
    });

    expect(dispatchedActions).toEqual([
      { channelIndex: 1, kind: 'start-sfx', pitch: 127, separation: 128, sfxId: 1, volume: 15 },
      { channelIndex: 3, kind: 'start-sfx', pitch: 135, separation: 64, sfxId: 10, volume: 9 },
    ]);
    expect(evidence).toEqual({
      dispatchCount: 2,
      dropCount: 2,
      firstDispatchedChannelIndex: 1,
      lastDispatchedChannelIndex: 3,
      replayActions: [
        { channelIndex: 1, kind: 'start-sfx', pitch: 127, separation: 128, sfxId: 1, volume: 15 },
        { kind: 'drop-sfx', reason: 'inaudible' },
        { channelIndex: 3, kind: 'start-sfx', pitch: 135, separation: 64, sfxId: 10, volume: 9 },
        { kind: 'drop-sfx', reason: 'no-channel' },
      ],
      replayChecksum: 1029420772,
      runtimeCommand: CONNECT_SFX_MIXER_RUNTIME_COMMAND,
    });
    expect(JSON.stringify(evidence)).not.toContain('feed');
    expect(Object.isFrozen(evidence)).toBe(true);
    expect(Object.isFrozen(evidence.replayActions)).toBe(true);
  });

  test('rejects non-target runtime commands before mixer dispatch', () => {
    const dispatchedActions: SfxMixerStartAction[] = [];

    expect(() =>
      connectSfxMixer({
        mixer: {
          startSound(action) {
            dispatchedActions.push(action);
            return 1n;
          },
        },
        runtimeCommand: 'bun run src/main.ts',
        soundResults: [{ kind: 'started', cnum: 0, sfxId: 1, volume: 15, separation: 128, pitch: 127 }],
      }),
    ).toThrow('connectSfxMixer requires bun run doom.ts');
    expect(dispatchedActions).toEqual([]);
  });

  test('validates started action payloads before mixer dispatch', () => {
    const dispatchedActions: SfxMixerStartAction[] = [];

    expect(() =>
      connectSfxMixer({
        mixer: {
          startSound(action) {
            dispatchedActions.push(action);
            return 1n;
          },
        },
        runtimeCommand: CONNECT_SFX_MIXER_RUNTIME_COMMAND,
        soundResults: [{ kind: 'started', cnum: -1, sfxId: 1, volume: 15, separation: 128, pitch: 127 }],
      }),
    ).toThrow('channelIndex must be an integer');
    expect(dispatchedActions).toEqual([]);
  });
});

function hasLiveSfxMixerSurface(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return value.name === 'live-sfx-mixer' && value.path === null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function readJson(path: string): Promise<Record<string, unknown>> {
  const value: unknown = JSON.parse(await Bun.file(path).text());
  if (!isRecord(value)) {
    throw new TypeError(`${path} must contain a JSON object`);
  }
  return value;
}

function readArray(record: Record<string, unknown>, key: string): readonly unknown[] {
  const value = record[key];
  if (!Array.isArray(value)) {
    throw new TypeError(`${key} must be an array`);
  }
  return value;
}

function readNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== 'number') {
    throw new TypeError(`${key} must be a number`);
  }
  return value;
}

function readRecord(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = record[key];
  if (!isRecord(value)) {
    throw new TypeError(`${key} must be an object`);
  }
  return value;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string') {
    throw new TypeError(`${key} must be a string`);
  }
  return value;
}

function sha256Hex(value: string): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(value);
  return hasher.digest('hex');
}
