export const ENTER_DEFAULT_TITLE_LOOP_CONTRACT = {
  auditManifestPath: 'plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json',
  bunRuntimePath: {
    command: 'bun run doom.ts',
    entryFile: 'doom.ts',
    program: 'bun',
    subcommand: 'run',
  },
  currentLauncherTransition: {
    command: 'bun run src/main.ts',
    helpUsageLines: ['bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', 'bun run start -- [--iwad <path-to-iwad>] --list-maps'],
    path: 'src/main.ts',
    scriptName: 'start',
    sourceCatalogId: 'S-FPS-011',
  },
  deterministicReplayCompatibility: {
    consumesReplayInput: false,
    createsWindowHost: false,
    loadsIwadBytes: false,
    mutatesGameState: false,
    mutatesGlobalRandomSeed: false,
    recordsLoopStateOnly: true,
  },
  stepId: '03-011',
  stepTitleSlug: 'enter-default-title-loop',
  titleLoop: {
    defaultMapName: 'E1M1',
    initialScreen: 'title',
    menuInitiallyOpen: false,
    source: 'vanilla-startup-title-loop',
    startsGameplay: false,
  },
} as const;

export type DefaultTitleLoopInput = {
  readonly command?: string;
};

export type DefaultTitleLoopState = {
  readonly command: typeof ENTER_DEFAULT_TITLE_LOOP_CONTRACT.bunRuntimePath.command;
  readonly currentScreen: typeof ENTER_DEFAULT_TITLE_LOOP_CONTRACT.titleLoop.initialScreen;
  readonly gameTic: 0;
  readonly mapName: typeof ENTER_DEFAULT_TITLE_LOOP_CONTRACT.titleLoop.defaultMapName;
  readonly menuOpen: typeof ENTER_DEFAULT_TITLE_LOOP_CONTRACT.titleLoop.menuInitiallyOpen;
  readonly replayInputConsumed: typeof ENTER_DEFAULT_TITLE_LOOP_CONTRACT.deterministicReplayCompatibility.consumesReplayInput;
  readonly windowHostCreated: typeof ENTER_DEFAULT_TITLE_LOOP_CONTRACT.deterministicReplayCompatibility.createsWindowHost;
};

export function enterDefaultTitleLoop(input: DefaultTitleLoopInput = {}): DefaultTitleLoopState {
  const command = input.command ?? ENTER_DEFAULT_TITLE_LOOP_CONTRACT.bunRuntimePath.command;

  if (command !== ENTER_DEFAULT_TITLE_LOOP_CONTRACT.bunRuntimePath.command) {
    throw new Error(`Default title loop must be entered through bun run doom.ts, got "${command}".`);
  }

  return {
    command: ENTER_DEFAULT_TITLE_LOOP_CONTRACT.bunRuntimePath.command,
    currentScreen: ENTER_DEFAULT_TITLE_LOOP_CONTRACT.titleLoop.initialScreen,
    gameTic: 0,
    mapName: ENTER_DEFAULT_TITLE_LOOP_CONTRACT.titleLoop.defaultMapName,
    menuOpen: ENTER_DEFAULT_TITLE_LOOP_CONTRACT.titleLoop.menuInitiallyOpen,
    replayInputConsumed: ENTER_DEFAULT_TITLE_LOOP_CONTRACT.deterministicReplayCompatibility.consumesReplayInput,
    windowHostCreated: ENTER_DEFAULT_TITLE_LOOP_CONTRACT.deterministicReplayCompatibility.createsWindowHost,
  };
}
