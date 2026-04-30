import { describe, expect, test } from 'bun:test';

import { NORM_PRIORITY, allocateChannel, createChannelTable } from '../../../src/audio/channels.ts';
import { DoomRandom } from '../../../src/core/rng.ts';
import { MENU_SOUND_DEFINITIONS, PLAY_MENU_SOUNDS_COMMAND_CONTRACT, playMenuSounds } from '../../../src/playable/audio-product-integration/playMenuSounds.ts';
import type { MenuSoundDispatchAction, MenuSoundEvent, PlayMenuSoundsEvidence } from '../../../src/playable/audio-product-integration/playMenuSounds.ts';

const sourcePath = 'src/playable/audio-product-integration/playMenuSounds.ts';
const missingLiveAudioManifestPath = 'plan_fps/manifests/01-011-audit-missing-live-audio.json';

const menuEvents: readonly MenuSoundEvent[] = [
  { kind: 'open', menuDepth: 0, tic: 0 },
  { kind: 'move', menuDepth: 1, tic: 1 },
  { kind: 'adjust', menuDepth: 1, tic: 2 },
  { kind: 'activate', menuDepth: 2, tic: 3 },
  { kind: 'close', menuDepth: 0, tic: 4 },
];

const expectedDispatchActions: MenuSoundDispatchAction[] = [
  {
    channel: 0,
    eventKind: 'open',
    menuDepth: 0,
    pitch: 136,
    separation: 128,
    soundEffectId: 23,
    tic: 0,
    volume: 15,
  },
  {
    channel: 1,
    eventKind: 'move',
    menuDepth: 1,
    pitch: 131,
    separation: 128,
    soundEffectId: 19,
    tic: 1,
    volume: 15,
  },
  {
    channel: 2,
    eventKind: 'adjust',
    menuDepth: 1,
    pitch: 116,
    separation: 128,
    soundEffectId: 22,
    tic: 2,
    volume: 15,
  },
  {
    channel: 3,
    eventKind: 'activate',
    menuDepth: 2,
    pitch: 114,
    separation: 128,
    soundEffectId: 1,
    tic: 3,
    volume: 15,
  },
  {
    channel: 4,
    eventKind: 'close',
    menuDepth: 0,
    pitch: 127,
    separation: 128,
    soundEffectId: 24,
    tic: 4,
    volume: 15,
  },
];

const expectedEvidence: PlayMenuSoundsEvidence = {
  command: PLAY_MENU_SOUNDS_COMMAND_CONTRACT,
  dispatchActions: expectedDispatchActions,
  dropActions: [],
  eventCount: 5,
  eventSignatures: ['started:0:open:0:23:0:15:128:136', 'started:1:move:1:19:1:15:128:131', 'started:2:adjust:1:22:2:15:128:116', 'started:3:activate:2:1:3:15:128:114', 'started:4:close:0:24:4:15:128:127'],
  musicActions: [],
  replayChecksum: 2_945_181_293,
};

