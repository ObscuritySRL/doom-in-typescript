import { describe, expect, test } from 'bun:test';

const fixturePath = 'test/oracles/fixtures/capture-full-attract-loop-cycle.json';
const manifestPath = 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json';
const referenceOraclesPath = 'plan_fps/REFERENCE_ORACLES.md';
const sourceCatalogPath = 'plan_fps/SOURCE_CATALOG.md';

const expectedFixture = {
  captureCommand: {
    arguments: [],
    captureTarget: 'full-attract-loop-cycle',
    commandLine: 'doom/DOOMD.EXE',
    program: 'doom/DOOMD.EXE',
    workingDirectory: 'doom',
  },
  deferredLiveHashes: [
    {
      hash: null,
      kind: 'audio',
      reason: 'The 02-006 read scope does not permit executing or inspecting reference binaries.',
      status: 'pending-live-reference-capture',
    },
    {
      hash: null,
      kind: 'framebuffer',
      reason: 'The 02-006 read scope does not permit executing or inspecting reference binaries.',
      status: 'pending-live-reference-capture',
    },
    {
      hash: null,
      kind: 'state',
      reason: 'The 02-006 read scope does not permit executing or inspecting reference binaries.',
      status: 'pending-live-reference-capture',
    },
  ],
  expectedTrace: [
    {
      event: 'capture-contract-created',
      surface: 'full-attract-loop-cycle',
      tic: 0,
    },
    {
      event: 'reference-authority-selected',
      primaryBinary: 'doom/DOOMD.EXE',
      primaryData: 'doom/DOOM1.WAD',
    },
    {
      event: 'launch-reference-binary',
      commandLine: 'doom/DOOMD.EXE',
      workingDirectory: 'doom',
    },
    {
      event: 'observe-title-page',
      phase: 'title',
    },
    {
      event: 'observe-demo-playback',
      phase: 'demo1',
    },
    {
      event: 'observe-interstitial-page',
      phase: 'post-demo1',
    },
    {
      event: 'observe-demo-playback',
      phase: 'demo2',
    },
    {
      event: 'observe-interstitial-page',
      phase: 'post-demo2',
    },
    {
      event: 'observe-demo-playback',
      phase: 'demo3',
    },
    {
      event: 'observe-cycle-return',
      phase: 'title-repeat',
    },
  ],
  expectedTraceHash: '77c2c36888420845a21cb2a57f1c075b41c4dcb9fd4f45c81acf4ffa45bf63ee',
  liveCaptureStatus: 'pending-live-reference-capture',
  rationale:
    'This oracle locks the full attract loop capture contract, source authority, tick/frame start point, and exact abstract trace hash while leaving live framebuffer, audio, and state hashes pending for a later step that may execute the reference capture path.',
  schemaVersion: 1,
  sourceAuthority: [
    {
      authority: 'local-primary-binary',
      id: 'S-FPS-005',
      path: 'doom/DOOMD.EXE',
      role: 'local DOS binary authority when usable',
    },
    {
      authority: 'local-primary-data',
      id: 'S-FPS-006',
      path: 'doom/DOOM1.WAD',
      role: 'local shareware IWAD data',
    },
    {
      authority: 'local-primary',
      id: 'S-FPS-011',
      path: 'src/main.ts',
      role: 'current launcher surface evidence from the 01-015 manifest',
    },
  ],
  sourceManifest: {
    path: manifestPath,
    schemaVersion: 1,
    stepId: '01-015',
    stepTitle: 'audit-missing-side-by-side-replay',
  },
  stepId: '02-006',
  stepTitle: 'capture-full-attract-loop-cycle',
  tickFrameWindow: {
    endCondition: 'first completed attract-loop cycle return after title, demo1, interstitial page, demo2, interstitial page, demo3, and title repeat observations',
    liveEndFrame: null,
    liveEndTic: null,
    startFrame: 0,
    startTic: 0,
    status: 'pending-live-reference-capture',
  },
} satisfies Record<string, unknown>;

