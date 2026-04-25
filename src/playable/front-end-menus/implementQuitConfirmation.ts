import type { FrontEndSequenceState } from '../../ui/frontEndSequence.ts';
import type { MenuAction, MenuState } from '../../ui/menus.ts';

import { setMenuActive } from '../../ui/frontEndSequence.ts';
import { KEY_ENTER, KEY_ESCAPE, MenuKind, handleMenuKey } from '../../ui/menus.ts';

export const IMPLEMENT_QUIT_CONFIRMATION_CONTRACT = Object.freeze({
  auditStepId: '01-008',
  confirmation: Object.freeze({
    cancelInputs: Object.freeze(['escape', 'n'] as const),
    confirmActionKind: 'quitGame',
    confirmInputs: Object.freeze(['enter', 'y'] as const),
    needsYesNo: true,
    text: 'are you sure you want to\nquit this great game?',
  }),
  mainMenu: Object.freeze({
    kind: MenuKind.Main,
    quitItemIndex: 5,
  }),
  requiredRuntimeCommand: 'bun run doom.ts',
});

const KEY_N = 'n'.charCodeAt(0);
const KEY_Y = 'y'.charCodeAt(0);

export type QuitConfirmationRequest = { readonly input: 'escape' | 'n'; readonly kind: 'cancelQuit' } | { readonly input: 'enter' | 'y'; readonly kind: 'confirmQuit' } | { readonly kind: 'openConfirmation' };

export interface ImplementQuitConfirmationOptions {
  readonly command: string;
  readonly frontEndSequenceState: FrontEndSequenceState;
  readonly menuState: MenuState;
  readonly request: QuitConfirmationRequest;
}

export interface ImplementQuitConfirmationResult {
  readonly demoPlaybackPreserved: boolean;
  readonly frontEndMenuActive: boolean;
  readonly menuAction: MenuAction;
  readonly menuMessageActive: boolean;
  readonly menuMessageNeedsYesNo: boolean;
  readonly menuMessageString: string | null;
  readonly menuPendingActionKind: MenuAction['kind'] | null;
}

function ensureRuntimeCommand(command: string): void {
  if (command !== IMPLEMENT_QUIT_CONFIRMATION_CONTRACT.requiredRuntimeCommand) {
    throw new Error(`implementQuitConfirmation requires "${IMPLEMENT_QUIT_CONFIRMATION_CONTRACT.requiredRuntimeCommand}".`);
  }
}

function ensureQuitMenuSelection(menuState: MenuState): void {
  if (!menuState.active) {
    throw new Error('Quit confirmation requires an active menu.');
  }

  if (menuState.currentMenu !== IMPLEMENT_QUIT_CONFIRMATION_CONTRACT.mainMenu.kind) {
    throw new Error('Quit confirmation requires the Main menu.');
  }

  if (menuState.itemOn !== IMPLEMENT_QUIT_CONFIRMATION_CONTRACT.mainMenu.quitItemIndex) {
    throw new Error('Quit confirmation requires the Main menu Quit Game selection.');
  }

  if (menuState.messageActive) {
    throw new Error('Quit confirmation is already open.');
  }
}

function ensureQuitConfirmationMessage(menuState: MenuState): void {
  if (!menuState.active) {
    throw new Error('Quit confirmation requires an active menu.');
  }

  if (!menuState.messageActive || menuState.messageString !== IMPLEMENT_QUIT_CONFIRMATION_CONTRACT.confirmation.text) {
    throw new Error('Quit confirmation requires the active quit message.');
  }

  if (!menuState.messageNeedsYesNo) {
    throw new Error('Quit confirmation requires a yes/no prompt.');
  }

  if (menuState.messagePendingAction?.kind !== IMPLEMENT_QUIT_CONFIRMATION_CONTRACT.confirmation.confirmActionKind) {
    throw new Error('Quit confirmation requires a quitGame confirm action.');
  }
}

function buildResult(frontEndSequenceState: FrontEndSequenceState, menuAction: MenuAction, menuState: MenuState, demoPlaybackPreserved: boolean): ImplementQuitConfirmationResult {
  return Object.freeze({
    demoPlaybackPreserved,
    frontEndMenuActive: frontEndSequenceState.menuActive,
    menuAction,
    menuMessageActive: menuState.messageActive,
    menuMessageNeedsYesNo: menuState.messageNeedsYesNo,
    menuMessageString: menuState.messageString,
    menuPendingActionKind: menuState.messagePendingAction?.kind ?? null,
  });
}

export function implementQuitConfirmation({ command, frontEndSequenceState, menuState, request }: ImplementQuitConfirmationOptions): ImplementQuitConfirmationResult {
  ensureRuntimeCommand(command);

  const initialDemoPlayback = frontEndSequenceState.inDemoPlayback;
  let menuAction: MenuAction;

  switch (request.kind) {
    case 'openConfirmation': {
      ensureQuitMenuSelection(menuState);
      menuAction = handleMenuKey(menuState, KEY_ENTER);

      if (
        menuAction.kind !== 'openMessage' ||
        menuAction.needsYesNo !== IMPLEMENT_QUIT_CONFIRMATION_CONTRACT.confirmation.needsYesNo ||
        menuAction.onConfirm.kind !== IMPLEMENT_QUIT_CONFIRMATION_CONTRACT.confirmation.confirmActionKind ||
        menuAction.text !== IMPLEMENT_QUIT_CONFIRMATION_CONTRACT.confirmation.text
      ) {
        throw new Error('Quit confirmation did not open the expected quit prompt.');
      }

      break;
    }
    case 'confirmQuit': {
      ensureQuitConfirmationMessage(menuState);

      const confirmationKey = request.input === 'enter' ? KEY_ENTER : KEY_Y;
      menuAction = handleMenuKey(menuState, confirmationKey);

      if (menuAction.kind !== IMPLEMENT_QUIT_CONFIRMATION_CONTRACT.confirmation.confirmActionKind) {
        throw new Error('Quit confirmation did not confirm quitGame.');
      }

      break;
    }
    case 'cancelQuit': {
      ensureQuitConfirmationMessage(menuState);

      const cancellationKey = request.input === 'escape' ? KEY_ESCAPE : KEY_N;
      menuAction = handleMenuKey(menuState, cancellationKey);

      if (menuAction.kind !== 'none') {
        throw new Error('Quit confirmation cancel should leave the menu layer on the no-op action.');
      }

      break;
    }
  }

  setMenuActive(frontEndSequenceState, menuState.active);

  const demoPlaybackPreserved = frontEndSequenceState.inDemoPlayback === initialDemoPlayback;

  if (!demoPlaybackPreserved) {
    throw new Error('Quit confirmation must preserve front-end demo playback state.');
  }

  return buildResult(frontEndSequenceState, menuAction, menuState, demoPlaybackPreserved);
}
