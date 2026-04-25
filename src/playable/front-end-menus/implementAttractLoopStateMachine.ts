import { createFrontEndSequence, notifyDemoCompleted, setMenuActive, tickFrontEnd } from '../../ui/frontEndSequence.ts';
import type { FrontEndSequenceState } from '../../ui/frontEndSequence.ts';
import { createMenuState } from '../../ui/menus.ts';
import type { MenuState } from '../../ui/menus.ts';

const EXPECTED_RUNTIME_COMMAND = 'bun run doom.ts' as const;

export const IMPLEMENT_ATTRACT_LOOP_STATE_MACHINE_CONTRACT = Object.freeze({
  auditManifestPath: 'plan_fps/manifests/01-008-audit-missing-launch-to-menu.json',
  demoCompletionRequiresNextTick: true,
  initialPageLump: 'TITLEPIC',
  menuStartsInactive: true,
  pageTickerRunsWhileMenuActive: true,
  runtimeCommand: EXPECTED_RUNTIME_COMMAND,
  sequenceDriverPath: 'src/ui/frontEndSequence.ts',
  transitionKinds: Object.freeze(['idle', 'playDemo', 'showPage'] as const),
});

export type AttractLoopGameMode = Parameters<typeof createFrontEndSequence>[0];

export type AttractLoopPresentation =
  | {
      readonly kind: 'demo';
      readonly demoLump: string;
    }
  | {
      readonly kind: 'page';
      readonly lumpName: string;
      readonly musicLump: string | null;
      readonly pagetic: number;
    };

export interface AttractLoopSnapshot {
  readonly inDemoPlayback: boolean;
  readonly menuActive: boolean;
  readonly presentation: AttractLoopPresentation;
}

export interface AttractLoopStateMachineState {
  readonly frontEndSequenceState: FrontEndSequenceState;
  readonly menuState: MenuState;
  presentation: AttractLoopPresentation;
}

interface AttractLoopTransitionBase {
  readonly snapshot: AttractLoopSnapshot;
}

export interface IdleAttractLoopTransition extends AttractLoopTransitionBase {
  readonly kind: 'idle';
}

export interface PlayDemoAttractLoopTransition extends AttractLoopTransitionBase {
  readonly kind: 'playDemo';
}

export interface ShowPageAttractLoopTransition extends AttractLoopTransitionBase {
  readonly kind: 'showPage';
}

export type AttractLoopTransition = IdleAttractLoopTransition | PlayDemoAttractLoopTransition | ShowPageAttractLoopTransition;

export interface ImplementAttractLoopStateMachineOptions {
  readonly gameMode: AttractLoopGameMode;
  readonly runtimeCommand: string;
}

export interface ImplementAttractLoopStateMachineResult {
  readonly initialTransition: ShowPageAttractLoopTransition;
  readonly stateMachine: AttractLoopStateMachineState;
}

function assertRuntimeCommand(runtimeCommand: string): void {
  if (runtimeCommand !== EXPECTED_RUNTIME_COMMAND) {
    throw new Error(`Expected runtime command "${EXPECTED_RUNTIME_COMMAND}", received "${runtimeCommand}".`);
  }
}

function createDemoPresentation(demoLump: string): AttractLoopPresentation {
  return Object.freeze({
    demoLump,
    kind: 'demo',
  });
}

function createPagePresentation(lumpName: string, musicLump: string | null, pagetic: number): AttractLoopPresentation {
  return Object.freeze({
    kind: 'page',
    lumpName,
    musicLump,
    pagetic,
  });
}

function createSnapshot(stateMachine: AttractLoopStateMachineState): AttractLoopSnapshot {
  return Object.freeze({
    inDemoPlayback: stateMachine.frontEndSequenceState.inDemoPlayback,
    menuActive: stateMachine.menuState.active,
    presentation: stateMachine.presentation,
  });
}

function createTransition(kind: AttractLoopTransition['kind'], stateMachine: AttractLoopStateMachineState): AttractLoopTransition {
  return Object.freeze({
    kind,
    snapshot: createSnapshot(stateMachine),
  });
}

function updateFromTick(stateMachine: AttractLoopStateMachineState): AttractLoopTransition {
  const tickAction = tickFrontEnd(stateMachine.frontEndSequenceState);

  if (tickAction.kind === 'playDemo') {
    stateMachine.presentation = createDemoPresentation(tickAction.demoLump);
    return createTransition('playDemo', stateMachine);
  }

  if (tickAction.kind === 'showPage') {
    stateMachine.presentation = createPagePresentation(tickAction.lumpName, tickAction.musicLump, tickAction.pagetic);
    return createTransition('showPage', stateMachine);
  }

  return createTransition('idle', stateMachine);
}

export function implementAttractLoopStateMachine(options: ImplementAttractLoopStateMachineOptions): ImplementAttractLoopStateMachineResult {
  assertRuntimeCommand(options.runtimeCommand);

  const frontEndSequenceState = createFrontEndSequence(options.gameMode);
  const menuState = createMenuState();
  const stateMachine: AttractLoopStateMachineState = {
    frontEndSequenceState,
    menuState,
    presentation: createPagePresentation(IMPLEMENT_ATTRACT_LOOP_STATE_MACHINE_CONTRACT.initialPageLump, 'D_INTRO', 170),
  };

  setMenuActive(frontEndSequenceState, menuState.active);

  const initialTransition = updateFromTick(stateMachine);

  if (initialTransition.kind !== 'showPage') {
    throw new Error('Attract loop must begin on the TITLEPIC page.');
  }

  return Object.freeze({
    initialTransition,
    stateMachine,
  });
}

export function tickAttractLoopStateMachine(stateMachine: AttractLoopStateMachineState): AttractLoopTransition {
  return updateFromTick(stateMachine);
}

export function syncAttractLoopMenuState(stateMachine: AttractLoopStateMachineState, active: boolean): void {
  stateMachine.menuState.active = active;
  setMenuActive(stateMachine.frontEndSequenceState, active);
}

export function completeAttractLoopDemo(stateMachine: AttractLoopStateMachineState): void {
  if (!stateMachine.frontEndSequenceState.inDemoPlayback) {
    throw new Error('Cannot complete an attract-loop demo when no demo is active.');
  }

  notifyDemoCompleted(stateMachine.frontEndSequenceState);
}