describe('capture-full-attract-loop-cycle oracle', () => {
  test('locks the exact fixture contract', async () => {
    const fixture = await readJsonObject(fixturePath);

    expect(fixture).toEqual(expectedFixture);
  });

  test('locks the exact attract loop trace hash and transition order', async () => {
    const fixture = await readJsonObject(fixturePath);
    const expectedTrace = getArray(fixture, 'expectedTrace').map(getRecord);
    const expectedTraceHash = getString(fixture, 'expectedTraceHash');

    expect(hashJson(expectedTrace)).toBe(expectedTraceHash);
    expect(expectedTraceHash).toMatch(/^[0-9a-f]{64}$/);
    expect(expectedTrace.map((eventRecord) => getString(eventRecord, 'event'))).toEqual([
      'capture-contract-created',
      'reference-authority-selected',
      'launch-reference-binary',
      'observe-title-page',
      'observe-demo-playback',
      'observe-interstitial-page',
      'observe-demo-playback',
      'observe-interstitial-page',
      'observe-demo-playback',
      'observe-cycle-return',
    ]);
    expect(getObject(fixture, 'tickFrameWindow')).toEqual(expectedFixture.tickFrameWindow);
  });

  test('locks the deferred live capture invariants across kinds and status', async () => {
    const fixture = await readJsonObject(fixturePath);
    const liveCaptureStatus = getString(fixture, 'liveCaptureStatus');
    const deferredLiveHashes = getArray(fixture, 'deferredLiveHashes').map(getRecord);

    expect(deferredLiveHashes).toHaveLength(3);
    expect(deferredLiveHashes.map((deferredEntry) => getString(deferredEntry, 'kind')).sort()).toEqual(['audio', 'framebuffer', 'state']);

    for (const deferredEntry of deferredLiveHashes) {
      expect(deferredEntry.hash).toBeNull();
      expect(getString(deferredEntry, 'status')).toBe(liveCaptureStatus);
    }
  });

  test('cross-checks source authority against the catalog and side-by-side audit manifest', async () => {
    const fixture = await readJsonObject(fixturePath);
    const manifest = await readJsonObject(manifestPath);
    const sourceCatalog = await Bun.file(sourceCatalogPath).text();

    expect(sourceCatalog).toContain('| S-FPS-005 | local DOS executable | file | local-primary-binary | `doom/DOOMD.EXE` |');
    expect(sourceCatalog).toContain('| S-FPS-006 | local IWAD | file | local-primary-data | `doom/DOOM1.WAD` |');
    expect(sourceCatalog).toContain('| S-FPS-011 | current launcher entry | file | local-primary | `src/main.ts` |');
    expect(getObject(fixture, 'sourceManifest')).toEqual({
      path: manifestPath,
      schemaVersion: getNumber(manifest, 'schemaVersion'),
      stepId: getString(manifest, 'stepId'),
      stepTitle: getString(manifest, 'stepTitle'),
    });
  });

  test('locks the command contract and the pending reference-capture gap', async () => {
    const manifest = await readJsonObject(manifestPath);
    const commandContracts = getObject(manifest, 'commandContracts');
    const targetPlayable = getObject(commandContracts, 'targetPlayable');
    const explicitNullSurfaces = getArray(manifest, 'explicitNullSurfaces').map(getRecord);

    expect(targetPlayable).toEqual({
      entryFile: 'doom.ts',
      runtimeCommand: 'bun run doom.ts',
    });
    expect(explicitNullSurfaces.some((surfaceRecord) => getString(surfaceRecord, 'surface') === 'reference-oracle-replay-capture')).toBe(true);
  });

  test('registers the oracle artifact with its refresh command', async () => {
    const referenceOracles = await Bun.file(referenceOraclesPath).text();

    expect(referenceOracles).toContain(
      '| OR-FPS-011 | `test/oracles/fixtures/capture-full-attract-loop-cycle.json` | full attract loop cycle capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-full-attract-loop-cycle.test.ts` |',
    );
  });
});

function getArray(record: Record<string, unknown>, key: string): unknown[] {
  const value = record[key];

  if (!Array.isArray(value)) {
    throw new Error(`Expected ${key} to be an array.`);
  }

  return value;
}

function getNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];

  if (typeof value !== 'number') {
    throw new Error(`Expected ${key} to be a number.`);
  }

  return value;
}

function getObject(record: Record<string, unknown>, key: string): Record<string, unknown> {
  return getRecord(record[key]);
}

function getRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Expected value to be an object.');
  }

  return value as Record<string, unknown>;
}

function getString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== 'string') {
    throw new Error(`Expected ${key} to be a string.`);
  }

  return value;
}

function hashJson(value: unknown): string {
  return new Bun.CryptoHasher('sha256').update(JSON.stringify(value)).digest('hex');
}

async function readJsonObject(path: string): Promise<Record<string, unknown>> {
  const parsedJson: unknown = await Bun.file(path).json();

  return getRecord(parsedJson);
}
