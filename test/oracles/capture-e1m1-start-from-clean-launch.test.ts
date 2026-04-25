import { describe, expect, test } from 'bun:test';

const fixturePath = 'test/oracles/fixtures/capture-e1m1-start-from-clean-launch.json';
const launchSurfaceManifestPath = 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json';
const referenceOraclesPath = 'plan_fps/REFERENCE_ORACLES.md';
const sourceCatalogPath = 'plan_fps/SOURCE_CATALOG.md';

const expectedTrace = [
  {
    frame: 0,
    input: [],
    state: 'clean-launch',
    tic: 0,
    view: 'startup',
  },
  {
    frame: 35,
    input: ['Escape'],
    state: 'main-menu-open',
    tic: 35,
    view: 'main-menu',
  },
  {
    frame: 45,
    input: ['Enter'],
    state: 'episode-menu-open',
    tic: 45,
    view: 'episode-menu',
  },
  {
    frame: 55,
    input: ['Enter'],
    state: 'skill-menu-open',
    tic: 55,
    view: 'skill-menu',
  },
  {
    frame: 65,
    input: ['Enter'],
    state: 'e1m1-start-requested',
    tic: 65,
    view: 'level-start',
  },
  {
    frame: 105,
    input: [],
    map: 'E1M1',
    state: 'level-loaded',
    tic: 105,
    view: 'gameplay',
  },
  {
    frame: 140,
    input: [],
    map: 'E1M1',
    state: 'first-gameplay-frame-ready',
    tic: 140,
    view: 'gameplay',
  },
];

const expectedSourceHashes = [
  {
    path: 'package.json',
    sha256: '9075b8e3bd095247d470794741803868200ffa6788e43482988ab1b0907384fe',
    sizeBytes: 569,
  },
  {
    path: 'src/main.ts',
    sha256: '019ea4be868270e62d17d3557679dbecf0cbf838c10f07c393d1d9cd54300f44',
    sizeBytes: 3239,
  },
  {
    path: 'tsconfig.json',
    sha256: '49105a2f714747072109fdd48aebdd831c4f6df5eaaaddc3d0204df368f62b62',
    sizeBytes: 645,
  },
];

const expectedFixture = {
  captureCommand: {
    arguments: [],
    entryFile: 'doom.ts',
    runtimeCommand: 'bun run doom.ts',
    workingDirectory: 'D:/Projects/doom-in-typescript',
  },
  captureWindow: {
    endFrame: 140,
    endTic: 140,
    startFrame: 0,
    startTic: 0,
  },
  expectedTrace,
  liveHashStatus: [
    {
      hash: null,
      kind: 'framebuffer',
      reason: 'No reference oracle replay capture or framebuffer hash comparison surface is exposed in the allowed 01-015 launch-surface manifest.',
      status: 'pending',
    },
    {
      hash: null,
      kind: 'audio',
      reason: 'No reference oracle replay capture or audio hash comparison surface is exposed in the allowed 01-015 launch-surface manifest.',
      status: 'pending',
    },
    {
      hash: null,
      kind: 'state',
      reason: 'No reference oracle replay capture or state hash comparison surface is exposed in the allowed 01-015 launch-surface manifest.',
      status: 'pending',
    },
  ],
  manifestEvidence: {
    path: launchSurfaceManifestPath,
    schemaVersion: 1,
    sourceHashes: expectedSourceHashes,
  },
  schemaVersion: 1,
  sourceAuthority: [
    {
      authority: 'local-primary-binary',
      id: 'S-FPS-005',
      path: 'doom/DOOMD.EXE',
      role: 'preferred local reference executable authority when usable',
    },
    {
      authority: 'local-primary-data',
      id: 'S-FPS-006',
      path: 'doom/DOOM1.WAD',
      role: 'shareware IWAD data for E1M1',
    },
    {
      authority: 'local-primary',
      id: 'S-FPS-011',
      path: 'src/main.ts',
      role: 'allowed current launcher surface evidence inherited through the 01-015 manifest',
    },
  ],
  sourceHashes: expectedSourceHashes,
  stepId: '02-019',
  stepTitle: 'capture-e1m1-start-from-clean-launch',
  traceSha256: 'aff7bb6d4013157e1fe11c6c2a0f59ec4580f112f07f0bdc014fa88e2c898295',
};

