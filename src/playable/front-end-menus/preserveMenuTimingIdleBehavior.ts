import { setMenuActive, tickFrontEnd } from '../../ui/frontEndSequence.ts';
import { tickMenu } from '../../ui/menus.ts';

import type { FrontEndTickAction, FrontEndSequenceState } from '../../ui/frontEndSequence.ts';
import type { MenuState } from '../../ui/menus.ts';

export const PRESERVE_MENU_TIMING_IDLE_BEHAVIOR_RUNTIME_CONTRACT = Object.freeze({
  audit: Object.freeze({
    schemaVersion: 1,
    stepId: '07-019',
    title: 'preserve-menu-timing-idle-behavior',
  }),
  sourceAudit: Object.freeze({
    manifestPath: 'plan_fps/manifests/01-008-audit-missing-launch-to-menu.json',
    stepId: '01-008',
    title: 'audit-missing-launch-to-menu',
  }),
  targetRuntime: Object.freeze({
    entryFile: 'doom.ts',
    program: 'bun',
    subcommand: 'run',
    value: 'bun run doom.ts',
  }),
});

export interface PreserveMenuTimingIdleBehaviorOptions {
  readonly frontEndSequenceState: FrontEndSequenceState;
  readonly menuState: MenuState;
  readonly runtimeCommand: string;
}

export interface PreserveMenuTimingIdleBehaviorResult {
  readonly frontEndAction: FrontEndTickAction;
  readonly menuActive: boolean;
  readonly skullAnimCounter: number;
  readonly whichSkull: 0 | 1;
}

function assertRuntimeCommand(runtimeCommand: string): void {
  if (runtimeCommand !== PRESERVE_MENU_TIMING_IDLE_BEHAVIOR_RUNTIME_CONTRACT.targetRuntime.value) {
    throw new Error(`Expected runtime command ${PRESERVE_MENU_TIMING_IDLE_BEHAVIOR_RUNTIME_CONTRACT.targetRuntime.value}, received ${runtimeCommand}`);
  }
}

/**
 * Preserve the idle-tick timing path that vanilla keeps running while the menu overlay is open.
 *
 * @param options Bun-only runtime command plus the mutable menu/front-end states to tick once.
 * @returns The front-end tick result plus the observable menu timing state after the idle tick.
 * @example
 * ```ts
 * const result = preserveMenuTimingIdleBehavior({
 *   frontEndSequenceState,
 *   menuState,
 *   runtimeCommand: 'bun run doom.ts',
 * });
 *
 * console.log(result.frontEndAction.kind);
 * ```
 */
export function preserveMenuTimingIdleBehavior(options: PreserveMenuTimingIdleBehaviorOptions): PreserveMenuTimingIdleBehaviorResult {
  assertRuntimeCommand(options.runtimeCommand);

  setMenuActive(options.frontEndSequenceState, options.menuState.active);
  tickMenu(options.menuState);

  const frontEndAction = tickFrontEnd(options.frontEndSequenceState);

  return Object.freeze({
    frontEndAction,
    menuActive: options.frontEndSequenceState.menuActive,
    skullAnimCounter: options.menuState.skullAnimCounter,
    whichSkull: options.menuState.whichSkull,
  });
}
