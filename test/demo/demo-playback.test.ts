import { describe, expect, it } from 'bun:test';

import { parseDemo } from '../../src/demo/demoParse.ts';
import { DemoPlayback, DEMO_PLAYBACK_DEFAULT_VERSION } from '../../src/demo/demoPlayback.ts';
import { DemoRecorder } from '../../src/demo/demoRecord.ts';
import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import { LumpLookup } from '../../src/wad/lumpLookup.ts';

const SINGLE_PLAYER_SLOTS = [true, false, false, false] as const;
const REFERENCE_WAD_PATH = `${REFERENCE_BUNDLE_PATH}\\${PRIMARY_TARGET.wadFilename}`;
const REFERENCE_WAD_BUFFER = Buffer.from(await Bun.file(REFERENCE_WAD_PATH).arrayBuffer());
const REFERENCE_WAD_DIRECTORY = parseWadDirectory(REFERENCE_WAD_BUFFER, parseWadHeader(REFERENCE_WAD_BUFFER));
const REFERENCE_WAD_LOOKUP = new LumpLookup(REFERENCE_WAD_DIRECTORY);

function getReferenceDemoLump(name: 'DEMO1' | 'DEMO2' | 'DEMO3'): Buffer {
  return REFERENCE_WAD_LOOKUP.getLumpData(name, REFERENCE_WAD_BUFFER);
}

function createSingleTicDemoBuffer(
  options: {
    readonly allowOldFormat?: boolean;
    readonly format?: 'longtics' | 'old' | 'vanilla';
    readonly playersInGame?: readonly boolean[];
    readonly versionByte?: number;
  } = {},
): Buffer {
  const recorder = new DemoRecorder({
    episode: 1,
    format: options.format,
    map: 1,
    playersInGame: options.playersInGame ?? SINGLE_PLAYER_SLOTS,
    skill: 2,
    versionByte: options.versionByte,
  });

  const recordedCommand = recorder.recordCommand({
    angleTurn: options.format === 'longtics' ? -0x1234 : 0x1234,
    buttons: 0x56,
    forwardMove: 25,
    sideMove: -24,
  });

  if (recordedCommand === null) {
    throw new Error('Expected the first demo tic to fit in the recorder buffer');
  }

  return recorder.finish();
}

function createVersionedDemoBuffer(options: {
  readonly firstCommand: {
    readonly angleByte: number;
    readonly buttons: number;
    readonly forwardMove: number;
    readonly sideMove: number;
  };
  readonly playersInGame: readonly boolean[];
  readonly secondCommand?: {
    readonly angleByte: number;
    readonly buttons: number;
    readonly forwardMove: number;
    readonly sideMove: number;
  };
  readonly versionByte?: number;
}): Buffer {
  const activePlayerCount = options.playersInGame.filter(Boolean).length;
  const buffer = Buffer.alloc(13 + activePlayerCount * 4 + 1);
  let offset = 0;

  buffer[offset++] = options.versionByte ?? 109;
  buffer[offset++] = 2;
  buffer[offset++] = 1;
  buffer[offset++] = 1;
  buffer[offset++] = 0;
  buffer[offset++] = 0;
  buffer[offset++] = 0;
  buffer[offset++] = 0;
  buffer[offset++] = 0;

  for (let playerIndex = 0; playerIndex < 4; playerIndex++) {
    buffer[offset++] = options.playersInGame[playerIndex] ? 1 : 0;
  }

  buffer.writeInt8(options.firstCommand.forwardMove, offset++);
  buffer.writeInt8(options.firstCommand.sideMove, offset++);
  buffer[offset++] = options.firstCommand.angleByte;
  buffer[offset++] = options.firstCommand.buttons;

  if (options.secondCommand !== undefined) {
    buffer.writeInt8(options.secondCommand.forwardMove, offset++);
    buffer.writeInt8(options.secondCommand.sideMove, offset++);
    buffer[offset++] = options.secondCommand.angleByte;
    buffer[offset++] = options.secondCommand.buttons;
  }

  buffer[offset++] = 0x80;
  return buffer.subarray(0, offset);
}

describe('DemoPlayback constants', () => {
  it('locks the default expected version byte to Doom 1.9', () => {
    expect(DEMO_PLAYBACK_DEFAULT_VERSION).toBe(109);
  });
});

