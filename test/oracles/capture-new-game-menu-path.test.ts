import { describe, expect, test } from 'bun:test';

type CaptureCommand = {
  binary: string;
  iwad: string;
  mode: string;
  scriptedInput: string[];
  workingDirectory: string;
};

type CaptureWindow = {
  endFrame: number;
  endTic: number;
  startFrame: number;
  startTic: number;
};

type ExpectedTraceEntry = {
  frame: number;
  input: string;
  menuState: string;
  selection: string | null;
  tic: number;
};

type ManifestEvidence = {
  currentLauncherCommand: string;
  path: string;
  sourceHashes: SourceHash[];
  stepId: string;
  targetPlayableRuntimeCommand: string;
};

type NewGameMenuPathFixture = {
  captureCommand: CaptureCommand;
  captureWindow: CaptureWindow;
  expectedTrace: ExpectedTraceEntry[];
  manifestEvidence: ManifestEvidence;
  pendingLiveHashes: PendingLiveHashes;
  schemaVersion: number;
  sourceAuthority: SourceAuthorityRecord[];
  stepId: string;
  stepTitle: string;
  traceSha256: string;
};

type PendingLiveHashes = {
  audio: null;
  framebuffer: null;
  reason: string;
  state: null;
};

type SideBySideReplayManifest = {
  commandContracts: {
    currentLauncher: {
      packageScriptCommand: string;
    };
    targetPlayable: {
      runtimeCommand: string;
    };
  };
  explicitNullSurfaces: {
    path: null;
    surface: string;
  }[];
  sourceHashes: SourceHash[];
  stepId: string;
};

type SourceAuthorityRecord = {
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

const fixturePath = 'test/oracles/fixtures/capture-new-game-menu-path.json';
const oracleRegistryPath = 'plan_fps/REFERENCE_ORACLES.md';
const sideBySideManifestPath = 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json';
const sourceCatalogPath = 'plan_fps/SOURCE_CATALOG.md';

const expectedFixture = {
  captureCommand: {
    binary: 'doom/DOOMD.EXE',
    iwad: 'doom/DOOM1.WAD',
    mode: 'reference-menu-input-capture',
    scriptedInput: ['Escape', 'Enter'],
    workingDirectory: 'D:/Projects/doom-in-typescript',
  },
  captureWindow: {
    endFrame: 2,
    endTic: 2,
    startFrame: 0,
    startTic: 0,
  },
  expectedTrace: [
    {
      frame: 0,
      input: 'clean-launch-idle',
      menuState: 'attract-loop',
      selection: null,
      tic: 0,
    },
    {
      frame: 1,
      input: 'Escape key down/up',
      menuState: 'main-menu',
      selection: 'New Game',
      tic: 1,
    },
    {
      frame: 2,
      input: 'Enter key down/up',
      menuState: 'episode-menu',
      selection: 'Episode 1: Knee-Deep in the Dead',
      tic: 2,
    },
  ],
  manifestEvidence: {
    currentLauncherCommand: 'bun run src/main.ts',
    path: sideBySideManifestPath,
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
    stepId: '01-015',
    targetPlayableRuntimeCommand: 'bun run doom.ts',
  },
  pendingLiveHashes: {
    audio: null,
    framebuffer: null,
    reason: 'The 02-011 read scope does not permit opening or executing reference binaries directly.',
    state: null,
  },
  schemaVersion: 1,
  sourceAuthority: [
    {
      authority: 'local-primary-binary',
      id: 'S-FPS-005',
      path: 'doom/DOOMD.EXE',
      role: 'local DOS binary authority',
    },
    {
      authority: 'local-primary-data',
      id: 'S-FPS-006',
      path: 'doom/DOOM1.WAD',
      role: 'shareware IWAD data',
    },
    {
      authority: 'local-primary',
      id: 'S-FPS-011',
      path: 'src/main.ts',
      role: 'allowed launch-surface evidence',
    },
  ],
  stepId: '02-011',
  stepTitle: 'capture-new-game-menu-path',
  traceSha256: '26fc0c173c27e0e3474f6a57e5d50c2b6e310ecc6a2f88c014ca9d02c59d5fd2',
} satisfies NewGameMenuPathFixture;

function hashJson(value: unknown): string {
  return new Bun.CryptoHasher('sha256').update(JSON.stringify(value)).digest('hex');
}

describe('capture-new-game-menu-path oracle', () => {
  test('locks the fixture contract exactly', async () => {
    const fixture: typeof expectedFixture = await Bun.file(fixturePath).json();

    expect(fixture).toEqual(expectedFixture);
  });

  test('locks the expected transition trace and hash', async () => {
    const fixture: typeof expectedFixture = await Bun.file(fixturePath).json();

    expect(fixture.expectedTrace.map((entry) => entry.menuState)).toEqual(['attract-loop', 'main-menu', 'episode-menu']);
    expect(fixture.expectedTrace.map((entry) => entry.selection)).toEqual([null, 'New Game', 'Episode 1: Knee-Deep in the Dead']);
    expect(fixture.captureCommand.scriptedInput).toEqual(['Escape', 'Enter']);
    expect(hashJson(fixture.expectedTrace)).toBe(fixture.traceSha256);
  });

  test('cross-checks source catalog and side-by-side manifest authority', async () => {
    const fixture: typeof expectedFixture = await Bun.file(fixturePath).json();
    const sideBySideManifest: SideBySideReplayManifest = await Bun.file(sideBySideManifestPath).json();
    const sourceCatalog = await Bun.file(sourceCatalogPath).text();

    expect(sourceCatalog).toContain('| S-FPS-005 | local DOS executable | file | local-primary-binary | `doom/DOOMD.EXE` | Preferred local binary authority when usable. |');
    expect(sourceCatalog).toContain('| S-FPS-006 | local IWAD | file | local-primary-data | `doom/DOOM1.WAD` | Shareware IWAD data. |');
    expect(sourceCatalog).toContain('| S-FPS-011 | current launcher entry | file | local-primary | `src/main.ts` | Current launcher surface, not the final requested `doom.ts` command. |');
    expect(fixture.manifestEvidence.currentLauncherCommand).toBe(sideBySideManifest.commandContracts.currentLauncher.packageScriptCommand);
    expect(fixture.manifestEvidence.sourceHashes).toEqual(sideBySideManifest.sourceHashes);
    expect(fixture.manifestEvidence.stepId).toBe(sideBySideManifest.stepId);
    expect(fixture.manifestEvidence.targetPlayableRuntimeCommand).toBe(sideBySideManifest.commandContracts.targetPlayable.runtimeCommand);
  });

  test('records the pending live reference-capture gap explicitly', async () => {
    const fixture: typeof expectedFixture = await Bun.file(fixturePath).json();
    const sideBySideManifest: SideBySideReplayManifest = await Bun.file(sideBySideManifestPath).json();

    expect(fixture.pendingLiveHashes).toEqual({
      audio: null,
      framebuffer: null,
      reason: 'The 02-011 read scope does not permit opening or executing reference binaries directly.',
      state: null,
    });
    expect(sideBySideManifest.explicitNullSurfaces.some((surface) => surface.path === null && surface.surface === 'reference-oracle-replay-capture')).toBe(true);
  });

  test('registers the oracle artifact', async () => {
    const oracleRegistry = await Bun.file(oracleRegistryPath).text();

    expect(oracleRegistry).toContain(
      '| OR-FPS-016 | `test/oracles/fixtures/capture-new-game-menu-path.json` | new game menu path capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-new-game-menu-path.test.ts` |',
    );
  });
});
