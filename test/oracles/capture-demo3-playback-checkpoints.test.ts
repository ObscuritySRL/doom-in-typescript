import { describe, expect, test } from 'bun:test';

const fixturePath = 'test/oracles/fixtures/capture-demo3-playback-checkpoints.json';
const referenceOraclesPath = 'plan_fps/REFERENCE_ORACLES.md';
const sideBySideManifestPath = 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json';
const sourceCatalogPath = 'plan_fps/SOURCE_CATALOG.md';

const expectedFixture = {
  captureCommand: {
    arguments: ['-iwad', 'doom/DOOM1.WAD', '-playdemo', 'demo3'],
    executablePath: 'doom/DOOMD.EXE',
    iwadPath: 'doom/DOOM1.WAD',
    mode: 'local-dos-reference-demo-playback',
    workingDirectory: 'D:/Projects/doom-in-typescript',
  },
  captureWindow: {
    checkpointFrames: [0, 1, 35, 350, 700],
    checkpointTics: [0, 1, 35, 350, 700],
    endFrame: 700,
    endTic: 700,
    startFrame: 0,
    startTic: 0,
  },
  expectedTrace: [
    {
      checkpoint: 'demo3-playback-requested',
      expectedState: 'reference launch receives -playdemo demo3',
      frame: 0,
      tic: 0,
    },
    {
      checkpoint: 'demo3-lump-selected',
      expectedState: 'DEMO3 input stream selected from local IWAD authority',
      frame: 1,
      tic: 1,
    },
    {
      checkpoint: 'demo3-first-visible-frame',
      expectedState: 'first visible demo3 playback checkpoint is ready for later framebuffer hash capture',
      frame: 35,
      tic: 35,
    },
    {
      checkpoint: 'demo3-mid-window',
      expectedState: 'mid-window demo3 playback checkpoint is ready for later state and audio hash capture',
      frame: 350,
      tic: 350,
    },
    {
      checkpoint: 'demo3-end-window',
      expectedState: 'end-window demo3 playback checkpoint is ready for later long-run drift comparison',
      frame: 700,
      tic: 700,
    },
  ],
  pendingLiveHashes: [
    {
      evidenceSurface: 'framebuffer-hash-comparison',
      hashKind: 'framebuffer',
      reason: 'No framebuffer hash comparison surface is exposed in the allowed launch-surface files.',
      status: 'pending-live-reference-capture',
    },
    {
      evidenceSurface: 'audio-hash-comparison',
      hashKind: 'audio',
      reason: 'No audio hash comparison surface is exposed in the allowed launch-surface files.',
      status: 'pending-live-reference-capture',
    },
    {
      evidenceSurface: 'state-hash-comparison',
      hashKind: 'state',
      reason: 'No state hash comparison surface is exposed in the allowed launch-surface files.',
      status: 'pending-live-reference-capture',
    },
  ],
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
  sourceManifest: {
    path: 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json',
    schemaVersion: 1,
    stepId: '01-015',
  },
  stepId: '02-009',
  stepTitle: 'capture-demo3-playback-checkpoints',
  traceSha256: '47ba2bb739f1a745f6237db884ccd759bd0d2d2bd6a823b2d500ab2f2cab0716',
} as const;

function hashJson(value: unknown): string {
  return new Bun.CryptoHasher('sha256').update(JSON.stringify(value)).digest('hex');
}

describe('capture demo3 playback checkpoints oracle', () => {
  test('locks the exact fixture values and trace hash', async () => {
    const fixture = await Bun.file(fixturePath).json();

    expect(fixture).toEqual(expectedFixture);
    expect(hashJson(fixture.expectedTrace)).toBe(expectedFixture.traceSha256);
    expect(hashJson(expectedFixture.expectedTrace)).toBe(expectedFixture.traceSha256);
  });

  test('locks the command contract and checkpoint transition order', () => {
    expect(expectedFixture.captureCommand).toEqual({
      arguments: ['-iwad', 'doom/DOOM1.WAD', '-playdemo', 'demo3'],
      executablePath: 'doom/DOOMD.EXE',
      iwadPath: 'doom/DOOM1.WAD',
      mode: 'local-dos-reference-demo-playback',
      workingDirectory: 'D:/Projects/doom-in-typescript',
    });
    expect(expectedFixture.expectedTrace.map((checkpoint) => checkpoint.checkpoint)).toEqual(['demo3-playback-requested', 'demo3-lump-selected', 'demo3-first-visible-frame', 'demo3-mid-window', 'demo3-end-window']);
    expect(expectedFixture.captureWindow.checkpointTics).toEqual(expectedFixture.captureWindow.checkpointFrames);
  });

  test('cross-checks source catalog authority and side-by-side manifest evidence', async () => {
    const sideBySideManifest = await Bun.file(sideBySideManifestPath).json();
    const sourceCatalogText = await Bun.file(sourceCatalogPath).text();

    expect(sourceCatalogText).toContain('| S-FPS-005 | local DOS executable | file | local-primary-binary | `doom/DOOMD.EXE` |');
    expect(sourceCatalogText).toContain('| S-FPS-006 | local IWAD | file | local-primary-data | `doom/DOOM1.WAD` |');
    expect(sourceCatalogText).toContain('| S-FPS-011 | current launcher entry | file | local-primary | `src/main.ts` |');
    expect(sideBySideManifest.schemaVersion).toBe(1);
    expect(sideBySideManifest.stepId).toBe('01-015');
    expect(sideBySideManifest.commandContracts.targetPlayable.runtimeCommand).toBe('bun run doom.ts');
    expect(JSON.stringify(sideBySideManifest.explicitNullSurfaces)).toContain('reference-oracle-replay-capture');
  });

  test('asserts oracle registry entry', async () => {
    const referenceOraclesText = await Bun.file(referenceOraclesPath).text();

    expect(referenceOraclesText).toContain(
      '| OR-FPS-014 | `test/oracles/fixtures/capture-demo3-playback-checkpoints.json` | demo3 playback checkpoint capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-demo3-playback-checkpoints.test.ts` |',
    );
  });
});
