import { describe, expect, test } from 'bun:test';

const fixturePath = 'test/oracles/fixtures/capture-demo2-playback-checkpoints.json';
const manifestPath = 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json';
const referenceOraclesPath = 'plan_fps/REFERENCE_ORACLES.md';
const sourceCatalogPath = 'plan_fps/SOURCE_CATALOG.md';

const expectedFixture = {
  captureCommand: {
    arguments: ['-timedemo', 'DEMO2', '-iwad', 'doom/DOOM1.WAD'],
    binaryPath: 'doom/DOOMD.EXE',
    command: 'doom/DOOMD.EXE -timedemo DEMO2 -iwad doom/DOOM1.WAD',
    demoLump: 'DEMO2',
    iwadPath: 'doom/DOOM1.WAD',
  },
  checkpointWindow: {
    frames: [0, 35, 70, 140, 280, 560, 840, 1_120],
    startFrame: 0,
    startTic: 0,
    ticRateHz: 35,
    tics: [0, 35, 70, 140, 280, 560, 840, 1_120],
  },
  expectedTrace: [
    {
      checkpoint: 'demo2-playback-start',
      demoLump: 'DEMO2',
      frame: 0,
      tic: 0,
    },
    {
      checkpoint: 'demo2-checkpoint-35',
      demoLump: 'DEMO2',
      frame: 35,
      tic: 35,
    },
    {
      checkpoint: 'demo2-checkpoint-70',
      demoLump: 'DEMO2',
      frame: 70,
      tic: 70,
    },
    {
      checkpoint: 'demo2-checkpoint-140',
      demoLump: 'DEMO2',
      frame: 140,
      tic: 140,
    },
    {
      checkpoint: 'demo2-checkpoint-280',
      demoLump: 'DEMO2',
      frame: 280,
      tic: 280,
    },
    {
      checkpoint: 'demo2-checkpoint-560',
      demoLump: 'DEMO2',
      frame: 560,
      tic: 560,
    },
    {
      checkpoint: 'demo2-checkpoint-840',
      demoLump: 'DEMO2',
      frame: 840,
      tic: 840,
    },
    {
      checkpoint: 'demo2-live-hashes-pending',
      demoLump: 'DEMO2',
      frame: 1_120,
      reason: 'reference-oracle-replay-capture is not exposed in the allowed 01-015 launch-surface files',
      tic: 1_120,
    },
  ],
  liveHashStatus: {
    audioSha256: null,
    framebufferSha256: null,
    reason: 'No reference oracle replay capture, framebuffer hash comparison, audio hash comparison, or state hash comparison surface is exposed in the allowed 01-015 launch-surface files.',
    stateSha256: null,
  },
  referenceManifest: {
    path: manifestPath,
    schemaVersion: 1,
    targetReplayContractCurrentVisibility: 'missing in allowed launch-surface files',
  },
  schemaVersion: 1,
  sourceAuthority: [
    {
      authority: 'local-primary-binary',
      id: 'S-FPS-005',
      path: 'doom/DOOMD.EXE',
      source: 'local DOS executable',
    },
    {
      authority: 'local-primary-data',
      id: 'S-FPS-006',
      path: 'doom/DOOM1.WAD',
      source: 'local IWAD',
    },
    {
      authority: 'local-primary',
      id: 'S-FPS-011',
      path: 'src/main.ts',
      source: 'current launcher entry',
    },
  ],
  stepId: '02-008',
  stepTitle: 'capture-demo2-playback-checkpoints',
  traceSha256: '736f0d08a73b3983dc0406477b6ac1cc1bf47cdf776165271e332047bff6cfa4',
  traceSerialization: 'JSON.stringify(expectedTrace)',
} as const;

describe('capture demo2 playback checkpoints oracle', () => {
  test('locks the fixture values and deterministic trace hash', async () => {
    const fixture: unknown = await Bun.file(fixturePath).json();

    expect(fixture).toEqual(expectedFixture);
    expect(Bun.CryptoHasher.hash('sha256', JSON.stringify(expectedFixture.expectedTrace), 'hex')).toBe(expectedFixture.traceSha256);
  });

  test('locks demo2 checkpoint transitions and capture command', () => {
    expect(expectedFixture.captureCommand).toEqual({
      arguments: ['-timedemo', 'DEMO2', '-iwad', 'doom/DOOM1.WAD'],
      binaryPath: 'doom/DOOMD.EXE',
      command: 'doom/DOOMD.EXE -timedemo DEMO2 -iwad doom/DOOM1.WAD',
      demoLump: 'DEMO2',
      iwadPath: 'doom/DOOM1.WAD',
    });
    expect(expectedFixture.expectedTrace.map((checkpoint) => checkpoint.checkpoint)).toEqual([
      'demo2-playback-start',
      'demo2-checkpoint-35',
      'demo2-checkpoint-70',
      'demo2-checkpoint-140',
      'demo2-checkpoint-280',
      'demo2-checkpoint-560',
      'demo2-checkpoint-840',
      'demo2-live-hashes-pending',
    ]);
    expect(expectedFixture.checkpointWindow).toEqual({
      frames: [0, 35, 70, 140, 280, 560, 840, 1_120],
      startFrame: 0,
      startTic: 0,
      ticRateHz: 35,
      tics: [0, 35, 70, 140, 280, 560, 840, 1_120],
    });
  });

  test('cross-checks source catalog authority', async () => {
    const sourceCatalog = await Bun.file(sourceCatalogPath).text();

    expect(sourceCatalog).toContain('| S-FPS-005 | local DOS executable | file | local-primary-binary | `doom/DOOMD.EXE` | Preferred local binary authority when usable. |');
    expect(sourceCatalog).toContain('| S-FPS-006 | local IWAD | file | local-primary-data | `doom/DOOM1.WAD` | Shareware IWAD data. |');
    expect(sourceCatalog).toContain('| S-FPS-011 | current launcher entry | file | local-primary | `src/main.ts` | Current launcher surface, not the final requested `doom.ts` command. |');
  });

  test('cross-checks the side-by-side replay audit manifest', async () => {
    const manifest: unknown = await Bun.file(manifestPath).json();

    expect(manifest).toMatchObject({
      commandContracts: {
        targetPlayable: {
          entryFile: 'doom.ts',
          runtimeCommand: 'bun run doom.ts',
        },
      },
      explicitNullSurfaces: expect.arrayContaining([
        expect.objectContaining({
          path: null,
          surface: 'reference-oracle-replay-capture',
        }),
        expect.objectContaining({
          path: null,
          surface: 'framebuffer-hash-comparison',
        }),
        expect.objectContaining({
          path: null,
          surface: 'audio-hash-comparison',
        }),
        expect.objectContaining({
          path: null,
          surface: 'state-hash-comparison',
        }),
      ]),
      schemaVersion: 1,
      targetReplayContract: {
        currentVisibility: 'missing in allowed launch-surface files',
        requiredCommand: 'bun run doom.ts',
      },
    });
  });

  test('registers the oracle artifact', async () => {
    const referenceOracles = await Bun.file(referenceOraclesPath).text();

    expect(referenceOracles).toContain(
      '| OR-FPS-013 | `test/oracles/fixtures/capture-demo2-playback-checkpoints.json` | demo2 playback checkpoint capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-demo2-playback-checkpoints.test.ts` |',
    );
  });
});
