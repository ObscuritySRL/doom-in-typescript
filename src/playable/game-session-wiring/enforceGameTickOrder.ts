import type { LauncherInputState, LauncherSession } from '../../launcher/session.ts';
import type { MainLoopPhase, PreLoopStep } from '../../mainLoop.ts';

import { EMPTY_LAUNCHER_INPUT, advanceLauncherSession, renderLauncherFrame } from '../../launcher/session.ts';
import { MainLoop } from '../../mainLoop.ts';

export const ENFORCE_GAME_TICK_ORDER_RUNTIME_CONTRACT = Object.freeze({
  auditManifest: {
    path: 'plan_fps/manifests/01-009-audit-missing-menu-to-e1m1.json',
    schemaVersion: 1,
    stepId: '01-009',
    stepTitle: 'audit-missing-menu-to-e1m1',
  },
  command: 'bun run doom.ts',
  entryFile: 'doom.ts',
  stepId: '08-004',
  stepTitle: 'enforce-game-tick-order',
});

export type EnforcedGameTickOrderPhase = MainLoopPhase | PreLoopStep;

export interface EnforceGameTickOrderOptions {
  readonly command: string;
  readonly inputState?: LauncherInputState;
  readonly loop?: MainLoop;
  readonly session: LauncherSession;
}

export interface EnforceGameTickOrderResult {
  readonly advancedTics: number;
  readonly frameCount: number;
  readonly framebuffer: Uint8Array;
  readonly orderedPhases: readonly EnforcedGameTickOrderPhase[];
  readonly replayLevelTime: number;
  readonly session: LauncherSession;
}

/**
 * Run one playable frame through the canonical Doom loop order.
 *
 * @param options Runtime command, launcher session, optional input state, and optional fresh loop.
 * @returns The ordered phases, resulting framebuffer, and replay-relevant tic count.
 * @example
 * ```ts
 * const result = enforceGameTickOrder({
 *   command: 'bun run doom.ts',
 *   session,
 * });
 * console.log(result.orderedPhases);
 * ```
 */
export function enforceGameTickOrder(options: EnforceGameTickOrderOptions): EnforceGameTickOrderResult {
  validateRuntimeCommand(options.command);

  const inputState = options.inputState ?? EMPTY_LAUNCHER_INPUT;
  const levelTimeBeforeFrame = options.session.levelTime;
  const loop = options.loop ?? new MainLoop();
  const orderedPhases: EnforcedGameTickOrderPhase[] = [];
  let framebuffer = options.session.framebuffer;

  loop.setup({
    executeSetViewSize() {
      orderedPhases.push('executeSetViewSize');
    },
    initialTryRunTics() {
      orderedPhases.push('initialTryRunTics');
    },
    restoreBuffer() {
      orderedPhases.push('restoreBuffer');
    },
    startGameLoop() {
      orderedPhases.push('startGameLoop');
    },
  });

  loop.runOneFrame({
    display() {
      orderedPhases.push('display');
      framebuffer = renderLauncherFrame(options.session);
    },
    startFrame() {
      orderedPhases.push('startFrame');
    },
    tryRunTics() {
      orderedPhases.push('tryRunTics');
      advanceLauncherSession(options.session, inputState);
    },
    updateSounds() {
      orderedPhases.push('updateSounds');
    },
  });

  return Object.freeze({
    advancedTics: options.session.levelTime - levelTimeBeforeFrame,
    frameCount: loop.frameCount,
    framebuffer,
    orderedPhases: Object.freeze([...orderedPhases]),
    replayLevelTime: options.session.levelTime,
    session: options.session,
  });
}

function validateRuntimeCommand(command: string): void {
  if (command !== ENFORCE_GAME_TICK_ORDER_RUNTIME_CONTRACT.command) {
    throw new Error(`Expected runtime command ${ENFORCE_GAME_TICK_ORDER_RUNTIME_CONTRACT.command}, got ${command}`);
  }
}
