const TARGET_RUNTIME_ENTRY_FILE = 'doom.ts';
const TARGET_RUNTIME_PROGRAM = 'bun';
const TARGET_RUNTIME_SUBCOMMAND = 'run';

export const DEFAULT_DETERMINISTIC_RESET_SEED = 0;

export type DeterministicResetSeedContract = {
  readonly auditedCurrentLauncher: {
    readonly command: 'bun run src/main.ts';
    readonly entrypointPath: 'src/main.ts';
    readonly scriptName: 'start';
    readonly transition: 'src-main-direct-to-runLauncherWindow';
  };
  readonly deterministicReplayCompatibility: {
    readonly mutatesGameplayState: false;
    readonly mutatesGlobalRandomSeedDirectly: false;
    readonly replayConsumesInput: false;
    readonly resetSeedValue: 0;
    readonly resetsBeforeReplayInput: true;
  };
  readonly implementation: {
    readonly helperName: 'implementDeterministicResetSeed';
    readonly stepId: '03-015';
    readonly surface: 'bun-run-playable-parity';
  };
  readonly runtimeCommand: {
    readonly command: 'bun run doom.ts';
    readonly entryFile: 'doom.ts';
    readonly program: 'bun';
    readonly subcommand: 'run';
  };
  readonly targetReset: {
    readonly resetApplied: true;
    readonly resetSeedValue: 0;
    readonly resetTiming: 'before-title-loop';
  };
};

export type DeterministicResetSeedResult = {
  readonly resetApplied: true;
  readonly resetSeedValue: 0;
  readonly resetTiming: 'before-title-loop';
  readonly runtimeCommand: 'bun run doom.ts';
};

export const deterministicResetSeedContract = {
  auditedCurrentLauncher: {
    command: 'bun run src/main.ts',
    entrypointPath: 'src/main.ts',
    scriptName: 'start',
    transition: 'src-main-direct-to-runLauncherWindow',
  },
  deterministicReplayCompatibility: {
    mutatesGameplayState: false,
    mutatesGlobalRandomSeedDirectly: false,
    replayConsumesInput: false,
    resetSeedValue: DEFAULT_DETERMINISTIC_RESET_SEED,
    resetsBeforeReplayInput: true,
  },
  implementation: {
    helperName: 'implementDeterministicResetSeed',
    stepId: '03-015',
    surface: 'bun-run-playable-parity',
  },
  runtimeCommand: {
    command: `${TARGET_RUNTIME_PROGRAM} ${TARGET_RUNTIME_SUBCOMMAND} ${TARGET_RUNTIME_ENTRY_FILE}`,
    entryFile: TARGET_RUNTIME_ENTRY_FILE,
    program: TARGET_RUNTIME_PROGRAM,
    subcommand: TARGET_RUNTIME_SUBCOMMAND,
  },
  targetReset: {
    resetApplied: true,
    resetSeedValue: DEFAULT_DETERMINISTIC_RESET_SEED,
    resetTiming: 'before-title-loop',
  },
} as const satisfies DeterministicResetSeedContract;

export function implementDeterministicResetSeed(runtimeCommand: string): DeterministicResetSeedResult {
  if (runtimeCommand !== deterministicResetSeedContract.runtimeCommand.command) {
    throw new Error(`implementDeterministicResetSeed only supports ${deterministicResetSeedContract.runtimeCommand.command}, got "${runtimeCommand}".`);
  }

  return {
    resetApplied: deterministicResetSeedContract.targetReset.resetApplied,
    resetSeedValue: deterministicResetSeedContract.targetReset.resetSeedValue,
    resetTiming: deterministicResetSeedContract.targetReset.resetTiming,
    runtimeCommand: deterministicResetSeedContract.runtimeCommand.command,
  };
}
