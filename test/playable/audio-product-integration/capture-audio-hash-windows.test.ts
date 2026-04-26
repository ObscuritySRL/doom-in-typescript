import { describe, expect, test } from 'bun:test';

import type { MusScore } from '../../../src/audio/musParser.ts';
import { AUDIO_HASH_WINDOW_SCHEMA_VERSION, MISSING_LIVE_AUDIO_AUDIT_STEP, PRODUCT_RUNTIME_COMMAND, captureAudioHashWindows } from '../../../src/playable/audio-product-integration/captureAudioHashWindows.ts';
import type { AudioHashWindow } from '../../../src/playable/audio-product-integration/captureAudioHashWindows.ts';

const SOURCE_PATH = 'src/playable/audio-product-integration/captureAudioHashWindows.ts';

const STUB_MUS_SCORE: Readonly<MusScore> = Object.freeze({
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
});

async function calculateSourceHash(): Promise<string> {
  return new Bun.CryptoHasher('sha256').update(await Bun.file(SOURCE_PATH).text()).digest('hex');
}

function createHashWindows(): readonly AudioHashWindow[] {
  return [
    {
      events: [
        {
          action: Object.freeze({ kind: 'set-volume', volume: 10 }),
          gameTic: 0,
          kind: 'music-device-action',
          scoreHash: null,
        },
        {
          gameTic: 1,
          kind: 'sound-effect-result',
          result: Object.freeze({
            cnum: 2,
            kind: 'started',
            pitch: 127,
            separation: 96,
            sfxId: 1,
            volume: 15,
          }),
        },
        {
          action: Object.freeze({ kind: 'pause-song' }),
          gameTic: 2,
          kind: 'music-device-action',
          scoreHash: null,
        },
        {
          gameTic: 3,
          kind: 'sound-effect-result',
          result: Object.freeze({ kind: 'inaudible' }),
        },
      ],
      firstGameTic: 0,
      lastGameTic: 34,
    },
    {
      events: [
        {
          action: Object.freeze({ kind: 'resume-song' }),
          gameTic: 35,
          kind: 'music-device-action',
          scoreHash: null,
        },
        {
          action: Object.freeze({ kind: 'stop-song', musicNum: 1 }),
          gameTic: 36,
          kind: 'music-device-action',
          scoreHash: null,
        },
        {
          gameTic: 37,
          kind: 'sound-effect-result',
          result: Object.freeze({ kind: 'no-channel' }),
        },
      ],
      firstGameTic: 35,
      lastGameTic: 69,
    },
  ];
}

