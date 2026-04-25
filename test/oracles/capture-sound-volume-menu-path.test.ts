import { describe, expect, test } from 'bun:test';

const fixturePath = 'test/oracles/fixtures/capture-sound-volume-menu-path.json';
const launchSurfaceManifestPath = 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json';
const referenceOraclesPath = 'plan_fps/REFERENCE_ORACLES.md';
const sourceCatalogPath = 'plan_fps/SOURCE_CATALOG.md';

type LaunchSurfaceManifest = {
  commandContracts: {
    targetPlayable: {
      runtimeCommand: string;
    };
  };
  explicitNullSurfaces: readonly {
    surface: string;
  }[];
  sourceHashes: readonly SourceHash[];
};

type SourceHash = {
  path: string;
  sha256: string;
  sizeBytes: number;
};

const expectedTrace = [
  {
    event: 'attract-loop-visible',
    frame: 0,
    input: null,
    menu: null,
    selection: null,
    sound: null,
    tick: 0,
  },
  {
    event: 'menu-opened',
    frame: 1,
    input: 'Escape',
    menu: 'main',
    selection: 'new-game',
    sound: 'sfx_swtchn',
    tick: 1,
  },
  {
    event: 'main-selection-moved',
    frame: 2,
    input: 'ArrowDown',
    menu: 'main',
    selection: 'options',
    sound: 'sfx_pstop',
    tick: 2,
  },
  {
    event: 'submenu-opened',
    frame: 3,
    input: 'Enter',
    menu: 'options',
    selection: 'end-game',
    sound: 'sfx_pistol',
    tick: 3,
  },
  {
    event: 'options-selection-moved',
    frame: 4,
    input: 'ArrowDown',
    menu: 'options',
    selection: 'messages',
    sound: 'sfx_pstop',
    tick: 4,
  },
  {
    event: 'options-selection-moved',
    frame: 5,
    input: 'ArrowDown',
    menu: 'options',
    selection: 'graphic-detail',
    sound: 'sfx_pstop',
    tick: 5,
  },
  {
    event: 'options-selection-moved',
    frame: 6,
    input: 'ArrowDown',
    menu: 'options',
    selection: 'screen-size',
    sound: 'sfx_pstop',
    tick: 6,
  },
  {
    event: 'options-selection-moved',
    frame: 7,
    input: 'ArrowDown',
    menu: 'options',
    selection: 'mouse-sensitivity',
    sound: 'sfx_pstop',
    tick: 7,
  },
  {
    event: 'options-selection-moved',
    frame: 8,
    input: 'ArrowDown',
    menu: 'options',
    selection: 'sound-volume',
    sound: 'sfx_pstop',
    tick: 8,
  },
  {
    event: 'submenu-opened',
    frame: 9,
    input: 'Enter',
    menu: 'sound-volume',
    selection: 'sfx-volume',
    sound: 'sfx_pistol',
    tick: 9,
  },
  {
    event: 'sound-volume-menu-stable',
    frame: 10,
    input: null,
    menu: 'sound-volume',
    selection: 'sfx-volume',
    sound: null,
    tick: 10,
  },
] as const;

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
] as const;

const expectedFixture = {
  captureCommand: {
    arguments: ['-iwad', 'doom/DOOM1.WAD'],
    program: 'doom/DOOMD.EXE',
    requiredWorkingDirectory: 'D:/Projects/doom-in-typescript',
    runner: 'local DOS reference runner',
    targetPlayableCommand: 'bun run doom.ts',
  },
  captureWindow: {
    checkpointFrames: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    checkpointTicks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    endFrame: 10,
    endTick: 10,
    startFrame: 0,
    startTick: 0,
  },
  expectedHashes: {
    audioEventSha256: null,
    framebufferSha256: null,
    stateSha256: null,
    traceSha256: '8f01956219a468482870e172933dd21339b4574ce2bc720312977bb749db4d70',
  },
  expectedTrace,
  inputSequence: [
    {
      action: 'open-main-menu',
      frame: 1,
      key: 'Escape',
      tick: 1,
    },
    {
      action: 'select-options-menu',
      frame: 2,
      key: 'ArrowDown',
      tick: 2,
    },
    {
      action: 'open-options-menu',
      frame: 3,
      key: 'Enter',
      tick: 3,
    },
    {
      action: 'select-messages-row',
      frame: 4,
      key: 'ArrowDown',
      tick: 4,
    },
    {
      action: 'select-graphic-detail-row',
      frame: 5,
      key: 'ArrowDown',
      tick: 5,
    },
    {
      action: 'select-screen-size-row',
      frame: 6,
      key: 'ArrowDown',
      tick: 6,
    },
    {
      action: 'select-mouse-sensitivity-row',
      frame: 7,
      key: 'ArrowDown',
      tick: 7,
    },
    {
      action: 'select-sound-volume-row',
      frame: 8,
      key: 'ArrowDown',
      tick: 8,
    },
    {
      action: 'open-sound-volume-menu',
      frame: 9,
      key: 'Enter',
      tick: 9,
    },
  ],
  oracleId: 'OR-FPS-020',
  referenceCaptureStatus: {
    audioEventHash: {
      reason: 'No reference oracle replay capture or audio hash comparison surface is exposed in the allowed 01-015 launch-surface manifest.',
      status: 'pending-live-reference-capture',
    },
    framebufferHash: {
      reason: 'No reference oracle replay capture or framebuffer hash comparison surface is exposed in the allowed 01-015 launch-surface manifest.',
      status: 'pending-live-reference-capture',
    },
    stateHash: {
      reason: 'No reference oracle replay capture or state hash comparison surface is exposed in the allowed 01-015 launch-surface manifest.',
      status: 'pending-live-reference-capture',
    },
  },
  schemaVersion: 1,
  sourceAuthority: {
    derivedFromManifest: {
      path: launchSurfaceManifestPath,
      stepId: '01-015',
    },
    primaryBinary: {
      authority: 'local-primary-binary',
      id: 'S-FPS-005',
      path: 'doom/DOOMD.EXE',
      source: 'local DOS executable',
    },
    primaryData: {
      authority: 'local-primary-data',
      id: 'S-FPS-006',
      path: 'doom/DOOM1.WAD',
      source: 'local IWAD',
    },
    secondaryData: {
      authority: 'local-data',
      id: 'S-FPS-007',
      path: 'iwad/DOOM1.WAD',
      source: 'copied IWAD',
    },
    sourceHashes: expectedSourceHashes,
  },
  stepId: '02-015',
  stepTitle: 'capture-sound-volume-menu-path',
} as const;

