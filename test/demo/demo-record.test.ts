import { describe, expect, it } from 'bun:test';

import { parseDemo } from '../../src/demo/demoParse.ts';
import { DEMO_RECORD_DEFAULT_MAXIMUM_SIZE, DEMO_RECORD_WRITE_HEADROOM, DemoRecorder } from '../../src/demo/demoRecord.ts';

const SINGLE_PLAYER_SLOTS = [true, false, false, false] as const;

describe('DemoRecorder constants', () => {
  it('locks the vanilla default maxdemo size to 0x20000 bytes', () => {
    expect(DEMO_RECORD_DEFAULT_MAXIMUM_SIZE).toBe(0x20_000);
  });

  it('locks the write headroom check to 16 bytes', () => {
    expect(DEMO_RECORD_WRITE_HEADROOM).toBe(16);
  });
});

describe('DemoRecorder header serialization', () => {
  it('records a vanilla 1.9 header and round-trips through parseDemo', () => {
    const recorder = new DemoRecorder({
      episode: 1,
      map: 5,
      playersInGame: SINGLE_PLAYER_SLOTS,
      skill: 2,
    });

    const recordedCommand = recorder.recordCommand({
      angleTurn: 0x1234,
      buttons: 0x56,
      chatCharacter: 0x7f,
      consistency: 0x2222,
      forwardMove: 25,
      sideMove: -24,
    });
    if (recordedCommand === null) {
      throw new Error('Expected first vanilla tic to be recorded');
    }

    expect(recordedCommand).toEqual({
      angleTurn: 0x1200,
      buttons: 0x56,
      forwardMove: 25,
      sideMove: -24,
    });

    const demoBuffer = recorder.finish();
    const parsedDemo = parseDemo(demoBuffer);

    expect(parsedDemo.format).toBe('vanilla');
    expect(parsedDemo.versionByte).toBe(109);
    expect(parsedDemo.skill).toBe(2);
    expect(parsedDemo.episode).toBe(1);
    expect(parsedDemo.map).toBe(5);
    expect(parsedDemo.playersInGame).toEqual(SINGLE_PLAYER_SLOTS);
    expect(parsedDemo.ticCount).toBe(1);
    expect(parsedDemo.commandsByTic[0]).toEqual([recordedCommand]);
    expect(demoBuffer.length).toBe(parsedDemo.headerByteLength + parsedDemo.commandByteLength + 1);
  });

  it('records old demos without a version byte or versioned flag fields', () => {
    const recorder = new DemoRecorder({
      episode: 1,
      format: 'old',
      map: 3,
      playersInGame: SINGLE_PLAYER_SLOTS,
      skill: 2,
    });

    recorder.recordCommand({
      angleTurn: 0x2000,
      buttons: 0x01,
      forwardMove: 10,
      sideMove: -10,
    });

    const parsedDemo = parseDemo(recorder.finish());
    expect(parsedDemo.format).toBe('old');
    expect(parsedDemo.versionByte).toBeNull();
    expect(parsedDemo.headerByteLength).toBe(7);
    expect(parsedDemo.deathmatch).toBe(0);
    expect(parsedDemo.respawnMonsters).toBe(0);
    expect(parsedDemo.fastMonsters).toBe(0);
    expect(parsedDemo.noMonsters).toBe(0);
    expect(parsedDemo.consolePlayer).toBe(0);
  });

  it('records longtics demos with the full signed 16-bit turn value', () => {
    const recorder = new DemoRecorder({
      episode: 1,
      format: 'longtics',
      map: 1,
      playersInGame: SINGLE_PLAYER_SLOTS,
      skill: 2,
    });

    const recordedCommand = recorder.recordCommand({
      angleTurn: -0x7fff,
      buttons: 0x10,
      forwardMove: 1,
      sideMove: 2,
    });
    if (recordedCommand === null) {
      throw new Error('Expected first longtics tic to be recorded');
    }

    const parsedDemo = parseDemo(recorder.finish());
    expect(recordedCommand).toEqual({
      angleTurn: -0x7fff,
      buttons: 0x10,
      forwardMove: 1,
      sideMove: 2,
    });
    expect(parsedDemo.format).toBe('longtics');
    expect(parsedDemo.versionByte).toBe(111);
    expect(parsedDemo.commandByteLength).toBe(5);
    expect(parsedDemo.commandsByTic[0]![0]).toEqual(recordedCommand);
  });
});

