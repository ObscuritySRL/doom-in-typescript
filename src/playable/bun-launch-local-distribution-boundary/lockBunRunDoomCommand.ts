export const LOCKED_BUN_RUN_DOOM_COMMAND = 'bun run doom.ts';

const COMMAND_ARGUMENTS = Object.freeze(['run', 'doom.ts'] as const);
const LEGACY_PACKAGE_START_SCRIPT = 'bun run src/main.ts';
const RUNTIME_PROGRAM = 'bun';
const STEP_IDENTIFIER = '14-001';

export type BunRunDoomCommandLockEvidence = Readonly<{
  commandArguments: readonly ['run', 'doom.ts'];
  commandHash: string;
  deterministicReplayCompatibility: Readonly<{
    inputStreamMutation: 'none';
    randomSeedMutation: 'none';
    simulationTickMutation: 'none';
  }>;
  legacyStartScript: 'bun run src/main.ts';
  lockedCommand: 'bun run doom.ts';
  runtimeProgram: 'bun';
  stepIdentifier: '14-001';
  transition: Readonly<{
    from: 'package-start-script';
    to: 'root-doom-ts-command';
  }>;
}>;

const DETERMINISTIC_REPLAY_COMPATIBILITY = Object.freeze({
  inputStreamMutation: 'none',
  randomSeedMutation: 'none',
  simulationTickMutation: 'none',
} satisfies BunRunDoomCommandLockEvidence['deterministicReplayCompatibility']);

const TRANSITION = Object.freeze({
  from: 'package-start-script',
  to: 'root-doom-ts-command',
} satisfies BunRunDoomCommandLockEvidence['transition']);

/**
 * Locks the playable local launch contract to the Bun root entry point.
 *
 * @param command Candidate launch command to validate.
 * @returns Frozen deterministic evidence for the accepted Bun launch command.
 * @example
 * ```ts
 * import { lockBunRunDoomCommand } from './src/playable/bun-launch-local-distribution-boundary/lockBunRunDoomCommand.ts';
 *
 * const evidence = lockBunRunDoomCommand('bun run doom.ts');
 * console.log(evidence.lockedCommand);
 * ```
 */
export function lockBunRunDoomCommand(command = LOCKED_BUN_RUN_DOOM_COMMAND): BunRunDoomCommandLockEvidence {
  if (command !== LOCKED_BUN_RUN_DOOM_COMMAND) {
    throw new Error(`Expected Bun launch command "bun run doom.ts", got "${command}".`);
  }

  return Object.freeze({
    commandArguments: COMMAND_ARGUMENTS,
    commandHash: createSha256Hex(LOCKED_BUN_RUN_DOOM_COMMAND),
    deterministicReplayCompatibility: DETERMINISTIC_REPLAY_COMPATIBILITY,
    legacyStartScript: LEGACY_PACKAGE_START_SCRIPT,
    lockedCommand: LOCKED_BUN_RUN_DOOM_COMMAND,
    runtimeProgram: RUNTIME_PROGRAM,
    stepIdentifier: STEP_IDENTIFIER,
    transition: TRANSITION,
  } satisfies BunRunDoomCommandLockEvidence);
}

function createSha256Hex(value: string): string {
  return new Bun.CryptoHasher('sha256').update(value).digest('hex');
}
