type ImplementStartupLoggingContract = {
  readonly currentLauncherSurface: {
    readonly command: 'bun run src/main.ts';
    readonly path: 'src/main.ts';
    readonly scriptName: 'start';
    readonly startupLogLines: readonly ['Launching ${session.mapName} from ${resources.iwadPath}', 'Opening gameplay window. Use Tab to switch to the automap.'];
    readonly startupStage: 'after-createLauncherSession-before-runLauncherWindow';
  };
  readonly deterministicReplayCompatibility: {
    readonly consumesReplayInput: false;
    readonly mutatesGameState: false;
    readonly mutatesGlobalRandomSeed: false;
    readonly opensWindowHost: false;
    readonly stage: 'startup-logging-only';
  };
  readonly logTemplates: {
    readonly launchPrefix: 'Launching ';
    readonly launchSeparator: ' from ';
    readonly windowOpenLine: 'Opening gameplay window. Use Tab to switch to the automap.';
  };
  readonly runtimeTarget: {
    readonly command: 'bun run doom.ts';
    readonly entryFile: 'doom.ts';
    readonly program: 'bun';
    readonly subcommand: 'run';
  };
  readonly stepId: '03-014';
  readonly stepTitle: 'implement-startup-logging';
  readonly unsupportedCurrentCommand: 'bun run src/main.ts';
};

export type StartupLoggingInput = {
  readonly command: string;
  readonly iwadPath: string;
  readonly mapName: string;
};

export type StartupLoggingResult = {
  readonly command: 'bun run doom.ts';
  readonly logLines: readonly [string, string];
};

export const IMPLEMENT_STARTUP_LOGGING_CONTRACT = {
  currentLauncherSurface: {
    command: 'bun run src/main.ts',
    path: 'src/main.ts',
    scriptName: 'start',
    startupLogLines: ['Launching ${session.mapName} from ${resources.iwadPath}', 'Opening gameplay window. Use Tab to switch to the automap.'],
    startupStage: 'after-createLauncherSession-before-runLauncherWindow',
  },
  deterministicReplayCompatibility: {
    consumesReplayInput: false,
    mutatesGameState: false,
    mutatesGlobalRandomSeed: false,
    opensWindowHost: false,
    stage: 'startup-logging-only',
  },
  logTemplates: {
    launchPrefix: 'Launching ',
    launchSeparator: ' from ',
    windowOpenLine: 'Opening gameplay window. Use Tab to switch to the automap.',
  },
  runtimeTarget: {
    command: 'bun run doom.ts',
    entryFile: 'doom.ts',
    program: 'bun',
    subcommand: 'run',
  },
  stepId: '03-014',
  stepTitle: 'implement-startup-logging',
  unsupportedCurrentCommand: 'bun run src/main.ts',
} as const satisfies ImplementStartupLoggingContract;

export function implementStartupLogging(input: StartupLoggingInput): StartupLoggingResult {
  if (input.command !== IMPLEMENT_STARTUP_LOGGING_CONTRACT.runtimeTarget.command) {
    throw new Error(`Startup logging requires ${IMPLEMENT_STARTUP_LOGGING_CONTRACT.runtimeTarget.command}, got "${input.command}".`);
  }

  if (input.mapName.trim().length === 0) {
    throw new Error('Startup logging requires a non-empty mapName.');
  }

  if (input.iwadPath.trim().length === 0) {
    throw new Error('Startup logging requires a non-empty iwadPath.');
  }

  return {
    command: IMPLEMENT_STARTUP_LOGGING_CONTRACT.runtimeTarget.command,
    logLines: [
      `${IMPLEMENT_STARTUP_LOGGING_CONTRACT.logTemplates.launchPrefix}${input.mapName}${IMPLEMENT_STARTUP_LOGGING_CONTRACT.logTemplates.launchSeparator}${input.iwadPath}`,
      IMPLEMENT_STARTUP_LOGGING_CONTRACT.logTemplates.windowOpenLine,
    ],
  };
}
