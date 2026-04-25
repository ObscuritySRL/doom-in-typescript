import { KEY_ENTER, MenuKind, handleMenuKey } from '../../ui/menus.ts';
import { setMenuActive } from '../../ui/frontEndSequence.ts';

import type { FrontEndSequenceState } from '../../ui/frontEndSequence.ts';
import type { MenuAction, MenuState } from '../../ui/menus.ts';

export const IMPLEMENT_MESSAGES_TOGGLE_CONTRACT = Object.freeze({
  audit: Object.freeze({
    missingLaunchToMenuManifestPath: 'plan_fps/manifests/01-008-audit-missing-launch-to-menu.json',
    requiredStepId: '01-008',
    requiredSurface: 'launch-to-menu-transition',
  }),
  messagesOption: Object.freeze({
    actionKind: 'toggleMessages',
    itemOn: 1,
    lump: 'M_MESSG',
    menu: MenuKind.Options,
  }),
  runtime: Object.freeze({
    entryFile: 'doom.ts',
    program: 'bun',
    subcommand: 'run',
    value: 'bun run doom.ts',
  }),
  statusMessages: Object.freeze({
    disabled: 'Messages OFF',
    enabled: 'Messages ON',
  }),
} as const);

export interface ImplementMessagesToggleOptions {
  readonly frontEnd: FrontEndSequenceState;
  readonly menu: MenuState;
  readonly messagesEnabled: boolean;
  readonly runtimeCommand: string;
}

export interface ImplementMessagesToggleResult {
  readonly action: Extract<MenuAction, { readonly kind: 'toggleMessages' }>;
  readonly frontEndMenuActive: boolean;
  readonly inDemoPlayback: boolean;
  readonly menuActive: boolean;
  readonly menuItemOn: number;
  readonly messagesEnabled: boolean;
  readonly statusMessage: string;
}

function assertMessagesSelection(menu: MenuState): void {
  if (!menu.active) {
    throw new Error('Implement messages toggle requires an active menu.');
  }

  if (menu.currentMenu !== IMPLEMENT_MESSAGES_TOGGLE_CONTRACT.messagesOption.menu) {
    throw new Error('Implement messages toggle requires the Options menu.');
  }

  if (menu.itemOn !== IMPLEMENT_MESSAGES_TOGGLE_CONTRACT.messagesOption.itemOn) {
    throw new Error('Implement messages toggle requires the Messages menu item.');
  }
}

function assertRuntimeCommand(runtimeCommand: string): void {
  if (runtimeCommand !== IMPLEMENT_MESSAGES_TOGGLE_CONTRACT.runtime.value) {
    throw new Error(`Implement messages toggle requires ${IMPLEMENT_MESSAGES_TOGGLE_CONTRACT.runtime.value}.`);
  }
}

export function implementMessagesToggle(options: ImplementMessagesToggleOptions): ImplementMessagesToggleResult {
  assertRuntimeCommand(options.runtimeCommand);
  assertMessagesSelection(options.menu);

  setMenuActive(options.frontEnd, options.menu.active);

  const action = handleMenuKey(options.menu, KEY_ENTER);

  if (action.kind !== IMPLEMENT_MESSAGES_TOGGLE_CONTRACT.messagesOption.actionKind) {
    throw new Error('Options menu did not emit the Messages toggle action.');
  }

  const nextMessagesEnabled = !options.messagesEnabled;
  const statusMessage = nextMessagesEnabled ? IMPLEMENT_MESSAGES_TOGGLE_CONTRACT.statusMessages.enabled : IMPLEMENT_MESSAGES_TOGGLE_CONTRACT.statusMessages.disabled;

  setMenuActive(options.frontEnd, options.menu.active);

  return Object.freeze({
    action,
    frontEndMenuActive: options.frontEnd.menuActive,
    inDemoPlayback: options.frontEnd.inDemoPlayback,
    menuActive: options.menu.active,
    menuItemOn: options.menu.itemOn,
    messagesEnabled: nextMessagesEnabled,
    statusMessage,
  });
}
