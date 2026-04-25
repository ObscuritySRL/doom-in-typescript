export type AddRootDoomTsCommandContract = {
  readonly command: 'bun run doom.ts';
  readonly commandParts: readonly ['bun', 'run', 'doom.ts'];
  readonly currentEntrypoint: {
    readonly command: 'bun run src/main.ts';
    readonly helpUsageLines: readonly ['bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', 'bun run start -- [--iwad <path-to-iwad>] --list-maps'];
    readonly path: 'src/main.ts';
    readonly scriptName: 'start';
    readonly sourceCatalogId: 'S-FPS-011';
  };
  readonly deterministicReplayCompatibility: {
    readonly launchSideEffects: 'none';
    readonly replayStateInputs: 'unchanged';
    readonly transition: 'contract-definition-only';
  };
  readonly entryFile: 'doom.ts';
  readonly implementationStepId: '03-002';
  readonly runtimeProgram: 'bun';
  readonly runtimeSubcommand: 'run';
  readonly sourceAuditManifestPath: 'plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json';
};

export const ADD_ROOT_DOOM_TS_COMMAND_CONTRACT: AddRootDoomTsCommandContract = {
  command: 'bun run doom.ts',
  commandParts: ['bun', 'run', 'doom.ts'],
  currentEntrypoint: {
    command: 'bun run src/main.ts',
    helpUsageLines: ['bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', 'bun run start -- [--iwad <path-to-iwad>] --list-maps'],
    path: 'src/main.ts',
    scriptName: 'start',
    sourceCatalogId: 'S-FPS-011',
  },
  deterministicReplayCompatibility: {
    launchSideEffects: 'none',
    replayStateInputs: 'unchanged',
    transition: 'contract-definition-only',
  },
  entryFile: 'doom.ts',
  implementationStepId: '03-002',
  runtimeProgram: 'bun',
  runtimeSubcommand: 'run',
  sourceAuditManifestPath: 'plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json',
};
