import type { LauncherInputState, LauncherSession } from '../../launcher/session.ts';
import type { MainLoopPhase, PreLoopStep } from '../../mainLoop.ts';

import { advanceLauncherSession, EMPTY_LAUNCHER_INPUT, renderLauncherFrame } from '../../launcher/session.ts';
import { MainLoop } from '../../mainLoop.ts';

export interface AutomapToggleRenderEvidence {
  readonly afterShowAutomap: boolean;
  readonly beforeShowAutomap: boolean;
  readonly frameCount: number;
  readonly levelTime: number;
  readonly phaseTrace: readonly MainLoopPhase[];
  readonly preLoopTrace: readonly PreLoopStep[];
  readonly renderedFramebufferByteLength: number;
  readonly renderedFramebufferIsSessionFramebuffer: boolean;
  readonly renderedMode: 'automap' | 'gameplay';
  readonly showAutomapAfterTryRunTics: boolean;
  readonly showAutomapDuringDisplay: boolean;
}

export interface AutomapToggleRenderOptions {
  readonly command: string;
  readonly inputState?: LauncherInputState;
  readonly mainLoop?: MainLoop;
  readonly session: LauncherSession;
}

export interface RuntimeCommandContract {
  readonly command: 'bun run doom.ts';
  readonly entryFile: 'doom.ts';
  readonly program: 'bun';
  readonly subcommand: 'run';
}

export const WIRE_AUTOMAP_TOGGLE_RENDER_PATH_COMMAND_CONTRACT = Object.freeze({
  command: 'bun run doom.ts',
  entryFile: 'doom.ts',
  program: 'bun',
  subcommand: 'run',
} satisfies RuntimeCommandContract);

export function wireAutomapToggleRenderPath(options: AutomapToggleRenderOptions): AutomapToggleRenderEvidence {
  if (options.command !== WIRE_AUTOMAP_TOGGLE_RENDER_PATH_COMMAND_CONTRACT.command) {
    throw new Error(`Expected command ${WIRE_AUTOMAP_TOGGLE_RENDER_PATH_COMMAND_CONTRACT.command}, got ${options.command}.`);
  }

  const beforeShowAutomap = options.session.showAutomap;
  const inputState = options.inputState ?? {
    ...EMPTY_LAUNCHER_INPUT,
    toggleMap: true,
  };
  const mainLoop = options.mainLoop ?? new MainLoop();
  const phaseTrace: MainLoopPhase[] = [];
  const preLoopTrace: PreLoopStep[] = [];
  const renderEvidence = {
    framebuffer: options.session.framebuffer,
    showAutomapDuringDisplay: options.session.showAutomap,
  };
  let showAutomapAfterTryRunTics = options.session.showAutomap;

  if (!mainLoop.started) {
    mainLoop.setup({
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

  mainLoop.runOneFrame({
    display() {
      phaseTrace.push('display');
      renderEvidence.showAutomapDuringDisplay = options.session.showAutomap;
      renderEvidence.framebuffer = renderLauncherFrame(options.session);
    },
    startFrame() {
      phaseTrace.push('startFrame');
    },
    tryRunTics() {
      phaseTrace.push('tryRunTics');
      advanceLauncherSession(options.session, inputState);
      showAutomapAfterTryRunTics = options.session.showAutomap;
    },
    updateSounds() {
      phaseTrace.push('updateSounds');
    },
  });

  return Object.freeze({
    afterShowAutomap: options.session.showAutomap,
    beforeShowAutomap,
    frameCount: mainLoop.frameCount,
    levelTime: options.session.levelTime,
    phaseTrace,
    preLoopTrace,
    renderedFramebufferByteLength: renderEvidence.framebuffer.byteLength,
    renderedFramebufferIsSessionFramebuffer: renderEvidence.framebuffer === options.session.framebuffer,
    renderedMode: renderEvidence.showAutomapDuringDisplay ? 'automap' : 'gameplay',
    showAutomapAfterTryRunTics,
    showAutomapDuringDisplay: renderEvidence.showAutomapDuringDisplay,
  });
}
