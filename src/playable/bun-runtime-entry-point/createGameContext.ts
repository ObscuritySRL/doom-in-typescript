const DEFAULT_MAP_NAME = 'E1M1';
const DEFAULT_SCALE = 2;
const DEFAULT_SKILL = 2;

export interface CreateGameContextCommandContract {
  readonly command: 'bun run doom.ts';
  readonly entryFile: 'doom.ts';
  readonly program: 'bun';
  readonly subcommand: 'run';
}

export interface CreateGameContextContract {
  readonly commandContract: CreateGameContextCommandContract;
  readonly contextCreation: {
    readonly defaultMapName: typeof DEFAULT_MAP_NAME;
    readonly defaultScale: typeof DEFAULT_SCALE;
    readonly defaultSkill: typeof DEFAULT_SKILL;
    readonly ownerStepId: '03-010';
    readonly phase: 'launcher-startup-before-title-loop';
    readonly runtimePath: 'bun-runtime-entry-point';
    readonly surface: 'game-context';
  };
  readonly currentEntrypoint: {
    readonly command: 'bun run src/main.ts';
    readonly helpUsageLines: readonly ['bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', 'bun run start -- [--iwad <path-to-iwad>] --list-maps'];
    readonly path: 'src/main.ts';
    readonly scriptName: 'start';
    readonly sourceCatalogId: 'S-FPS-011';
  };
  readonly deterministicReplayCompatibility: {
    readonly consumesReplayInput: false;
    readonly createsLauncherSession: false;
    readonly createsWindow: false;
    readonly loadsIwadBytes: false;
    readonly mutatesGameSimulation: false;
    readonly mutatesGlobalState: false;
    readonly replayStateBoundary: 'context-metadata-only-before-title-loop';
  };
  readonly manifestAuthority: {
    readonly auditManifestPath: 'plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json';
    readonly schemaVersion: 1;
    readonly stepId: '01-007';
  };
}

export interface CreateGameContextInput {
  readonly configuration?: Readonly<Record<string, string>>;
  readonly iwadPath: string;
  readonly mapName?: string;
  readonly scale?: number;
  readonly skill?: number;
}

export interface GameContext {
  readonly commandContract: CreateGameContextCommandContract;
  readonly configuration: Readonly<Record<string, string>>;
  readonly deterministicReplayCompatibility: CreateGameContextContract['deterministicReplayCompatibility'];
  readonly iwadPath: string;
  readonly lifecyclePhase: 'context-created-before-title-loop';
  readonly mapName: string;
  readonly runtimePath: CreateGameContextContract['contextCreation']['runtimePath'];
  readonly scale: number;
  readonly skill: number;
}

export const CREATE_GAME_CONTEXT_CONTRACT = {
  commandContract: {
    command: 'bun run doom.ts',
    entryFile: 'doom.ts',
    program: 'bun',
    subcommand: 'run',
  },
  contextCreation: {
    defaultMapName: DEFAULT_MAP_NAME,
    defaultScale: DEFAULT_SCALE,
    defaultSkill: DEFAULT_SKILL,
    ownerStepId: '03-010',
    phase: 'launcher-startup-before-title-loop',
    runtimePath: 'bun-runtime-entry-point',
    surface: 'game-context',
  },
  currentEntrypoint: {
    command: 'bun run src/main.ts',
    helpUsageLines: ['bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', 'bun run start -- [--iwad <path-to-iwad>] --list-maps'],
    path: 'src/main.ts',
    scriptName: 'start',
    sourceCatalogId: 'S-FPS-011',
  },
  deterministicReplayCompatibility: {
    consumesReplayInput: false,
    createsLauncherSession: false,
    createsWindow: false,
    loadsIwadBytes: false,
    mutatesGameSimulation: false,
    mutatesGlobalState: false,
    replayStateBoundary: 'context-metadata-only-before-title-loop',
  },
  manifestAuthority: {
    auditManifestPath: 'plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json',
    schemaVersion: 1,
    stepId: '01-007',
  },
} as const satisfies CreateGameContextContract;

export function createGameContext(input: CreateGameContextInput): GameContext {
  if (input.iwadPath.trim().length === 0) {
    throw new Error('iwadPath is required to create a game context.');
  }

  const mapName = (input.mapName ?? CREATE_GAME_CONTEXT_CONTRACT.contextCreation.defaultMapName).trim();

  if (mapName.length === 0) {
    throw new Error('mapName must not be empty.');
  }

  const scale = input.scale ?? CREATE_GAME_CONTEXT_CONTRACT.contextCreation.defaultScale;
  const skill = input.skill ?? CREATE_GAME_CONTEXT_CONTRACT.contextCreation.defaultSkill;

  if (!Number.isInteger(scale) || scale < 1) {
    throw new Error(`scale must be a positive integer, got "${scale}".`);
  }

  if (!Number.isInteger(skill) || skill < 1) {
    throw new Error(`skill must be a positive integer, got "${skill}".`);
  }

  return {
    commandContract: CREATE_GAME_CONTEXT_CONTRACT.commandContract,
    configuration: {
      ...(input.configuration ?? {}),
    },
    deterministicReplayCompatibility: CREATE_GAME_CONTEXT_CONTRACT.deterministicReplayCompatibility,
    iwadPath: input.iwadPath,
    lifecyclePhase: 'context-created-before-title-loop',
    mapName: mapName.toUpperCase(),
    runtimePath: CREATE_GAME_CONTEXT_CONTRACT.contextCreation.runtimePath,
    scale,
    skill,
  };
}
