import type { LauncherInputState, LauncherSession } from '../../launcher/session.ts';
import type { MainLoopPhase, PreLoopStep } from '../../mainLoop.ts';

import { EMPTY_LAUNCHER_INPUT, advanceLauncherSession, renderLauncherFrame } from '../../launcher/session.ts';
import { MainLoop } from '../../mainLoop.ts';

const RUNTIME_COMMAND = 'bun run doom.ts';

export interface WireGameplayRendererInvocationContract {
  readonly command: typeof RUNTIME_COMMAND;
  readonly entryFile: 'doom.ts';
  readonly rendererPhase: 'display';
  readonly sourceAuditPath: 'plan_fps/manifests/01-009-audit-missing-menu-to-e1m1.json';
  readonly sourceAuditStepId: '01-009';
}

export interface WireGameplayRendererInvocationOptions {
  readonly command: string;
  readonly inputState?: LauncherInputState;
  readonly mainLoop?: MainLoop;
  readonly session: LauncherSession;
}

export interface WireGameplayRendererInvocationResult {
  readonly framebuffer: Uint8Array;
  readonly frameCountAfter: number;
  readonly frameCountBefore: number;
  readonly levelTimeAfter: number;
  readonly levelTimeAfterRender: number;
  readonly levelTimeBefore: number;
  readonly levelTimeBeforeRender: number;
  readonly phaseTrace: readonly MainLoopPhase[];
  readonly preLoopTrace: readonly PreLoopStep[];
  readonly renderPhase: 'display';
  readonly renderedGameplay: true;
  readonly reusedFramebuffer: boolean;
  readonly showAutomap: false;
}

export const WIRE_GAMEPLAY_RENDERER_INVOCATION_CONTRACT = Object.freeze({
  command: RUNTIME_COMMAND,
  entryFile: 'doom.ts',
  rendererPhase: 'display',
  sourceAuditPath: 'plan_fps/manifests/01-009-audit-missing-menu-to-e1m1.json',
  sourceAuditStepId: '01-009',
} satisfies WireGameplayRendererInvocationContract);

export function wireGameplayRendererInvocation(options: WireGameplayRendererInvocationOptions): WireGameplayRendererInvocationResult {
  if (options.command !== WIRE_GAMEPLAY_RENDERER_INVOCATION_CONTRACT.command) {
    throw new Error(`wire gameplay renderer invocation requires ${WIRE_GAMEPLAY_RENDERER_INVOCATION_CONTRACT.command}`);
  }

  if (options.session.showAutomap) {
    throw new Error('wire gameplay renderer invocation requires gameplay view');
  }

  const inputState = options.inputState ?? EMPTY_LAUNCHER_INPUT;
  const mainLoop = options.mainLoop ?? new MainLoop();
  const phaseTrace: MainLoopPhase[] = [];
  const preLoopTrace: PreLoopStep[] = [];
  const frameCountBefore = mainLoop.frameCount;
  const levelTimeBefore = options.session.levelTime;
  let levelTimeBeforeRender = options.session.levelTime;
  let levelTimeAfterRender = options.session.levelTime;
  let renderedFramebuffer: Uint8Array | null = null;

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
      levelTimeBeforeRender = options.session.levelTime;
      renderedFramebuffer = renderLauncherFrame(options.session);
      levelTimeAfterRender = options.session.levelTime;
    },
    startFrame() {
      phaseTrace.push('startFrame');
    },
    tryRunTics() {
      phaseTrace.push('tryRunTics');
      advanceLauncherSession(options.session, inputState);
    },
    updateSounds() {
      phaseTrace.push('updateSounds');
    },
  });

  if (renderedFramebuffer === null) {
    throw new Error('gameplay renderer was not invoked during display');
  }

  return Object.freeze({
    framebuffer: renderedFramebuffer,
    frameCountAfter: mainLoop.frameCount,
    frameCountBefore,
    levelTimeAfter: options.session.levelTime,
    levelTimeAfterRender,
    levelTimeBefore,
    levelTimeBeforeRender,
    phaseTrace: Object.freeze([...phaseTrace]),
    preLoopTrace: Object.freeze([...preLoopTrace]),
    renderPhase: WIRE_GAMEPLAY_RENDERER_INVOCATION_CONTRACT.rendererPhase,
    renderedGameplay: true,
    reusedFramebuffer: renderedFramebuffer === options.session.framebuffer,
    showAutomap: options.session.showAutomap,
  });
}
