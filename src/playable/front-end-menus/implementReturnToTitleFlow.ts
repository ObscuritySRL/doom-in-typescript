import { createFrontEndSequence, setMenuActive, tickFrontEnd } from '../../ui/frontEndSequence.ts';
import { closeMenu, handleMenuKey, KEY_ENTER, MenuKind } from '../../ui/menus.ts';

import type { FrontEndSequenceState, FrontEndTickAction } from '../../ui/frontEndSequence.ts';
import type { MenuAction, MenuState } from '../../ui/menus.ts';

export const IMPLEMENT_RETURN_TO_TITLE_FLOW_RUNTIME_CONTRACT = Object.freeze({
  audit: Object.freeze({
    schemaVersion: 1,
    stepId: '07-020',
    title: 'implement-return-to-title-flow',
  }),
  launchAudit: Object.freeze({
    manifestPath: 'plan_fps/manifests/01-008-audit-missing-launch-to-menu.json',
    missingSurface: 'launch-to-menu-transition',
    stepId: '01-008',
    title: 'audit-missing-launch-to-menu',
  }),
  runtime: Object.freeze({
    entryFile: 'doom.ts',
    program: 'bun',
    subcommand: 'run',
    value: 'bun run doom.ts',
  }),
  selection: Object.freeze({
    confirmationText: 'are you sure you want to end the game?',
    defaultResponseKey: KEY_ENTER,
    itemOn: 0,
    menu: MenuKind.Options,
    resultAction: 'endGame',
  }),
  titleReset: Object.freeze({
    initialLumpName: 'TITLEPIC',
    initialMusicLump: 'D_INTRO',
    initialTickKind: 'showPage',
    menuActive: false,
  }),
});

export interface ImplementReturnToTitleFlowOptions {
  readonly command: string;
  readonly frontEndSequenceState: FrontEndSequenceState;
  readonly gameMode: Parameters<typeof createFrontEndSequence>[0];
  readonly menuState: MenuState;
  readonly responseKey?: number;
}

export interface ReturnToTitleFlowResult {
  readonly confirmationAction: MenuAction;
  readonly nextFrontEndSequenceState: FrontEndSequenceState;
  readonly responseAction: MenuAction;
  readonly returnedToTitle: boolean;
  readonly titleTickAction: FrontEndTickAction | null;
}

/**
 * Route the Options-menu End Game confirmation through the Bun-only playable
 * parity path and, on confirm, reseed the front-end title loop.
 *
 * @param options Runtime command, menu state, front-end state, and optional confirmation-response key.
 * @returns The opened confirmation action, the response action, and either a reseeded title tick or `null` when the flow stays in-menu.
 * @example
 * ```ts
 * import { createFrontEndSequence } from '../../ui/frontEndSequence.ts';
 * import { createMenuState, openMenu, MenuKind } from '../../ui/menus.ts';
 *
 * const frontEndSequenceState = createFrontEndSequence('shareware');
 * const menuState = createMenuState();
 * openMenu(menuState, MenuKind.Options);
 *
 * const result = implementReturnToTitleFlow({
 *   command: 'bun run doom.ts',
 *   frontEndSequenceState,
 *   gameMode: 'shareware',
 *   menuState,
 *   responseKey: 'y'.charCodeAt(0),
 * });
 *
 * console.log(result.returnedToTitle); // true
 * ```
 */
export function implementReturnToTitleFlow({
  command,
  frontEndSequenceState,
  gameMode,
  menuState,
  responseKey = IMPLEMENT_RETURN_TO_TITLE_FLOW_RUNTIME_CONTRACT.selection.defaultResponseKey,
}: ImplementReturnToTitleFlowOptions): ReturnToTitleFlowResult {
  if (command !== IMPLEMENT_RETURN_TO_TITLE_FLOW_RUNTIME_CONTRACT.runtime.value) {
    throw new Error('implementReturnToTitleFlow requires the Bun runtime command `bun run doom.ts`.');
  }

  if (!menuState.active || menuState.currentMenu !== MenuKind.Options || menuState.itemOn !== IMPLEMENT_RETURN_TO_TITLE_FLOW_RUNTIME_CONTRACT.selection.itemOn) {
    throw new Error('implementReturnToTitleFlow requires the active Options menu End Game selection.');
  }

  if (menuState.messageActive) {
    throw new Error('implementReturnToTitleFlow requires the end-game confirmation to start closed.');
  }

  setMenuActive(frontEndSequenceState, true);

  const confirmationAction = handleMenuKey(menuState, KEY_ENTER);

  if (
    confirmationAction.kind !== 'openMessage' ||
    confirmationAction.onConfirm.kind !== IMPLEMENT_RETURN_TO_TITLE_FLOW_RUNTIME_CONTRACT.selection.resultAction ||
    confirmationAction.text !== IMPLEMENT_RETURN_TO_TITLE_FLOW_RUNTIME_CONTRACT.selection.confirmationText
  ) {
    throw new Error('implementReturnToTitleFlow failed to open the end-game confirmation.');
  }

  const responseAction = handleMenuKey(menuState, responseKey);

  if (responseAction.kind !== 'endGame') {
    return {
      confirmationAction,
      nextFrontEndSequenceState: frontEndSequenceState,
      responseAction,
      returnedToTitle: false,
      titleTickAction: null,
    };
  }

  closeMenu(menuState);
  setMenuActive(frontEndSequenceState, false);

  const nextFrontEndSequenceState = createFrontEndSequence(gameMode);
  const titleTickAction = tickFrontEnd(nextFrontEndSequenceState);

  if (
    titleTickAction.kind !== IMPLEMENT_RETURN_TO_TITLE_FLOW_RUNTIME_CONTRACT.titleReset.initialTickKind ||
    titleTickAction.lumpName !== IMPLEMENT_RETURN_TO_TITLE_FLOW_RUNTIME_CONTRACT.titleReset.initialLumpName ||
    titleTickAction.musicLump !== IMPLEMENT_RETURN_TO_TITLE_FLOW_RUNTIME_CONTRACT.titleReset.initialMusicLump
  ) {
    throw new Error('implementReturnToTitleFlow failed to reseed the title loop.');
  }

  return {
    confirmationAction,
    nextFrontEndSequenceState,
    responseAction,
    returnedToTitle: true,
    titleTickAction,
  };
}
