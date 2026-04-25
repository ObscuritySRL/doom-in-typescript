import type { MainLoopPhase, PreLoopStep } from '../../mainLoop.ts';
import type { LauncherResources, LauncherSession } from '../../launcher/session.ts';

import { MainLoop } from '../../mainLoop.ts';
import { EMPTY_LAUNCHER_INPUT, advanceLauncherSession, createLauncherSession, renderLauncherFrame } from '../../launcher/session.ts';

const DEFAULT_CURRENT_MAP_NAME = 'E1M1';
const DEFAULT_NEXT_MAP_NAME = 'E1M2';
const DEFAULT_SKILL = 2;

export const WIRE_LEVEL_EXIT_FLOW_COMMAND_CONTRACT = Object.freeze({
  command: 'bun run doom.ts',
  entryFile: 'doom.ts',
  program: 'bun',
  subcommand: 'run',
});

export interface LevelExitLevelTimeEvidence {
  readonly currentAfterExit: number;
  readonly currentBeforeExit: number;
  readonly nextAfterExit: number;
}

export interface LevelExitTransitionEvidence {
  readonly fromMapName: string;
  readonly phase: 'tryRunTics';
  readonly reason: 'level-exit';
  readonly toMapName: string;
}

export interface WireLevelExitFlowOptions {
  readonly command: string;
  readonly currentMapName?: string;
  readonly loop?: MainLoop;
  readonly nextMapName?: string;
  readonly skill?: number;
}

export interface WireLevelExitFlowResult {
  readonly commandContract: typeof WIRE_LEVEL_EXIT_FLOW_COMMAND_CONTRACT;
  readonly currentMapName: string;
  readonly framebufferByteLength: number;
  readonly frameCount: number;
  readonly levelTime: LevelExitLevelTimeEvidence;
  readonly nextMapName: string;
  readonly phaseTrace: readonly MainLoopPhase[];
  readonly preLoopTrace: readonly PreLoopStep[];
  readonly renderedMapName: string;
  readonly transition: LevelExitTransitionEvidence;
}

export function wireLevelExitFlow(resources: LauncherResources, options: WireLevelExitFlowOptions): WireLevelExitFlowResult {
  validateRuntimeCommand(options.command);

  const currentMapName = normalizeMapName(options.currentMapName ?? DEFAULT_CURRENT_MAP_NAME);
  const nextMapName = normalizeMapName(options.nextMapName ?? DEFAULT_NEXT_MAP_NAME);
  const skill = options.skill ?? DEFAULT_SKILL;

  validateMapPair(resources, currentMapName, nextMapName);

  const currentSession = createLauncherSession(resources, {
    mapName: currentMapName,
    skill,
  });
  const loop = options.loop ?? new MainLoop();
  const phaseTrace: MainLoopPhase[] = [];
  const preLoopTrace: PreLoopStep[] = [];
  const flowEvidence: {
    activeSession: LauncherSession;
    displayedFramebuffer: Uint8Array | null;
    transition: LevelExitTransitionEvidence | null;
  } = {
    activeSession: currentSession,
    displayedFramebuffer: null,
    transition: null,
  };
  const currentLevelTimeBeforeExit = currentSession.levelTime;

  if (!loop.started) {
    loop.setup({
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

  loop.runOneFrame({
    display() {
      phaseTrace.push('display');
      flowEvidence.displayedFramebuffer = renderLauncherFrame(flowEvidence.activeSession);
    },
    startFrame() {
      phaseTrace.push('startFrame');
    },
    tryRunTics() {
      phaseTrace.push('tryRunTics');
      advanceLauncherSession(currentSession, EMPTY_LAUNCHER_INPUT);
      flowEvidence.transition = {
        fromMapName: currentMapName,
        phase: 'tryRunTics',
        reason: 'level-exit',
        toMapName: nextMapName,
      };
      flowEvidence.activeSession = createLauncherSession(resources, {
        mapName: nextMapName,
        skill,
      });
    },
    updateSounds() {
      phaseTrace.push('updateSounds');
    },
  });

  if (flowEvidence.displayedFramebuffer === null || flowEvidence.transition === null) {
    throw new Error('level exit flow did not reach display after transition');
  }

  return Object.freeze({
    commandContract: WIRE_LEVEL_EXIT_FLOW_COMMAND_CONTRACT,
    currentMapName,
    framebufferByteLength: flowEvidence.displayedFramebuffer.byteLength,
    frameCount: loop.frameCount,
    levelTime: Object.freeze({
      currentAfterExit: currentSession.levelTime,
      currentBeforeExit: currentLevelTimeBeforeExit,
      nextAfterExit: flowEvidence.activeSession.levelTime,
    }),
    nextMapName,
    phaseTrace: Object.freeze([...phaseTrace]),
    preLoopTrace: Object.freeze([...preLoopTrace]),
    renderedMapName: flowEvidence.activeSession.mapName,
    transition: Object.freeze(flowEvidence.transition),
  });
}

function normalizeMapName(mapName: string): string {
  const normalizedMapName = mapName.toUpperCase();

  if (normalizedMapName.length === 0) {
    throw new RangeError('map name must not be empty');
  }

  return normalizedMapName;
}

function validateMapPair(resources: LauncherResources, currentMapName: string, nextMapName: string): void {
  validateMapAvailable(resources, currentMapName);
  validateMapAvailable(resources, nextMapName);

  if (currentMapName === nextMapName) {
    throw new RangeError(`level exit flow requires distinct maps, got ${currentMapName}`);
  }
}

function validateMapAvailable(resources: LauncherResources, mapName: string): void {
  if (!resources.mapNames.includes(mapName)) {
    throw new RangeError(`map ${mapName} is not available in IWAD resources`);
  }
}

function validateRuntimeCommand(command: string): void {
  if (command !== WIRE_LEVEL_EXIT_FLOW_COMMAND_CONTRACT.command) {
    throw new Error(`wireLevelExitFlow requires ${WIRE_LEVEL_EXIT_FLOW_COMMAND_CONTRACT.command}, got ${command}`);
  }
}
