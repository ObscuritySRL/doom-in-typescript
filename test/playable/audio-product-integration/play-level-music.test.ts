import { describe, expect, test } from 'bun:test';

import { Buffer } from 'node:buffer';

import type { ChangeMusicRequest, MusicDeviceAction } from '../../../src/audio/musicSystem.ts';
import { createMusicSystem, pauseMusic } from '../../../src/audio/musicSystem.ts';
import { LEVEL_MUSIC_AUDIT_MANIFEST_PATH, LEVEL_MUSIC_COMMAND_CONTRACT, LEVEL_MUSIC_ENTRY_FILE, LEVEL_MUSIC_RUNTIME_COMMAND, playLevelMusic, resolveLevelMusic } from '../../../src/playable/audio-product-integration/playLevelMusic.ts';

const EMPTY_LEVEL_SCORE = Object.freeze({
  bytesConsumed: 0,
  events: Object.freeze([]),
  header: Object.freeze({
    channelCount: 0,
    instrumentCount: 0,
    instruments: Object.freeze([]),
    scoreData: Buffer.alloc(0),
    scoreLength: 0,
    scoreStart: 0,
    secondaryChannelCount: 0,
  }),
  totalDelay: 0,
}) satisfies ChangeMusicRequest['score'];

async function sha256Hex(filePath: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await Bun.file(filePath).arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

describe('playLevelMusic', () => {
  test('locks the command contract, audit manifest, and formatted source hash', async () => {
    const manifest = await Bun.file(LEVEL_MUSIC_AUDIT_MANIFEST_PATH).json();

    expect(LEVEL_MUSIC_RUNTIME_COMMAND).toBe('bun run doom.ts');
    expect(LEVEL_MUSIC_ENTRY_FILE).toBe('doom.ts');
    expect(manifest.commandContracts.target.runtimeCommand).toBe(LEVEL_MUSIC_RUNTIME_COMMAND);
    expect(manifest.explicitNullSurfaces.some((surface: { name: string }) => surface.name === 'live-music-playback')).toBe(true);
    expect(await sha256Hex('src/playable/audio-product-integration/playLevelMusic.ts')).toBe('d9a1a21ef408757590b733110af07ce7e05ea18d083e5e22862f7f8b798016cf');
  });

  test('resolves Doom episode map names to level music numbers and lumps', () => {
    expect(resolveLevelMusic(' e1m1 ')).toEqual({
      mapName: 'E1M1',
      musicLumpName: 'D_E1M1',
      musicNumber: 1,
    });
    expect(resolveLevelMusic('E3M9')).toEqual({
      mapName: 'E3M9',
      musicLumpName: 'D_E3M9',
      musicNumber: 27,
    });
  });

  test('plays E1M1 music through the Bun product command with handle-free replay evidence', () => {
    const dispatchActions: MusicDeviceAction[] = [];
    const system = createMusicSystem({ initialVolume: 8 });
    const result = playLevelMusic({
      dispatchMusicAction: (action) => {
        dispatchActions.push(action);
      },
      mapName: 'E1M1',
      runtimeCommand: LEVEL_MUSIC_RUNTIME_COMMAND,
      score: EMPTY_LEVEL_SCORE,
      system,
    });

    expect(result).toEqual({
      auditManifestPath: LEVEL_MUSIC_AUDIT_MANIFEST_PATH,
      commandContract: {
        entryFile: LEVEL_MUSIC_ENTRY_FILE,
        runtimeCommand: LEVEL_MUSIC_RUNTIME_COMMAND,
      },
      currentMusicNumber: 1,
      looping: true,
      mapName: 'E1M1',
      musicLumpName: 'D_E1M1',
      musicNumber: 1,
      paused: false,
      replayActions: [
        {
          kind: 'play-song',
          looping: true,
          musicNumber: 1,
        },
      ],
      replayChecksum: 3716162403,
    });

    expect(dispatchActions).toHaveLength(1);
    const dispatchAction = dispatchActions[0];
    if (dispatchAction === undefined || dispatchAction.kind !== 'play-song') {
      throw new Error('expected exactly one play-song dispatch action');
    }
    expect(dispatchAction.looping).toBe(true);
    expect(dispatchAction.musicNum).toBe(1);
    expect(dispatchAction.score).toBe(EMPTY_LEVEL_SCORE);
    expect('handle' in result.replayActions[0]).toBe(false);
  });

  test('does not restart a level track that is already playing', () => {
    const dispatchActions: MusicDeviceAction[] = [];
    const system = createMusicSystem({ initialVolume: 8 });

    playLevelMusic({
      dispatchMusicAction: (action) => {
        dispatchActions.push(action);
      },
      mapName: 'E1M1',
      runtimeCommand: LEVEL_MUSIC_RUNTIME_COMMAND,
      score: EMPTY_LEVEL_SCORE,
      system,
    });

    const result = playLevelMusic({
      dispatchMusicAction: (action) => {
        dispatchActions.push(action);
      },
      mapName: 'E1M1',
      runtimeCommand: LEVEL_MUSIC_RUNTIME_COMMAND,
      score: EMPTY_LEVEL_SCORE,
      system,
    });

    expect(dispatchActions).toHaveLength(1);
    expect(result.replayActions).toEqual([]);
    expect(result.replayChecksum).toBe(3686880548);
    expect(result.currentMusicNumber).toBe(1);
  });

  test('rejects wrong runtime commands before mutation or live dispatch', () => {
    const dispatchActions: MusicDeviceAction[] = [];
    const system = createMusicSystem({ initialVolume: 8 });

    expect(() =>
      playLevelMusic({
        dispatchMusicAction: (action) => {
          dispatchActions.push(action);
        },
        mapName: 'E1M1',
        runtimeCommand: 'bun run src/main.ts',
        score: EMPTY_LEVEL_SCORE,
        system,
      }),
    ).toThrow('play-level-music requires bun run doom.ts');

    expect(dispatchActions).toEqual([]);
    expect(system.currentMusicNum).toBeNull();
  });

  test('rejects unsupported map names before mutation or live dispatch', () => {
    const dispatchActions: MusicDeviceAction[] = [];
    const system = createMusicSystem({ initialVolume: 8 });

    expect(() =>
      playLevelMusic({
        dispatchMusicAction: (action) => {
          dispatchActions.push(action);
        },
        mapName: 'MAP01',
        runtimeCommand: LEVEL_MUSIC_RUNTIME_COMMAND,
        score: EMPTY_LEVEL_SCORE,
        system,
      }),
    ).toThrow('level music map must be E1M1 through E3M9');

    expect(dispatchActions).toEqual([]);
    expect(system.currentMusicNum).toBeNull();
  });

  test('resolves all episode boundaries to vanilla mus_e1m1-mus_e3m9 indices', () => {
    expect(resolveLevelMusic('E1M1')).toEqual({ mapName: 'E1M1', musicLumpName: 'D_E1M1', musicNumber: 1 });
    expect(resolveLevelMusic('E1M9')).toEqual({ mapName: 'E1M9', musicLumpName: 'D_E1M9', musicNumber: 9 });
    expect(resolveLevelMusic('E2M1')).toEqual({ mapName: 'E2M1', musicLumpName: 'D_E2M1', musicNumber: 10 });
    expect(resolveLevelMusic('E2M5')).toEqual({ mapName: 'E2M5', musicLumpName: 'D_E2M5', musicNumber: 14 });
    expect(resolveLevelMusic('E2M9')).toEqual({ mapName: 'E2M9', musicLumpName: 'D_E2M9', musicNumber: 18 });
    expect(resolveLevelMusic('E3M1')).toEqual({ mapName: 'E3M1', musicLumpName: 'D_E3M1', musicNumber: 19 });
  });

  test('rejects out-of-range map names before mutation or live dispatch', () => {
    const outOfRangeMapNames = ['E0M1', 'E4M1', 'E1M0', 'E1M10', 'E10M1', '', 'E1M1X', 'XE1M1'] as const;
    for (const mapName of outOfRangeMapNames) {
      expect(() => resolveLevelMusic(mapName)).toThrow('level music map must be E1M1 through E3M9');
    }
  });

  test('emits stop-song then play-song when transitioning between distinct level tracks', () => {
    const dispatchActions: MusicDeviceAction[] = [];
    const system = createMusicSystem({ initialVolume: 8 });

    playLevelMusic({
      dispatchMusicAction: (action) => {
        dispatchActions.push(action);
      },
      mapName: 'E1M1',
      runtimeCommand: LEVEL_MUSIC_RUNTIME_COMMAND,
      score: EMPTY_LEVEL_SCORE,
      system,
    });

    expect(dispatchActions).toEqual([{ kind: 'play-song', looping: true, musicNum: 1, score: EMPTY_LEVEL_SCORE }]);

    const result = playLevelMusic({
      dispatchMusicAction: (action) => {
        dispatchActions.push(action);
      },
      mapName: 'E1M2',
      runtimeCommand: LEVEL_MUSIC_RUNTIME_COMMAND,
      score: EMPTY_LEVEL_SCORE,
      system,
    });

    expect(dispatchActions).toEqual([
      { kind: 'play-song', looping: true, musicNum: 1, score: EMPTY_LEVEL_SCORE },
      { kind: 'stop-song', musicNum: 1 },
      { kind: 'play-song', looping: true, musicNum: 2, score: EMPTY_LEVEL_SCORE },
    ]);
    expect(result.replayActions).toEqual([
      { kind: 'stop-song', musicNumber: 1 },
      { kind: 'play-song', looping: true, musicNumber: 2 },
    ]);
    expect(result.currentMusicNumber).toBe(2);
    expect(result.musicNumber).toBe(2);
    expect(result.musicLumpName).toBe('D_E1M2');
    expect(system.paused).toBe(false);
  });

  test('emits resume-song before stop-song when the prior track was paused', () => {
    const dispatchActions: MusicDeviceAction[] = [];
    const system = createMusicSystem({ initialVolume: 8 });

    playLevelMusic({
      dispatchMusicAction: (action) => {
        dispatchActions.push(action);
      },
      mapName: 'E1M1',
      runtimeCommand: LEVEL_MUSIC_RUNTIME_COMMAND,
      score: EMPTY_LEVEL_SCORE,
      system,
    });
    pauseMusic(system);
    expect(system.paused).toBe(true);

    const transitionDispatchActions: MusicDeviceAction[] = [];
    const result = playLevelMusic({
      dispatchMusicAction: (action) => {
        transitionDispatchActions.push(action);
      },
      mapName: 'E2M1',
      runtimeCommand: LEVEL_MUSIC_RUNTIME_COMMAND,
      score: EMPTY_LEVEL_SCORE,
      system,
    });

    expect(transitionDispatchActions).toEqual([{ kind: 'resume-song' }, { kind: 'stop-song', musicNum: 1 }, { kind: 'play-song', looping: true, musicNum: 10, score: EMPTY_LEVEL_SCORE }]);
    expect(result.replayActions).toEqual([{ kind: 'resume-song' }, { kind: 'stop-song', musicNumber: 1 }, { kind: 'play-song', looping: true, musicNumber: 10 }]);
    expect(result.paused).toBe(false);
    expect(system.paused).toBe(false);
    expect(system.currentMusicNum).toBe(10);
  });

  test('runs without an optional live dispatcher and still produces replay evidence', () => {
    const system = createMusicSystem({ initialVolume: 8 });
    const result = playLevelMusic({
      mapName: 'E2M5',
      runtimeCommand: LEVEL_MUSIC_RUNTIME_COMMAND,
      score: EMPTY_LEVEL_SCORE,
      system,
    });

    expect(result.musicNumber).toBe(14);
    expect(result.musicLumpName).toBe('D_E2M5');
    expect(result.currentMusicNumber).toBe(14);
    expect(result.replayActions).toEqual([{ kind: 'play-song', looping: true, musicNumber: 14 }]);
    expect(system.currentMusicNum).toBe(14);
    expect(system.looping).toBe(true);
  });

  test('reuses the module-level command contract instance across calls', () => {
    const system = createMusicSystem({ initialVolume: 8 });
    const firstResult = playLevelMusic({
      mapName: 'E1M1',
      runtimeCommand: LEVEL_MUSIC_RUNTIME_COMMAND,
      score: EMPTY_LEVEL_SCORE,
      system,
    });
    const secondResult = playLevelMusic({
      mapName: 'E1M2',
      runtimeCommand: LEVEL_MUSIC_RUNTIME_COMMAND,
      score: EMPTY_LEVEL_SCORE,
      system,
    });

    expect(firstResult.commandContract).toBe(LEVEL_MUSIC_COMMAND_CONTRACT);
    expect(secondResult.commandContract).toBe(LEVEL_MUSIC_COMMAND_CONTRACT);
    expect(firstResult.commandContract).toBe(secondResult.commandContract);
    expect(Object.isFrozen(LEVEL_MUSIC_COMMAND_CONTRACT)).toBe(true);
    expect(LEVEL_MUSIC_COMMAND_CONTRACT).toEqual({
      entryFile: LEVEL_MUSIC_ENTRY_FILE,
      runtimeCommand: LEVEL_MUSIC_RUNTIME_COMMAND,
    });
  });
});
