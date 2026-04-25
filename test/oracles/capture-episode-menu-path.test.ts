import { describe, expect, test } from 'bun:test';

type CaptureEpisodeMenuPathFixture = {
  artifactPath: string;
  authority: {
    manifestPath: string;
    primaryDataPath: string;
    primaryExecutablePath: string;
    referenceOracleAuthority: string[];
    sourceCatalogEvidence: SourceCatalogEvidence[];
  };
  captureCommand: {
    commandLine: string;
    executablePath: string;
    requiredDataPath: string;
    workingDirectory: string;
  };
  captureWindow: {
    endFrame: number;
    endTic: number;
    frameRateHz: number;
    startFrame: number;
    startTic: number;
  };
  commandContracts: {
    currentLauncher: {
      entryFile: string;
      packageScript: string;
      packageScriptCommand: string;
    };
    targetPlayable: {
      entryFile: string;
      runtimeCommand: string;
    };
  };
  expectedTrace: TraceEntry[];
  inputSequence: InputEvent[];
  liveArtifactStatus: LiveArtifactStatus[];
  oracleId: string;
  schemaVersion: number;
  sourceHashes: SourceHash[];
  stepId: string;
  stepTitle: string;
  traceHashSha256: string;
};

type InputEvent = {
  control: string;
  purpose: string;
  resultMenu: string;
  startMenu: string;
  tic: number;
};

type LiveArtifactStatus = {
  kind: string;
  reason: string;
  status: string;
};

type SourceCatalogEvidence = {
  authority: string;
  id: string;
  path: string;
  role: string;
};

type SourceHash = {
  path: string;
  sha256: string;
  sizeBytes: number;
};

type TraceEntry = {
  event: string;
  frame: number;
  menu: string;
  selection: string | null;
  state: string;
  tic: number;
};

const fixturePath = 'test/oracles/fixtures/capture-episode-menu-path.json';
const referenceOraclesPath = 'plan_fps/REFERENCE_ORACLES.md';
const sideBySideManifestPath = 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json';
const sourceCatalogPath = 'plan_fps/SOURCE_CATALOG.md';

const expectedFixture = {
  artifactPath: fixturePath,
  authority: {
    manifestPath: sideBySideManifestPath,
    primaryDataPath: 'doom/DOOM1.WAD',
    primaryExecutablePath: 'doom/DOOMD.EXE',
    referenceOracleAuthority: ['Local original DOS binary if present and usable.', 'Local IWAD/data files.'],
    sourceCatalogEvidence: [
      {
        authority: 'local-primary-binary',
        id: 'S-FPS-005',
        path: 'doom/DOOMD.EXE',
        role: 'preferred local DOS binary authority',
      },
      {
        authority: 'local-primary-data',
        id: 'S-FPS-006',
        path: 'doom/DOOM1.WAD',
        role: 'shareware IWAD data',
      },
      {
        authority: 'local-data',
        id: 'S-FPS-007',
        path: 'iwad/DOOM1.WAD',
        role: 'workspace IWAD copy',
      },
    ],
  },
  captureCommand: {
    commandLine: 'DOOMD.EXE',
    executablePath: 'doom/DOOMD.EXE',
    requiredDataPath: 'doom/DOOM1.WAD',
    workingDirectory: 'doom',
  },
  captureWindow: {
    endFrame: 3,
    endTic: 3,
    frameRateHz: 35,
    startFrame: 0,
    startTic: 0,
  },
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
  expectedTrace: [
    {
      event: 'clean-launch-menu-ready',
      frame: 0,
      menu: 'attract-loop',
      selection: null,
      state: 'awaiting-menu-open',
      tic: 0,
    },
    {
      event: 'escape-opens-main-menu',
      frame: 1,
      menu: 'main-menu',
      selection: 'new-game',
      state: 'main-menu-active',
      tic: 1,
    },
    {
      event: 'enter-opens-episode-menu',
      frame: 2,
      menu: 'episode-menu',
      selection: 'knee-deep-in-the-dead',
      state: 'episode-select-active',
      tic: 2,
    },
    {
      event: 'enter-selects-episode-one',
      frame: 3,
      menu: 'skill-menu',
      selection: 'im-too-young-to-die',
      state: 'skill-select-active',
      tic: 3,
    },
  ],
  inputSequence: [
    {
      control: 'Escape',
      purpose: 'open main menu from clean launch',
      resultMenu: 'main-menu',
      startMenu: 'attract-loop',
      tic: 1,
    },
    {
      control: 'Enter',
      purpose: 'activate the default New Game item',
      resultMenu: 'episode-menu',
      startMenu: 'main-menu',
      tic: 2,
    },
    {
      control: 'Enter',
      purpose: 'activate the default Knee-Deep in the Dead episode',
      resultMenu: 'skill-menu',
      startMenu: 'episode-menu',
      tic: 3,
    },
  ],
  liveArtifactStatus: [
    {
      kind: 'framebuffer-hash',
      reason: 'No framebuffer hash comparison surface is exposed in the allowed launch-surface files.',
      status: 'pending',
    },
    {
      kind: 'audio-hash',
      reason: 'No audio hash comparison surface is exposed in the allowed launch-surface files.',
      status: 'pending',
    },
    {
      kind: 'state-hash',
      reason: 'No state hash comparison surface is exposed in the allowed launch-surface files.',
      status: 'pending',
    },
  ],
  oracleId: 'OR-FPS-017',
  schemaVersion: 1,
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
  stepId: '02-012',
  stepTitle: 'capture-episode-menu-path',
  traceHashSha256: '0a3880c1319b25029e21e3e984bff4807a28cf112857342f2bcb3a348b5a8881',
} satisfies CaptureEpisodeMenuPathFixture;

