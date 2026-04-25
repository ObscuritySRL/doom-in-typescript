export interface MissingIwadErrorContract {
  readonly currentEntrypoint: CurrentEntrypointContract;
  readonly deterministicReplayCompatibility: DeterministicReplayCompatibility;
  readonly missingIwadError: MissingIwadErrorDetails;
  readonly schemaVersion: 1;
  readonly stepId: '03-008';
  readonly stepTitleSlug: 'implement-missing-iwad-error';
  readonly targetCommand: TargetCommandContract;
}

export interface MissingIwadErrorInput {
  readonly checkedPaths: readonly string[];
  readonly explicitPath: string | null;
}

interface CurrentEntrypointContract {
  readonly command: 'bun run src/main.ts';
  readonly helpUsageLines: readonly ['bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', 'bun run start -- [--iwad <path-to-iwad>] --list-maps'];
  readonly path: 'src/main.ts';
  readonly scriptName: 'start';
  readonly sourceCatalogId: 'S-FPS-011';
}

interface DeterministicReplayCompatibility {
  readonly failureTiming: 'launcher-startup-before-session';
  readonly mutatesGameState: false;
  readonly mutatesReplayInput: false;
  readonly requiresWindowHost: false;
}

interface MissingIwadErrorDetails {
  readonly defaultCandidatePath: 'doom\\DOOM1.WAD';
  readonly explicitArgument: '--iwad <path-to-iwad>';
  readonly failureKind: 'missing-iwad';
  readonly messageHeader: 'Missing IWAD file for playable launch.';
  readonly recoveryText: 'Provide --iwad <path-to-iwad> or place DOOM1.WAD at doom\\DOOM1.WAD.';
  readonly reportsCheckedPaths: true;
  readonly throwsBeforeWindow: true;
}

interface TargetCommandContract {
  readonly command: 'bun run doom.ts';
  readonly entryFile: 'doom.ts';
  readonly program: 'bun';
  readonly subcommand: 'run';
}

export const IMPLEMENT_MISSING_IWAD_ERROR_CONTRACT = {
  currentEntrypoint: {
    command: 'bun run src/main.ts',
    helpUsageLines: ['bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', 'bun run start -- [--iwad <path-to-iwad>] --list-maps'],
    path: 'src/main.ts',
    scriptName: 'start',
    sourceCatalogId: 'S-FPS-011',
  },
  deterministicReplayCompatibility: {
    failureTiming: 'launcher-startup-before-session',
    mutatesGameState: false,
    mutatesReplayInput: false,
    requiresWindowHost: false,
  },
  missingIwadError: {
    defaultCandidatePath: 'doom\\DOOM1.WAD',
    explicitArgument: '--iwad <path-to-iwad>',
    failureKind: 'missing-iwad',
    messageHeader: 'Missing IWAD file for playable launch.',
    recoveryText: 'Provide --iwad <path-to-iwad> or place DOOM1.WAD at doom\\DOOM1.WAD.',
    reportsCheckedPaths: true,
    throwsBeforeWindow: true,
  },
  schemaVersion: 1,
  stepId: '03-008',
  stepTitleSlug: 'implement-missing-iwad-error',
  targetCommand: {
    command: 'bun run doom.ts',
    entryFile: 'doom.ts',
    program: 'bun',
    subcommand: 'run',
  },
} as const satisfies MissingIwadErrorContract;

/**
 * Format the launcher error emitted when IWAD discovery has no playable path.
 *
 * @param input Missing-IWAD launch context.
 * @returns A stable, user-facing startup error message.
 * @example
 * ```ts
 * formatMissingIwadError({ checkedPaths: ['doom\\DOOM1.WAD'], explicitPath: null });
 * ```
 */
export function formatMissingIwadError(input: MissingIwadErrorInput): string {
  const checkedPathLines = input.checkedPaths.length === 0 ? ['Checked paths: none'] : ['Checked paths:', ...input.checkedPaths.map((checkedPath) => `- ${checkedPath}`)];
  const explicitPathLine = input.explicitPath === null ? 'Explicit --iwad path: not provided' : `Explicit --iwad path: ${input.explicitPath}`;

  return [IMPLEMENT_MISSING_IWAD_ERROR_CONTRACT.missingIwadError.messageHeader, IMPLEMENT_MISSING_IWAD_ERROR_CONTRACT.missingIwadError.recoveryText, explicitPathLine, ...checkedPathLines].join('\n');
}

/**
 * Create the startup Error used when IWAD discovery fails.
 *
 * @param input Missing-IWAD launch context.
 * @returns An Error containing the stable missing-IWAD message.
 * @example
 * ```ts
 * createMissingIwadError({ checkedPaths: ['doom\\DOOM1.WAD'], explicitPath: null });
 * ```
 */
export function createMissingIwadError(input: MissingIwadErrorInput): Error {
  return new Error(formatMissingIwadError(input));
}
