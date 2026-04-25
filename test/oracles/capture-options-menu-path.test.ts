import { describe, expect, test } from 'bun:test';

type CaptureCommand = {
  arguments: string[];
  executable: string;
  inputSequence: string;
  iwad: string;
  targetPlayableCommand: string;
  workingDirectory: string;
};

type CaptureWindow = {
  endFrame: number;
  endTic: number;
  frameSampling: string;
  startFrame: number;
  startTic: number;
  ticRateHz: number;
};

type ExpectedTraceEvent = {
  frame: number;
  input: string;
  menuState: string;
  selection: string;
  tic: number;
  transition: string;
};

type InputSequenceEvent = {
  frame: number;
  key: string;
  result: string;
  tic: number;
};

type LiveReferenceCapture = {
  audioHash: null;
  framebufferHash: null;
  reason: string;
  stateHash: null;
  status: string;
};

type OptionsMenuPathFixture = {
  artifactPath: string;
  captureCommand: CaptureCommand;
  captureWindow: CaptureWindow;
  expectedTrace: ExpectedTraceEvent[];
  expectedTraceSha256: string;
  inheritedLaunchSurfaceSourceHashes: SourceHash[];
  inputSequence: InputSequenceEvent[];
  liveReferenceCapture: LiveReferenceCapture;
  oracleId: string;
  schemaVersion: number;
  sourceAuthority: SourceAuthority[];
  sourceManifest: string;
  stepId: string;
  stepTitle: string;
};

type SideBySideReplayManifest = {
  commandContracts: {
    targetPlayable: {
      entryFile: string;
      runtimeCommand: string;
    };
  };
  explicitNullSurfaces: {
    path: string | null;
    reason: string;
    surface: string;
  }[];
  schemaVersion: number;
  sourceHashes: SourceHash[];
  stepId: string;
};

type SourceAuthority = {
  authority: string;
  catalogId: string;
  path: string;
  role: string;
};

type SourceHash = {
  path: string;
  sha256: string;
  sizeBytes: number;
};

const fixturePath = 'test/oracles/fixtures/capture-options-menu-path.json';
const manifestPath = 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json';
const referenceOraclesPath = 'plan_fps/REFERENCE_ORACLES.md';
const sourceCatalogPath = 'plan_fps/SOURCE_CATALOG.md';