describe('playMenuSounds', () => {
  test('locks the Bun command contract and missing-live-audio manifest link', async () => {
    const manifestText = await Bun.file(missingLiveAudioManifestPath).text();

    expect(PLAY_MENU_SOUNDS_COMMAND_CONTRACT).toBe('bun run doom.ts');
    expect(manifestText).toContain('"schemaVersion": 1');
    expect(manifestText).toContain('"runtimeCommand": "bun run doom.ts"');
    expect(manifestText).toContain('"name": "menu-sound-events"');
    expect(manifestText).toContain('"id": "01-011"');
  });

  test('locks the formatted source hash', async () => {
    expect(await sha256File(sourcePath)).toBe('1821c010f3d1b94eea7c56572001ac6384c6c1a722eeee82c4f208de7c13fe79');
  });

  test('returns deterministic handle-free replay evidence for menu sounds', () => {
    const dispatchedActions: MenuSoundDispatchAction[] = [];
    const evidence = playMenuSounds({
      dispatchStartedSound: (action) => {
        dispatchedActions.push(action);
      },
      events: menuEvents,
      rng: new DoomRandom(),
      runtimeCommand: PLAY_MENU_SOUNDS_COMMAND_CONTRACT,
      soundEffectVolume: 15,
      table: createChannelTable(),
    });

    expect(dispatchedActions).toEqual(expectedDispatchActions);
    expect(evidence).toEqual(expectedEvidence);
    expect(Object.isFrozen(evidence)).toBe(true);
    expect(Object.isFrozen(evidence.dispatchActions)).toBe(true);
    expect(Object.isFrozen(evidence.dropActions)).toBe(true);
    expect(Object.isFrozen(evidence.eventSignatures)).toBe(true);
    expect(Object.isFrozen(evidence.musicActions)).toBe(true);
    expect(JSON.stringify(evidence)).not.toContain('handle');
  });

  test('rejects non-product commands before mutating channels or dispatching', () => {
    const dispatchedActions: MenuSoundDispatchAction[] = [];
    const table = createChannelTable();
    const beforeTable = JSON.stringify(table);

    expect(() =>
      playMenuSounds({
        dispatchStartedSound: (action) => {
          dispatchedActions.push(action);
        },
        events: menuEvents,
        rng: new DoomRandom(),
        runtimeCommand: 'bun run src/main.ts',
        soundEffectVolume: 15,
        table,
      }),
    ).toThrow('playMenuSounds requires runtime command bun run doom.ts');

    expect(dispatchedActions).toEqual([]);
    expect(JSON.stringify(table)).toBe(beforeTable);
  });

  test('prevalidates all menu events before mutating channels', () => {
    const dispatchedActions: MenuSoundDispatchAction[] = [];
    const table = createChannelTable();
    const beforeTable = JSON.stringify(table);

    expect(() =>
      playMenuSounds({
        dispatchStartedSound: (action) => {
          dispatchedActions.push(action);
        },
        events: [
          { kind: 'open', menuDepth: 0, tic: 0 },
          { kind: 'close', menuDepth: -1, tic: 1 },
        ],
        rng: new DoomRandom(),
        runtimeCommand: PLAY_MENU_SOUNDS_COMMAND_CONTRACT,
        soundEffectVolume: 15,
        table,
      }),
    ).toThrow('menuDepth must be a non-negative integer, got -1');

    expect(dispatchedActions).toEqual([]);
    expect(JSON.stringify(table)).toBe(beforeTable);
  });

  test('locks the menu sound definition table that maps event kinds to vanilla sfx ids', () => {
    expect(MENU_SOUND_DEFINITIONS).toEqual({
      activate: { pitchClass: 'default', priority: NORM_PRIORITY, soundEffectId: 1 },
      adjust: { pitchClass: 'default', priority: NORM_PRIORITY, soundEffectId: 22 },
      back: { pitchClass: 'default', priority: NORM_PRIORITY, soundEffectId: 23 },
      close: { pitchClass: 'default', priority: NORM_PRIORITY, soundEffectId: 24 },
      move: { pitchClass: 'default', priority: NORM_PRIORITY, soundEffectId: 19 },
      open: { pitchClass: 'default', priority: NORM_PRIORITY, soundEffectId: 23 },
    });
    expect(Object.isFrozen(MENU_SOUND_DEFINITIONS)).toBe(true);
    for (const definition of Object.values(MENU_SOUND_DEFINITIONS)) {
      expect(Object.isFrozen(definition)).toBe(true);
    }
  });

  test('returns zero-event evidence for an empty events array without mutating the channel table', () => {
    const table = createChannelTable();
    const beforeTable = JSON.stringify(table);

    const evidence = playMenuSounds({
      events: [],
      rng: new DoomRandom(),
      runtimeCommand: PLAY_MENU_SOUNDS_COMMAND_CONTRACT,
      soundEffectVolume: 15,
      table,
    });

    expect(evidence.eventCount).toBe(0);
    expect(evidence.dispatchActions).toEqual([]);
    expect(evidence.dropActions).toEqual([]);
    expect(evidence.eventSignatures).toEqual([]);
    expect(evidence.musicActions).toEqual([]);
    expect(evidence.command).toBe(PLAY_MENU_SOUNDS_COMMAND_CONTRACT);
    expect(JSON.stringify(table)).toBe(beforeTable);
  });

  test('runs the dispatch loop without a dispatchStartedSound callback and still records evidence', () => {
    const evidence = playMenuSounds({
      events: menuEvents,
      rng: new DoomRandom(),
      runtimeCommand: PLAY_MENU_SOUNDS_COMMAND_CONTRACT,
      soundEffectVolume: 15,
      table: createChannelTable(),
    });

    expect(evidence).toEqual(expectedEvidence);
  });

  test('records dropped events when every channel slot holds a strictly more important sound', () => {
    const table = createChannelTable();
    for (let cnum = 0; cnum < table.capacity; cnum += 1) {
      const allocatedCnum = allocateChannel(table, { origin: cnum + 1, sfxId: 7, priority: 0 });
      expect(allocatedCnum).toBe(cnum);
    }

    const evidence = playMenuSounds({
      events: [
        { kind: 'open', menuDepth: 0, tic: 0 },
        { kind: 'move', menuDepth: 1, tic: 1 },
      ],
      rng: new DoomRandom(),
      runtimeCommand: PLAY_MENU_SOUNDS_COMMAND_CONTRACT,
      soundEffectVolume: 15,
      table,
    });

    expect(evidence.dispatchActions).toEqual([]);
    expect(evidence.dropActions).toEqual([
      { eventKind: 'open', menuDepth: 0, reason: 'no-channel', tic: 0 },
      { eventKind: 'move', menuDepth: 1, reason: 'no-channel', tic: 1 },
    ]);
    expect(evidence.eventSignatures).toEqual(['dropped:0:open:0:no-channel', 'dropped:1:move:1:no-channel']);
    expect(evidence.eventCount).toBe(2);
  });

  test('rejects an unknown menu sound event kind before mutating channels', () => {
    const table = createChannelTable();
    const beforeTable = JSON.stringify(table);

    expect(() =>
      playMenuSounds({
        events: [{ kind: 'unknown' as MenuSoundEvent['kind'], menuDepth: 0, tic: 0 }],
        rng: new DoomRandom(),
        runtimeCommand: PLAY_MENU_SOUNDS_COMMAND_CONTRACT,
        soundEffectVolume: 15,
        table,
      }),
    ).toThrow('unknown menu sound event kind: unknown');
    expect(JSON.stringify(table)).toBe(beforeTable);
  });

  test('rejects a non-integer tic before mutating channels', () => {
    const table = createChannelTable();
    const beforeTable = JSON.stringify(table);

    expect(() =>
      playMenuSounds({
        events: [{ kind: 'open', menuDepth: 0, tic: 1.5 }],
        rng: new DoomRandom(),
        runtimeCommand: PLAY_MENU_SOUNDS_COMMAND_CONTRACT,
        soundEffectVolume: 15,
        table,
      }),
    ).toThrow('tic must be a non-negative integer, got 1.5');
    expect(JSON.stringify(table)).toBe(beforeTable);
  });

  test('rejects a non-integer or out-of-range soundEffectVolume before iterating events', () => {
    const table = createChannelTable();

    expect(() =>
      playMenuSounds({
        events: [],
        rng: new DoomRandom(),
        runtimeCommand: PLAY_MENU_SOUNDS_COMMAND_CONTRACT,
        soundEffectVolume: 16,
        table,
      }),
    ).toThrow('soundEffectVolume must be an integer in [0, 15], got 16');

    expect(() =>
      playMenuSounds({
        events: [],
        rng: new DoomRandom(),
        runtimeCommand: PLAY_MENU_SOUNDS_COMMAND_CONTRACT,
        soundEffectVolume: -1,
        table,
      }),
    ).toThrow('soundEffectVolume must be an integer in [0, 15], got -1');

    expect(() =>
      playMenuSounds({
        events: [],
        rng: new DoomRandom(),
        runtimeCommand: PLAY_MENU_SOUNDS_COMMAND_CONTRACT,
        soundEffectVolume: 7.5,
        table,
      }),
    ).toThrow('soundEffectVolume must be an integer in [0, 15], got 7.5');
  });
});

async function sha256File(path: string): Promise<string> {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(await Bun.file(path).text());
  return hasher.digest('hex');
}
