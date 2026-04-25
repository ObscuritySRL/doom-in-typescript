export const DEFAULT_LOCAL_IWAD_PATH = 'doom\\DOOM1.WAD';

export type DiscoverIwadPathOptions = {
  readonly defaultIwadPath?: string;
  readonly fileExists?: IwadPathExistenceProbe;
  readonly requestedIwadPath?: string | null;
};

export type DiscoverIwadPathResult =
  | {
      readonly iwadPath: string;
      readonly source: 'command-line';
      readonly status: 'discovered';
    }
  | {
      readonly iwadPath: string;
      readonly source: 'default-local-reference-bundle';
      readonly status: 'discovered';
    }
  | {
      readonly iwadPath: null;
      readonly source: 'default-local-reference-bundle';
      readonly status: 'missing';
    };

export type ImplementIwadDiscoveryContract = {
  readonly commandContract: {
    readonly command: 'bun run doom.ts';
    readonly entryFile: 'doom.ts';
    readonly program: 'bun';
    readonly subcommand: 'run';
  };
  readonly currentEntrypoint: {
    readonly command: 'bun run src/main.ts';
    readonly helpUsageLines: readonly ['bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', 'bun run start -- [--iwad <path-to-iwad>] --list-maps'];
    readonly path: 'src/main.ts';
    readonly scriptName: 'start';
    readonly sourceCatalogId: 'S-FPS-011';
  };
  readonly deterministicReplayCompatibility: {
    readonly discoveryStage: 'startup-before-game-session';
    readonly frameDependent: false;
    readonly gameStateMutation: false;
    readonly replayInputDependency: false;
  };
  readonly discovery: {
    readonly commandLineParameter: '--iwad';
    readonly defaultCandidate: {
      readonly path: typeof DEFAULT_LOCAL_IWAD_PATH;
      readonly source: 'local-reference-bundle';
    };
    readonly missingDefaultResult: 'null-deferred-to-03-008';
    readonly provider: 'Bun.file().exists()';
    readonly source: 'Bun-runtime-entrypoint';
  };
  readonly stepId: '03-007';
  readonly stepTitleSlug: 'implement-iwad-discovery';
};

export type IwadPathExistenceProbe = (iwadPath: string) => Promise<boolean>;

export const IMPLEMENT_IWAD_DISCOVERY_CONTRACT = {
  commandContract: {
    command: 'bun run doom.ts',
    entryFile: 'doom.ts',
    program: 'bun',
    subcommand: 'run',
  },
  currentEntrypoint: {
    command: 'bun run src/main.ts',
    helpUsageLines: ['bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', 'bun run start -- [--iwad <path-to-iwad>] --list-maps'],
    path: 'src/main.ts',
    scriptName: 'start',
    sourceCatalogId: 'S-FPS-011',
  },
  deterministicReplayCompatibility: {
    discoveryStage: 'startup-before-game-session',
    frameDependent: false,
    gameStateMutation: false,
    replayInputDependency: false,
  },
  discovery: {
    commandLineParameter: '--iwad',
    defaultCandidate: {
      path: DEFAULT_LOCAL_IWAD_PATH,
      source: 'local-reference-bundle',
    },
    missingDefaultResult: 'null-deferred-to-03-008',
    provider: 'Bun.file().exists()',
    source: 'Bun-runtime-entrypoint',
  },
  stepId: '03-007',
  stepTitleSlug: 'implement-iwad-discovery',
} as const satisfies ImplementIwadDiscoveryContract;

export async function discoverIwadPath(options: DiscoverIwadPathOptions = {}): Promise<DiscoverIwadPathResult> {
  if (options.requestedIwadPath !== null && options.requestedIwadPath !== undefined) {
    return {
      iwadPath: options.requestedIwadPath,
      source: 'command-line',
      status: 'discovered',
    };
  }

  const defaultIwadPath = options.defaultIwadPath ?? DEFAULT_LOCAL_IWAD_PATH;
  const fileExists = options.fileExists ?? iwadPathExistsWithBun;

  if (await fileExists(defaultIwadPath)) {
    return {
      iwadPath: defaultIwadPath,
      source: 'default-local-reference-bundle',
      status: 'discovered',
    };
  }

  return {
    iwadPath: null,
    source: 'default-local-reference-bundle',
    status: 'missing',
  };
}

async function iwadPathExistsWithBun(iwadPath: string): Promise<boolean> {
  return await Bun.file(iwadPath).exists();
}
