import { describe, expect, test } from 'bun:test';

const fixturePath = 'test/oracles/fixtures/capture-first-menu-frame.json';
const manifestPath = 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json';
const referenceOraclesPath = 'plan_fps/REFERENCE_ORACLES.md';
const sourceCatalogPath = 'plan_fps/SOURCE_CATALOG.md';

const expectedFixture = {
  captureCommand: {
    arguments: ['-iwad', 'doom/DOOM1.WAD'],
    inputSequence: [
      {
        action: 'launch-reference',
        frame: 0,
        tic: 0,
      },
      {
        action: 'wait-for-initial-title-frame',
        frame: 0,
        tic: 0,
      },
      {
        action: 'press-escape',
        frame: 1,
        tic: 1,
      },
      {
        action: 'capture-first-menu-frame',
        frame: 2,
        tic: 2,
      },
    ],
    program: 'doom/DOOMD.EXE',
    workingDirectory: 'D:/Projects/doom-in-typescript',
  },
  captureWindow: {
    captureFrame: 2,
    captureTic: 2,
    firstFrame: 2,
    firstTic: 2,
    inputFrame: 1,
    inputTic: 1,
    lastFrame: 2,
    lastTic: 2,
    sourceFrame: 'first visible main menu frame after pressing Escape from the initial title frame',
  },
  expectedTrace: [
    'authority:S-FPS-005 doom/DOOMD.EXE local DOS binary',
    'authority:S-FPS-006 doom/DOOM1.WAD local IWAD',
    'previous-frame-oracle:OR-FPS-009 initial title frame',
    'input:press Escape from initial title frame',
    'state:menu-active main-menu',
    'selection:0 New Game',
    'capture:first visible menu frame after menu open',
  ],
  framebufferHash: {
    reason: 'The 02-005 step read scope does not permit opening or executing reference binaries directly; live framebuffer hashing remains deferred.',
    sha256: null,
    status: 'pending-live-capture',
  },
  referenceOracleEvidence: [
    {
      authority: 'local DOS binary authority when usable',
      id: 'OR-FPS-001',
      path: 'doom/DOOMD.EXE',
    },
    {
      authority: 'local shareware IWAD data',
      id: 'OR-FPS-003',
      path: 'doom/DOOM1.WAD',
    },
    {
      authority: 'initial title frame prerequisite oracle',
      id: 'OR-FPS-009',
      path: 'test/oracles/fixtures/capture-initial-title-frame.json',
    },
  ],
  schemaVersion: 1,
  sourceAuthority: [
    {
      authority: 'local-primary-binary',
      id: 'S-FPS-005',
      path: 'doom/DOOMD.EXE',
      role: 'reference executable for the first-menu-frame capture contract',
    },
    {
      authority: 'local-primary-data',
      id: 'S-FPS-006',
      path: 'doom/DOOM1.WAD',
      role: 'IWAD data for the first-menu-frame capture contract',
    },
  ],
  sourceManifest: {
    path: 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json',
    schemaVersion: 1,
    stepId: '01-015',
    targetReplayContract: 'side-by-side-verifiable replay parity',
    targetRuntimeCommand: 'bun run doom.ts',
  },
  stepId: '02-005',
  stepTitle: 'capture-first-menu-frame',
  traceHash: '63fdff6b843b28c359aaadfec88cfae8a21392fdeb7aa0eb4b857b9a50ab57bd',
};

describe('capture-first-menu-frame oracle', () => {
  test('locks the fixture exactly', async () => {
    const fixtureText = await Bun.file(fixturePath).text();
    const fixtureJson: unknown = JSON.parse(fixtureText);

    expect(fixtureJson).toEqual(expectedFixture);
  });

  test('locks the trace hash and first menu transition', () => {
    const traceHash = new Bun.CryptoHasher('sha256').update(JSON.stringify(expectedFixture.expectedTrace)).digest('hex');

    expect(traceHash).toBe(expectedFixture.traceHash);
    expect(expectedFixture.captureCommand.inputSequence).toEqual([
      {
        action: 'launch-reference',
        frame: 0,
        tic: 0,
      },
      {
        action: 'wait-for-initial-title-frame',
        frame: 0,
        tic: 0,
      },
      {
        action: 'press-escape',
        frame: 1,
        tic: 1,
      },
      {
        action: 'capture-first-menu-frame',
        frame: 2,
        tic: 2,
      },
    ]);
    expect(expectedFixture.captureWindow.inputTic).toBeLessThan(expectedFixture.captureWindow.captureTic);
    expect(expectedFixture.expectedTrace).toContain('state:menu-active main-menu');
    expect(expectedFixture.expectedTrace).toContain('selection:0 New Game');
  });

  test('cross-checks source catalog authority rows', async () => {
    const sourceCatalogText = await Bun.file(sourceCatalogPath).text();

    expect(sourceCatalogText).toContain('| S-FPS-005 | local DOS executable | file | local-primary-binary | `doom/DOOMD.EXE` |');
    expect(sourceCatalogText).toContain('| S-FPS-006 | local IWAD | file | local-primary-data | `doom/DOOM1.WAD` |');
  });

  test('cross-checks the allowed side-by-side audit manifest', async () => {
    const manifestText = await Bun.file(manifestPath).text();
    const manifestJson: unknown = JSON.parse(manifestText);

    expect(manifestJson).toMatchObject({
      commandContracts: {
        currentLauncher: {
          entryFile: 'src/main.ts',
          packageScript: 'start',
          packageScriptCommand: 'bun run src/main.ts',
        },
        targetPlayable: {
          entryFile: 'doom.ts',
          runtimeCommand: 'bun run doom.ts',
        },
      },
      schemaVersion: 1,
      stepId: '01-015',
      targetReplayContract: {
        acceptanceMode: 'side-by-side-verifiable replay parity',
        requiredCommand: 'bun run doom.ts',
      },
    });
  });

  test('registers the captured oracle artifact', async () => {
    const referenceOraclesText = await Bun.file(referenceOraclesPath).text();

    expect(referenceOraclesText).toContain(
      '| OR-FPS-010 | `test/oracles/fixtures/capture-first-menu-frame.json` | first menu frame capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-first-menu-frame.test.ts` |',
    );
  });
});
