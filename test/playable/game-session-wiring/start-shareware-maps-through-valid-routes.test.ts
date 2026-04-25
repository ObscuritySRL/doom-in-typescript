import { describe, expect, test } from 'bun:test';

import type { LauncherResources } from '../../../src/launcher/session.ts';

import { loadLauncherResources } from '../../../src/launcher/session.ts';
import { START_SHAREWARE_MAPS_THROUGH_VALID_ROUTES_CONTRACT, startSharewareMapsThroughValidRoutes } from '../../../src/playable/game-session-wiring/startSharewareMapsThroughValidRoutes.ts';

const EXPECTED_SOURCE_SHA256 = 'f5823c314136d1ceb7d86a7cb62a3691d036cb638999e568e767dab464f035f9';
const SOURCE_PATH = 'src/playable/game-session-wiring/startSharewareMapsThroughValidRoutes.ts';

interface MenuToE1M1AuditManifest {
  readonly commandContracts: {
    readonly targetRuntime: {
      readonly command: string;
      readonly entryFile: string;
      readonly implementedInReadScope: boolean;
    };
  };
  readonly explicitNullSurfaces: readonly {
    readonly surfaceId: string;
  }[];
  readonly schemaVersion: number;
  readonly stepId: string;
}

let launcherResourcesPromise: Promise<LauncherResources> | null = null;

function getLauncherResources(): Promise<LauncherResources> {
  launcherResourcesPromise ??= loadLauncherResources('doom/DOOM1.WAD');
  return launcherResourcesPromise;
}

