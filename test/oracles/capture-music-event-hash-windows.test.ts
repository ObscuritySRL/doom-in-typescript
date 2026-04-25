import { describe, expect, test } from 'bun:test';

type MusicEventHashWindow = {
  frameWindow: {
    end: number;
    start: number;
  };
  musicEvent: string;
  reason: string;
  status: string;
  ticWindow: {
    end: number;
    start: number;
  };
  windowId: string;
};

type MusicEventHashWindowsFixture = {
  captureCommand: {
    arguments: string[];
    entryFile: string;
    fullCommand: string;
    program: string;
    runtimeCommand: string;
    subcommand: string;
  };
  captureWindow: {
    frameWindow: {
      end: number;
      start: number;
    };
    ticWindow: {
      end: number;
      start: number;
    };
  };
  inheritedLaunchSurface: {
    manifestPath: string;
    missingSurfaces: string[];
    targetRuntimeCommand: string;
  };
  liveHashStatus: {
    expectedLiveHashes: null;
    reason: string;
    status: string;
    surfacesChecked: string[];
  };
  musicEventHashTrace: MusicEventHashWindow[];
  musicEventHashTraceSha256: string;
  schemaVersion: number;
  sourceAuthority: {
    authority: string;
    id: string;
    path: string;
    role: string;
  }[];
  sourceHashes: {
    path: string;
    sha256: string;
    sizeBytes: number;
  }[];
  stepId: string;
  stepTitle: string;
};

const fixturePath = 'test/oracles/fixtures/capture-music-event-hash-windows.json';

const expectedFixture: MusicEventHashWindowsFixture = {
  captureCommand: {
    arguments: ['--oracle', 'capture-music-event-hash-windows', '--iwad', 'doom/DOOM1.WAD', '--music-event-hash-windows', 'music-clean-launch-title-window,music-menu-navigation-window,music-e1m1-start-window'],
    entryFile: 'doom.ts',
    fullCommand: 'bun run doom.ts --oracle capture-music-event-hash-windows --iwad doom/DOOM1.WAD --music-event-hash-windows music-clean-launch-title-window,music-menu-navigation-window,music-e1m1-start-window',
    program: 'bun',
    runtimeCommand: 'bun run doom.ts',
    subcommand: 'run',
  },
  captureWindow: {
    frameWindow: {
      end: 420,
      start: 0,
    },
    ticWindow: {
      end: 420,
      start: 0,
    },
  },
  inheritedLaunchSurface: {
    manifestPath: 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json',
    missingSurfaces: ['audio-hash-comparison', 'reference-oracle-replay-capture', 'side-by-side-replay-command'],
    targetRuntimeCommand: 'bun run doom.ts',
  },
  liveHashStatus: {
    expectedLiveHashes: null,
    reason: 'The selected step read scope permits the launch-surface audit manifest but no reference capture or audio hash comparison surface.',
    status: 'pending-reference-capture',
    surfacesChecked: ['audio-hash-comparison', 'reference-oracle-replay-capture', 'side-by-side-replay-command'],
  },
  musicEventHashTrace: [
    {
      frameWindow: {
        end: 104,
        start: 0,
      },
      musicEvent: 'pending-clean-launch-music-event-hash',
      reason: 'No reference oracle replay capture or audio hash comparison surface is exposed in the allowed 01-015 launch-surface manifest.',
      status: 'pending-reference-capture',
      ticWindow: {
        end: 104,
        start: 0,
      },
      windowId: 'music-clean-launch-title-window',
    },
    {
      frameWindow: {
        end: 244,
        start: 140,
      },
      musicEvent: 'pending-menu-navigation-music-event-hash',
      reason: 'No reference oracle replay capture or audio hash comparison surface is exposed in the allowed 01-015 launch-surface manifest.',
      status: 'pending-reference-capture',
      ticWindow: {
        end: 244,
        start: 140,
      },
      windowId: 'music-menu-navigation-window',
    },
    {
      frameWindow: {
        end: 420,
        start: 315,
      },
      musicEvent: 'pending-e1m1-start-music-event-hash',
      reason: 'No reference oracle replay capture or audio hash comparison surface is exposed in the allowed 01-015 launch-surface manifest.',
      status: 'pending-reference-capture',
      ticWindow: {
        end: 420,
        start: 315,
      },
      windowId: 'music-e1m1-start-window',
    },
  ],
  musicEventHashTraceSha256: '68a121abc739db1bc68513d75d040a9235c9f9bde15852f47959c34dc42f7430',
  schemaVersion: 1,
  sourceAuthority: [
    {
      authority: 'local-primary-binary',
      id: 'S-FPS-005',
      path: 'doom/DOOMD.EXE',
      role: 'reference music event authority',
    },
    {
      authority: 'local-primary-data',
      id: 'S-FPS-006',
      path: 'doom/DOOM1.WAD',
      role: 'music lump and map data authority',
    },
    {
      authority: 'allowed-launch-surface-audit',
      id: 'M-FPS-01-015',
      path: 'plan_fps/manifests/01-015-audit-missing-side-by-side-replay.json',
      role: 'source hashes and missing capture-surface evidence',
    },
  ],
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
  stepId: '02-028',
  stepTitle: 'capture-music-event-hash-windows',
};

