import { describe, expect, test } from 'bun:test';

const fixturePath = 'test/oracles/fixtures/capture-demo1-playback-checkpoints.json';
const manifestPath = 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json';
const referenceOraclesPath = 'plan_fps/REFERENCE_ORACLES.md';
const sourceCatalogPath = 'plan_fps/SOURCE_CATALOG.md';

const expectedTrace = [
  {
    event: 'reference-process-start',
    frame: 0,
    index: 0,
    tic: 0,
    value: 'doom/DOOMD.EXE -iwad doom/DOOM1.WAD -playdemo demo1',
  },
  {
    event: 'demo-lump-selected',
    frame: 0,
    index: 1,
    tic: 0,
    value: 'DEMO1',
  },
  {
    event: 'checkpoint',
    frame: 0,
    index: 2,
    tic: 0,
    value: 'demo1-checkpoint-tic-000000-frame-000000',
  },
  {
    event: 'checkpoint',
    frame: 35,
    index: 3,
    tic: 35,
    value: 'demo1-checkpoint-tic-000035-frame-000035',
  },
  {
    event: 'checkpoint',
    frame: 70,
    index: 4,
    tic: 70,
    value: 'demo1-checkpoint-tic-000070-frame-000070',
  },
  {
    event: 'checkpoint',
    frame: 175,
    index: 5,
    tic: 175,
    value: 'demo1-checkpoint-tic-000175-frame-000175',
  },
  {
    event: 'checkpoint',
    frame: 350,
    index: 6,
    tic: 350,
    value: 'demo1-checkpoint-tic-000350-frame-000350',
  },
  {
    event: 'checkpoint',
    frame: 700,
    index: 7,
    tic: 700,
    value: 'demo1-checkpoint-tic-000700-frame-000700',
  },
  {
    event: 'live-hashes-pending',
    frame: 700,
    index: 8,
    tic: 700,
    value: 'framebuffer/audio/state hashes require a later runnable reference capture surface',
  },
] as const;

const expectedFixture = {
  artifactPath: fixturePath,
  captureCommand: {
    arguments: ['-iwad', 'doom/DOOM1.WAD', '-playdemo', 'demo1'],
    demoLump: 'DEMO1',
    executable: 'doom/DOOMD.EXE',
    status: 'contract-only-not-executed-by-this-step',
    workingDirectory: 'D:/Projects/doom-in-typescript',
  },
  commandContracts: {
    currentLauncher: {
      entryFile: 'src/main.ts',
      helpUsageLines: ['  bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', '  bun run start -- [--iwad <path-to-iwad>] --list-maps'],
      packageScript: 'start',
      packageScriptCommand: 'bun run src/main.ts',
    },
    targetPlayable: {
      entryFile: 'doom.ts',
      runtimeCommand: 'bun run doom.ts',
    },
  },
  expectedTrace,
  expectedTraceSha256: '79e192143cb4f4a4ab5b16c5dd0cba2e0d6a45517a17968fa06d20d39e5aa194',
  pendingLiveHashes: [
    {
      reason: 'The selected step does not permit opening or executing reference binaries or audio capture surfaces.',
      surface: 'audio',
    },
    {
      reason: 'The selected step does not permit opening or executing reference binaries or framebuffer capture surfaces.',
      surface: 'framebuffer',
    },
    {
      reason: 'The selected step does not permit opening or executing reference binaries or synchronized state capture surfaces.',
      surface: 'state',
    },
  ],
  schemaVersion: 1,
  sourceAuthority: [
    {
      authority: 'local-primary-binary',
      path: 'doom/DOOMD.EXE',
      role: 'preferred local reference executable when usable',
      sourceIdentifier: 'S-FPS-005',
    },
    {
      authority: 'local-primary-data',
      path: 'doom/DOOM1.WAD',
      role: 'shareware IWAD data containing bundled demo lumps',
      sourceIdentifier: 'S-FPS-006',
    },
    {
      authority: 'derived-launch-surface-audit',
      path: manifestPath,
      role: 'allowed manifest evidence for current and target command contracts',
      sourceIdentifier: 'M-FPS-01-015',
    },
  ],
  stepId: '02-007',
  stepTitle: 'capture-demo1-playback-checkpoints',
  tickFrameWindow: {
    checkpointFrames: [0, 35, 70, 175, 350, 700],
    checkpointTics: [0, 35, 70, 175, 350, 700],
    clock: 'vanilla tic checkpoint indexes',
    firstFrame: 0,
    firstTic: 0,
    lastFrame: 700,
    lastTic: 700,
  },
} as const;

function digestJson(value: unknown): string {
  const hasher = new Bun.CryptoHasher('sha256');

  hasher.update(JSON.stringify(value));

  return hasher.digest('hex');
}

describe('capture-demo1-playback-checkpoints oracle', () => {
  test('locks the fixture exactly', async () => {
    const fixture: unknown = await Bun.file(fixturePath).json();

    expect(fixture).toEqual(expectedFixture);
  });

  test('locks the deterministic trace hash', () => {
    expect(digestJson(expectedTrace)).toBe(expectedFixture.expectedTraceSha256);
  });

  test('cross-checks source catalog authority rows', async () => {
    const sourceCatalog = await Bun.file(sourceCatalogPath).text();

    for (const source of expectedFixture.sourceAuthority.slice(0, 2)) {
      expect(sourceCatalog).toContain(`| ${source.sourceIdentifier} |`);
      expect(sourceCatalog).toContain(`| ${source.authority} |`);
      expect(sourceCatalog).toContain(`| \`${source.path}\` |`);
    }
  });

  test('cross-checks the allowed side-by-side audit manifest', async () => {
    const manifest: unknown = await Bun.file(manifestPath).json();

    expect(manifest).toEqual(
      expect.objectContaining({
        commandContracts: expectedFixture.commandContracts,
        schemaVersion: 1,
        stepId: '01-015',
        stepTitle: 'audit-missing-side-by-side-replay',
        targetReplayContract: expect.objectContaining({
          requiredCommand: expectedFixture.commandContracts.targetPlayable.runtimeCommand,
        }),
      }),
    );
  });

  test('registers the oracle artifact', async () => {
    const referenceOracles = await Bun.file(referenceOraclesPath).text();

    expect(referenceOracles).toContain(
      '| OR-FPS-012 | `test/oracles/fixtures/capture-demo1-playback-checkpoints.json` | demo1 playback checkpoint capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-demo1-playback-checkpoints.test.ts` |',
    );
  });
});
