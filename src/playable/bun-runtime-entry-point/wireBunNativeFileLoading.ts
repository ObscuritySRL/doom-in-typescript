export type BunNativeFileLoadingWire = {
  readonly commandContract: {
    readonly entryFile: 'doom.ts';
    readonly program: 'bun';
    readonly runtimeCommand: 'bun run doom.ts';
    readonly subcommand: 'run';
  };
  readonly currentEntrypoint: {
    readonly command: 'bun run src/main.ts';
    readonly defaultIwadProbe: {
      readonly behavior: 'probe-default-iwad-path-before-launch-resource-load';
      readonly method: 'Bun.file().exists';
      readonly sourceLocation: 'src/main.ts:resolveDefaultIwadPath';
    };
    readonly path: 'src/main.ts';
    readonly scriptName: 'start';
  };
  readonly deterministicReplayCompatibility: {
    readonly fileReadTiming: 'launcher-startup-only';
    readonly mutatesGameState: false;
    readonly replayInputDependency: 'none';
  };
  readonly fileLoading: {
    readonly binaryReadMethod: 'Bun.file().arrayBuffer';
    readonly existenceProbeMethod: 'Bun.file().exists';
    readonly provider: 'Bun.file';
    readonly textReadMethod: 'Bun.file().text';
  };
  readonly manifestAuthority: {
    readonly path: 'plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json';
    readonly schemaVersion: 1;
    readonly sourceStepIdentifier: '01-007';
  };
  readonly step: {
    readonly stepIdentifier: '03-004';
    readonly titleSlug: 'wire-bun-native-file-loading';
  };
};

/**
 * Bun-native file loading contract for the playable entrypoint path.
 *
 * @example
 * ```ts
 * import { bunNativeFileLoadingWire } from './src/playable/bun-runtime-entry-point/wireBunNativeFileLoading.ts';
 *
 * console.log(bunNativeFileLoadingWire.fileLoading.provider);
 * ```
 */
export const bunNativeFileLoadingWire = {
  commandContract: {
    entryFile: 'doom.ts',
    program: 'bun',
    runtimeCommand: 'bun run doom.ts',
    subcommand: 'run',
  },
  currentEntrypoint: {
    command: 'bun run src/main.ts',
    defaultIwadProbe: {
      behavior: 'probe-default-iwad-path-before-launch-resource-load',
      method: 'Bun.file().exists',
      sourceLocation: 'src/main.ts:resolveDefaultIwadPath',
    },
    path: 'src/main.ts',
    scriptName: 'start',
  },
  deterministicReplayCompatibility: {
    fileReadTiming: 'launcher-startup-only',
    mutatesGameState: false,
    replayInputDependency: 'none',
  },
  fileLoading: {
    binaryReadMethod: 'Bun.file().arrayBuffer',
    existenceProbeMethod: 'Bun.file().exists',
    provider: 'Bun.file',
    textReadMethod: 'Bun.file().text',
  },
  manifestAuthority: {
    path: 'plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json',
    schemaVersion: 1,
    sourceStepIdentifier: '01-007',
  },
  step: {
    stepIdentifier: '03-004',
    titleSlug: 'wire-bun-native-file-loading',
  },
} as const satisfies BunNativeFileLoadingWire;
