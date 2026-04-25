import { describe, expect, test } from 'bun:test';

import type { MusicDeviceAction } from '../../../src/audio/musicSystem.ts';
import { createMusicSystem } from '../../../src/audio/musicSystem.ts';
import type { SoundEffectsVolumeAction } from '../../../src/playable/audio-product-integration/wireVolumeControls.ts';
import { SOUND_EFFECTS_VOLUME_MAX, SOUND_EFFECTS_VOLUME_MIN, WIRE_VOLUME_CONTROLS_AUDIT_MANIFEST_PATH, WIRE_VOLUME_CONTROLS_RUNTIME_COMMAND, wireVolumeControls } from '../../../src/playable/audio-product-integration/wireVolumeControls.ts';

const EXPECTED_SOURCE_SHA256 = '37feb646a3cf163d872a7330779132a0475ff341c8b3d32985026d80d4a4471c';

describe('wireVolumeControls', () => {
  test('locks the runtime command, audit linkage, constants, and source hash', async () => {
    expect(WIRE_VOLUME_CONTROLS_RUNTIME_COMMAND).toBe('bun run doom.ts');
    expect(WIRE_VOLUME_CONTROLS_AUDIT_MANIFEST_PATH).toBe('plan_fps/manifests/01-011-audit-missing-live-audio.json');
    expect(SOUND_EFFECTS_VOLUME_MIN).toBe(0);
    expect(SOUND_EFFECTS_VOLUME_MAX).toBe(15);
    expect(await sha256File('src/playable/audio-product-integration/wireVolumeControls.ts')).toBe(EXPECTED_SOURCE_SHA256);
  });

  test('applies sound-effects and music volume transitions with replay-stable evidence', () => {
    const musicActions: MusicDeviceAction[] = [];
    const soundEffectsActions: SoundEffectsVolumeAction[] = [];
    const state = {
      musicSystem: createMusicSystem({ initialVolume: 8 }),
      soundEffectsVolume: 15,
    };

    const evidence = wireVolumeControls({
      controls: [
        { kind: 'sound-effects', volume: 11 },
        { kind: 'music', volume: 64 },
        { kind: 'sound-effects', volume: 0 },
      ],
      dispatchMusicAction: (action) => {
        musicActions.push(action);
      },
      dispatchSoundEffectsAction: (action) => {
        soundEffectsActions.push(action);
      },
      runtimeCommand: WIRE_VOLUME_CONTROLS_RUNTIME_COMMAND,
      state,
    });

    expect(evidence).toEqual({
      auditManifestPath: 'plan_fps/manifests/01-011-audit-missing-live-audio.json',
      finalMusicVolume: 64,
      finalSoundEffectsVolume: 0,
      replayChecksum: 4_280_210_275,
      runtimeCommand: 'bun run doom.ts',
      transitions: [
        {
          actionIndex: 0,
          afterMusicVolume: 8,
          afterSoundEffectsVolume: 11,
          beforeMusicVolume: 8,
          beforeSoundEffectsVolume: 15,
          dispatchedActionKinds: ['sound-effects:set-sound-effects-volume'],
          kind: 'sound-effects',
          volume: 11,
        },
        {
          actionIndex: 1,
          afterMusicVolume: 64,
          afterSoundEffectsVolume: 11,
          beforeMusicVolume: 8,
          beforeSoundEffectsVolume: 11,
          dispatchedActionKinds: ['music:set-volume'],
          kind: 'music',
          volume: 64,
        },
        {
          actionIndex: 2,
          afterMusicVolume: 64,
          afterSoundEffectsVolume: 0,
          beforeMusicVolume: 64,
          beforeSoundEffectsVolume: 11,
          dispatchedActionKinds: ['sound-effects:set-sound-effects-volume'],
          kind: 'sound-effects',
          volume: 0,
        },
      ],
    });
    expect(musicActions).toEqual([{ kind: 'set-volume', volume: 64 }]);
    expect(soundEffectsActions).toEqual([
      { kind: 'set-sound-effects-volume', volume: 11 },
      { kind: 'set-sound-effects-volume', volume: 0 },
    ]);
    expect(state.musicSystem.musicVolume).toBe(64);
    expect(state.soundEffectsVolume).toBe(0);
  });

  test('rejects the wrong runtime command before mutation or dispatch', () => {
    const musicActions: MusicDeviceAction[] = [];
    const soundEffectsActions: SoundEffectsVolumeAction[] = [];
    const state = {
      musicSystem: createMusicSystem({ initialVolume: 8 }),
      soundEffectsVolume: 15,
    };

    expect(() =>
      wireVolumeControls({
        controls: [{ kind: 'music', volume: 12 }],
        dispatchMusicAction: (action) => {
          musicActions.push(action);
        },
        dispatchSoundEffectsAction: (action) => {
          soundEffectsActions.push(action);
        },
        runtimeCommand: 'bun run src/main.ts',
        state,
      }),
    ).toThrow('wireVolumeControls expected runtimeCommand bun run doom.ts');
    expect(musicActions).toEqual([]);
    expect(soundEffectsActions).toEqual([]);
    expect(state.musicSystem.musicVolume).toBe(8);
    expect(state.soundEffectsVolume).toBe(15);
  });

  test('prevalidates invalid music volume before mutation or dispatch', () => {
    const musicActions: MusicDeviceAction[] = [];
    const state = {
      musicSystem: createMusicSystem({ initialVolume: 8 }),
      soundEffectsVolume: 15,
    };

    expect(() =>
      wireVolumeControls({
        controls: [
          { kind: 'sound-effects', volume: 9 },
          { kind: 'music', volume: 128 },
        ],
        dispatchMusicAction: (action) => {
          musicActions.push(action);
        },
        runtimeCommand: WIRE_VOLUME_CONTROLS_RUNTIME_COMMAND,
        state,
      }),
    ).toThrow('music volume must be an integer in [0, 127], got 128');
    expect(musicActions).toEqual([]);
    expect(state.musicSystem.musicVolume).toBe(8);
    expect(state.soundEffectsVolume).toBe(15);
  });

  test('prevalidates invalid sound-effects volume before mutation', () => {
    const state = {
      musicSystem: createMusicSystem({ initialVolume: 8 }),
      soundEffectsVolume: 15,
    };

    expect(() =>
      wireVolumeControls({
        controls: [
          { kind: 'music', volume: 12 },
          { kind: 'sound-effects', volume: 16 },
        ],
        runtimeCommand: WIRE_VOLUME_CONTROLS_RUNTIME_COMMAND,
        state,
      }),
    ).toThrow('sound effects volume must be an integer in [0, 15], got 16');
    expect(state.musicSystem.musicVolume).toBe(8);
    expect(state.soundEffectsVolume).toBe(15);
  });
});

async function sha256File(path: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await Bun.file(path).arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
