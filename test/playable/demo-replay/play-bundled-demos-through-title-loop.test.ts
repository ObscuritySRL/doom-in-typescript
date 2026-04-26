import { describe, expect, test } from 'bun:test';

import type { DemoPlayback, DemoPlaybackSnapshot } from '../../../src/demo/demoPlayback.ts';
import type { BundledDemoPlaybackSource } from '../../../src/playable/demo-replay/playBundledDemosThroughTitleLoop.ts';

import { EMPTY_DEMO_PLAYBACK_SCRIPT, EMPTY_TITLE_LOOP_SCRIPT } from '../../../src/oracles/inputScript.ts';
import { BUNDLED_DEMO_LUMP_NAMES, PLAY_BUNDLED_DEMOS_COMMAND_CONTRACT, playBundledDemosThroughTitleLoop } from '../../../src/playable/demo-replay/playBundledDemosThroughTitleLoop.ts';

const EXPECTED_REPLAY_HASH = 'ff621ab36df8129f3d7d97aa0603c111dcdae0da6afaaf165ba1aceac43071bc';
const EXPECTED_SOURCE_SHA256 = '37d3604431c91c13a055c22b1937b706e82f62cb64e46d5ffde471620c9780f3';
const SOURCE_PATH = 'src/playable/demo-replay/playBundledDemosThroughTitleLoop.ts';

describe('playBundledDemosThroughTitleLoop', () => {
  test('locks the runtime command contract and audit manifest linkage', async () => {
    const sourceText = await Bun.file(SOURCE_PATH).text();
    const sourceHasher = new Bun.CryptoHasher('sha256');
    sourceHasher.update(sourceText);
    const auditManifest = await Bun.file('plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json').json();

    expect(PLAY_BUNDLED_DEMOS_COMMAND_CONTRACT).toEqual({
      entryFile: 'doom.ts',
      runtimeCommand: 'bun run doom.ts',
    });
    expect(sourceHasher.digest('hex')).toBe(EXPECTED_SOURCE_SHA256);
    expect(auditManifest.schemaVersion).toBe(1);
    expect(auditManifest.stepId).toBe('01-015');
    expect(auditManifest.targetReplayContract).toEqual({
      acceptanceMode: 'side-by-side-verifiable replay parity',
      currentVisibility: 'missing in allowed launch-surface files',
      requiredCommand: 'bun run doom.ts',
    });
  });

  test('plays DEMO1 through DEMO3 through one title-loop pass', () => {
    const result = playBundledDemosThroughTitleLoop({
      demoSources: createDemoSources([2, 3, 4]),
      runtimeCommand: PLAY_BUNDLED_DEMOS_COMMAND_CONTRACT.runtimeCommand,
    });

    expect(result).toEqual({
      completionActions: ['advance-demo', 'advance-demo', 'advance-demo'],
      deterministicReplayHash: EXPECTED_REPLAY_HASH,
      inputScriptDescriptions: [EMPTY_TITLE_LOOP_SCRIPT.description, EMPTY_DEMO_PLAYBACK_SCRIPT.description],
      runtimeCommand: 'bun run doom.ts',
      targetReplayContract: {
        acceptanceMode: 'side-by-side-verifiable replay parity',
        requiredCommand: 'bun run doom.ts',
        sourceAuditStepId: '01-015',
      },
      ticRateHz: 35,
      totalDemoTics: 9,
      transitions: [
        {
          action: 'show-title-page',
          demoIndex: -1,
          lumpName: 'TITLEPIC',
          scriptDescription: EMPTY_TITLE_LOOP_SCRIPT.description,
          ticCount: 0,
        },
        {
          action: 'start-demo',
          demoIndex: 0,
          lumpName: 'DEMO1',
          scriptDescription: EMPTY_DEMO_PLAYBACK_SCRIPT.description,
          ticCount: 0,
        },
        {
          action: 'advance-demo',
          demoIndex: 0,
          lumpName: 'DEMO1',
          scriptDescription: EMPTY_DEMO_PLAYBACK_SCRIPT.description,
          ticCount: 2,
        },
        {
          action: 'start-demo',
          demoIndex: 1,
          lumpName: 'DEMO2',
          scriptDescription: EMPTY_DEMO_PLAYBACK_SCRIPT.description,
          ticCount: 0,
        },
        {
          action: 'advance-demo',
          demoIndex: 1,
          lumpName: 'DEMO2',
          scriptDescription: EMPTY_DEMO_PLAYBACK_SCRIPT.description,
          ticCount: 3,
        },
        {
          action: 'start-demo',
          demoIndex: 2,
          lumpName: 'DEMO3',
          scriptDescription: EMPTY_DEMO_PLAYBACK_SCRIPT.description,
          ticCount: 0,
        },
        {
          action: 'advance-demo',
          demoIndex: 2,
          lumpName: 'DEMO3',
          scriptDescription: EMPTY_DEMO_PLAYBACK_SCRIPT.description,
          ticCount: 4,
        },
        {
          action: 'wrap-title-loop',
          demoIndex: 0,
          lumpName: 'TITLEPIC',
          scriptDescription: EMPTY_TITLE_LOOP_SCRIPT.description,
          ticCount: 0,
        },
      ],
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.transitions)).toBe(true);
  });

  test('rejects non-product runtime commands before consuming demo streams', () => {
    expect(() =>
      playBundledDemosThroughTitleLoop({
        demoSources: createExplodingDemoSources(),
        runtimeCommand: 'bun run src/main.ts',
      }),
    ).toThrow('Expected runtime command bun run doom.ts, got bun run src/main.ts');
  });

  test('rejects out-of-order bundled demo lumps', () => {
    const demoSources = createDemoSources([1, 1, 1]);

    expect(() =>
      playBundledDemosThroughTitleLoop({
        demoSources: [demoSources[1], demoSources[0], demoSources[2]],
        runtimeCommand: PLAY_BUNDLED_DEMOS_COMMAND_CONTRACT.runtimeCommand,
      }),
    ).toThrow('Expected bundled demo DEMO1 at index 0, got DEMO2');
  });

  test('rejects single-demo completion during title-loop playback', () => {
    expect(() =>
      playBundledDemosThroughTitleLoop({
        demoSources: [
          {
            lumpName: 'DEMO1',
            playback: createPlayback(1, 'quit'),
          },
          {
            lumpName: 'DEMO2',
            playback: createPlayback(1),
          },
          {
            lumpName: 'DEMO3',
            playback: createPlayback(1),
          },
        ],
        runtimeCommand: PLAY_BUNDLED_DEMOS_COMMAND_CONTRACT.runtimeCommand,
      }),
    ).toThrow('DEMO1 completed with quit, expected advance-demo for title-loop playback');
  });
});

