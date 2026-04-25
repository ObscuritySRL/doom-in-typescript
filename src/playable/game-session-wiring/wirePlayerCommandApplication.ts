import type { LauncherInputState, LauncherSession } from '../../launcher/session.ts';
import type { MainLoopPhase, PreLoopStep } from '../../mainLoop.ts';

import { advanceLauncherSession } from '../../launcher/session.ts';
import { MainLoop } from '../../mainLoop.ts';

export const WIRE_PLAYER_COMMAND_APPLICATION_RUNTIME_CONTRACT = Object.freeze({
  auditManifest: Object.freeze({
    path: 'plan_fps/manifests/01-009-audit-missing-menu-to-e1m1.json',
    schemaVersion: 1,
    stepId: '01-009',
  }),
  runtimeCommand: 'bun run doom.ts',
  runtimeProgram: 'bun',
  stepId: '08-006',
  stepTitle: 'wire-player-command-application',
} as const);

export interface WirePlayerCommandApplicationOptions {
  readonly inputState: LauncherInputState;
  readonly loop: MainLoop;
  readonly runtimeCommand: string;
  readonly session: LauncherSession;
}

export interface WirePlayerCommandApplicationResult {
  readonly after: WirePlayerCommandApplicationSnapshot;
  readonly appliedDuringPhase: MainLoopPhase;
  readonly before: WirePlayerCommandApplicationSnapshot;
  readonly frameCount: number;
  readonly phaseTrace: readonly MainLoopPhase[];
  readonly preLoopTrace: readonly PreLoopStep[];
  readonly runtimeCommand: typeof WIRE_PLAYER_COMMAND_APPLICATION_RUNTIME_CONTRACT.runtimeCommand;
  readonly stepId: typeof WIRE_PLAYER_COMMAND_APPLICATION_RUNTIME_CONTRACT.stepId;
}

export interface WirePlayerCommandApplicationSnapshot {
  readonly angle: number;
  readonly frameCount: number;
  readonly levelTime: number;
  readonly playerCommand: LauncherSession['player']['cmd'];
  readonly playerX: number;
  readonly playerY: number;
  readonly playerZ: number;
  readonly viewZ: number;
}

export function wirePlayerCommandApplication(options: WirePlayerCommandApplicationOptions): WirePlayerCommandApplicationResult {
  if (options.runtimeCommand !== WIRE_PLAYER_COMMAND_APPLICATION_RUNTIME_CONTRACT.runtimeCommand) {
    throw new Error(`wire-player-command-application requires bun run doom.ts, got ${options.runtimeCommand}`);
  }

  const playerMapObject = options.session.player.mo;

  if (playerMapObject === null) {
    throw new Error('wire-player-command-application requires a spawned player');
  }

  const before = Object.freeze({
    angle: playerMapObject.angle,
    frameCount: options.loop.frameCount,
    levelTime: options.session.levelTime,
    playerCommand: options.session.player.cmd,
    playerX: playerMapObject.x,
    playerY: playerMapObject.y,
    playerZ: playerMapObject.z,
    viewZ: options.session.player.viewz,
  });
  const phaseTrace: MainLoopPhase[] = [];
  const preLoopTrace: PreLoopStep[] = [];

  if (!options.loop.started) {
    options.loop.setup({
      executeSetViewSize() {
        preLoopTrace.push('executeSetViewSize');
      },
      initialTryRunTics() {
        preLoopTrace.push('initialTryRunTics');
      },
      restoreBuffer() {
        preLoopTrace.push('restoreBuffer');
      },
      startGameLoop() {
        preLoopTrace.push('startGameLoop');
      },
    });
  }

  options.loop.runOneFrame({
    display() {
      phaseTrace.push('display');
    },
    startFrame() {
      phaseTrace.push('startFrame');
    },
    tryRunTics() {
      phaseTrace.push('tryRunTics');
      advanceLauncherSession(options.session, options.inputState);
    },
    updateSounds() {
      phaseTrace.push('updateSounds');
    },
  });

  const updatedPlayerMapObject = options.session.player.mo;

  if (updatedPlayerMapObject === null) {
    throw new Error('wire-player-command-application lost the spawned player');
  }

  return Object.freeze({
    after: Object.freeze({
      angle: updatedPlayerMapObject.angle,
      frameCount: options.loop.frameCount,
      levelTime: options.session.levelTime,
      playerCommand: options.session.player.cmd,
      playerX: updatedPlayerMapObject.x,
      playerY: updatedPlayerMapObject.y,
      playerZ: updatedPlayerMapObject.z,
      viewZ: options.session.player.viewz,
    }),
    appliedDuringPhase: 'tryRunTics',
    before,
    frameCount: options.loop.frameCount,
    phaseTrace: Object.freeze([...phaseTrace]),
    preLoopTrace: Object.freeze([...preLoopTrace]),
    runtimeCommand: WIRE_PLAYER_COMMAND_APPLICATION_RUNTIME_CONTRACT.runtimeCommand,
    stepId: WIRE_PLAYER_COMMAND_APPLICATION_RUNTIME_CONTRACT.stepId,
  });
}
