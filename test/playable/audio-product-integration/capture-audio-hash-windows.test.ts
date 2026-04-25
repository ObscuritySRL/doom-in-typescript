import { describe, expect, test } from 'bun:test';

import { AUDIO_HASH_WINDOW_SCHEMA_VERSION, MISSING_LIVE_AUDIO_AUDIT_STEP, PRODUCT_RUNTIME_COMMAND, captureAudioHashWindows } from '../../../src/playable/audio-product-integration/captureAudioHashWindows.ts';
import type { AudioHashWindow } from '../../../src/playable/audio-product-integration/captureAudioHashWindows.ts';

const SOURCE_PATH = 'src/playable/audio-product-integration/captureAudioHashWindows.ts';

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

  test('locks the formatted implementation hash', async () => {
    expect(await calculateSourceHash()).toBe('c158497f6bd14eb49c2fb1f0818fdd4242d9205fc641f7366c8af2b6c3611a45');
  });
});