function createDemoSources(ticCounts: readonly [number, number, number]): readonly BundledDemoPlaybackSource[] {
  return Object.freeze(
    BUNDLED_DEMO_LUMP_NAMES.map((lumpName, demoIndex) =>
      Object.freeze({
        lumpName,
        playback: createPlayback(ticCounts[demoIndex]),
      }),
    ),
  );
}

function createExplodingDemoSources(): readonly BundledDemoPlaybackSource[] {
  return Object.freeze(
    BUNDLED_DEMO_LUMP_NAMES.map((lumpName) =>
      Object.freeze({
        lumpName,
        playback: {
          readNextTic(): never {
            throw new Error('demo stream was consumed before command validation');
          },
          snapshot(): never {
            throw new Error('demo snapshot was read before command validation');
          },
        },
      }),
    ),
  );
}

function createPlayback(ticCount: number, completionAction: DemoPlaybackSnapshot['completionAction'] = 'advance-demo'): Pick<DemoPlayback, 'readNextTic' | 'snapshot'> {
  let consumedTicCount = 0;
  let demoplayback = true;

  return Object.freeze({
    readNextTic(): readonly [] | null {
      if (consumedTicCount >= ticCount) {
        demoplayback = false;
        return null;
      }

      consumedTicCount += 1;
      return Object.freeze([]);
    },
    snapshot(): Readonly<DemoPlaybackSnapshot> {
      return Object.freeze({
        completionAction,
        consolePlayer: 0,
        deathmatch: 0,
        demoplayback,
        fastMonsters: 0,
        netDemo: false,
        netGame: false,
        noMonsters: 0,
        playersInGame: Object.freeze([true, false, false, false]),
        respawnMonsters: 0,
        singleDemo: completionAction === 'quit',
        ticIndex: consumedTicCount,
      });
    },
  });
}
