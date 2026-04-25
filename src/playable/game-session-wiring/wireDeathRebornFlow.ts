import type { LauncherResources, LauncherSession } from '../../launcher/session.ts';
import type { MainLoopPhase, PreLoopStep } from '../../mainLoop.ts';

import { createLauncherSession, renderLauncherFrame } from '../../launcher/session.ts';
import { MainLoop } from '../../mainLoop.ts';

export const WIRE_DEATH_REBORN_FLOW_COMMAND_CONTRACT = Object.freeze({
  command: 'bun run doom.ts',
  entryFile: 'doom.ts',
  program: 'bun',
  subcommand: 'run',
});

export interface DeathRebornSnapshot {
  readonly health: number;
  readonly levelTime: number;
  readonly mapName: string;
  readonly playerMapObjectHealth: number;
  readonly playerMapObjectPresent: boolean;
}

export interface WireDeathRebornFlowOptions {
  readonly command: string;
  readonly mapName?: string;
  readonly skill?: number;
}

export interface WireDeathRebornFlowResult {
  readonly commandContract: typeof WIRE_DEATH_REBORN_FLOW_COMMAND_CONTRACT;
  readonly deathSnapshot: DeathRebornSnapshot;
  readonly deterministicReplay: {
    readonly frameCount: number;
    readonly preLoopStepCount: number;
    readonly stateTransitionPhase: MainLoopPhase;
  };
  readonly framebufferLength: number;
  readonly phaseTrace: readonly (MainLoopPhase | PreLoopStep)[];
  readonly rebornSnapshot: DeathRebornSnapshot;
  readonly transition: {
    readonly from: 'dead-player';
    readonly reusedDeadSession: boolean;
    readonly to: 'reborn-player';
  };
}

export function wireDeathRebornFlow(resources: LauncherResources, options: WireDeathRebornFlowOptions): WireDeathRebornFlowResult {
  if (options.command !== WIRE_DEATH_REBORN_FLOW_COMMAND_CONTRACT.command) {
    throw new Error(`wire-death-reborn-flow requires ${WIRE_DEATH_REBORN_FLOW_COMMAND_CONTRACT.command}`);
  }

  const mapName = options.mapName ?? 'E1M1';
  const skill = options.skill ?? 2;
  const deathSession = createLauncherSession(resources, { mapName, skill });
  let activeSession = deathSession;
  let deathSnapshot: DeathRebornSnapshot | null = null;
  let rebornSnapshot: DeathRebornSnapshot | null = null;
  let stateTransitionPhase: MainLoopPhase | null = null;
  let framebufferLength = 0;
  const mainLoop = new MainLoop();
  const phaseTrace: (MainLoopPhase | PreLoopStep)[] = [];

  mainLoop.setup({
    executeSetViewSize() {
      phaseTrace.push('executeSetViewSize');
    },
    initialTryRunTics() {
      phaseTrace.push('initialTryRunTics');
    },
    restoreBuffer() {
      phaseTrace.push('restoreBuffer');
    },
    startGameLoop() {
      phaseTrace.push('startGameLoop');
    },
  });

  mainLoop.runOneFrame({
    display() {
      phaseTrace.push('display');
      framebufferLength = renderLauncherFrame(activeSession).length;
    },
    startFrame() {
      phaseTrace.push('startFrame');
    },
    tryRunTics() {
      phaseTrace.push('tryRunTics');
      forceDeathState(deathSession);
      deathSnapshot = snapshotDeathRebornSession(deathSession);
      activeSession = createLauncherSession(resources, { mapName, skill });
      rebornSnapshot = snapshotDeathRebornSession(activeSession);
      stateTransitionPhase = 'tryRunTics';
    },
    updateSounds() {
      phaseTrace.push('updateSounds');
    },
  });

  if (deathSnapshot === null || rebornSnapshot === null || stateTransitionPhase === null) {
    throw new Error('wire-death-reborn-flow did not complete the death reborn transition');
  }

  return Object.freeze({
    commandContract: WIRE_DEATH_REBORN_FLOW_COMMAND_CONTRACT,
    deathSnapshot,
    deterministicReplay: Object.freeze({
      frameCount: mainLoop.frameCount,
      preLoopStepCount: 4,
      stateTransitionPhase,
    }),
    framebufferLength,
    phaseTrace: Object.freeze([...phaseTrace]),
    rebornSnapshot,
    transition: Object.freeze({
      from: 'dead-player',
      reusedDeadSession: activeSession === deathSession,
      to: 'reborn-player',
    }),
  });
}

function forceDeathState(session: LauncherSession): void {
  session.player.health = 0;

  if (session.player.mo !== null) {
    session.player.mo.health = 0;
  }
}

function snapshotDeathRebornSession(session: LauncherSession): DeathRebornSnapshot {
  return Object.freeze({
    health: session.player.health,
    levelTime: session.levelTime,
    mapName: session.mapName,
    playerMapObjectHealth: session.player.mo?.health ?? 0,
    playerMapObjectPresent: session.player.mo !== null,
  });
}
