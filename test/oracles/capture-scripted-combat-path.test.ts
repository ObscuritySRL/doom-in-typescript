import { describe, expect, test } from 'bun:test';

type CaptureCommand = {
  arguments: string[];
  entryFile: string;
  inputTraceName: string;
  runtimeCommand: string;
  scriptedInputArtifact: string;
};

type CaptureWindow = {
  endFrame: number;
  endTic: number;
  startFrame: number;
  startTic: number;
};

type ExpectedTraceEntry = {
  event: string;
  note: string;
  tic: number;
};

type HashStatus = {
  reason: string;
  sha256: string | null;
  status: 'pending';
};

type InheritedSourceHash = {
  path: string;
  sha256: string;
  sizeBytes: number;
};

type ScriptedCombatPathOracleFixture = {
  captureCommand: CaptureCommand;
  captureWindow: CaptureWindow;
  expectedTrace: ExpectedTraceEntry[];
  inheritedLaunchSurfaceSourceHashes: InheritedSourceHash[];
  liveHashStatus: {
    audio: HashStatus;
    framebuffer: HashStatus;
    state: HashStatus;
  };
  schemaVersion: number;
  scriptedInput: ScriptedInputEntry[];
  sourceAuthority: SourceAuthority[];
  stepIdentifier: string;
  stepTitle: string;
  traceSha256: string;
};

type ScriptedInputEntry = {
  action: string;
  control: string;
  tic: number;
};

type SideBySideReplayManifest = {
  commandContracts: {
    targetPlayable: {
      entryFile: string;
      runtimeCommand: string;
    };
  };
  explicitNullSurfaces: {
    evidencePaths: string[];
    path: null;
    reason: string;
    surface: string;
  }[];
  sourceHashes: InheritedSourceHash[];
};

type SourceAuthority = {
  authority: string;
  path: string;
  sourceCatalogIdentifier: string;
};

const fixturePath = 'test/oracles/fixtures/capture-scripted-combat-path.json';
const referenceOraclesPath = 'plan_fps/REFERENCE_ORACLES.md';
const sideBySideReplayManifestPath = 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json';
const sourceCatalogPath = 'plan_fps/SOURCE_CATALOG.md';

const fixture: ScriptedCombatPathOracleFixture = await Bun.file(fixturePath).json();
const referenceOraclesText = await Bun.file(referenceOraclesPath).text();
const sideBySideReplayManifest: SideBySideReplayManifest = await Bun.file(sideBySideReplayManifestPath).json();
const sourceCatalogText = await Bun.file(sourceCatalogPath).text();

const expectedFixture = {
  captureCommand: {
    arguments: [],
    entryFile: 'doom.ts',
    inputTraceName: 'capture-scripted-combat-path',
    runtimeCommand: 'bun run doom.ts',
    scriptedInputArtifact: fixturePath,
  },
  captureWindow: {
    endFrame: 110,
    endTic: 110,
    startFrame: 0,
    startTic: 0,
  },
  expectedTrace: [
    {
      event: 'clean-launch',
      note: 'target command contract starts the playable product from a clean process',
      tic: 0,
    },
    {
      event: 'open-main-menu',
      note: 'Escape opens the main menu from the attract loop',
      tic: 2,
    },
    {
      event: 'select-new-game',
      note: 'Enter accepts the default New Game item',
      tic: 5,
    },
    {
      event: 'select-episode-one',
      note: 'Enter accepts Knee-Deep in the Dead',
      tic: 8,
    },
    {
      event: 'select-hurt-me-plenty',
      note: 'Enter accepts the default skill and requests E1M1',
      tic: 11,
    },
    {
      event: 'e1m1-first-gameplay-frame',
      note: 'first gameplay frame after clean menu path',
      tic: 35,
    },
    {
      event: 'advance-from-start-room',
      note: 'script holds forward toward the first former human encounter lane',
      tic: 48,
    },
    {
      event: 'align-pistol-shot',
      note: 'script turns to keep the first target in the pistol sightline',
      tic: 72,
    },
    {
      event: 'fire-pistol',
      note: 'attack command is pressed for the first scripted combat action',
      tic: 88,
    },
    {
      event: 'pistol-shot-resolved',
      note: 'deterministic pistol hitscan event resolves against the first target lane',
      tic: 91,
    },
    {
      event: 'combat-path-capture-end',
      note: 'capture window includes the first combat event and immediate post-shot state',
      tic: 110,
    },
  ],
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
  liveHashStatus: {
    audio: {
      reason: 'pending because the selected step read scope does not permit opening or executing reference binaries',
      sha256: null,
      status: 'pending',
    },
    framebuffer: {
      reason: 'pending because the selected step read scope does not permit opening or executing reference binaries',
      sha256: null,
      status: 'pending',
    },
    state: {
      reason: 'pending because the selected step read scope does not permit opening or executing reference binaries',
      sha256: null,
      status: 'pending',
    },
  },
  schemaVersion: 1,
  scriptedInput: [
    {
      action: 'press',
      control: 'Escape',
      tic: 2,
    },
    {
      action: 'press',
      control: 'Enter',
      tic: 5,
    },
    {
      action: 'press',
      control: 'Enter',
      tic: 8,
    },
    {
      action: 'press',
      control: 'Enter',
      tic: 11,
    },
    {
      action: 'hold',
      control: 'ArrowUp',
      tic: 44,
    },
    {
      action: 'release',
      control: 'ArrowUp',
      tic: 66,
    },
    {
      action: 'hold',
      control: 'ArrowRight',
      tic: 67,
    },
    {
      action: 'release',
      control: 'ArrowRight',
      tic: 71,
    },
    {
      action: 'press',
      control: 'ControlLeft',
      tic: 88,
    },
    {
      action: 'release',
      control: 'ControlLeft',
      tic: 89,
    },
  ],
  sourceAuthority: [
    {
      authority: 'local-primary-binary',
      path: 'doom/DOOMD.EXE',
      sourceCatalogIdentifier: 'S-FPS-005',
    },
    {
      authority: 'local-primary-data',
      path: 'doom/DOOM1.WAD',
      sourceCatalogIdentifier: 'S-FPS-006',
    },
    {
      authority: 'local-data',
      path: 'iwad/DOOM1.WAD',
      sourceCatalogIdentifier: 'S-FPS-007',
    },
    {
      authority: 'derived-launch-surface-audit',
      path: sideBySideReplayManifestPath,
      sourceCatalogIdentifier: '01-015',
    },
  ],
  stepIdentifier: '02-021',
  stepTitle: 'capture-scripted-combat-path',
  traceSha256: '59a84f722ab1bdb74c91c4f29530f7aa0cf701ffecb3829e58a80ef2ff09700e',
} satisfies ScriptedCombatPathOracleFixture;

