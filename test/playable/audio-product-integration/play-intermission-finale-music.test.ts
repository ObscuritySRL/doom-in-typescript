import { describe, expect, test } from 'bun:test';

import { Buffer } from 'node:buffer';

import type { MusicDeviceAction } from '../../../src/audio/musicSystem.ts';
import { createMusicSystem } from '../../../src/audio/musicSystem.ts';
import { parseMusScore } from '../../../src/audio/musParser.ts';
import {
  FINALE_BUNNY_MUSIC_NUMBER,
  FINALE_VICTORY_MUSIC_NUMBER,
  INTERMISSION_MUSIC_NUMBER,
  PLAY_INTERMISSION_FINALE_MUSIC_AUDIT_STEP_ID,
  PLAY_INTERMISSION_FINALE_MUSIC_RUNTIME_COMMAND,
  playIntermissionFinaleMusic,
  resolveIntermissionFinaleMusicRoute,
} from '../../../src/playable/audio-product-integration/playIntermissionFinaleMusic.ts';

const SOURCE_FILE_PATH = new URL('../../../src/playable/audio-product-integration/playIntermissionFinaleMusic.ts', import.meta.url);
const EXPECTED_SOURCE_SHA256 = '6e0681c8efc44438c062ad32dfee1ca23eebe37dd9860dc674478080912c794d';

function createMinimalScore() {
  return parseMusScore(
    Buffer.from([
      0x4d,
      0x55,
      0x53,
      0x1a, // MUS<EOF>
      0x01,
      0x00, // score length
      0x10,
      0x00, // score start
      0x01,
      0x00, // primary channels
      0x00,
      0x00, // secondary channels
      0x00,
      0x00, // instrument count
      0x00,
      0x00, // dummy
      0x60, // score end
    ]),
  );
}

async function sha256File(filePath: URL): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await Bun.file(filePath).arrayBuffer());
  let hexadecimalDigest = '';
  for (const byte of new Uint8Array(digest)) {
    hexadecimalDigest += byte.toString(16).padStart(2, '0');
  }
  return hexadecimalDigest;
}

