export type WireBunTestIntegrationContract = {
  readonly bunTestRunner: {
    readonly focusedVerificationCommand: 'bun test test/playable/bun-runtime-entry-point/wire-bun-test-integration.test.ts';
    readonly fullVerificationCommand: 'bun test';
    readonly moduleSpecifier: 'bun:test';
    readonly runner: 'bun test';
    readonly status: 'wired-through-bun-test-runner';
  };
  readonly commandContract: {
    readonly entryFile: 'doom.ts';
    readonly program: 'bun';
    readonly subcommand: 'run';
    readonly targetCommand: 'bun run doom.ts';
    readonly workspacePath: 'doom.ts';
  };
  readonly currentLauncherTransition: {
    readonly command: 'bun run src/main.ts';
    readonly helpUsageLines: readonly ['bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', 'bun run start -- [--iwad <path-to-iwad>] --list-maps'];
    readonly path: 'src/main.ts';
    readonly scriptName: 'start';
    readonly sourceCatalogId: 'S-FPS-011';
  };
  readonly deterministicReplayCompatibility: {
    readonly gameStateMutation: 'none';
    readonly replayInputDependency: 'none';
    readonly replayTimingDependency: 'none';
    readonly scope: 'test-runner-contract-only';
  };
  readonly forbiddenTestRunners: readonly ['jest', 'mocha', 'vitest'];
  readonly manifestAuthority: {
    readonly path: 'plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json';
    readonly schemaVersion: 1;
    readonly stepIdentifier: '01-007';
  };
  readonly packageScriptEvidence: {
    readonly currentStartScript: 'bun run src/main.ts';
    readonly packageName: 'doom-codex';
    readonly packageType: 'module';
  };
  readonly stepIdentifier: '03-006';
  readonly stepTitleSlug: 'wire-bun-test-integration';
};

export const wireBunTestIntegrationContract: WireBunTestIntegrationContract = {
  bunTestRunner: {
    focusedVerificationCommand: 'bun test test/playable/bun-runtime-entry-point/wire-bun-test-integration.test.ts',
    fullVerificationCommand: 'bun test',
    moduleSpecifier: 'bun:test',
    runner: 'bun test',
    status: 'wired-through-bun-test-runner',
  },
  commandContract: {
    entryFile: 'doom.ts',
    program: 'bun',
    subcommand: 'run',
    targetCommand: 'bun run doom.ts',
    workspacePath: 'doom.ts',
  },
  currentLauncherTransition: {
    command: 'bun run src/main.ts',
    helpUsageLines: ['bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', 'bun run start -- [--iwad <path-to-iwad>] --list-maps'],
    path: 'src/main.ts',
    scriptName: 'start',
    sourceCatalogId: 'S-FPS-011',
  },
  deterministicReplayCompatibility: {
    gameStateMutation: 'none',
    replayInputDependency: 'none',
    replayTimingDependency: 'none',
    scope: 'test-runner-contract-only',
  },
  forbiddenTestRunners: ['jest', 'mocha', 'vitest'],
  manifestAuthority: {
    path: 'plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json',
    schemaVersion: 1,
    stepIdentifier: '01-007',
  },
  packageScriptEvidence: {
    currentStartScript: 'bun run src/main.ts',
    packageName: 'doom-codex',
    packageType: 'module',
  },
  stepIdentifier: '03-006',
  stepTitleSlug: 'wire-bun-test-integration',
};
