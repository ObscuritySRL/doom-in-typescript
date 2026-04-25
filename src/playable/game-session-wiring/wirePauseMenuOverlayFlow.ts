import type { LauncherInputState, LauncherSession } from '../../launcher/session.ts';
import type { MainLoopPhase, PreLoopStep } from '../../mainLoop.ts';

import { EMPTY_LAUNCHER_INPUT, advanceLauncherSession, renderLauncherFrame } from '../../launcher/session.ts';
import { MainLoop } from '../../mainLoop.ts';

export const WIRE_PAUSE_MENU_OVERLAY_FLOW_COMMAND_CONTRACT = Object.freeze({
  command: 'bun run doom.ts',
  entryFile: 'doom.ts',
  program: 'bun',
  subcommand: 'run',
} as const);

export interface PauseMenuOverlayFlowResult {
  readonly framebuffer: Uint8Array;
  readonly frameCountAfter: number;
  readonly frameCountBefore: number;
  readonly gameplayAdvanced: boolean;
  readonly levelTimeAfter: number;
  readonly levelTimeBefore: number;
  readonly loopStartedAfter: boolean;
  readonly loopStartedBefore: boolean;
  readonly pauseMenuOverlayOpenAfter: boolean;
  readonly pauseMenuOverlayOpenBefore: boolean;
  readonly pauseMenuOverlayRenderedDuringDisplay: boolean;
  readonly phaseTrace: readonly MainLoopPhase[];
  readonly preLoopTrace: readonly PreLoopStep[];
  readonly renderPhase: MainLoopPhase;
  readonly runtimeCommand: typeof WIRE_PAUSE_MENU_OVERLAY_FLOW_COMMAND_CONTRACT.command;
  readonly tickPhase: MainLoopPhase;
}

export interface WirePauseMenuOverlayFlowOptions {
  readonly command?: string;
  readonly gameplayInput?: LauncherInputState;
  readonly loop?: MainLoop;
  readonly pauseMenuOverlayOpen?: boolean;
  readonly togglePauseMenu?: boolean;
}

export function wirePauseMenuOverlayFlow(session: LauncherSession, options: WirePauseMenuOverlayFlowOptions = {}): PauseMenuOverlayFlowResult {
  const runtimeCommand = options.command ?? WIRE_PAUSE_MENU_OVERLAY_FLOW_COMMAND_CONTRACT.command;
  validateRuntimeCommand(runtimeCommand);

  const loop = options.loop ?? new MainLoop();
  const gameplayInput = options.gameplayInput ?? EMPTY_LAUNCHER_INPUT;
  const phaseTrace: MainLoopPhase[] = [];
  const preLoopTrace: PreLoopStep[] = [];
  const frameCountBefore = loop.frameCount;
  const levelTimeBefore = session.levelTime;
  const loopStartedBefore = loop.started;
  const pauseMenuOverlayOpenBefore = options.pauseMenuOverlayOpen ?? false;
  const togglePauseMenu = options.togglePauseMenu ?? true;
  let displayedFramebuffer: Uint8Array | null = null;
  let gameplayAdvanced = false;
  let pauseMenuOverlayOpen = pauseMenuOverlayOpenBefore;
  let renderPhase: MainLoopPhase | null = null;
  let tickPhase: MainLoopPhase | null = null;

  if (!loop.started) {
    loop.setup({
      executeSetViewSize(): void {
        preLoopTrace.push('executeSetViewSize');
      },
      initialTryRunTics(): void {
        preLoopTrace.push('initialTryRunTics');
      },
      restoreBuffer(): void {
        preLoopTrace.push('restoreBuffer');
      },
      startGameLoop(): void {
        preLoopTrace.push('startGameLoop');
      },
    });
  }

  loop.runOneFrame({
    display(): void {
      phaseTrace.push('display');
      renderPhase = 'display';
      displayedFramebuffer = renderLauncherFrame(session);
    },
    startFrame(): void {
      phaseTrace.push('startFrame');
    },
    tryRunTics(): void {
      phaseTrace.push('tryRunTics');
      tickPhase = 'tryRunTics';

      if (togglePauseMenu) {
        pauseMenuOverlayOpen = !pauseMenuOverlayOpen;
      }

      if (pauseMenuOverlayOpen) {
        return;
      }

      advanceLauncherSession(session, gameplayInput);
      gameplayAdvanced = true;
    },
    updateSounds(): void {
      phaseTrace.push('updateSounds');
    },
  });

  if (displayedFramebuffer === null || renderPhase === null || tickPhase === null) {
    throw new Error('pause menu overlay flow did not complete a full main-loop frame');
  }

  return Object.freeze({
    framebuffer: displayedFramebuffer,
    frameCountAfter: loop.frameCount,
    frameCountBefore,
    gameplayAdvanced,
    levelTimeAfter: session.levelTime,
    levelTimeBefore,
    loopStartedAfter: loop.started,
    loopStartedBefore,
    pauseMenuOverlayOpenAfter: pauseMenuOverlayOpen,
    pauseMenuOverlayOpenBefore,
    pauseMenuOverlayRenderedDuringDisplay: pauseMenuOverlayOpen,
    phaseTrace: Object.freeze([...phaseTrace]),
    preLoopTrace: Object.freeze([...preLoopTrace]),
    renderPhase,
    runtimeCommand,
    tickPhase,
  });
}

function validateRuntimeCommand(command: string): asserts command is typeof WIRE_PAUSE_MENU_OVERLAY_FLOW_COMMAND_CONTRACT.command {
  if (command !== WIRE_PAUSE_MENU_OVERLAY_FLOW_COMMAND_CONTRACT.command) {
    throw new Error(`wire pause menu overlay flow expected ${WIRE_PAUSE_MENU_OVERLAY_FLOW_COMMAND_CONTRACT.command}, got ${command}`);
  }
}
