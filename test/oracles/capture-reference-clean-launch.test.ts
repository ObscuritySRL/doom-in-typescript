import { describe, expect, test } from 'bun:test';

const fixturePath = 'test/oracles/fixtures/capture-reference-clean-launch.json';
const referenceOraclesPath = 'plan_fps/REFERENCE_ORACLES.md';
const sourceCatalogPath = 'plan_fps/SOURCE_CATALOG.md';

const expectedTrace = [
  {
    event: 'select-primary-reference-binary',
    ordinal: 1,
    value: 'doom/DOOMD.EXE',
  },
  {
    event: 'select-primary-iwad-data',
    ordinal: 2,
    value: 'doom/DOOM1.WAD',
  },
  {
    event: 'launch-reference-clean-command',
    ordinal: 3,
    value: 'cd doom && DOOMD.EXE',
  },
  {
    event: 'capture-window',
    ordinal: 4,
    value: 'tic 0 frame 0',
  },
] as const;

const expectedTraceHash = 'd757bf195f2002df8b103deee4f8d81e117a99c5a15e476ca8196e25b32e3a1a';

const expectedFixture = {
  captureCommand: {
    arguments: [],
    description: 'Clean-launch reference capture from the local DOS binary authority with the shareware IWAD available in the same reference directory.',
    effectiveCommand: 'cd doom && DOOMD.EXE',
    program: 'DOOMD.EXE',
    workingDirectory: 'doom',
    writesInsideReferenceRoots: false,
  },
  captureWindow: {
    endFrame: 0,
    endTic: 0,
    frameCount: 1,
    inputTrace: [],
    startFrame: 0,
    startTic: 0,
  },
  expectedHashes: [
    {
      algorithm: 'sha256',
      sha256: expectedTraceHash,
      surface: 'expectedTrace-json',
    },
  ],
  expectedTrace,
  refreshCommand: 'bun test test/oracles/capture-reference-clean-launch.test.ts',
  schemaVersion: 1,
  sourceAuthority: {
    authorityOrder: ['OR-FPS-001', 'OR-FPS-003', 'OR-FPS-002', 'OR-FPS-005'],
    primaryData: {
      authority: 'local-primary-data',
      id: 'S-FPS-006',
      path: 'doom/DOOM1.WAD',
      role: 'shareware IWAD data',
    },
    primaryExecutable: {
      authority: 'local-primary-binary',
      id: 'S-FPS-005',
      path: 'doom/DOOMD.EXE',
      role: 'local DOS binary authority when usable',
    },
    secondaryExecutable: {
      authority: 'local-secondary-binary',
      id: 'S-FPS-004',
      path: 'doom/DOOM.EXE',
      role: 'local Windows executable fallback where appropriate',
    },
  },
  sourceCatalogEvidence: [
    {
      authority: 'local-secondary-binary',
      id: 'S-FPS-004',
      path: 'doom/DOOM.EXE',
      source: 'local Windows executable',
    },
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
  ],
  sourceManifestEvidence: {
    currentLauncherEntryFile: 'src/main.ts',
    path: 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json',
    schemaVersion: 1,
    stepId: '01-015',
    targetRuntimeCommand: 'bun run doom.ts',
  },
  stepId: '02-002',
  stepTitle: 'capture-reference-clean-launch',
};

function sha256Json(value: unknown): string {
  return new Bun.CryptoHasher('sha256').update(JSON.stringify(value)).digest('hex');
}

describe('capture-reference-clean-launch oracle', () => {
  test('locks the fixture values to the expected reference capture contract', async () => {
    const fixture = await Bun.file(fixturePath).json();

    expect(fixture).toEqual(expectedFixture);
  });

  test('recomputes the on-disk trace hash and locks structural invariants', async () => {
    const fixture = (await Bun.file(fixturePath).json()) as typeof expectedFixture;
    const traceHash = sha256Json(fixture.expectedTrace);

    expect(traceHash).toMatch(/^[0-9a-f]{64}$/);
    expect(fixture.expectedHashes).toHaveLength(1);
    expect(fixture.expectedHashes[0]).toEqual({
      algorithm: 'sha256',
      sha256: traceHash,
      surface: 'expectedTrace-json',
    });
    expect(fixture.expectedTrace.map((event) => event.ordinal)).toEqual([1, 2, 3, 4]);
    expect(new Set(fixture.expectedTrace.map((event) => event.event)).size).toBe(fixture.expectedTrace.length);
    expect(fixture.captureWindow.frameCount).toBe(1);
    expect(fixture.captureWindow.startFrame).toBe(fixture.captureWindow.endFrame);
    expect(fixture.captureWindow.startTic).toBe(fixture.captureWindow.endTic);
    expect(fixture.captureWindow.inputTrace).toHaveLength(0);
    expect(fixture.captureCommand.writesInsideReferenceRoots).toBe(false);
    expect(fixture.refreshCommand).toBe('bun test test/oracles/capture-reference-clean-launch.test.ts');

    const sourceAuthorityIds = new Set([fixture.sourceAuthority.primaryExecutable.id, fixture.sourceAuthority.secondaryExecutable.id, fixture.sourceAuthority.primaryData.id]);
    const sourceCatalogIds = new Set(fixture.sourceCatalogEvidence.map((evidence) => evidence.id));
    expect(sourceCatalogIds).toEqual(sourceAuthorityIds);
  });

  test('cross-checks allowed source catalog authority rows are intact on disk', async () => {
    const fixture = (await Bun.file(fixturePath).json()) as typeof expectedFixture;
    const sourceCatalogText = await Bun.file(sourceCatalogPath).text();

    for (const evidence of fixture.sourceCatalogEvidence) {
      expect(sourceCatalogText).toContain(`| ${evidence.id} | ${evidence.source} | file | ${evidence.authority} | \`${evidence.path}\` |`);
    }
  });

  test('cross-checks the allowed launch-surface manifest evidence', async () => {
    const fixture = (await Bun.file(fixturePath).json()) as typeof expectedFixture;
    const sourceManifest = await Bun.file(fixture.sourceManifestEvidence.path).json();

    expect(sourceManifest).toMatchObject({
      commandContracts: {
        currentLauncher: {
          entryFile: fixture.sourceManifestEvidence.currentLauncherEntryFile,
        },
        targetPlayable: {
          runtimeCommand: fixture.sourceManifestEvidence.targetRuntimeCommand,
        },
      },
      schemaVersion: fixture.sourceManifestEvidence.schemaVersion,
      stepId: fixture.sourceManifestEvidence.stepId,
    });
  });

  test('registers the oracle artifact row in REFERENCE_ORACLES.md', async () => {
    const referenceOraclesText = await Bun.file(referenceOraclesPath).text();

    expect(referenceOraclesText).toContain(
      '| OR-FPS-007 | `test/oracles/fixtures/capture-reference-clean-launch.json` | reference clean-launch capture contract from local DOS binary authority | `bun test test/oracles/capture-reference-clean-launch.test.ts` |',
    );
  });
});
