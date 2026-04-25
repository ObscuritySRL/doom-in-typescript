import type { FrontEndSequenceState } from '../../ui/frontEndSequence.ts';
import type { MenuAction, MenuState } from '../../ui/menus.ts';

import { setMenuActive } from '../../ui/frontEndSequence.ts';
import { handleMenuKey, KEY_ESCAPE, MenuKind } from '../../ui/menus.ts';

const TARGET_RUNTIME = Object.freeze({
  entryFile: 'doom.ts',
  program: 'bun',
  subcommand: 'run',
  value: 'bun run doom.ts',
});

export const IMPLEMENT_MENU_SOUND_EVENTS_RUNTIME_CONTRACT = Object.freeze({
  audit: Object.freeze({
    schemaVersion: 1,
    stepId: '01-008',
    title: 'audit-missing-launch-to-menu',
  }),
  deterministicReplayCompatible: true,
  route: Object.freeze({
    frontEndSequenceModule: 'src/ui/frontEndSequence.ts',
    menuModule: 'src/ui/menus.ts',
  }),
  targetRuntime: TARGET_RUNTIME,
});

export const MENU_SOUND_EVENT_ACTIVATE = Object.freeze({ kind: 'activate' } as const);
export const MENU_SOUND_EVENT_ADJUST = Object.freeze({ kind: 'adjust' } as const);
export const MENU_SOUND_EVENT_BACK = Object.freeze({ kind: 'back' } as const);
export const MENU_SOUND_EVENT_CURSOR_MOVE = Object.freeze({ kind: 'cursorMove' } as const);
export const MENU_SOUND_EVENT_NONE = Object.freeze({ kind: 'none' } as const);

export type MenuSoundEvent = typeof MENU_SOUND_EVENT_ACTIVATE | typeof MENU_SOUND_EVENT_ADJUST | typeof MENU_SOUND_EVENT_BACK | typeof MENU_SOUND_EVENT_CURSOR_MOVE | typeof MENU_SOUND_EVENT_NONE;

export interface ImplementMenuSoundEventsResult {
  readonly menuAction: MenuAction;
  readonly soundEvent: MenuSoundEvent;
}

interface MenuSoundSnapshot {
  readonly active: boolean;
  readonly currentMenu: MenuKind;
  readonly itemOn: number;
  readonly messageActive: boolean;
}

function assertRuntimeCommand(runtimeCommand: string): void {
  if (runtimeCommand !== TARGET_RUNTIME.value) {
    throw new Error(`implementMenuSoundEvents requires ${TARGET_RUNTIME.value}`);
  }
}

function snapshotMenuState(menuState: MenuState): MenuSoundSnapshot {
  return {
    active: menuState.active,
    currentMenu: menuState.currentMenu,
    itemOn: menuState.itemOn,
    messageActive: menuState.messageActive,
  };
}

function isNegativeConfirmKey(key: number): boolean {
  if (key === KEY_ESCAPE) return true;
  return String.fromCharCode(key).toLowerCase() === 'n';
}

function classifyMenuSoundEvent(key: number, menuAction: MenuAction, menuStateBefore: MenuSoundSnapshot, menuStateAfter: MenuSoundSnapshot): MenuSoundEvent {
  if (menuAction.kind !== 'none') {
    switch (menuAction.kind) {
      case 'adjustMusicVolume':
      case 'adjustScreenSize':
      case 'adjustSensitivity':
      case 'adjustSfxVolume':
      case 'toggleDetail':
      case 'toggleMessages':
        return MENU_SOUND_EVENT_ADJUST;
      case 'cancelSaveStringEntry':
      case 'closeMenu':
        return MENU_SOUND_EVENT_BACK;
      case 'openMenu':
        if (menuStateBefore.active && key === KEY_ESCAPE) {
          return MENU_SOUND_EVENT_BACK;
        }
        return MENU_SOUND_EVENT_ACTIVATE;
      case 'beginSaveStringEntry':
      case 'commitSaveStringEntry':
      case 'endGame':
      case 'openMessage':
      case 'quitGame':
      case 'readThisAdvance':
      case 'selectEpisode':
      case 'selectLoadSlot':
      case 'selectSaveSlot':
      case 'selectSkill':
        return MENU_SOUND_EVENT_ACTIVATE;
    }
  }

  if (menuStateBefore.itemOn !== menuStateAfter.itemOn || menuStateBefore.currentMenu !== menuStateAfter.currentMenu) {
    return MENU_SOUND_EVENT_CURSOR_MOVE;
  }

  if (menuStateBefore.messageActive && !menuStateAfter.messageActive && isNegativeConfirmKey(key)) {
    return MENU_SOUND_EVENT_BACK;
  }

  return MENU_SOUND_EVENT_NONE;
}

/**
 * Route one menu-layer key through `menus.ts`, classify the resulting stable
 * sound event, and keep the front-end attract-loop menu-active bit in sync.
 *
 * @param runtimeCommand Exact runtime command. Must be `bun run doom.ts`.
 * @param frontEndSequenceState Mutable front-end sequence state to keep menu activity synchronized.
 * @param menuState Mutable menu state that consumes the incoming key.
 * @param key Keyboard code forwarded to `handleMenuKey`.
 * @returns The routed menu action plus the stable sound-event category for that transition.
 * @example
 * ```ts
 * import { createFrontEndSequence } from '../../ui/frontEndSequence.ts';
 * import { createMenuState, KEY_ESCAPE } from '../../ui/menus.ts';
 * import { implementMenuSoundEvents } from './implementMenuSoundEvents.ts';
 *
 * const frontEndSequenceState = createFrontEndSequence('shareware');
 * const menuState = createMenuState();
 * const result = implementMenuSoundEvents('bun run doom.ts', frontEndSequenceState, menuState, KEY_ESCAPE);
 *
 * console.log(result.soundEvent.kind); // "activate"
 * ```
 */
export function implementMenuSoundEvents(runtimeCommand: string, frontEndSequenceState: FrontEndSequenceState, menuState: MenuState, key: number): ImplementMenuSoundEventsResult {
  assertRuntimeCommand(runtimeCommand);

  const menuStateBefore = snapshotMenuState(menuState);
  const menuAction = handleMenuKey(menuState, key);
  const menuStateAfter = snapshotMenuState(menuState);

  setMenuActive(frontEndSequenceState, menuState.active);

  return {
    menuAction,
    soundEvent: classifyMenuSoundEvent(key, menuAction, menuStateBefore, menuStateAfter),
  };
}
