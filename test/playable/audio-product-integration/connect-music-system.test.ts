import { describe, expect, test } from 'bun:test';

import { CONNECT_MUSIC_SYSTEM_RUNTIME_COMMAND, connectMusicSystem } from '../../../src/playable/audio-product-integration/connectMusicSystem.ts';
import type { ConnectMusicSystemAction } from '../../../src/playable/audio-product-integration/connectMusicSystem.ts';

const SOURCE_PATH = 'src/playable/audio-product-integration/connectMusicSystem.ts';

describe('connectMusicSystem', () => {
  test('locks the command contract, transition evidence, and handle-free replay checksum', () => {
    const dispatchedActions: ConnectMusicSystemAction[] = [];
    const score = Object.freeze({
      fixture: 'score-payload-not-in-evidence',
    });

    const result = connectMusicSystem({
      actions: [
        Object.freeze({ kind: 'set-volume', volume: 11 }),
        Object.freeze({ kind: 'play-song', looping: true, musicNum: 29, score }),
        Object.freeze({ kind: 'pause-song' }),
        Object.freeze({ kind: 'resume-song' }),
        Object.freeze({ kind: 'stop-song', musicNum: 29 }),
      ],
      dispatchMusicAction(action) {
        dispatchedActions.push(action);
      },
      runtimeCommand: CONNECT_MUSIC_SYSTEM_RUNTIME_COMMAND,
    });

    expect(result).toEqual({
      dispatchedActionCount: 5,
      replayChecksum: 4013364346,
      replayEvidence: [
        { kind: 'set-volume', ordinal: 0, volume: 11 },
        { kind: 'play-song', looping: true, musicNum: 29, ordinal: 1 },
        { kind: 'pause-song', ordinal: 2 },
        { kind: 'resume-song', ordinal: 3 },
        { kind: 'stop-song', musicNum: 29, ordinal: 4 },
      ],
      runtimeCommand: CONNECT_MUSIC_SYSTEM_RUNTIME_COMMAND,
    });
    expect(JSON.stringify(result.replayEvidence)).not.toContain('score-payload-not-in-evidence');
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.replayEvidence)).toBe(true);
    for (const evidenceEntry of result.replayEvidence) {
      expect(Object.isFrozen(evidenceEntry)).toBe(true);
    }
    for (const dispatchedAction of dispatchedActions) {
      expect(Object.isFrozen(dispatchedAction)).toBe(true);
    }
    const playAction = dispatchedActions.find((action) => action.kind === 'play-song');
    expect(playAction?.score).toBe(score);
  });

  test('prevalidates action payloads before dispatching to the live host', () => {
    let dispatchCount = 0;

    expect(() =>
      connectMusicSystem({
        actions: [Object.freeze({ kind: 'set-volume', volume: 128 }), Object.freeze({ kind: 'pause-song' })],
        dispatchMusicAction() {
          dispatchCount += 1;
        },
        runtimeCommand: CONNECT_MUSIC_SYSTEM_RUNTIME_COMMAND,
      }),
    ).toThrow(RangeError);
    expect(dispatchCount).toBe(0);
  });

  test('rejects non-target runtime commands before host dispatch', () => {
    let dispatchCount = 0;

    expect(() =>
      connectMusicSystem({
        actions: [Object.freeze({ kind: 'pause-song' })],
        dispatchMusicAction() {
          dispatchCount += 1;
        },
        runtimeCommand: 'bun run src/main.ts',
      }),
    ).toThrow(`connectMusicSystem requires ${CONNECT_MUSIC_SYSTEM_RUNTIME_COMMAND}`);
    expect(dispatchCount).toBe(0);
  });

  test('locks the missing-live-audio audit manifest contract for music playback', async () => {
    const manifestText = await Bun.file('plan_fps/manifests/01-011-audit-missing-live-audio.json').text();
    const manifest: unknown = JSON.parse(manifestText);
    const commandContracts = requireObjectProperty(manifest, 'commandContracts');
    const explicitNullSurfaces = requireArrayProperty(manifest, 'explicitNullSurfaces');
    const liveMusicSurface = explicitNullSurfaces.find((surface) => requireObjectProperty(surface, 'name') === 'live-music-playback');
    const target = requireObjectProperty(commandContracts, 'target');

    expect(requireObjectProperty(manifest, 'schemaVersion')).toBe(1);
    expect(requireObjectProperty(target, 'runtimeCommand')).toBe(CONNECT_MUSIC_SYSTEM_RUNTIME_COMMAND);
    expect(requireObjectProperty(liveMusicSurface, 'path')).toBeNull();
  });

  test('locks the product source hash', async () => {
    expect(await sha256File(SOURCE_PATH)).toBe('3daacdf2ad4d17e02cfc3ef572acae4bbc649176a3320157f8d3920271544ad1');
  });
});

async function sha256File(path: string): Promise<string> {
  const text = await Bun.file(path).text();
  return new Bun.CryptoHasher('sha256').update(text).digest('hex');
}

function requireArrayProperty(value: unknown, propertyName: string): readonly unknown[] {
  const propertyValue = requireObjectProperty(value, propertyName);
  if (!Array.isArray(propertyValue)) {
    throw new TypeError(`${propertyName} must be an array`);
  }
  return propertyValue;
}

function requireObjectProperty(value: unknown, propertyName: string): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${propertyName} requires an object`);
  }
  if (!Object.hasOwn(value, propertyName)) {
    throw new TypeError(`missing ${propertyName}`);
  }
  return Reflect.get(value, propertyName);
}
