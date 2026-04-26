export type WireRootDoomTsEntrypoint = {
  readonly bunRuntime: {
    readonly argumentVectorSource: 'Bun.argv';
    readonly fileProbeApi: 'Bun.file';
    readonly runtime: 'bun';
    readonly scriptRunner: 'bun run';
  };
  readonly commandContract: {
    readonly command: 'bun run doom.ts';
    readonly entryFile: 'doom.ts';
    readonly program: 'bun';
    readonly subcommand: 'run';
    readonly workspacePath: 'doom.ts';
  };
  readonly currentEntrypoint: {
    readonly command: 'bun run src/main.ts';
    readonly helpUsageLines: readonly ['bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', 'bun run start -- [--iwad <path-to-iwad>] --list-maps'];
    readonly path: 'src/main.ts';
    readonly scriptName: 'start';
    readonly sourceCatalogId: 'S-FPS-011';
  };
  readonly deterministicReplayCompatibility: {
    readonly importSideEffects: readonly [];
    readonly replayInputSources: readonly [];
    readonly simulationStateMutations: readonly [];
    readonly status: 'compatible';
  };
  readonly sourceAuditManifest: {
    readonly path: 'plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json';
    readonly schemaVersion: 1;
    readonly stepId: '01-007';
  };
  readonly step: {
    readonly id: '03-002';
    readonly titleSlug: 'wire-root-doom-ts-entrypoint';
  };
  readonly transition: {
    readonly fromEntryFile: 'doom.ts';
    readonly status: 'wired-to-current-launcher-surface';
    readonly toEntrypointPath: 'src/main.ts';
    readonly transitionKind: 'bun-root-entrypoint-delegation';
  };
};

export const WIRE_ROOT_DOOM_TS_ENTRYPOINT: WireRootDoomTsEntrypoint = Object.freeze({
  bunRuntime: Object.freeze({
    argumentVectorSource: 'Bun.argv',
    fileProbeApi: 'Bun.file',
    runtime: 'bun',
    scriptRunner: 'bun run',
  }),
  commandContract: Object.freeze({
    command: 'bun run doom.ts',
    entryFile: 'doom.ts',
    program: 'bun',
    subcommand: 'run',
    workspacePath: 'doom.ts',
  }),
  currentEntrypoint: Object.freeze({
    command: 'bun run src/main.ts',
    helpUsageLines: Object.freeze(['bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', 'bun run start -- [--iwad <path-to-iwad>] --list-maps'] as const),
    path: 'src/main.ts',
    scriptName: 'start',
    sourceCatalogId: 'S-FPS-011',
  }),
  deterministicReplayCompatibility: Object.freeze({
    importSideEffects: Object.freeze([] as const),
    replayInputSources: Object.freeze([] as const),
    simulationStateMutations: Object.freeze([] as const),
    status: 'compatible',
  }),
  sourceAuditManifest: Object.freeze({
    path: 'plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json',
    schemaVersion: 1,
    stepId: '01-007',
  }),
  step: Object.freeze({
    id: '03-002',
    titleSlug: 'wire-root-doom-ts-entrypoint',
  }),
  transition: Object.freeze({
    fromEntryFile: 'doom.ts',
    status: 'wired-to-current-launcher-surface',
    toEntrypointPath: 'src/main.ts',
    transitionKind: 'bun-root-entrypoint-delegation',
  }),
});

export function wireRootDoomTsEntrypoint(): WireRootDoomTsEntrypoint {
  return WIRE_ROOT_DOOM_TS_ENTRYPOINT;
}
