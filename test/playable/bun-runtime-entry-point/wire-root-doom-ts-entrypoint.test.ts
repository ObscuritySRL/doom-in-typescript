import { describe, expect, test } from 'bun:test';

import { WIRE_ROOT_DOOM_TS_ENTRYPOINT, wireRootDoomTsEntrypoint } from '../../../src/playable/bun-runtime-entry-point/wireRootDoomTsEntrypoint.ts';
import type { WireRootDoomTsEntrypoint } from '../../../src/playable/bun-runtime-entry-point/wireRootDoomTsEntrypoint.ts';

const EXPECTED_WIRE_ROOT_DOOM_TS_ENTRYPOINT: WireRootDoomTsEntrypoint = {
  bunRuntime: {
    argumentVectorSource: 'Bun.argv',
    fileProbeApi: 'Bun.file',
    runtime: 'bun',
    scriptRunner: 'bun run',
  },
  commandContract: {
    command: 'bun run doom.ts',
    entryFile: 'doom.ts',
    program: 'bun',
    subcommand: 'run',
    workspacePath: 'doom.ts',
  },
  currentEntrypoint: {
    command: 'bun run src/main.ts',
    helpUsageLines: ['bun run start -- [--iwad <path-to-iwad>] [--map E1M1] [--skill 2] [--scale 2]', 'bun run start -- [--iwad <path-to-iwad>] --list-maps'],
    path: 'src/main.ts',
    scriptName: 'start',
    sourceCatalogId: 'S-FPS-011',
  },
  deterministicReplayCompatibility: {
    importSideEffects: [],
    replayInputSources: [],
    simulationStateMutations: [],
    status: 'compatible',
  },
  sourceAuditManifest: {
    path: 'plan_fps/manifests/01-007-audit-missing-bun-run-doom-entrypoint.json',
    schemaVersion: 1,
    stepId: '01-007',
  },
  step: {
    id: '03-002',
    titleSlug: 'wire-root-doom-ts-entrypoint',
  },
  transition: {
    fromEntryFile: 'doom.ts',
    status: 'wired-to-current-launcher-surface',
    toEntrypointPath: 'src/main.ts',
    transitionKind: 'bun-root-entrypoint-delegation',
  },
};

describe('wire root doom.ts entrypoint', () => {
  test('locks the exact Bun runtime entrypoint wire contract', () => {
    expect(WIRE_ROOT_DOOM_TS_ENTRYPOINT).toEqual(EXPECTED_WIRE_ROOT_DOOM_TS_ENTRYPOINT);
    expect(wireRootDoomTsEntrypoint()).toBe(WIRE_ROOT_DOOM_TS_ENTRYPOINT);
  });

  test('cross-checks the transition against the 01-007 audit manifest', async () => {
    const manifest = await Bun.file(WIRE_ROOT_DOOM_TS_ENTRYPOINT.sourceAuditManifest.path).json();

    expect(manifest).toMatchObject({
      currentEntrypoint: WIRE_ROOT_DOOM_TS_ENTRYPOINT.currentEntrypoint,
      schemaVersion: WIRE_ROOT_DOOM_TS_ENTRYPOINT.sourceAuditManifest.schemaVersion,
      stepId: WIRE_ROOT_DOOM_TS_ENTRYPOINT.sourceAuditManifest.stepId,
      targetCommand: {
        command: WIRE_ROOT_DOOM_TS_ENTRYPOINT.commandContract.command,
        entryFile: WIRE_ROOT_DOOM_TS_ENTRYPOINT.commandContract.entryFile,
        workspacePath: WIRE_ROOT_DOOM_TS_ENTRYPOINT.commandContract.workspacePath,
      },
    });
  });

  test('cross-checks the wire path against the package script and current launcher', async () => {
    const packageJson = await Bun.file('package.json').json();
    const sourceText = await Bun.file(WIRE_ROOT_DOOM_TS_ENTRYPOINT.currentEntrypoint.path).text();

    expect(packageJson).toMatchObject({
      scripts: {
        [WIRE_ROOT_DOOM_TS_ENTRYPOINT.currentEntrypoint.scriptName]: WIRE_ROOT_DOOM_TS_ENTRYPOINT.currentEntrypoint.command,
      },
    });

    for (const helpUsageLine of WIRE_ROOT_DOOM_TS_ENTRYPOINT.currentEntrypoint.helpUsageLines) {
      expect(sourceText).toContain(helpUsageLine);
    }

    expect(sourceText).toContain(`new CommandLine(${WIRE_ROOT_DOOM_TS_ENTRYPOINT.bunRuntime.argumentVectorSource})`);
    expect(sourceText).not.toContain('process.argv');
  });

  test('keeps the wire contract deterministic-replay compatible', () => {
    expect(WIRE_ROOT_DOOM_TS_ENTRYPOINT.deterministicReplayCompatibility).toEqual({
      importSideEffects: [],
      replayInputSources: [],
      simulationStateMutations: [],
      status: 'compatible',
    });
  });

  test('locks the wire contract as runtime-immutable and the function as a stable getter', () => {
    expect(Object.isFrozen(WIRE_ROOT_DOOM_TS_ENTRYPOINT)).toBe(true);
    expect(Object.isFrozen(WIRE_ROOT_DOOM_TS_ENTRYPOINT.bunRuntime)).toBe(true);
    expect(Object.isFrozen(WIRE_ROOT_DOOM_TS_ENTRYPOINT.commandContract)).toBe(true);
    expect(Object.isFrozen(WIRE_ROOT_DOOM_TS_ENTRYPOINT.currentEntrypoint)).toBe(true);
    expect(Object.isFrozen(WIRE_ROOT_DOOM_TS_ENTRYPOINT.currentEntrypoint.helpUsageLines)).toBe(true);
    expect(Object.isFrozen(WIRE_ROOT_DOOM_TS_ENTRYPOINT.deterministicReplayCompatibility)).toBe(true);
    expect(Object.isFrozen(WIRE_ROOT_DOOM_TS_ENTRYPOINT.deterministicReplayCompatibility.importSideEffects)).toBe(true);
    expect(Object.isFrozen(WIRE_ROOT_DOOM_TS_ENTRYPOINT.deterministicReplayCompatibility.replayInputSources)).toBe(true);
    expect(Object.isFrozen(WIRE_ROOT_DOOM_TS_ENTRYPOINT.deterministicReplayCompatibility.simulationStateMutations)).toBe(true);
    expect(Object.isFrozen(WIRE_ROOT_DOOM_TS_ENTRYPOINT.sourceAuditManifest)).toBe(true);
    expect(Object.isFrozen(WIRE_ROOT_DOOM_TS_ENTRYPOINT.step)).toBe(true);
    expect(Object.isFrozen(WIRE_ROOT_DOOM_TS_ENTRYPOINT.transition)).toBe(true);
    expect(wireRootDoomTsEntrypoint()).toBe(wireRootDoomTsEntrypoint());
  });
});
