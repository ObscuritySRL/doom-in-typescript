export const IMPLEMENT_CLEAN_QUIT_CONTRACT = {
  cleanQuitBehavior: {
    acceptedReasons: ['escape-key', 'window-close', 'launcher-complete'],
    exitCode: 0,
    fatalErrorPath: 'deferred-to-03-013',
    processExitCall: 'not-used-for-clean-quit',
    resultState: 'cleanly-quit',
  },
  currentLauncherTransition: {
    auditManifestPath: 'plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json',
    auditSchemaVersion: 1,
    currentCommand: 'bun run src/main.ts',
    currentEntryPath: 'src/main.ts',
    currentScriptName: 'start',
    helpQuitBinding: 'Esc: quit',
    launcherAwaitSurface: 'await runLauncherWindow(session, { scale, title })',
  },
  deterministicReplayCompatibility: {
    consumesReplayInput: false,
    dependsOnWallClock: false,
    mutatesGameState: false,
    mutatesGlobalRandomSeed: false,
    mutatesSimulationState: false,
    recordsInputTrace: false,
  },
  stepId: '03-012',
  stepTitleSlug: 'implement-clean-quit',
  targetCommand: {
    command: 'bun run doom.ts',
    entryFile: 'doom.ts',
    program: 'bun',
    subcommand: 'run',
  },
} as const;

export type CleanQuitReason = (typeof IMPLEMENT_CLEAN_QUIT_CONTRACT.cleanQuitBehavior.acceptedReasons)[number];

export type CleanQuitResult = {
  readonly command: typeof IMPLEMENT_CLEAN_QUIT_CONTRACT.targetCommand.command;
  readonly exitCode: typeof IMPLEMENT_CLEAN_QUIT_CONTRACT.cleanQuitBehavior.exitCode;
  readonly processExitCall: typeof IMPLEMENT_CLEAN_QUIT_CONTRACT.cleanQuitBehavior.processExitCall;
  readonly reason: CleanQuitReason;
  readonly resultState: typeof IMPLEMENT_CLEAN_QUIT_CONTRACT.cleanQuitBehavior.resultState;
};

/**
 * Creates the clean quit result for the Bun playable entrypoint.
 *
 * @param command - Launch command requesting the clean quit lifecycle path.
 * @param reason - Clean quit trigger reported by the playable host.
 * @returns A deterministic clean quit result with exit code 0.
 * @example
 * ```ts
 * const result = implementCleanQuit('bun run doom.ts', 'escape-key');
 * console.log(result.exitCode);
 * ```
 */
export function implementCleanQuit(command: string, reason: CleanQuitReason): CleanQuitResult {
  if (command !== IMPLEMENT_CLEAN_QUIT_CONTRACT.targetCommand.command) {
    throw new Error(`Clean quit is only wired for bun run doom.ts, got "${command}".`);
  }

  return {
    command: IMPLEMENT_CLEAN_QUIT_CONTRACT.targetCommand.command,
    exitCode: IMPLEMENT_CLEAN_QUIT_CONTRACT.cleanQuitBehavior.exitCode,
    processExitCall: IMPLEMENT_CLEAN_QUIT_CONTRACT.cleanQuitBehavior.processExitCall,
    reason,
    resultState: IMPLEMENT_CLEAN_QUIT_CONTRACT.cleanQuitBehavior.resultState,
  };
}
