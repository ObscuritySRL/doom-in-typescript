export const CLEAN_WORKING_TREE_RUNTIME_COMMAND = 'bun run doom.ts';
export const CLEAN_WORKING_TREE_SMOKE_COMMAND = 'git status --porcelain';
export const CLEAN_WORKING_TREE_STEP_IDENTIFIER = '14-007';
export const CLEAN_WORKING_TREE_TRANSITION = 'local-distribution-boundary:clean-working-tree-before-launch';
export const LEGACY_PACKAGE_START_COMMAND = 'bun run src/main.ts';

export type SmokeTestCleanLocalWorkingTreeOptions = Readonly<{
  runtimeCommand?: string;
  workingTreePorcelainOutput?: string;
}>;

export type SmokeTestCleanLocalWorkingTreeReplayCompatibility = Readonly<{
  inputStreamMutated: false;
  randomSeedMutated: false;
  simulationTicAdvanced: false;
}>;

export type SmokeTestCleanLocalWorkingTreeEvidence = Readonly<{
  commandContract: typeof CLEAN_WORKING_TREE_RUNTIME_COMMAND;
  deterministicReplayCompatible: SmokeTestCleanLocalWorkingTreeReplayCompatibility;
  evidenceHash: string;
  expectedPorcelainOutput: '';
  legacyStartCommand: typeof LEGACY_PACKAGE_START_COMMAND;
  smokeCommand: typeof CLEAN_WORKING_TREE_SMOKE_COMMAND;
  stepIdentifier: typeof CLEAN_WORKING_TREE_STEP_IDENTIFIER;
  transition: typeof CLEAN_WORKING_TREE_TRANSITION;
}>;

const CLEAN_WORKING_TREE_REPLAY_COMPATIBILITY = Object.freeze({
  inputStreamMutated: false,
  randomSeedMutated: false,
  simulationTicAdvanced: false,
} satisfies SmokeTestCleanLocalWorkingTreeReplayCompatibility);

/**
 * @param options Clean working tree smoke-test inputs.
 * @returns Deterministic evidence for the local launch smoke-test boundary.
 * @example
 * ```ts
 * const evidence = smokeTestCleanLocalWorkingTree({
 *   runtimeCommand: 'bun run doom.ts',
 *   workingTreePorcelainOutput: '',
 * });
 * console.log(evidence.commandContract);
 * ```
 */
export function smokeTestCleanLocalWorkingTree(options: SmokeTestCleanLocalWorkingTreeOptions = {}): SmokeTestCleanLocalWorkingTreeEvidence {
  const runtimeCommand = options.runtimeCommand ?? CLEAN_WORKING_TREE_RUNTIME_COMMAND;

  if (runtimeCommand !== CLEAN_WORKING_TREE_RUNTIME_COMMAND) {
    throw new Error(`Expected ${CLEAN_WORKING_TREE_RUNTIME_COMMAND} for clean working tree smoke test, got ${runtimeCommand}.`);
  }

  const workingTreePorcelainOutput = options.workingTreePorcelainOutput ?? '';

  if (workingTreePorcelainOutput.trim().length > 0) {
    throw new Error(`Working tree must be clean before ${CLEAN_WORKING_TREE_RUNTIME_COMMAND}; ${CLEAN_WORKING_TREE_SMOKE_COMMAND} reported changes.`);
  }

  const evidenceWithoutHash = Object.freeze({
    commandContract: CLEAN_WORKING_TREE_RUNTIME_COMMAND,
    deterministicReplayCompatible: CLEAN_WORKING_TREE_REPLAY_COMPATIBILITY,
    expectedPorcelainOutput: '',
    legacyStartCommand: LEGACY_PACKAGE_START_COMMAND,
    smokeCommand: CLEAN_WORKING_TREE_SMOKE_COMMAND,
    stepIdentifier: CLEAN_WORKING_TREE_STEP_IDENTIFIER,
    transition: CLEAN_WORKING_TREE_TRANSITION,
  } satisfies Omit<SmokeTestCleanLocalWorkingTreeEvidence, 'evidenceHash'>);

  const evidenceHash = new Bun.CryptoHasher('sha256').update(JSON.stringify(evidenceWithoutHash)).digest('hex');

  return Object.freeze({
    commandContract: evidenceWithoutHash.commandContract,
    deterministicReplayCompatible: evidenceWithoutHash.deterministicReplayCompatible,
    evidenceHash,
    expectedPorcelainOutput: evidenceWithoutHash.expectedPorcelainOutput,
    legacyStartCommand: evidenceWithoutHash.legacyStartCommand,
    smokeCommand: evidenceWithoutHash.smokeCommand,
    stepIdentifier: evidenceWithoutHash.stepIdentifier,
    transition: evidenceWithoutHash.transition,
  });
}