const expectedFixture = {
  artifactPath: fixturePath,
  captureCommand: {
    arguments: [],
    executable: 'doom/DOOMD.EXE',
    inputSequence: 'Escape, ArrowDown, Enter',
    iwad: 'doom/DOOM1.WAD',
    targetPlayableCommand: 'bun run doom.ts',
    workingDirectory: 'doom/',
  },
  captureWindow: {
    endFrame: 3,
    endTic: 3,
    frameSampling: 'one captured visible frame per input transition',
    startFrame: 0,
    startTic: 0,
    ticRateHz: 35,
  },
  expectedTrace: [
    {
      frame: 0,
      input: 'none',
      menuState: 'attract-loop',
      selection: 'none',
      tic: 0,
      transition: 'await-menu-open',
    },
    {
      frame: 1,
      input: 'Escape',
      menuState: 'main-menu',
      selection: 'New Game',
      tic: 1,
      transition: 'open-main-menu',
    },
    {
      frame: 2,
      input: 'ArrowDown',
      menuState: 'main-menu',
      selection: 'Options',
      tic: 2,
      transition: 'move-selection-to-options',
    },
    {
      frame: 3,
      input: 'Enter',
      menuState: 'options-menu',
      selection: 'End Game',
      tic: 3,
      transition: 'open-options-menu',
    },
  ],
  expectedTraceSha256: 'b74543c5b452f4ca3636ce60857e80b7bfe60d27c4bbea113d97c7c5459ecc0d',
  inheritedLaunchSurfaceSourceHashes: [
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
  inputSequence: [
    {
      frame: 1,
      key: 'Escape',
      result: 'main menu opens with New Game selected',
      tic: 1,
    },
    {
      frame: 2,
      key: 'ArrowDown',
      result: 'main menu selection moves from New Game to Options',
      tic: 2,
    },
    {
      frame: 3,
      key: 'Enter',
      result: 'options menu opens with End Game selected',
      tic: 3,
    },
  ],
  liveReferenceCapture: {
    audioHash: null,
    framebufferHash: null,
    reason: 'The 02-014 read scope does not permit opening or executing reference binaries directly, and 01-015 records no reference oracle replay capture surface.',
    stateHash: null,
    status: 'pending',
  },
  oracleId: 'OR-FPS-019',
  schemaVersion: 1,
  sourceAuthority: [
    {
      authority: 'local-primary-binary',
      catalogId: 'S-FPS-005',
      path: 'doom/DOOMD.EXE',
      role: 'preferred local binary authority when usable',
    },
    {
      authority: 'local-primary-data',
      catalogId: 'S-FPS-006',
      path: 'doom/DOOM1.WAD',
      role: 'shareware IWAD data',
    },
    {
      authority: 'local-primary',
      catalogId: 'S-FPS-011',
      path: 'src/main.ts',
      role: 'current launcher surface used only to inherit the missing replay-capture gap',
    },
  ],
  sourceManifest: manifestPath,
  stepId: '02-014',
  stepTitle: 'capture-options-menu-path',
} satisfies OptionsMenuPathFixture;

async function loadFixture(): Promise<OptionsMenuPathFixture> {
  const fixture: OptionsMenuPathFixture = await Bun.file(fixturePath).json();

  return fixture;
}

async function loadSideBySideReplayManifest(): Promise<SideBySideReplayManifest> {
  const manifest: SideBySideReplayManifest = await Bun.file(manifestPath).json();

  return manifest;
}

function sha256Json(value: unknown): string {
  return new Bun.CryptoHasher('sha256').update(JSON.stringify(value)).digest('hex');
}

describe('capture options menu path oracle', () => {
  test('locks the fixture contract exactly', async () => {
    const fixture = await loadFixture();

    expect(fixture).toEqual(expectedFixture);
  });

  test('recomputes the expected abstract trace hash', async () => {
    const fixture = await loadFixture();

    expect(sha256Json(fixture.expectedTrace)).toBe(fixture.expectedTraceSha256);
    expect(sha256Json(expectedFixture.expectedTrace)).toBe('b74543c5b452f4ca3636ce60857e80b7bfe60d27c4bbea113d97c7c5459ecc0d');
  });

  test('records the options menu transition path', async () => {
    const fixture = await loadFixture();

    expect(fixture.inputSequence.map((event) => event.key)).toEqual(['Escape', 'ArrowDown', 'Enter']);
    expect(fixture.expectedTrace.map((event) => event.transition)).toEqual(['await-menu-open', 'open-main-menu', 'move-selection-to-options', 'open-options-menu']);
    expect(fixture.expectedTrace[1]).toEqual({
      frame: 1,
      input: 'Escape',
      menuState: 'main-menu',
      selection: 'New Game',
      tic: 1,
      transition: 'open-main-menu',
    });
    expect(fixture.expectedTrace[3]).toEqual({
      frame: 3,
      input: 'Enter',
      menuState: 'options-menu',
      selection: 'End Game',
      tic: 3,
      transition: 'open-options-menu',
    });
  });

  test('cross-checks source authority and missing live replay surface', async () => {
    const fixture = await loadFixture();
    const manifest = await loadSideBySideReplayManifest();
    const sourceCatalog = await Bun.file(sourceCatalogPath).text();
    const explicitNullSurfaces = new Set(manifest.explicitNullSurfaces.map((surface) => surface.surface));

    expect(sourceCatalog).toContain('| S-FPS-005 | local DOS executable | file | local-primary-binary | `doom/DOOMD.EXE` |');
    expect(sourceCatalog).toContain('| S-FPS-006 | local IWAD | file | local-primary-data | `doom/DOOM1.WAD` |');
    expect(sourceCatalog).toContain('| S-FPS-011 | current launcher entry | file | local-primary | `src/main.ts` |');
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.stepId).toBe('01-015');
    expect(manifest.commandContracts.targetPlayable).toEqual({
      entryFile: 'doom.ts',
      runtimeCommand: fixture.captureCommand.targetPlayableCommand,
    });
    expect(manifest.sourceHashes).toEqual(fixture.inheritedLaunchSurfaceSourceHashes);
    expect(explicitNullSurfaces.has('reference-oracle-replay-capture')).toBe(true);
    expect(explicitNullSurfaces.has('framebuffer-hash-comparison')).toBe(true);
    expect(explicitNullSurfaces.has('audio-hash-comparison')).toBe(true);
    expect(explicitNullSurfaces.has('state-hash-comparison')).toBe(true);
    expect(fixture.liveReferenceCapture).toEqual({
      audioHash: null,
      framebufferHash: null,
      reason: 'The 02-014 read scope does not permit opening or executing reference binaries directly, and 01-015 records no reference oracle replay capture surface.',
      stateHash: null,
      status: 'pending',
    });
  });

  test('registers the oracle artifact', async () => {
    const referenceOracles = await Bun.file(referenceOraclesPath).text();

    expect(referenceOracles).toContain(
      '| OR-FPS-019 | `test/oracles/fixtures/capture-options-menu-path.json` | options menu path capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-options-menu-path.test.ts` |',
    );
  });
});