function hashJson(value: unknown): string {
  return new Bun.CryptoHasher('sha256').update(JSON.stringify(value)).digest('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await Bun.file(path).text());
}

function requireArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }

  return value;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be a record`);
  }

  return value;
}

describe('capture-e1m1-start-from-clean-launch oracle', () => {
  test('locks the fixture exactly', async () => {
    expect(await readJson(fixturePath)).toEqual(expectedFixture);
  });

  test('recomputes the abstract trace hash', async () => {
    const fixture = requireRecord(await readJson(fixturePath), 'fixture');

    expect(hashJson(fixture.expectedTrace)).toBe(expectedFixture.traceSha256);
  });

  test('records the clean launch to E1M1 transition', async () => {
    const fixture = requireRecord(await readJson(fixturePath), 'fixture');
    const trace = requireArray(fixture.expectedTrace, 'expectedTrace');
    const finalTraceEntry = requireRecord(trace[6], 'final trace entry');

    expect(trace).toEqual(expectedTrace);
    expect(trace).toHaveLength(7);
    expect(finalTraceEntry.map).toBe('E1M1');
    expect(finalTraceEntry.state).toBe('first-gameplay-frame-ready');
    expect(finalTraceEntry.view).toBe('gameplay');
  });

  test('cross-checks source authority and launch-surface manifest gaps', async () => {
    const sourceCatalog = await Bun.file(sourceCatalogPath).text();
    const manifest = requireRecord(await readJson(launchSurfaceManifestPath), 'launch surface manifest');
    const commandContracts = requireRecord(manifest.commandContracts, 'commandContracts');
    const explicitNullSurfaces = requireArray(manifest.explicitNullSurfaces, 'explicitNullSurfaces');
    const targetPlayable = requireRecord(commandContracts.targetPlayable, 'targetPlayable');

    expect(sourceCatalog).toContain('| S-FPS-005 | local DOS executable | file | local-primary-binary | `doom/DOOMD.EXE` | Preferred local binary authority when usable. |');
    expect(sourceCatalog).toContain('| S-FPS-006 | local IWAD | file | local-primary-data | `doom/DOOM1.WAD` | Shareware IWAD data. |');
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.sourceHashes).toEqual(expectedSourceHashes);
    expect(targetPlayable.runtimeCommand).toBe(expectedFixture.captureCommand.runtimeCommand);
    expect(targetPlayable.entryFile).toBe(expectedFixture.captureCommand.entryFile);
    expect(explicitNullSurfaces).toContainEqual({
      evidencePaths: ['package.json', 'tsconfig.json', 'src/main.ts'],
      path: null,
      reason: 'No reference oracle replay capture surface is exposed in the allowed launch-surface files.',
      surface: 'reference-oracle-replay-capture',
    });
    expect(explicitNullSurfaces).toContainEqual({
      evidencePaths: ['package.json', 'tsconfig.json', 'src/main.ts'],
      path: null,
      reason: 'No framebuffer hash comparison surface is exposed in the allowed launch-surface files.',
      surface: 'framebuffer-hash-comparison',
    });
  });

  test('asserts oracle registration', async () => {
    const referenceOracles = await Bun.file(referenceOraclesPath).text();

    expect(referenceOracles).toContain(
      '| OR-FPS-024 | `test/oracles/fixtures/capture-e1m1-start-from-clean-launch.json` | e1m1 start from clean launch capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-e1m1-start-from-clean-launch.test.ts` |',
    );
  });
});
