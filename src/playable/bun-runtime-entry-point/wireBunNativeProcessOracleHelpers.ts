export interface AuditManifestReference {
  readonly path: string;
  readonly schemaVersion: 1;
  readonly stepId: '01-007';
}

export interface CurrentEntrypointReference {
  readonly command: 'bun run src/main.ts';
  readonly helpUsageLines: readonly ['bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', 'bun run start -- [--iwad <path-to-iwad>] --list-maps'];
  readonly path: 'src/main.ts';
  readonly scriptName: 'start';
  readonly sourceCatalogId: 'S-FPS-011';
}

export interface DeterministicReplayCompatibility {
  readonly changesGameState: false;
  readonly consumesReplayInput: false;
  readonly helperSurface: 'oracle-process-contract-only';
  readonly launchesWindow: false;
  readonly mutatesReplayState: false;
  readonly processExecutionMode: 'deferred-to-oracle-runner';
}

export interface ProcessOracleHelpers {
  readonly captureStreams: readonly ['stdout', 'stderr'];
  readonly environmentPolicy: 'explicit-bun-environment';
  readonly exitStatusPolicy: 'capture-exit-code-without-throwing';
  readonly forbiddenProviders: readonly ['child_process', 'node:child_process', 'npm', 'npx', 'node'];
  readonly provider: 'Bun.spawn';
  readonly shellPolicy: 'direct-argument-vector-no-shell';
  readonly spawnArgumentMode: 'program-plus-arguments';
}

export interface TargetCommandContract {
  readonly command: 'bun run doom.ts';
  readonly entryFile: 'doom.ts';
  readonly program: 'bun';
  readonly subcommand: 'run';
  readonly workspacePath: 'doom.ts';
}

export interface WireBunNativeProcessOracleHelpers {
  readonly auditManifest: AuditManifestReference;
  readonly currentEntrypoint: CurrentEntrypointReference;
  readonly deterministicReplayCompatibility: DeterministicReplayCompatibility;
  readonly processOracleHelpers: ProcessOracleHelpers;
  readonly schemaVersion: 1;
  readonly stepId: '03-005';
  readonly stepTitleSlug: 'wire-bun-native-process-oracle-helpers';
  readonly targetCommand: TargetCommandContract;
}

export const wireBunNativeProcessOracleHelpers = {
  auditManifest: {
    path: 'plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json',
    schemaVersion: 1,
    stepId: '01-007',
  },
  currentEntrypoint: {
    command: 'bun run src/main.ts',
    helpUsageLines: ['bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', 'bun run start -- [--iwad <path-to-iwad>] --list-maps'],
    path: 'src/main.ts',
    scriptName: 'start',
    sourceCatalogId: 'S-FPS-011',
  },
  deterministicReplayCompatibility: {
    changesGameState: false,
    consumesReplayInput: false,
    helperSurface: 'oracle-process-contract-only',
    launchesWindow: false,
    mutatesReplayState: false,
    processExecutionMode: 'deferred-to-oracle-runner',
  },
  processOracleHelpers: {
    captureStreams: ['stdout', 'stderr'],
    environmentPolicy: 'explicit-bun-environment',
    exitStatusPolicy: 'capture-exit-code-without-throwing',
    forbiddenProviders: ['child_process', 'node:child_process', 'npm', 'npx', 'node'],
    provider: 'Bun.spawn',
    shellPolicy: 'direct-argument-vector-no-shell',
    spawnArgumentMode: 'program-plus-arguments',
  },
  schemaVersion: 1,
  stepId: '03-005',
  stepTitleSlug: 'wire-bun-native-process-oracle-helpers',
  targetCommand: {
    command: 'bun run doom.ts',
    entryFile: 'doom.ts',
    program: 'bun',
    subcommand: 'run',
    workspacePath: 'doom.ts',
  },
} as const satisfies WireBunNativeProcessOracleHelpers;