const expectedOracleRow =
  '| OR-FPS-017 | `test/oracles/fixtures/capture-episode-menu-path.json` | episode menu path capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-episode-menu-path.test.ts` |';

function computeTraceHashSha256(trace: TraceEntry[]): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(JSON.stringify(trace));
  return hasher.digest('hex');
}

describe('capture episode menu path oracle', () => {
  test('locks the exact fixture content', async () => {
    const fixture: unknown = await Bun.file(fixturePath).json();

    expect(fixture).toEqual(expectedFixture);
  });

  test('locks the transition trace hash', () => {
    expect(computeTraceHashSha256(expectedFixture.expectedTrace)).toBe(expectedFixture.traceHashSha256);
  });

  test('records the episode menu input path into the skill menu', () => {
    expect(expectedFixture.inputSequence.map((inputEvent) => inputEvent.control)).toEqual(['Escape', 'Enter', 'Enter']);
    expect(expectedFixture.expectedTrace.map((traceEntry) => traceEntry.menu)).toEqual(['attract-loop', 'main-menu', 'episode-menu', 'skill-menu']);
    expect(expectedFixture.expectedTrace.at(-1)).toMatchObject({
      event: 'enter-selects-episode-one',
      selection: 'im-too-young-to-die',
      state: 'skill-select-active',
    });
  });

  test('cross-checks source authority and command contracts', async () => {
    const sideBySideManifest: unknown = await Bun.file(sideBySideManifestPath).json();
    const sourceCatalog = await Bun.file(sourceCatalogPath).text();

    expect(sourceCatalog).toContain('| S-FPS-005 | local DOS executable | file | local-primary-binary | `doom/DOOMD.EXE` |');
    expect(sourceCatalog).toContain('| S-FPS-006 | local IWAD | file | local-primary-data | `doom/DOOM1.WAD` |');
    expect(sourceCatalog).toContain('| S-FPS-007 | copied IWAD | file | local-data | `iwad/DOOM1.WAD` |');
    expect(sideBySideManifest).toMatchObject({
      commandContracts: {
        currentLauncher: expectedFixture.commandContracts.currentLauncher,
        targetPlayable: expectedFixture.commandContracts.targetPlayable,
      },
      schemaVersion: 1,
      sourceHashes: expectedFixture.sourceHashes,
    });
    expect(sideBySideManifest).toMatchObject({
      explicitNullSurfaces: expect.arrayContaining([
        expect.objectContaining({
          reason: expectedFixture.liveArtifactStatus[0].reason,
          surface: 'framebuffer-hash-comparison',
        }),
        expect.objectContaining({
          reason: expectedFixture.liveArtifactStatus[1].reason,
          surface: 'audio-hash-comparison',
        }),
        expect.objectContaining({
          reason: expectedFixture.liveArtifactStatus[2].reason,
          surface: 'state-hash-comparison',
        }),
      ]),
    });
  });

  test('registers the oracle artifact', async () => {
    const referenceOracles = await Bun.file(referenceOraclesPath).text();

    expect(referenceOracles).toContain(expectedOracleRow);
  });
});
