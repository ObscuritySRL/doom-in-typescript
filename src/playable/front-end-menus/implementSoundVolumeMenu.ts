import type { FrontEndSequenceState } from '../../ui/frontEndSequence.ts';
import type { MenuAction, MenuState } from '../../ui/menus.ts';

import { setMenuActive } from '../../ui/frontEndSequence.ts';
import { handleMenuKey, KEY_ENTER, MENU_TREE, MenuKind } from '../../ui/menus.ts';

const TARGET_RUNTIME_COMMAND = 'bun run doom.ts';
const OPTIONS_SOUND_VOLUME_ITEM_INDEX = 7;
const OPTIONS_SOUND_VOLUME_ITEM_LUMP = 'M_SVOL';
const SOUND_VOLUME_FIRST_ITEM_INDEX = 0;
const SOUND_VOLUME_FIRST_ITEM_LUMP = 'M_SFXVOL';
const SOUND_VOLUME_SECOND_ITEM_INDEX = 2;
const SOUND_VOLUME_SECOND_ITEM_LUMP = 'M_MUSVOL';

export const IMPLEMENT_SOUND_VOLUME_MENU_RUNTIME_CONTRACT = Object.freeze({
  auditManifestPath: 'plan_fps/manifests/01-008-audit-missing-launch-to-menu.json',
  expectedCommand: TARGET_RUNTIME_COMMAND,
  optionsMenu: Object.freeze({
    kind: MenuKind.Options,
    selectedItemIndex: OPTIONS_SOUND_VOLUME_ITEM_INDEX,
    selectedItemLump: OPTIONS_SOUND_VOLUME_ITEM_LUMP,
  }),
  soundVolumeMenu: Object.freeze({
    firstSelectableItemIndex: SOUND_VOLUME_FIRST_ITEM_INDEX,
    firstSelectableItemLump: SOUND_VOLUME_FIRST_ITEM_LUMP,
    kind: MenuKind.SoundVolume,
    secondSelectableItemIndex: SOUND_VOLUME_SECOND_ITEM_INDEX,
    secondSelectableItemLump: SOUND_VOLUME_SECOND_ITEM_LUMP,
  }),
  transitionKey: KEY_ENTER,
} as const);

export interface ImplementSoundVolumeMenuOptions {
  readonly command: string;
  readonly frontEndSequence: FrontEndSequenceState;
  readonly menu: MenuState;
}

export interface ImplementSoundVolumeMenuResult {
  readonly action: MenuAction;
  readonly currentMenu: MenuKind.SoundVolume;
  readonly inDemoPlayback: boolean;
  readonly itemOn: number;
  readonly menuActive: boolean;
  readonly selectedItemLump: typeof SOUND_VOLUME_FIRST_ITEM_LUMP;
}

/**
 * Route the active Options-menu Sound Volume selection into the vanilla
 * SoundVolume submenu through the playable Bun runtime path.
 *
 * @param options Live runtime command plus the shared front-end and menu state.
 * @returns The exact menu transition result after Sound Volume opens.
 * @example
 * ```ts
 * import { createFrontEndSequence } from '../../ui/frontEndSequence.ts';
 * import { createMenuState, MenuKind, openMenu } from '../../ui/menus.ts';
 * import { implementSoundVolumeMenu } from './implementSoundVolumeMenu.ts';
 *
 * const frontEndSequence = createFrontEndSequence('shareware');
 * const menu = createMenuState();
 * openMenu(menu, MenuKind.Options);
 * menu.itemOn = 7;
 *
 * const result = implementSoundVolumeMenu({
 *   command: 'bun run doom.ts',
 *   frontEndSequence,
 *   menu,
 * });
 *
 * console.log(result.currentMenu); // "soundVolume"
 * ```
 */
export function implementSoundVolumeMenu(options: ImplementSoundVolumeMenuOptions): ImplementSoundVolumeMenuResult {
  if (options.command !== TARGET_RUNTIME_COMMAND) {
    throw new Error(`implementSoundVolumeMenu requires "${TARGET_RUNTIME_COMMAND}".`);
  }

  if (!options.menu.active || options.menu.currentMenu !== MenuKind.Options) {
    throw new Error('implementSoundVolumeMenu requires the active Options menu.');
  }

  const selectedItem = MENU_TREE[MenuKind.Options].items[options.menu.itemOn];
  if (selectedItem === undefined || selectedItem.lump !== OPTIONS_SOUND_VOLUME_ITEM_LUMP || selectedItem.onEnter.kind !== 'openMenu' || selectedItem.onEnter.target !== MenuKind.SoundVolume) {
    throw new Error('implementSoundVolumeMenu requires the Sound Volume option to be selected.');
  }

  setMenuActive(options.frontEndSequence, options.menu.active);

  const action = handleMenuKey(options.menu, KEY_ENTER);
  if (action.kind !== 'openMenu' || action.target !== MenuKind.SoundVolume) {
    throw new Error('implementSoundVolumeMenu failed to open the Sound Volume menu.');
  }

  setMenuActive(options.frontEndSequence, options.menu.active);

  if (options.menu.itemOn !== SOUND_VOLUME_FIRST_ITEM_INDEX) {
    throw new Error('implementSoundVolumeMenu failed to activate the Sound Volume menu state.');
  }

  const selectedSoundItem = MENU_TREE[MenuKind.SoundVolume].items[options.menu.itemOn];
  if (selectedSoundItem === undefined || selectedSoundItem.lump !== SOUND_VOLUME_FIRST_ITEM_LUMP) {
    throw new Error('implementSoundVolumeMenu failed to focus the SFX volume slider.');
  }

  return Object.freeze({
    action,
    currentMenu: MenuKind.SoundVolume,
    inDemoPlayback: options.frontEndSequence.inDemoPlayback,
    itemOn: options.menu.itemOn,
    menuActive: options.frontEndSequence.menuActive,
    selectedItemLump: SOUND_VOLUME_FIRST_ITEM_LUMP,
  });
}
