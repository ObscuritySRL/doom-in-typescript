import { describe, expect, test } from 'bun:test';

const fixturePath = 'test/oracles/fixtures/capture-skill-menu-path.json';
const manifestPath = 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json';
const referenceOraclesPath = 'plan_fps/REFERENCE_ORACLES.md';
const sourceCatalogPath = 'plan_fps/SOURCE_CATALOG.md';

const expectedFixture = {
  captureCommand: {
    arguments: ['-iwad', 'doom/DOOM1.WAD'],
    executable: 'doom/DOOMD.EXE',
    mode: 'reference-skill-menu-path',
    workingDirectory: 'D:/Projects/doom-in-typescript',
  },
  captureWindow: {
    endFrame: 12,
    endTic: 12,
    startFrame: 0,
    startTic: 0,
    targetFrame: 12,
    targetTic: 12,
  },
  expectedTrace: [
    {
      description: 'clean launch reaches the title screen before menu input',
      frame: 0,
      input: null,
      menu: 'title-screen',
      result: 'attract-loop-active',
      tic: 0,
    },
    {
      description: 'Escape opens the main menu with New Game selected',
      frame: 3,
      input: 'Escape',
      menu: 'main-menu:new-game',
      result: 'main-menu-active',
      tic: 3,
    },
    {
      description: 'Enter selects New Game and opens the episode menu',
      frame: 6,
      input: 'Enter',
      menu: 'episode-menu:knee-deep-in-the-dead',
      result: 'episode-menu-active',
      tic: 6,
    },
    {
      description: 'Enter selects Episode 1 and opens the skill menu',
      frame: 9,
      input: 'Enter',
      menu: 'skill-menu:hurt-me-plenty',
      result: 'skill-menu-active',
      tic: 9,
    },
    {
      description: 'Enter accepts the default skill and requests E1M1 startup',
      frame: 12,
      input: 'Enter',
      menu: 'game-start-request:e1m1:hurt-me-plenty',
      result: 'game-start-requested',
      tic: 12,
    },
  ],
  inputSequence: [
    {
      action: 'press',
      frame: 3,
      key: 'Escape',
      tic: 3,
    },
    {
      action: 'press',
      frame: 6,
      key: 'Enter',
      tic: 6,
    },
    {
      action: 'press',
      frame: 9,
      key: 'Enter',
      tic: 9,
    },
    {
      action: 'press',
      frame: 12,
      key: 'Enter',
      tic: 12,
    },
  ],
  liveReferenceCapture: {
    audioHash: null,
    framebufferHash: null,
    reason: 'The selected 02-013 read scope does not permit opening or executing reference binaries directly.',
    stateHash: null,
    status: 'pending',
  },
  schemaVersion: 1,
  sourceAuthority: [
    {
      authority: 'local-primary-binary',
      path: 'doom/DOOMD.EXE',
      source: 'local DOS executable',
      sourceCatalogId: 'S-FPS-005',
    },
    {
      authority: 'local-primary-data',
      path: 'doom/DOOM1.WAD',
      source: 'local IWAD',
      sourceCatalogId: 'S-FPS-006',
    },
  ],
  sourceManifest: {
    path: manifestPath,
    sourceHashes: [
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
    ],
    targetRuntimeCommand: 'bun run doom.ts',
    unavailableSurfaces: ['audio-hash-comparison', 'framebuffer-hash-comparison', 'reference-oracle-replay-capture', 'state-hash-comparison'],
  },
  stepId: '02-013',
  stepTitle: 'capture-skill-menu-path',
  traceSha256: 'bc39d28a454a857c59b34f51fb5d39029be24edc71f26682dff00434d6d92388',
} as const;

describe('capture skill menu path oracle', () => {
  test('locks the fixture exactly', async () => {
    const fixture: unknown = await Bun.file(fixturePath).json();

    expect(fixture).toEqual(expectedFixture);
  });

  test('recomputes the expected trace hash', () => {
    const traceText = JSON.stringify(expectedFixture.expectedTrace);
    const traceSha256 = new Bun.CryptoHasher('sha256').update(traceText).digest('hex');

    expect(traceSha256).toBe(expectedFixture.traceSha256);
  });

  test('captures the skill menu transition path', () => {
    const finalTraceEvent = expectedFixture.expectedTrace[4];

    expect(expectedFixture.inputSequence.map((inputEvent) => inputEvent.key)).toEqual(['Escape', 'Enter', 'Enter', 'Enter']);
    expect(expectedFixture.expectedTrace.map((traceEvent) => traceEvent.menu)).toEqual(['title-screen', 'main-menu:new-game', 'episode-menu:knee-deep-in-the-dead', 'skill-menu:hurt-me-plenty', 'game-start-request:e1m1:hurt-me-plenty']);
    expect(finalTraceEvent.result).toBe('game-start-requested');
    expect(expectedFixture.captureWindow.targetTic).toBe(finalTraceEvent.tic);
    expect(expectedFixture.captureWindow.targetFrame).toBe(finalTraceEvent.frame);
  });

  test('cross-checks source authority and launch-surface evidence', async () => {
    const manifestText = await Bun.file(manifestPath).text();
    const sourceCatalogText = await Bun.file(sourceCatalogPath).text();

    for (const sourceAuthority of expectedFixture.sourceAuthority) {
      expect(sourceCatalogText).toContain(`| ${sourceAuthority.sourceCatalogId} |`);
      expect(sourceCatalogText).toContain(`| ${sourceAuthority.source} |`);
      expect(sourceCatalogText).toContain(`| ${sourceAuthority.authority} |`);
      expect(sourceCatalogText).toContain(`\`${sourceAuthority.path}\``);
    }

    expect(manifestText).toContain('"runtimeCommand": "bun run doom.ts"');
    expect(manifestText).toContain('"surface": "reference-oracle-replay-capture"');
    expect(manifestText).toContain('"surface": "framebuffer-hash-comparison"');
    expect(manifestText).toContain('"surface": "audio-hash-comparison"');
    expect(manifestText).toContain('"surface": "state-hash-comparison"');

    for (const sourceHash of expectedFixture.sourceManifest.sourceHashes) {
      expect(manifestText).toContain(`"path": "${sourceHash.path}"`);
      expect(manifestText).toContain(`"sha256": "${sourceHash.sha256}"`);
      expect(manifestText).toContain(`"sizeBytes": ${sourceHash.sizeBytes}`);
    }
  });

  test('registers the oracle artifact', async () => {
    const referenceOraclesText = await Bun.file(referenceOraclesPath).text();

    expect(referenceOraclesText).toContain(
      '| OR-FPS-018 | `test/oracles/fixtures/capture-skill-menu-path.json` | skill menu path capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-skill-menu-path.test.ts` |',
    );
  });
});
