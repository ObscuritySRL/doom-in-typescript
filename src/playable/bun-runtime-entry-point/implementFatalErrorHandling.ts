export const IMPLEMENT_FATAL_ERROR_HANDLING_CONTRACT = {
  auditedCurrentLauncherSurface: {
    command: 'bun run src/main.ts',
    helpUsageLines: ['bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', 'bun run start -- [--iwad <path-to-iwad>] --list-maps'],
    path: 'src/main.ts',
    scriptName: 'start',
    sourceCatalogId: 'S-FPS-011',
  },
  commandContract: {
    command: 'bun run doom.ts',
    entryFile: 'doom.ts',
    program: 'bun',
    subcommand: 'run',
  },
  currentLauncherFatalPath: {
    catchWrapper: 'void main().catch((error: unknown) => {',
    exitCall: 'process.exit(1);',
    stderrCall: 'console.error(message);',
  },
  deterministicReplayCompatibility: {
    consumesReplayInput: false,
    mutatesGameState: false,
    mutatesGlobalProcessState: false,
    mutatesRandomSeed: false,
    phase: 'pre-session-launch',
  },
  fatalErrorHandling: {
    exitCode: 1,
    outputStream: 'stderr',
    prefix: 'Fatal error:',
    unknownFallback: 'Unknown fatal error.',
  },
  stepId: '03-013',
  stepTitle: 'implement-fatal-error-handling',
} as const;

export type FatalErrorHandlingResult = Readonly<{
  auditedCurrentLauncherSurface: typeof IMPLEMENT_FATAL_ERROR_HANDLING_CONTRACT.auditedCurrentLauncherSurface;
  deterministicReplayCompatibility: typeof IMPLEMENT_FATAL_ERROR_HANDLING_CONTRACT.deterministicReplayCompatibility;
  exitCode: typeof IMPLEMENT_FATAL_ERROR_HANDLING_CONTRACT.fatalErrorHandling.exitCode;
  outputStream: typeof IMPLEMENT_FATAL_ERROR_HANDLING_CONTRACT.fatalErrorHandling.outputStream;
  runtimeCommand: typeof IMPLEMENT_FATAL_ERROR_HANDLING_CONTRACT.commandContract.command;
  status: 'fatal-error';
  stderrLine: string;
}>;

function extractFatalErrorMessage(fatalError: unknown): string {
  if (fatalError instanceof Error) {
    const normalizedMessage = fatalError.message.trim();

    if (normalizedMessage.length > 0) {
      return normalizedMessage;
    }
  }

  if (typeof fatalError === 'string') {
    const normalizedMessage = fatalError.trim();

    if (normalizedMessage.length > 0) {
      return normalizedMessage;
    }
  }

  return IMPLEMENT_FATAL_ERROR_HANDLING_CONTRACT.fatalErrorHandling.unknownFallback;
}

export function implementFatalErrorHandling(runtimeCommand: string, fatalError: unknown): FatalErrorHandlingResult {
  const expectedRuntimeCommand = IMPLEMENT_FATAL_ERROR_HANDLING_CONTRACT.commandContract.command;

  if (runtimeCommand !== expectedRuntimeCommand) {
    throw new Error(`Fatal error handling is only available through ${expectedRuntimeCommand}.`);
  }

  const errorMessage = extractFatalErrorMessage(fatalError);

  return {
    auditedCurrentLauncherSurface: IMPLEMENT_FATAL_ERROR_HANDLING_CONTRACT.auditedCurrentLauncherSurface,
    deterministicReplayCompatibility: IMPLEMENT_FATAL_ERROR_HANDLING_CONTRACT.deterministicReplayCompatibility,
    exitCode: IMPLEMENT_FATAL_ERROR_HANDLING_CONTRACT.fatalErrorHandling.exitCode,
    outputStream: IMPLEMENT_FATAL_ERROR_HANDLING_CONTRACT.fatalErrorHandling.outputStream,
    runtimeCommand: expectedRuntimeCommand,
    status: 'fatal-error',
    stderrLine: `${IMPLEMENT_FATAL_ERROR_HANDLING_CONTRACT.fatalErrorHandling.prefix} ${errorMessage}`,
  };
}
