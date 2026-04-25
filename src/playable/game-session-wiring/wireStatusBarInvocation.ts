import type { LauncherInputState, LauncherSession } from '../../launcher/session.ts';
import type { MainLoopCallbacks, MainLoopPhase, PreLoopCallbacks, PreLoopStep } from '../../mainLoop.ts';

import { EMPTY_LAUNCHER_INPUT, advanceLauncherSession, renderLauncherFrame } from '../../launcher/session.ts';
import { MainLoop } from '../../mainLoop.ts';

export const WIRE_STATUS_BAR_INVOCATION_CONTRACT = Object.freeze({
  auditManifestPath: 'plan_fps/manifests/01-009-audit-missing-menu-to-e1m1.json',
  command: 'bun run doom.ts',
  entryFile: 'doom.ts',
  runtime: 'bun',
  stepId: '08-008',
  stepTitle: 'wire-status-bar-invocation',
} as const);

export type StatusBarInvocationPhase = 'display';

export type WireStatusBarPhaseTraceEntry = `frame:${MainLoopPhase}` | `preLoop:${PreLoopStep}` | 'statusBar:display';

export interface StatusBarInvocation {
  readonly frameNumber: number;
  readonly levelTime: number;
  readonly phase: StatusBarInvocationPhase;
  readonly playerHealth: number;
  readonly playerObjectHealth: number | null;
  readonly renderedAfterGameplay: boolean;
  readonly viewZ: number;
}

export interface WireStatusBarInvocationOptions {
  readonly command?: string;
  readonly inputState?: LauncherInputState;
  readonly loop?: MainLoop;
}

export interface WireStatusBarInvocationResult {
  readonly frameCount: number;
  readonly framebufferLength: number;
  readonly framebufferSample: readonly number[];
  readonly levelTime: number;
  readonly loopStartedBeforeInvocation: boolean;
  readonly phaseTrace: readonly WireStatusBarPhaseTraceEntry[];
  readonly statusBarInvocation: StatusBarInvocation;
}

interface DisplayEvidence {
  framebuffer?: Uint8Array;
  statusBarInvocation?: StatusBarInvocation;
}

/**
 * Wires the gameplay status-bar invocation into the Bun playable frame path.
 *
 * @param session Active launcher session to advance and render.
 * @param options Optional command, input state, and reusable main loop.
 * @returns Replay-stable evidence for the frame phase where the status bar runs.
 * @example
 * ```ts
 * const evidence = wireStatusBarInvocation(session, { command: 'bun run doom.ts' });
 * console.log(evidence.statusBarInvocation.phase);
 * ```
 */
export function wireStatusBarInvocation(session: LauncherSession, options: WireStatusBarInvocationOptions = {}): WireStatusBarInvocationResult {
  const command = options.command ?? WIRE_STATUS_BAR_INVOCATION_CONTRACT.command;

  validateCommand(command);

  const inputState = options.inputState ?? EMPTY_LAUNCHER_INPUT;
  const loop = options.loop ?? new MainLoop();
  const loopStartedBeforeInvocation = loop.started;
  const phaseTrace: WireStatusBarPhaseTraceEntry[] = [];

  setupLoopIfNeeded(loop, phaseTrace);

  const displayEvidence: DisplayEvidence = {};

  const callbacks = {
    display() {
      phaseTrace.push('frame:display');
      displayEvidence.framebuffer = renderLauncherFrame(session);
      displayEvidence.statusBarInvocation = captureStatusBarInvocation(session, loop.frameCount + 1, true);
      phaseTrace.push('statusBar:display');
    },
    startFrame() {
      phaseTrace.push('frame:startFrame');
    },
    tryRunTics() {
      phaseTrace.push('frame:tryRunTics');
      advanceLauncherSession(session, inputState);
    },
    updateSounds() {
      phaseTrace.push('frame:updateSounds');
    },
  } satisfies MainLoopCallbacks;

  loop.runOneFrame(callbacks);

  if (displayEvidence.framebuffer === undefined || displayEvidence.statusBarInvocation === undefined) {
    throw new Error('status bar invocation did not run during display');
  }

  const framebuffer = displayEvidence.framebuffer;

  return Object.freeze({
    frameCount: loop.frameCount,
    framebufferLength: framebuffer.length,
    framebufferSample: Object.freeze(Array.from(framebuffer.subarray(0, 8))),
    levelTime: session.levelTime,
    loopStartedBeforeInvocation,
    phaseTrace: Object.freeze([...phaseTrace]),
    statusBarInvocation: displayEvidence.statusBarInvocation,
  });
}

function captureStatusBarInvocation(session: LauncherSession, frameNumber: number, renderedAfterGameplay: boolean): StatusBarInvocation {
  return Object.freeze({
    frameNumber,
    levelTime: session.levelTime,
    phase: 'display',
    playerHealth: session.player.health,
    playerObjectHealth: session.player.mo === null ? null : session.player.mo.health,
    renderedAfterGameplay,
    viewZ: session.player.viewz,
  });
}

function setupLoopIfNeeded(loop: MainLoop, phaseTrace: WireStatusBarPhaseTraceEntry[]): void {
  if (loop.started) {
    return;
  }

  const callbacks = {
    executeSetViewSize() {
      phaseTrace.push('preLoop:executeSetViewSize');
    },
    initialTryRunTics() {
      phaseTrace.push('preLoop:initialTryRunTics');
    },
    restoreBuffer() {
      phaseTrace.push('preLoop:restoreBuffer');
    },
    startGameLoop() {
      phaseTrace.push('preLoop:startGameLoop');
    },
  } satisfies PreLoopCallbacks;

  loop.setup(callbacks);
}

function validateCommand(command: string): void {
  if (command !== WIRE_STATUS_BAR_INVOCATION_CONTRACT.command) {
    throw new Error(`wireStatusBarInvocation requires ${WIRE_STATUS_BAR_INVOCATION_CONTRACT.command}, got ${command}`);
  }
}
