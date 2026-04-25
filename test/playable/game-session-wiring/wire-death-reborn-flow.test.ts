import { expect, test } from 'bun:test';

import { createHash } from 'node:crypto';

import { loadLauncherResources } from '../../../src/launcher/session.ts';
import { WIRE_DEATH_REBORN_FLOW_COMMAND_CONTRACT, wireDeathRebornFlow } from '../../../src/playable/game-session-wiring/wireDeathRebornFlow.ts';

interface AuditManifest {
  readonly commandContracts: {
    readonly targetRuntime: {
      readonly command: string;
      readonly entryFile: string;
      readonly implementedInReadScope: boolean;
    };
  };
  readonly schemaVersion: number;
  readonly stepId: string;
}

const SOURCE_PATH = 'src/playable/game-session-wiring/wireDeathRebornFlow.ts';

test('wire death reborn flow locks the exact Bun command contract', () => {
  expect(WIRE_DEATH_REBORN_FLOW_COMMAND_CONTRACT).toEqual({
    command: 'bun run doom.ts',
    entryFile: 'doom.ts',
    program: 'bun',
    subcommand: 'run',
  });
});

test('wire death reborn flow keeps the 01-009 audit runtime target linked', async () => {
  const manifest = (await Bun.file('plan_fps/manifests/01-009-audit-missing-menu-to-e1m1.json').json()) as AuditManifest;

  expect(manifest.schemaVersion).toBe(1);
  expect(manifest.stepId).toBe('01-009');
  expect(manifest.commandContracts.targetRuntime).toEqual({
    command: WIRE_DEATH_REBORN_FLOW_COMMAND_CONTRACT.command,
    entryFile: WIRE_DEATH_REBORN_FLOW_COMMAND_CONTRACT.entryFile,
    implementedInReadScope: false,
  });
});

test('wire death reborn flow source hash is stable', async () => {
  const sourceText = await Bun.file(SOURCE_PATH).text();
  const sourceHash = createHash('sha256').update(sourceText).digest('hex');

  expect(sourceHash).toBe('fc6e9dfb555d15c8131b8202483db701f2853b53ad0889b32395f010d197d7ef');
});

test('wire death reborn flow transitions from dead player to fresh reborn player during tryRunTics', async () => {
  const resources = await loadLauncherResources('doom/DOOM1.WAD');
  const result = wireDeathRebornFlow(resources, {
    command: WIRE_DEATH_REBORN_FLOW_COMMAND_CONTRACT.command,
    mapName: 'E1M1',
    skill: 2,
  });

  expect(result.phaseTrace).toEqual(['initialTryRunTics', 'restoreBuffer', 'executeSetViewSize', 'startGameLoop', 'startFrame', 'tryRunTics', 'updateSounds', 'display']);
  expect(result.transition).toEqual({
    from: 'dead-player',
    reusedDeadSession: false,
    to: 'reborn-player',
  });
  expect(result.deathSnapshot).toEqual({
    health: 0,
    levelTime: 0,
    mapName: 'E1M1',
    playerMapObjectHealth: 0,
    playerMapObjectPresent: true,
  });
  expect(result.rebornSnapshot).toEqual({
    health: 100,
    levelTime: 0,
    mapName: 'E1M1',
    playerMapObjectHealth: 100,
    playerMapObjectPresent: true,
  });
  expect(result.deterministicReplay).toEqual({
    frameCount: 1,
    preLoopStepCount: 4,
    stateTransitionPhase: 'tryRunTics',
  });
  expect(result.framebufferLength).toBe(64_000);
});

test('wire death reborn flow rejects non-target runtime commands before creating transition evidence', async () => {
  const resources = await loadLauncherResources('doom/DOOM1.WAD');

  expect(() =>
    wireDeathRebornFlow(resources, {
      command: 'bun run src/main.ts',
      mapName: 'E1M1',
      skill: 2,
    }),
  ).toThrow('wire-death-reborn-flow requires bun run doom.ts');
});