describe('startSharewareMapsThroughValidRoutes', () => {
  test('locks the exact command contract and audit manifest linkage', async () => {
    expect(START_SHAREWARE_MAPS_THROUGH_VALID_ROUTES_CONTRACT).toEqual({
      audit: {
        manifestPath: 'plan_fps/manifests/01-009-audit-missing-menu-to-e1m1.json',
        schemaVersion: 1,
        stepId: '01-009',
        surfaceIds: ['episode-menu-route', 'menu-to-e1m1-transition', 'skill-menu-route'],
      },
      commandContract: {
        entryFile: 'doom.ts',
        program: 'bun',
        subcommand: 'run',
      },
      routePrefix: ['main:new-game', 'episode:e1', 'skill-select'],
      schemaVersion: 1,
      sharewareMaps: ['E1M1', 'E1M2', 'E1M3', 'E1M4', 'E1M5', 'E1M6', 'E1M7', 'E1M8', 'E1M9'],
      stepId: '08-002',
      stepTitle: 'start-shareware-maps-through-valid-routes',
    });

    const manifestUnknown: unknown = await Bun.file(START_SHAREWARE_MAPS_THROUGH_VALID_ROUTES_CONTRACT.audit.manifestPath).json();

    if (!isMenuToE1M1AuditManifest(manifestUnknown)) {
      throw new Error('01-009 audit manifest shape changed');
    }

    expect(manifestUnknown.commandContracts.targetRuntime.command).toBe('bun run doom.ts');
    expect(manifestUnknown.commandContracts.targetRuntime.entryFile).toBe(START_SHAREWARE_MAPS_THROUGH_VALID_ROUTES_CONTRACT.commandContract.entryFile);
    expect(manifestUnknown.commandContracts.targetRuntime.implementedInReadScope).toBe(false);
    expect(manifestUnknown.schemaVersion).toBe(START_SHAREWARE_MAPS_THROUGH_VALID_ROUTES_CONTRACT.audit.schemaVersion);
    expect(manifestUnknown.stepId).toBe(START_SHAREWARE_MAPS_THROUGH_VALID_ROUTES_CONTRACT.audit.stepId);

    const nullSurfaceIds = manifestUnknown.explicitNullSurfaces.map((surface) => surface.surfaceId);

    for (const surfaceId of START_SHAREWARE_MAPS_THROUGH_VALID_ROUTES_CONTRACT.audit.surfaceIds) {
      expect(nullSurfaceIds).toContain(surfaceId);
    }
  });

  test('locks the implementation source hash', async () => {
    expect(await sha256File(SOURCE_PATH)).toBe(EXPECTED_SOURCE_SHA256);
  });

  test('starts a shareware map through the validated route without advancing replay state', async () => {
    const resources = await getLauncherResources();
    const result = startSharewareMapsThroughValidRoutes({
      command: ['bun', 'run', 'doom.ts'],
      mapName: 'e1m9',
      resources,
      route: ['main:new-game', 'episode:e1', 'skill-select', 'map:E1M9'],
      skill: 2,
    });

    expect(result.mainLoop.frameCount).toBe(0);
    expect(result.mainLoop.started).toBe(false);
    expect(result.mapName).toBe('E1M9');
    expect(result.route).toEqual(['main:new-game', 'episode:e1', 'skill-select', 'map:E1M9']);
    expect(result.session.levelTime).toBe(0);
    expect(result.session.mapName).toBe('E1M9');
    expect(result.session.player.mo).not.toBeNull();
    expect(result.session.showAutomap).toBe(false);
  });

  test('rejects non-Bun runtime commands before creating a session', async () => {
    const resources = await getLauncherResources();

    expect(() =>
      startSharewareMapsThroughValidRoutes({
        command: ['bun', 'run', 'src/main.ts'],
        mapName: 'E1M1',
        resources,
        route: ['main:new-game', 'episode:e1', 'skill-select', 'map:E1M1'],
        skill: 2,
      }),
    ).toThrow('start shareware maps requires command "bun run doom.ts"');
  });

  test('rejects maps outside the shareware episode', async () => {
    const resources = await getLauncherResources();

    expect(() =>
      startSharewareMapsThroughValidRoutes({
        command: ['bun', 'run', 'doom.ts'],
        mapName: 'E2M1',
        resources,
        route: ['main:new-game', 'episode:e1', 'skill-select', 'map:E2M1'],
        skill: 2,
      }),
    ).toThrow('shareware map must be E1M1 through E1M9, got E2M1');
  });

  test('rejects routes that do not match the requested shareware map', async () => {
    const resources = await getLauncherResources();

    expect(() =>
      startSharewareMapsThroughValidRoutes({
        command: ['bun', 'run', 'doom.ts'],
        mapName: 'E1M2',
        resources,
        route: ['main:new-game', 'episode:e1', 'skill-select', 'map:E1M1'],
        skill: 2,
      }),
    ).toThrow('shareware route for E1M2 must be main:new-game -> episode:e1 -> skill-select -> map:E1M2');
  });

  test('rejects unavailable shareware maps before session creation', async () => {
    const resources = await getLauncherResources();
    const unavailableResources: LauncherResources = {
      ...resources,
      mapNames: resources.mapNames.filter((mapName) => mapName !== 'E1M9'),
    };

    expect(() =>
      startSharewareMapsThroughValidRoutes({
        command: ['bun', 'run', 'doom.ts'],
        mapName: 'E1M9',
        resources: unavailableResources,
        route: ['main:new-game', 'episode:e1', 'skill-select', 'map:E1M9'],
        skill: 2,
      }),
    ).toThrow('shareware map E1M9 is not available in IWAD resources');
  });
});

async function sha256File(path: string): Promise<string> {
  const digestBuffer = await crypto.subtle.digest('SHA-256', await Bun.file(path).arrayBuffer());
  return Array.from(new Uint8Array(digestBuffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function isMenuToE1M1AuditManifest(value: unknown): value is MenuToE1M1AuditManifest {
  if (!isRecord(value) || typeof value.schemaVersion !== 'number' || typeof value.stepId !== 'string') {
    return false;
  }

  if (!Array.isArray(value.explicitNullSurfaces)) {
    return false;
  }

  const commandContracts = value.commandContracts;

  if (!isRecord(commandContracts)) {
    return false;
  }

  const targetRuntime = commandContracts.targetRuntime;

  if (!isRecord(targetRuntime)) {
    return false;
  }

  return (
    typeof targetRuntime.command === 'string' &&
    typeof targetRuntime.entryFile === 'string' &&
    typeof targetRuntime.implementedInReadScope === 'boolean' &&
    value.explicitNullSurfaces.every((surface) => isRecord(surface) && typeof surface.surfaceId === 'string')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