const hashText = (text: string): string => new Bun.CryptoHasher('sha256').update(text).digest('hex');

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const readJson = async (path: string): Promise<unknown> => JSON.parse(await Bun.file(path).text());

const readLaunchSurfaceManifestSourceHashes = async (): Promise<MusicEventHashWindowsFixture['sourceHashes']> => {
  const manifest = await readJson(expectedFixture.inheritedLaunchSurface.manifestPath);

  if (!isRecord(manifest) || !Array.isArray(manifest.sourceHashes)) {
    throw new Error('01-015 launch-surface manifest is missing sourceHashes.');
  }

  return manifest.sourceHashes.map((sourceHash): MusicEventHashWindowsFixture['sourceHashes'][number] => {
    if (!isRecord(sourceHash)) {
      throw new Error('01-015 source hash entry is not an object.');
    }

    const path = sourceHash.path;
    const sha256 = sourceHash.sha256;
    const sizeBytes = sourceHash.sizeBytes;

    if (typeof path !== 'string' || typeof sha256 !== 'string' || typeof sizeBytes !== 'number') {
      throw new Error('01-015 source hash entry has an unexpected shape.');
    }

    return {
      path,
      sha256,
      sizeBytes,
    };
  });
};

describe('capture-music-event-hash-windows oracle', () => {
  test('locks the exact oracle fixture value', async () => {
    expect(await readJson(fixturePath)).toEqual(expectedFixture);
  });

  test('recomputes the exact pending music event trace hash', () => {
    expect(hashText(JSON.stringify(expectedFixture.musicEventHashTrace))).toBe(expectedFixture.musicEventHashTraceSha256);
    expect(expectedFixture.musicEventHashTraceSha256).toBe('68a121abc739db1bc68513d75d040a9235c9f9bde15852f47959c34dc42f7430');
  });

  test('locks the capture command contract and music event windows', () => {
    expect(expectedFixture.captureCommand.runtimeCommand).toBe('bun run doom.ts');
    expect(expectedFixture.captureCommand.fullCommand.startsWith('bun run doom.ts ')).toBe(true);
    expect(expectedFixture.captureWindow).toEqual({
      frameWindow: {
        end: 420,
        start: 0,
      },
      ticWindow: {
        end: 420,
        start: 0,
      },
    });
    expect(expectedFixture.musicEventHashTrace.map((hashWindow) => hashWindow.windowId)).toEqual(['music-clean-launch-title-window', 'music-menu-navigation-window', 'music-e1m1-start-window']);
    expect(expectedFixture.musicEventHashTrace.map((hashWindow) => hashWindow.status)).toEqual(['pending-reference-capture', 'pending-reference-capture', 'pending-reference-capture']);
    expect(expectedFixture.liveHashStatus.expectedLiveHashes).toBeNull();
  });

  test('cross-checks source authority and inherited launch-surface evidence', async () => {
    const sourceCatalogText = await Bun.file('plan_fps/SOURCE_CATALOG.md').text();

    for (const sourceAuthority of expectedFixture.sourceAuthority.filter((source) => source.id.startsWith('S-FPS-'))) {
      expect(sourceCatalogText).toContain(`| ${sourceAuthority.id} `);
      expect(sourceCatalogText).toContain(sourceAuthority.authority);
      expect(sourceCatalogText).toContain(`\`${sourceAuthority.path}\``);
    }

    const inheritedSourceHashes = await readLaunchSurfaceManifestSourceHashes();

    expect(inheritedSourceHashes).toEqual(expectedFixture.sourceHashes);

    const launchSurfaceManifest = await readJson(expectedFixture.inheritedLaunchSurface.manifestPath);

    if (!isRecord(launchSurfaceManifest)) {
      throw new Error('01-015 launch-surface manifest is not an object.');
    }

    const commandContracts = launchSurfaceManifest.commandContracts;

    if (!isRecord(commandContracts) || !isRecord(commandContracts.targetPlayable)) {
      throw new Error('01-015 launch-surface manifest is missing targetPlayable command contracts.');
    }

    expect(commandContracts.targetPlayable.runtimeCommand).toBe(expectedFixture.captureCommand.runtimeCommand);

    if (!Array.isArray(launchSurfaceManifest.explicitNullSurfaces)) {
      throw new Error('01-015 launch-surface manifest is missing explicitNullSurfaces.');
    }

    const missingSurfaceNames = launchSurfaceManifest.explicitNullSurfaces.map((missingSurface) => {
      if (!isRecord(missingSurface) || typeof missingSurface.surface !== 'string') {
        throw new Error('01-015 null surface entry has an unexpected shape.');
      }

      return missingSurface.surface;
    });

    expect(missingSurfaceNames).toEqual(expect.arrayContaining(expectedFixture.inheritedLaunchSurface.missingSurfaces));
  });

  test('registers the oracle artifact', async () => {
    const referenceOraclesText = await Bun.file('plan_fps/REFERENCE_ORACLES.md').text();

    expect(referenceOraclesText).toContain('OR-FPS-033');
    expect(referenceOraclesText).toContain(`\`${fixturePath}\``);
    expect(referenceOraclesText).toContain('`bun test test/oracles/capture-music-event-hash-windows.test.ts`');
  });
});