describe('DemoPlayback bundled-demo sequencing', () => {
  it('streams every DEMO3 tic in order and only finishes on the marker read', () => {
    const demoBuffer = getReferenceDemoLump('DEMO3');
    const parsedDemo = parseDemo(demoBuffer);
    const playback = new DemoPlayback(demoBuffer);

    const initialSnapshot = playback.snapshot();
    expect(initialSnapshot.demoplayback).toBe(true);
    expect(initialSnapshot.completionAction).toBe('none');
    expect(initialSnapshot.netDemo).toBe(false);
    expect(initialSnapshot.netGame).toBe(false);
    expect(initialSnapshot.playersInGame).toEqual(SINGLE_PLAYER_SLOTS);
    expect(Object.isFrozen(initialSnapshot)).toBe(true);
    expect(Object.isFrozen(initialSnapshot.playersInGame)).toBe(true);

    for (let ticIndex = 0; ticIndex < parsedDemo.ticCount; ticIndex++) {
      expect(playback.readNextTic()).toEqual(parsedDemo.commandsByTic[ticIndex]);
    }

    const beforeMarkerSnapshot = playback.snapshot();
    expect(beforeMarkerSnapshot.demoplayback).toBe(true);
    expect(beforeMarkerSnapshot.completionAction).toBe('none');
    expect(beforeMarkerSnapshot.ticIndex).toBe(parsedDemo.ticCount);

    expect(playback.readNextTic()).toBeNull();

    const finishedSnapshot = playback.snapshot();
    expect(finishedSnapshot.demoplayback).toBe(false);
    expect(finishedSnapshot.completionAction).toBe('advance-demo');
    expect(finishedSnapshot.consolePlayer).toBe(0);
    expect(finishedSnapshot.deathmatch).toBe(0);
    expect(finishedSnapshot.fastMonsters).toBe(0);
    expect(finishedSnapshot.noMonsters).toBe(0);
    expect(finishedSnapshot.respawnMonsters).toBe(0);
    expect(finishedSnapshot.netDemo).toBe(false);
    expect(finishedSnapshot.netGame).toBe(false);
    expect(finishedSnapshot.playersInGame).toEqual(SINGLE_PLAYER_SLOTS);
    expect(playback.readNextTic()).toBeNull();
  });
});

describe('DemoPlayback net-demo flags', () => {
  it('treats player slot 1 as the load-bearing netgame trigger', () => {
    const noSecondPlayerPlayback = new DemoPlayback(
      createVersionedDemoBuffer({
        firstCommand: {
          angleByte: 0x12,
          buttons: 0x34,
          forwardMove: 10,
          sideMove: -10,
        },
        playersInGame: [true, false, true, false],
        secondCommand: {
          angleByte: 0x56,
          buttons: 0x78,
          forwardMove: 20,
          sideMove: -20,
        },
      }),
    );

    const secondPlayerPlayback = new DemoPlayback(
      createVersionedDemoBuffer({
        firstCommand: {
          angleByte: 0x12,
          buttons: 0x34,
          forwardMove: 10,
          sideMove: -10,
        },
        playersInGame: [true, true, false, false],
        secondCommand: {
          angleByte: 0x56,
          buttons: 0x78,
          forwardMove: 20,
          sideMove: -20,
        },
      }),
    );

    expect(noSecondPlayerPlayback.snapshot().netDemo).toBe(false);
    expect(noSecondPlayerPlayback.snapshot().netGame).toBe(false);
    expect(secondPlayerPlayback.snapshot().netDemo).toBe(true);
    expect(secondPlayerPlayback.snapshot().netGame).toBe(true);
  });

  it('forces netdemo/netgame when solo-net or netdemo playback is requested', () => {
    const demoBuffer = createSingleTicDemoBuffer();

    const soloNetPlayback = new DemoPlayback(demoBuffer, { soloNet: true });
    const netDemoPlayback = new DemoPlayback(demoBuffer, { netDemo: true });

    expect(soloNetPlayback.snapshot().netDemo).toBe(true);
    expect(soloNetPlayback.snapshot().netGame).toBe(true);
    expect(netDemoPlayback.snapshot().netDemo).toBe(true);
    expect(netDemoPlayback.snapshot().netGame).toBe(true);
  });
});

describe('DemoPlayback completion behavior', () => {
  it('quits instead of advancing when singledemo playback is enabled', () => {
    const playback = new DemoPlayback(createSingleTicDemoBuffer(), { singleDemo: true });

    expect(playback.readNextTic()).not.toBeNull();
    expect(playback.snapshot().completionAction).toBe('none');
    expect(playback.readNextTic()).toBeNull();
    expect(playback.snapshot().completionAction).toBe('quit');
  });
});

describe('DemoPlayback version validation', () => {
  it('rejects versioned demos whose version byte does not match the expected version', () => {
    const demoBuffer = createSingleTicDemoBuffer({ versionByte: 108 });

    expect(() => new DemoPlayback(demoBuffer)).toThrow(/does not match expected 109/);
  });

  it('rejects longtics playback when the extension is disabled', () => {
    const demoBuffer = createSingleTicDemoBuffer({ format: 'longtics' });

    expect(() => new DemoPlayback(demoBuffer, { allowLongTics: false })).toThrow(/longtics playback support/);
  });

  it('rejects old demos by default but accepts them when old-format playback is enabled', () => {
    const oldDemoBuffer = createSingleTicDemoBuffer({ format: 'old' });

    expect(() => new DemoPlayback(oldDemoBuffer)).toThrow(/does not match expected 109/);
    expect(() => new DemoPlayback(oldDemoBuffer, { allowOldFormat: true })).not.toThrow();
  });
});