describe('playIntermissionFinaleMusic', () => {
  test('locks command contract, audit linkage, route constants, and source hash', async () => {
    expect(PLAY_INTERMISSION_FINALE_MUSIC_RUNTIME_COMMAND).toBe('bun run doom.ts');
    expect(PLAY_INTERMISSION_FINALE_MUSIC_AUDIT_STEP_ID).toBe('01-011');
    expect(resolveIntermissionFinaleMusicRoute('finale-bunny')).toEqual({
      looping: true,
      musicLumpName: 'D_BUNNY',
      musicNumber: FINALE_BUNNY_MUSIC_NUMBER,
      scene: 'finale-bunny',
    });
    expect(resolveIntermissionFinaleMusicRoute('finale-victory')).toEqual({
      looping: true,
      musicLumpName: 'D_VICTOR',
      musicNumber: FINALE_VICTORY_MUSIC_NUMBER,
      scene: 'finale-victory',
    });
    expect(resolveIntermissionFinaleMusicRoute('intermission')).toEqual({
      looping: true,
      musicLumpName: 'D_INTER',
      musicNumber: INTERMISSION_MUSIC_NUMBER,
      scene: 'intermission',
    });
    expect(await sha256File(SOURCE_FILE_PATH)).toBe(EXPECTED_SOURCE_SHA256);
  });

  test('plays intermission music with deterministic handle-free evidence', () => {
    const dispatchedActions: MusicDeviceAction[] = [];
    const score = createMinimalScore();
    const system = createMusicSystem();

    const evidence = playIntermissionFinaleMusic({
      dispatchMusicDeviceAction: (action) => {
        dispatchedActions.push(action);
      },
      runtimeCommand: PLAY_INTERMISSION_FINALE_MUSIC_RUNTIME_COMMAND,
      scene: 'intermission',
      score,
      system,
    });

    expect(evidence).toEqual({
      actionSignatures: ['play-song:28:looping'],
      auditStepId: '01-011',
      currentMusicNumber: 28,
      dispatchedActionCount: 1,
      handleFree: true,
      looping: true,
      musicLumpName: 'D_INTER',
      musicNumber: 28,
      paused: false,
      replayChecksum: 1_181_899_283,
      runtimeCommand: 'bun run doom.ts',
      scene: 'intermission',
      transitionSignature: 'scene=intermission|lump=D_INTER|music=28|looping=looping|actions=play-song:28:looping|current=28|paused=false',
    });
    expect(dispatchedActions).toEqual([
      {
        kind: 'play-song',
        looping: true,
        musicNum: 28,
        score,
      },
    ]);
    expect(Object.isFrozen(evidence)).toBe(true);
    expect(Object.isFrozen(evidence.actionSignatures)).toBe(true);
    expect(system.currentMusicNum).toBe(28);
  });

  test('transitions from intermission to finale victory music in vanilla order', () => {
    const dispatchedActions: MusicDeviceAction[] = [];
    const score = createMinimalScore();
    const system = createMusicSystem();

    playIntermissionFinaleMusic({
      runtimeCommand: PLAY_INTERMISSION_FINALE_MUSIC_RUNTIME_COMMAND,
      scene: 'intermission',
      score,
      system,
    });
    const evidence = playIntermissionFinaleMusic({
      dispatchMusicDeviceAction: (action) => {
        dispatchedActions.push(action);
      },
      runtimeCommand: PLAY_INTERMISSION_FINALE_MUSIC_RUNTIME_COMMAND,
      scene: 'finale-victory',
      score,
      system,
    });

    expect(evidence.actionSignatures).toEqual(['stop-song:28', 'play-song:31:looping']);
    expect(evidence.replayChecksum).toBe(3_957_481_178);
    expect(evidence.transitionSignature).toBe('scene=finale-victory|lump=D_VICTOR|music=31|looping=looping|actions=stop-song:28,play-song:31:looping|current=31|paused=false');
    expect(dispatchedActions.map((action) => action.kind)).toEqual(['stop-song', 'play-song']);
    expect(system.currentMusicNum).toBe(31);
  });

  test('keeps repeat finale bunny playback as a deterministic no-op', () => {
    const dispatchedActions: MusicDeviceAction[] = [];
    const score = createMinimalScore();
    const system = createMusicSystem();

    playIntermissionFinaleMusic({
      runtimeCommand: PLAY_INTERMISSION_FINALE_MUSIC_RUNTIME_COMMAND,
      scene: 'finale-bunny',
      score,
      system,
    });
    const evidence = playIntermissionFinaleMusic({
      dispatchMusicDeviceAction: (action) => {
        dispatchedActions.push(action);
      },
      runtimeCommand: PLAY_INTERMISSION_FINALE_MUSIC_RUNTIME_COMMAND,
      scene: 'finale-bunny',
      score,
      system,
    });

    expect(evidence).toMatchObject({
      actionSignatures: [],
      currentMusicNumber: 30,
      dispatchedActionCount: 0,
      musicLumpName: 'D_BUNNY',
      musicNumber: 30,
      replayChecksum: 2_804_529_359,
      scene: 'finale-bunny',
      transitionSignature: 'scene=finale-bunny|lump=D_BUNNY|music=30|looping=looping|actions=|current=30|paused=false',
    });
    expect(dispatchedActions).toEqual([]);
  });

  test('rejects non-product runtime commands before mutation or dispatch', () => {
    const dispatchedActions: MusicDeviceAction[] = [];
    const score = createMinimalScore();
    const system = createMusicSystem();

    expect(() =>
      playIntermissionFinaleMusic({
        dispatchMusicDeviceAction: (action) => {
          dispatchedActions.push(action);
        },
        runtimeCommand: 'bun run src/main.ts',
        scene: 'intermission',
        score,
        system,
      }),
    ).toThrow('playIntermissionFinaleMusic requires bun run doom.ts');

    expect(dispatchedActions).toEqual([]);
    expect(system.currentMusicNum).toBeNull();
  });
});
