export type AddDevLaunchSmokeTest = {
  readonly currentEntrypoint: {
    readonly command: string;
    readonly helpUsageLines: readonly string[];
    readonly path: string;
    readonly scriptName: string;
    readonly sourceCatalogIdentifier: string;
  };
  readonly deterministicReplayCompatibility: {
    readonly gameStateMutation: 'none';
    readonly launchWindowSideEffects: 'none';
    readonly replayInputMutation: 'none';
    readonly smokeTestScope: 'process-contract-only';
  };
  readonly manifestAuthority: {
    readonly path: string;
    readonly schemaVersion: number;
    readonly sourceStepIdentifier: string;
    readonly targetCommandStatus: string;
  };
  readonly smokeTest: {
    readonly arguments: readonly string[];
    readonly command: string;
    readonly expectedExitCode: number;
    readonly expectedOutputFragments: readonly string[];
    readonly kind: 'development-launch-smoke-test';
    readonly purpose: string;
    readonly sideEffects: {
      readonly createsGameSession: false;
      readonly loadsIwad: false;
      readonly opensWindow: false;
      readonly consumesReplayInput: false;
    };
    readonly transition: {
      readonly fromEntrypoint: string;
      readonly toLauncherEntrypoint: string;
      readonly viaRuntime: string;
    };
  };
  readonly stepIdentifier: '03-003';
  readonly stepTitleSlug: 'add-dev-launch-smoke-test';
  readonly targetCommand: {
    readonly command: string;
    readonly entryFile: string;
    readonly program: string;
    readonly runner: string;
    readonly workspacePath: string;
  };
};

export const addDevLaunchSmokeTest = {
  currentEntrypoint: {
    command: 'bun run src/main.ts',
    helpUsageLines: ['bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', 'bun run start -- [--iwad <path-to-iwad>] --list-maps'],
    path: 'src/main.ts',
    scriptName: 'start',
    sourceCatalogIdentifier: 'S-FPS-011',
  },
  deterministicReplayCompatibility: {
    gameStateMutation: 'none',
    launchWindowSideEffects: 'none',
    replayInputMutation: 'none',
    smokeTestScope: 'process-contract-only',
  },
  manifestAuthority: {
    path: 'plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json',
    schemaVersion: 1,
    sourceStepIdentifier: '01-007',
    targetCommandStatus: 'missing-from-current-launcher-surface',
  },
  smokeTest: {
    arguments: ['--help'],
    command: 'bun run doom.ts --help',
    expectedExitCode: 0,
    expectedOutputFragments: ['DOOM Codex launcher', 'Usage:', 'bun run doom.ts'],
    kind: 'development-launch-smoke-test',
    purpose: 'confirm the root Bun entrypoint resolves and exits from help mode without opening a window',
    sideEffects: {
      consumesReplayInput: false,
      createsGameSession: false,
      loadsIwad: false,
      opensWindow: false,
    },
    transition: {
      fromEntrypoint: 'doom.ts',
      toLauncherEntrypoint: 'src/main.ts',
      viaRuntime: 'bun run',
    },
  },
  stepIdentifier: '03-003',
  stepTitleSlug: 'add-dev-launch-smoke-test',
  targetCommand: {
    command: 'bun run doom.ts',
    entryFile: 'doom.ts',
    program: 'bun',
    runner: 'run',
    workspacePath: 'doom.ts',
  },
} as const satisfies AddDevLaunchSmokeTest;