describe('capture-scripted-combat-path oracle', () => {
  test('locks the exact scripted combat fixture', () => {
    expect(fixture).toEqual(expectedFixture);
  });

  test('recomputes the deterministic trace hash', () => {
    const traceHasher = new Bun.CryptoHasher('sha256');
    traceHasher.update(JSON.stringify(fixture.expectedTrace));

    expect(traceHasher.digest('hex')).toBe(fixture.traceSha256);
  });

  test('records the menu-to-combat transition and scripted fire input', () => {
    expect(fixture.expectedTrace.map((traceEntry) => traceEntry.event)).toEqual([
      'clean-launch',
      'open-main-menu',
      'select-new-game',
      'select-episode-one',
      'select-hurt-me-plenty',
      'e1m1-first-gameplay-frame',
      'advance-from-start-room',
      'align-pistol-shot',
      'fire-pistol',
      'pistol-shot-resolved',
      'combat-path-capture-end',
    ]);
    expect(fixture.scriptedInput).toContainEqual({
      action: 'press',
      control: 'ControlLeft',
      tic: 88,
    });
    expect(fixture.captureWindow).toEqual({
      endFrame: 110,
      endTic: 110,
      startFrame: 0,
      startTic: 0,
    });
  });

  test('cross-checks source authority and the side-by-side audit manifest', () => {
    expect(fixture.captureCommand.runtimeCommand).toBe(sideBySideReplayManifest.commandContracts.targetPlayable.runtimeCommand);
    expect(fixture.captureCommand.entryFile).toBe(sideBySideReplayManifest.commandContracts.targetPlayable.entryFile);
    expect(fixture.inheritedLaunchSurfaceSourceHashes).toEqual(sideBySideReplayManifest.sourceHashes);
    expect(sideBySideReplayManifest.explicitNullSurfaces).toContainEqual({
      evidencePaths: ['package.json', 'tsconfig.json', 'src/main.ts'],
      path: null,
      reason: 'No reference oracle replay capture surface is exposed in the allowed launch-surface files.',
      surface: 'reference-oracle-replay-capture',
    });

    for (const sourceAuthorityEntry of fixture.sourceAuthority.filter((sourceAuthorityEntry) => sourceAuthorityEntry.sourceCatalogIdentifier.startsWith('S-FPS-'))) {
      expect(sourceCatalogText).toContain(sourceAuthorityEntry.sourceCatalogIdentifier);
      expect(sourceCatalogText).toContain(sourceAuthorityEntry.path);
    }
    expect(fixture.sourceAuthority).toContainEqual({
      authority: 'derived-launch-surface-audit',
      path: sideBySideReplayManifestPath,
      sourceCatalogIdentifier: '01-015',
    });
  });

  test('records pending live hash gaps and oracle registration', () => {
    expect(Object.values(fixture.liveHashStatus)).toEqual([
      {
        reason: 'pending because the selected step read scope does not permit opening or executing reference binaries',
        sha256: null,
        status: 'pending',
      },
      {
        reason: 'pending because the selected step read scope does not permit opening or executing reference binaries',
        sha256: null,
        status: 'pending',
      },
      {
        reason: 'pending because the selected step read scope does not permit opening or executing reference binaries',
        sha256: null,
        status: 'pending',
      },
    ]);
    expect(referenceOraclesText).toContain(
      '| OR-FPS-026 | `test/oracles/fixtures/capture-scripted-combat-path.json` | scripted combat path capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-scripted-combat-path.test.ts` |',
    );
  });
});