describe('DemoRecorder parity-sensitive recording rules', () => {
  it('carries low-resolution turn error across successive vanilla tics', () => {
    const recorder = new DemoRecorder({
      episode: 1,
      map: 1,
      playersInGame: SINGLE_PLAYER_SLOTS,
      skill: 2,
    });

    const firstCommand = recorder.recordCommand({
      angleTurn: 100,
      buttons: 0,
      forwardMove: 0,
      sideMove: 0,
    });
    const secondCommand = recorder.recordCommand({
      angleTurn: 100,
      buttons: 0,
      forwardMove: 0,
      sideMove: 0,
    });
    const thirdCommand = recorder.recordCommand({
      angleTurn: 100,
      buttons: 0,
      forwardMove: 0,
      sideMove: 0,
    });
    if (firstCommand === null || secondCommand === null || thirdCommand === null) {
      throw new Error('Expected all three vanilla tics to be recorded');
    }

    expect(firstCommand).toEqual({ angleTurn: 0, buttons: 0, forwardMove: 0, sideMove: 0 });
    expect(secondCommand).toEqual({ angleTurn: 0x0100, buttons: 0, forwardMove: 0, sideMove: 0 });
    expect(thirdCommand).toEqual({ angleTurn: 0, buttons: 0, forwardMove: 0, sideMove: 0 });

    const parsedDemo = parseDemo(recorder.finish());
    expect(parsedDemo.commandsByTic).toEqual([[firstCommand], [secondCommand], [thirdCommand]]);
  });

  it('stops recording before a tic when fewer than 16 bytes remain and the vanilla limit is enabled', () => {
    const recorder = new DemoRecorder({
      episode: 1,
      map: 1,
      maximumSize: 13 + DEMO_RECORD_WRITE_HEADROOM,
      playersInGame: SINGLE_PLAYER_SLOTS,
      skill: 2,
    });

    const firstCommand = recorder.recordCommand({
      angleTurn: 0,
      buttons: 1,
      forwardMove: 10,
      sideMove: 0,
    });
    const secondCommand = recorder.recordCommand({
      angleTurn: 0,
      buttons: 2,
      forwardMove: 20,
      sideMove: 0,
    });

    expect(firstCommand).not.toBeNull();
    expect(secondCommand).toBeNull();
    if (firstCommand === null) {
      throw new Error('Expected the first tic to fit within the vanilla demo buffer');
    }

    const parsedDemo = parseDemo(recorder.finish());
    expect(parsedDemo.ticCount).toBe(1);
    expect(parsedDemo.commandsByTic[0]).toEqual([firstCommand]);
  });

  it('doubles the buffer when the vanilla limit is disabled', () => {
    const recorder = new DemoRecorder({
      episode: 1,
      map: 1,
      maximumSize: 13 + DEMO_RECORD_WRITE_HEADROOM,
      playersInGame: SINGLE_PLAYER_SLOTS,
      skill: 2,
      vanillaDemoLimit: false,
    });

    recorder.recordCommand({
      angleTurn: 0,
      buttons: 1,
      forwardMove: 10,
      sideMove: 0,
    });
    const secondCommand = recorder.recordCommand({
      angleTurn: 0,
      buttons: 2,
      forwardMove: 20,
      sideMove: 0,
    });
    if (secondCommand === null) {
      throw new Error('Expected the buffer to grow for the second tic');
    }

    expect(recorder.maximumSize).toBe((13 + DEMO_RECORD_WRITE_HEADROOM) * 2);
    expect(secondCommand).toEqual({
      angleTurn: 0,
      buttons: 2,
      forwardMove: 20,
      sideMove: 0,
    });

    const parsedDemo = parseDemo(recorder.finish());
    expect(parsedDemo.ticCount).toBe(2);
    expect(parsedDemo.commandsByTic[1]).toEqual([secondCommand]);
  });
});

describe('DemoRecorder validation', () => {
  it('rejects versioned demos with ambiguous version bytes 0..4', () => {
    expect(
      () =>
        new DemoRecorder({
          episode: 1,
          map: 1,
          playersInGame: SINGLE_PLAYER_SLOTS,
          skill: 2,
          versionByte: 4,
        }),
    ).toThrow(/version byte > 4/);
  });

  it('rejects headers without exactly four player slots', () => {
    expect(
      () =>
        new DemoRecorder({
          episode: 1,
          map: 1,
          playersInGame: [true, false, false],
          skill: 2,
        }),
    ).toThrow(/exactly 4 player slots/);
  });

  it('rejects recording after finish has been called', () => {
    const recorder = new DemoRecorder({
      episode: 1,
      map: 1,
      playersInGame: SINGLE_PLAYER_SLOTS,
      skill: 2,
    });

    recorder.finish();

    expect(() =>
      recorder.recordCommand({
        angleTurn: 0,
        buttons: 0,
        forwardMove: 0,
        sideMove: 0,
      }),
    ).toThrow(/after finish/);
  });
});
