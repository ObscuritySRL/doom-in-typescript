import type { LauncherResources, LauncherSession } from '../../launcher/session.ts';

import { createLauncherSession } from '../../launcher/session.ts';
import { MainLoop } from '../../mainLoop.ts';

export type SharewareMapName = 'E1M1' | 'E1M2' | 'E1M3' | 'E1M4' | 'E1M5' | 'E1M6' | 'E1M7' | 'E1M8' | 'E1M9';

export type SharewareMapRouteStep = 'episode:e1' | 'main:new-game' | `map:${SharewareMapName}` | 'skill-select';

export interface StartSharewareMapsThroughValidRoutesOptions {
  readonly command: readonly string[];
  readonly mapName: string;
  readonly resources: LauncherResources;
  readonly route: readonly string[];
  readonly skill: number;
}

export interface StartSharewareMapsThroughValidRoutesResult {
  readonly mainLoop: MainLoop;
  readonly mapName: SharewareMapName;
  readonly route: readonly SharewareMapRouteStep[];
  readonly session: LauncherSession;
}

const SHAREWARE_MAP_NAMES = Object.freeze(['E1M1', 'E1M2', 'E1M3', 'E1M4', 'E1M5', 'E1M6', 'E1M7', 'E1M8', 'E1M9']) satisfies readonly SharewareMapName[];

const SHAREWARE_ROUTE_PREFIX = Object.freeze(['main:new-game', 'episode:e1', 'skill-select']) satisfies readonly SharewareMapRouteStep[];

const SHAREWARE_ROUTE_BY_MAP: Readonly<Record<SharewareMapName, readonly SharewareMapRouteStep[]>> = Object.freeze({
  E1M1: Object.freeze(['main:new-game', 'episode:e1', 'skill-select', 'map:E1M1'] as const),
  E1M2: Object.freeze(['main:new-game', 'episode:e1', 'skill-select', 'map:E1M2'] as const),
  E1M3: Object.freeze(['main:new-game', 'episode:e1', 'skill-select', 'map:E1M3'] as const),
  E1M4: Object.freeze(['main:new-game', 'episode:e1', 'skill-select', 'map:E1M4'] as const),
  E1M5: Object.freeze(['main:new-game', 'episode:e1', 'skill-select', 'map:E1M5'] as const),
  E1M6: Object.freeze(['main:new-game', 'episode:e1', 'skill-select', 'map:E1M6'] as const),
  E1M7: Object.freeze(['main:new-game', 'episode:e1', 'skill-select', 'map:E1M7'] as const),
  E1M8: Object.freeze(['main:new-game', 'episode:e1', 'skill-select', 'map:E1M8'] as const),
  E1M9: Object.freeze(['main:new-game', 'episode:e1', 'skill-select', 'map:E1M9'] as const),
});

export const START_SHAREWARE_MAPS_THROUGH_VALID_ROUTES_CONTRACT = Object.freeze({
  audit: Object.freeze({
    manifestPath: 'plan_fps/manifests/01-009-audit-missing-menu-to-e1m1.json',
    schemaVersion: 1,
    stepId: '01-009',
    surfaceIds: Object.freeze(['episode-menu-route', 'menu-to-e1m1-transition', 'skill-menu-route']),
  }),
  commandContract: Object.freeze({
    entryFile: 'doom.ts',
    program: 'bun',
    subcommand: 'run',
  }),
  routePrefix: SHAREWARE_ROUTE_PREFIX,
  schemaVersion: 1,
  sharewareMaps: SHAREWARE_MAP_NAMES,
  stepId: '08-002',
  stepTitle: 'start-shareware-maps-through-valid-routes',
});

/**
 * Start an episode-one shareware map from a validated Bun runtime route.
 *
 * @param options Runtime command, menu route, IWAD resources, target map, and skill.
 * @returns A fresh launcher session plus an unopened main loop for later deterministic ticking.
 * @example
 * ```ts
 * const result = startSharewareMapsThroughValidRoutes({
 *   command: ["bun", "run", "doom.ts"],
 *   mapName: "E1M2",
 *   resources,
 *   route: ["main:new-game", "episode:e1", "skill-select", "map:E1M2"],
 *   skill: 2,
 * });
 * ```
 */
export function startSharewareMapsThroughValidRoutes(options: StartSharewareMapsThroughValidRoutesOptions): StartSharewareMapsThroughValidRoutesResult {
  validateRuntimeCommand(options.command);

  const mapName = normalizeSharewareMapName(options.mapName);
  const route = SHAREWARE_ROUTE_BY_MAP[mapName];

  validateRoute(options.route, route, mapName);

  if (!options.resources.mapNames.includes(mapName)) {
    throw new RangeError(`shareware map ${mapName} is not available in IWAD resources`);
  }

  return Object.freeze({
    mainLoop: new MainLoop(),
    mapName,
    route,
    session: createLauncherSession(options.resources, {
      mapName,
      skill: options.skill,
    }),
  });
}

function normalizeSharewareMapName(mapName: string): SharewareMapName {
  switch (mapName.toUpperCase()) {
    case 'E1M1':
      return 'E1M1';
    case 'E1M2':
      return 'E1M2';
    case 'E1M3':
      return 'E1M3';
    case 'E1M4':
      return 'E1M4';
    case 'E1M5':
      return 'E1M5';
    case 'E1M6':
      return 'E1M6';
    case 'E1M7':
      return 'E1M7';
    case 'E1M8':
      return 'E1M8';
    case 'E1M9':
      return 'E1M9';
    default:
      throw new RangeError(`shareware map must be E1M1 through E1M9, got ${mapName}`);
  }
}

function validateRoute(route: readonly string[], expectedRoute: readonly SharewareMapRouteStep[], mapName: SharewareMapName): void {
  if (route.length !== expectedRoute.length) {
    throw new Error(`shareware route for ${mapName} must be ${expectedRoute.join(' -> ')}`);
  }

  for (let routeIndex = 0; routeIndex < expectedRoute.length; routeIndex += 1) {
    if (route[routeIndex] !== expectedRoute[routeIndex]) {
      throw new Error(`shareware route for ${mapName} must be ${expectedRoute.join(' -> ')}`);
    }
  }
}

function validateRuntimeCommand(command: readonly string[]): void {
  if (command.length !== 3 || command[0] !== 'bun' || command[1] !== 'run' || command[2] !== 'doom.ts') {
    throw new Error('start shareware maps requires command "bun run doom.ts"');
  }
}
