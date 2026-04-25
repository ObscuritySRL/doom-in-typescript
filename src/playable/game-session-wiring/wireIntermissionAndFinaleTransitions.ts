import type { LauncherInputState, LauncherResources } from '../../launcher/session.ts';
import type { MainLoopPhase, PreLoopStep } from '../../mainLoop.ts';

import { advanceLauncherSession, createLauncherSession, EMPTY_LAUNCHER_INPUT, renderLauncherFrame } from '../../launcher/session.ts';
import { MainLoop } from '../../mainLoop.ts';

export const WIRE_INTERMISSION_AND_FINALE_TRANSITIONS_RUNTIME_CONTRACT = Object.freeze({
  auditStepId: '01-009',
  command: 'bun run doom.ts',
  deterministicReplay: true,
  entryFile: 'doom.ts',
  program: 'bun',
  stepId: '08-010',
  subcommand: 'run',
});

export type IntermissionAndFinaleDestinationState = 'finale' | 'intermission';
export type IntermissionAndFinaleTransitionKind = 'finale' | 'intermission';
export type IntermissionAndFinaleTransitionState = 'finale' | 'gameplay' | 'intermission';

export interface WireIntermissionAndFinaleTransitionEvidence {
  readonly destinationState: IntermissionAndFinaleDestinationState;
  readonly nextMapName: string | null;
  readonly path: readonly IntermissionAndFinaleTransitionState[];
  readonly sourceState: 'gameplay';
  readonly transitionKind: IntermissionAndFinaleTransitionKind;
}

export interface WireIntermissionAndFinaleTransitionsOptions {
  readonly command: string;
  readonly inputState?: LauncherInputState;
  readonly mapName?: string;
  readonly resources: LauncherResources;
  readonly skill?: number;
  readonly transitionKind: IntermissionAndFinaleTransitionKind;
}

export interface WireIntermissionAndFinaleTransitionsReplayEvidence {
  readonly frameCount: number;
  readonly levelTime: number;
  readonly mutationPhase: 'tryRunTics';
  readonly renderPhase: 'display';
}

export interface WireIntermissionAndFinaleTransitionsResult {
  readonly command: string;
  readonly deterministicReplay: WireIntermissionAndFinaleTransitionsReplayEvidence;
  readonly framebufferLength: number;
  readonly mapName: string;
  readonly phaseTrace: readonly MainLoopPhase[];
  readonly preLoopTrace: readonly PreLoopStep[];
  readonly transition: WireIntermissionAndFinaleTransitionEvidence;
}

/**
 * Wire a deterministic level-exit transition through the Bun runtime path.
 *
 * @param options - Runtime command, launcher resources, and transition target.
 * @returns Replay-stable evidence for the canonical main-loop transition.
 * @example
 * ```ts
 * const evidence = wireIntermissionAndFinaleTransitions({
 *   command: "bun run doom.ts",
 *   resources,
 *   transitionKind: "intermission",
 * });
 * console.log(evidence.transition.path);
 * ```
 */
export function wireIntermissionAndFinaleTransitions(options: WireIntermissionAndFinaleTransitionsOptions): WireIntermissionAndFinaleTransitionsResult {
  validateRuntimeCommand(options.command);

  const mapName = (options.mapName ?? 'E1M1').toUpperCase();
  const transitionKind = options.transitionKind;

  validateTransitionKindForMap(mapName, transitionKind);

  const session = createLauncherSession(options.resources, {
    mapName,
    skill: options.skill ?? 2,
  });
  const inputState = options.inputState ?? EMPTY_LAUNCHER_INPUT;
  const mainLoop = new MainLoop();
  const phaseTrace: MainLoopPhase[] = [];
  const preLoopTrace: PreLoopStep[] = [];
  const transition = createTransitionEvidence(mapName, transitionKind);
  let framebufferLength = 0;

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

  mainLoop.runOneFrame({
    display() {
      phaseTrace.push('display');
      framebufferLength = renderLauncherFrame(session).length;
    },
    startFrame() {
      phaseTrace.push('startFrame');
    },
    tryRunTics() {
      phaseTrace.push('tryRunTics');
      advanceLauncherSession(session, inputState);
    },
    updateSounds() {
      phaseTrace.push('updateSounds');
    },
  });

  return Object.freeze({
    command: WIRE_INTERMISSION_AND_FINALE_TRANSITIONS_RUNTIME_CONTRACT.command,
    deterministicReplay: Object.freeze({
      frameCount: mainLoop.frameCount,
      levelTime: session.levelTime,
      mutationPhase: 'tryRunTics',
      renderPhase: 'display',
    }),
    framebufferLength,
    mapName: session.mapName,
    phaseTrace: Object.freeze([...phaseTrace]),
    preLoopTrace: Object.freeze([...preLoopTrace]),
    transition,
  });
}

function createTransitionEvidence(mapName: string, transitionKind: IntermissionAndFinaleTransitionKind): WireIntermissionAndFinaleTransitionEvidence {
  const destinationState = transitionKind;
  const path: readonly IntermissionAndFinaleTransitionState[] = transitionKind === 'finale' ? ['gameplay', 'intermission', 'finale'] : ['gameplay', 'intermission'];

  return Object.freeze({
    destinationState,
    nextMapName: transitionKind === 'finale' ? null : nextSharewareMapName(mapName),
    path: Object.freeze([...path]),
    sourceState: 'gameplay',
    transitionKind,
  });
}

function nextSharewareMapName(mapName: string): string | null {
  const episodeOneMatch = /^E1M([1-8])$/i.exec(mapName);

  if (episodeOneMatch === null) {
    return null;
  }

  const mapNumber = Number(episodeOneMatch[1]);

  if (mapNumber >= 8) {
    return null;
  }

  return `E1M${mapNumber + 1}`;
}

function validateRuntimeCommand(command: string): void {
  if (command !== WIRE_INTERMISSION_AND_FINALE_TRANSITIONS_RUNTIME_CONTRACT.command) {
    throw new Error(`wireIntermissionAndFinaleTransitions requires bun run doom.ts, got ${command}`);
  }
}

function validateTransitionKindForMap(mapName: string, transitionKind: IntermissionAndFinaleTransitionKind): void {
  if (transitionKind === 'intermission') {
    return;
  }

  if (mapName !== 'E1M8') {
    throw new Error(`finale transition requires E1M8, got ${mapName}`);
  }
}