const requiredMissingSurfaces = ['audio-hash-comparison', 'framebuffer-hash-comparison', 'reference-oracle-replay-capture', 'state-hash-comparison'] as const;

function hashTrace(trace: unknown): string {
  const hasher = new Bun.CryptoHasher('sha256');
  hasher.update(JSON.stringify(trace));
  return hasher.digest('hex');
}

function isLaunchSurfaceManifest(value: unknown): value is LaunchSurfaceManifest {
  if (!isRecord(value)) {
    return false;
  }

  const commandContracts = value.commandContracts;
  const explicitNullSurfaces = value.explicitNullSurfaces;
  const sourceHashes = value.sourceHashes;

  if (!isRecord(commandContracts) || !isRecord(commandContracts.targetPlayable)) {
    return false;
  }

  return typeof commandContracts.targetPlayable.runtimeCommand === 'string' && Array.isArray(explicitNullSurfaces) && explicitNullSurfaces.every(isSurfaceRecord) && Array.isArray(sourceHashes) && sourceHashes.every(isSourceHash);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSourceHash(value: unknown): value is SourceHash {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.path === 'string' && typeof value.sha256 === 'string' && typeof value.sizeBytes === 'number';
}

function isSurfaceRecord(value: unknown): value is { surface: string } {
  return isRecord(value) && typeof value.surface === 'string';
}

describe('capture sound volume menu path oracle', () => {
  test('locks the complete fixture by exact value', async () => {
    const fixture: unknown = await Bun.file(fixturePath).json();

    expect(fixture).toEqual(expectedFixture);
  });

  test('locks the deterministic trace hash and sound volume transition', async () => {
    const fixture: unknown = await Bun.file(fixturePath).json();

    if (!isRecord(fixture) || !Array.isArray(fixture.expectedTrace) || !isRecord(fixture.expectedHashes) || typeof fixture.expectedHashes.traceSha256 !== 'string') {
      throw new Error('Sound volume oracle fixture shape changed');
    }

    expect(hashTrace(fixture.expectedTrace)).toBe(fixture.expectedHashes.traceSha256);
    expect(fixture.expectedTrace[8]).toEqual({
      event: 'options-selection-moved',
      frame: 8,
      input: 'ArrowDown',
      menu: 'options',
      selection: 'sound-volume',
      sound: 'sfx_pstop',
      tick: 8,
    });
    expect(fixture.expectedTrace[9]).toEqual({
      event: 'submenu-opened',
      frame: 9,
      input: 'Enter',
      menu: 'sound-volume',
      selection: 'sfx-volume',
      sound: 'sfx_pistol',
      tick: 9,
    });
  });

  test('cross-checks the launch-surface manifest command contract and missing hash surfaces', async () => {
    const manifest: unknown = await Bun.file(launchSurfaceManifestPath).json();

    expect(isLaunchSurfaceManifest(manifest)).toBe(true);

    if (!isLaunchSurfaceManifest(manifest)) {
      throw new Error('01-015 launch-surface manifest shape changed');
    }

    const missingSurfaces = manifest.explicitNullSurfaces.map((surfaceRecord) => surfaceRecord.surface);

    expect(manifest.commandContracts.targetPlayable.runtimeCommand).toBe(expectedFixture.captureCommand.targetPlayableCommand);
    expect(manifest.sourceHashes).toEqual(expectedSourceHashes);

    for (const requiredMissingSurface of requiredMissingSurfaces) {
      expect(missingSurfaces).toContain(requiredMissingSurface);
    }
  });

  test('cross-checks source authority against the source catalog', async () => {
    const sourceCatalog = await Bun.file(sourceCatalogPath).text();

    for (const authority of [expectedFixture.sourceAuthority.primaryBinary, expectedFixture.sourceAuthority.primaryData, expectedFixture.sourceAuthority.secondaryData]) {
      expect(sourceCatalog).toContain(authority.id);
      expect(sourceCatalog).toContain(authority.path);
      expect(sourceCatalog).toContain(authority.authority);
    }
  });

  test('registers the oracle artifact and refresh command', async () => {
    const referenceOracles = await Bun.file(referenceOraclesPath).text();

    expect(referenceOracles).toContain(
      '| OR-FPS-020 | `test/oracles/fixtures/capture-sound-volume-menu-path.json` | sound volume menu path capture contract derived from local DOS binary authority and `plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json` | `bun test test/oracles/capture-sound-volume-menu-path.test.ts` |',
    );
  });
});