describe('captureAudioHashWindows', () => {
  test('locks the command contract and missing-live-audio audit linkage', async () => {
    const manifestText = await Bun.file('plan_fps/manifests/01-011-audit-missing-live-audio.json').text();

    expect(AUDIO_HASH_WINDOW_SCHEMA_VERSION).toBe(1);
    expect(MISSING_LIVE_AUDIO_AUDIT_STEP).toBe('01-011');
    expect(PRODUCT_RUNTIME_COMMAND).toBe('bun run doom.ts');
    expect(manifestText).toContain('"name": "audio-hash-window-capture"');
    expect(manifestText).toContain('"runtimeCommand": "bun run doom.ts"');
  });

  test('captures exact deterministic audio hash windows', () => {
    const result = captureAudioHashWindows({
      runtimeCommand: PRODUCT_RUNTIME_COMMAND,
      windows: createHashWindows(),
    });

    expect(result).toEqual({
      captureHash: '13f2e649ec29549028b7e546a6f9921d9aab032ce0ccc0be5b01a367e131c374',
      captureSignature: 'audio-hash-window-schema=1|5199f32b712ba94e3453dc43b9b907fdcce303dffdfeb201103b6c59e3a425a8|01a04995d53d193875293833eb6d0dfd8ef7eb45a99e5f0e4c9983589c61e011',
      replayChecksum: 334685769,
      schemaVersion: 1,
      windows: [
        {
          eventCount: 4,
          firstGameTic: 0,
          lastGameTic: 34,
          windowHash: '5199f32b712ba94e3453dc43b9b907fdcce303dffdfeb201103b6c59e3a425a8',
          windowSignature: 'window:0-34:tic=0:music:set-volume:volume=10;tic=1:sound-effect:started:channel=2:pitch=127:separation=96:sound=1:volume=15;tic=2:music:pause-song;tic=3:sound-effect:inaudible',
        },
        {
          eventCount: 3,
          firstGameTic: 35,
          lastGameTic: 69,
          windowHash: '01a04995d53d193875293833eb6d0dfd8ef7eb45a99e5f0e4c9983589c61e011',
          windowSignature: 'window:35-69:tic=35:music:resume-song;tic=36:music:stop-song:music=1;tic=37:sound-effect:no-channel',
        },
      ],
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.windows)).toBe(true);
    expect(Object.isFrozen(result.windows[0])).toBe(true);
  });

  test('rejects non-product runtime commands before validating windows', () => {
    expect(() =>
      captureAudioHashWindows({
        runtimeCommand: 'bun run src/main.ts',
        windows: [
          {
            events: [],
            firstGameTic: 2,
            lastGameTic: 1,
          },
        ],
      }),
    ).toThrow('captureAudioHashWindows requires bun run doom.ts');
  });

  test('rejects events outside their hash window', () => {
    expect(() =>
      captureAudioHashWindows({
        runtimeCommand: PRODUCT_RUNTIME_COMMAND,
        windows: [
          {
            events: [
              {
                gameTic: 35,
                kind: 'sound-effect-result',
                result: Object.freeze({ kind: 'link-silenced' }),
              },
            ],
            firstGameTic: 0,
            lastGameTic: 34,
          },
        ],
      }),
    ).toThrow(RangeError);
  });

  test('captures play-song actions with a valid lowercase 64-character scoreHash', () => {
    const scoreHash = 'a'.repeat(64);

    const result = captureAudioHashWindows({
      runtimeCommand: PRODUCT_RUNTIME_COMMAND,
      windows: [
        {
          events: [
            {
              action: Object.freeze({ kind: 'play-song', looping: true, musicNum: 1, score: STUB_MUS_SCORE }),
              gameTic: 0,
              kind: 'music-device-action',
              scoreHash,
            },
          ],
          firstGameTic: 0,
          lastGameTic: 34,
        },
      ],
    });

    expect(result).toEqual({
      captureHash: '864a180df82fe958a7f9994521241235f8117b371ed40d3930a93eb6992618d0',
      captureSignature: 'audio-hash-window-schema=1|c19f48e20a86cd5b36ec7364386dae89837b40a911ce990bbf2ab94e224d94c7',
      replayChecksum: 2253002765,
      schemaVersion: 1,
      windows: [
        {
          eventCount: 1,
          firstGameTic: 0,
          lastGameTic: 34,
          windowHash: 'c19f48e20a86cd5b36ec7364386dae89837b40a911ce990bbf2ab94e224d94c7',
          windowSignature: `window:0-34:tic=0:music:play-song:looping=true:music=1:score=${scoreHash}`,
        },
      ],
    });
  });

  test('rejects play-song scoreHash that is null, uppercase, or wrong length', () => {
    const baseRequest = (scoreHash: string | null) => ({
      runtimeCommand: PRODUCT_RUNTIME_COMMAND,
      windows: [
        {
          events: [
            {
              action: Object.freeze({ kind: 'play-song', looping: false, musicNum: 1, score: STUB_MUS_SCORE }),
              gameTic: 0,
              kind: 'music-device-action' as const,
              scoreHash,
            },
          ],
          firstGameTic: 0,
          lastGameTic: 0,
        },
      ],
    });

    expect(() => captureAudioHashWindows(baseRequest(null))).toThrow(TypeError);
    expect(() => captureAudioHashWindows(baseRequest('A'.repeat(64)))).toThrow(TypeError);
    expect(() => captureAudioHashWindows(baseRequest('a'.repeat(63)))).toThrow(TypeError);
    expect(() => captureAudioHashWindows(baseRequest('z'.repeat(64)))).toThrow(TypeError);
  });

  test('rejects music numbers and music volumes outside their valid ranges', () => {
    const playSongOf = (musicNum: number) => ({
      runtimeCommand: PRODUCT_RUNTIME_COMMAND,
      windows: [
        {
          events: [
            {
              action: Object.freeze({ kind: 'play-song', looping: false, musicNum, score: STUB_MUS_SCORE }),
              gameTic: 0,
              kind: 'music-device-action' as const,
              scoreHash: 'a'.repeat(64),
            },
          ],
          firstGameTic: 0,
          lastGameTic: 0,
        },
      ],
    });

    const stopSongOf = (musicNum: number) => ({
      runtimeCommand: PRODUCT_RUNTIME_COMMAND,
      windows: [
        {
          events: [
            {
              action: Object.freeze({ kind: 'stop-song', musicNum }),
              gameTic: 0,
              kind: 'music-device-action' as const,
              scoreHash: null,
            },
          ],
          firstGameTic: 0,
          lastGameTic: 0,
        },
      ],
    });

    const setVolumeOf = (volume: number) => ({
      runtimeCommand: PRODUCT_RUNTIME_COMMAND,
      windows: [
        {
          events: [
            {
              action: Object.freeze({ kind: 'set-volume', volume }),
              gameTic: 0,
              kind: 'music-device-action' as const,
              scoreHash: null,
            },
          ],
          firstGameTic: 0,
          lastGameTic: 0,
        },
      ],
    });

    expect(() => captureAudioHashWindows(playSongOf(0))).toThrow(RangeError);
    expect(() => captureAudioHashWindows(playSongOf(68))).toThrow(RangeError);
    expect(() => captureAudioHashWindows(stopSongOf(0))).toThrow(RangeError);
    expect(() => captureAudioHashWindows(stopSongOf(68))).toThrow(RangeError);
    expect(() => captureAudioHashWindows(setVolumeOf(-1))).toThrow(RangeError);
    expect(() => captureAudioHashWindows(setVolumeOf(128))).toThrow(RangeError);
  });

  test('rejects negative or non-integer started result fields', () => {
    const startedOf = (overrides: Partial<{ cnum: number; pitch: number; separation: number; sfxId: number; volume: number }>) => ({
      runtimeCommand: PRODUCT_RUNTIME_COMMAND,
      windows: [
        {
          events: [
            {
              gameTic: 0,
              kind: 'sound-effect-result' as const,
              result: Object.freeze({
                cnum: overrides.cnum ?? 0,
                kind: 'started' as const,
                pitch: overrides.pitch ?? 0,
                separation: overrides.separation ?? 0,
                sfxId: overrides.sfxId ?? 1,
                volume: overrides.volume ?? 0,
              }),
            },
          ],
          firstGameTic: 0,
          lastGameTic: 0,
        },
      ],
    });

    expect(() => captureAudioHashWindows(startedOf({ cnum: -1 }))).toThrow(RangeError);
    expect(() => captureAudioHashWindows(startedOf({ pitch: 1.5 }))).toThrow(RangeError);
    expect(() => captureAudioHashWindows(startedOf({ separation: -10 }))).toThrow(RangeError);
    expect(() => captureAudioHashWindows(startedOf({ sfxId: Number.NaN }))).toThrow(RangeError);
    expect(() => captureAudioHashWindows(startedOf({ volume: -1 }))).toThrow(RangeError);
  });

  test('rejects window endpoints that are negative, non-integer, or inverted under a valid runtime command', () => {
    const oneWindow = (firstGameTic: number, lastGameTic: number) => ({
      runtimeCommand: PRODUCT_RUNTIME_COMMAND,
      windows: [
        {
          events: [],
          firstGameTic,
          lastGameTic,
        },
      ],
    });

    expect(() => captureAudioHashWindows(oneWindow(-1, 0))).toThrow(RangeError);
    expect(() => captureAudioHashWindows(oneWindow(0.5, 1))).toThrow(RangeError);
    expect(() => captureAudioHashWindows(oneWindow(2, 1))).toThrow(RangeError);
    expect(() => captureAudioHashWindows(oneWindow(0, Number.NaN))).toThrow(RangeError);
  });

  test('captures a deterministic empty result for an empty windows array', () => {
    const result = captureAudioHashWindows({
      runtimeCommand: PRODUCT_RUNTIME_COMMAND,
      windows: [],
    });

    expect(result).toEqual({
      captureHash: 'f698943a1da96ae0adc9329de4235dde19769a56f201dad561336438ae0e3795',
      captureSignature: 'audio-hash-window-schema=1|',
      replayChecksum: 4137194554,
      schemaVersion: 1,
      windows: [],
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.windows)).toBe(true);
  });

  test('locks the formatted implementation hash', async () => {
    expect(await calculateSourceHash()).toBe('c158497f6bd14eb49c2fb1f0818fdd4242d9205fc641f7366c8af2b6c3611a45');
  });
});
