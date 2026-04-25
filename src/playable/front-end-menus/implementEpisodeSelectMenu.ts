import { setMenuActive } from '../../ui/frontEndSequence.ts';
import { KEY_ENTER, MenuKind, handleMenuKey, openMenu } from '../../ui/menus.ts';

import type { FrontEndSequenceState } from '../../ui/frontEndSequence.ts';
import type { MenuAction, MenuState } from '../../ui/menus.ts';

type SelectEpisodeAction = Extract<MenuAction, { readonly kind: 'selectEpisode' }>;

export const IMPLEMENT_EPISODE_SELECT_MENU_RUNTIME_COMMAND = 'bun run doom.ts' as const;

export const IMPLEMENT_EPISODE_SELECT_MENU_CONTRACT = Object.freeze({
  auditManifestPath: 'plan_fps/manifests/01-008-audit-missing-launch-to-menu.json',
  expectedCurrentMenu: MenuKind.Episode,
  nextMenu: MenuKind.Skill,
  runtimeCommand: IMPLEMENT_EPISODE_SELECT_MENU_RUNTIME_COMMAND,
  stepId: '07-006',
  triggerKeyCode: KEY_ENTER,
} as const);

export interface ImplementEpisodeSelectMenuOptions {
  readonly command: string;
  readonly frontEndSequence: FrontEndSequenceState;
  readonly menu: MenuState;
}

export interface ImplementEpisodeSelectMenuResult {
  readonly demoPlaybackWasActive: boolean;
  readonly frontEndMenuActive: boolean;
  readonly menuAction: SelectEpisodeAction;
  readonly nextMenu: MenuKind.Skill;
  readonly selectedEpisode: number;
}

function assertRuntimeCommand(command: string): void {
  if (command !== IMPLEMENT_EPISODE_SELECT_MENU_RUNTIME_COMMAND) {
    throw new Error(`implementEpisodeSelectMenu requires bun run doom.ts; received ${command}`);
  }
}

function assertEpisodeMenuState(menu: MenuState): void {
  if (!menu.active) {
    throw new Error('implementEpisodeSelectMenu requires an active menu.');
  }

  if (menu.currentMenu !== MenuKind.Episode) {
    throw new Error(`implementEpisodeSelectMenu requires the episode menu; received ${menu.currentMenu}`);
  }
}

export function implementEpisodeSelectMenu(options: ImplementEpisodeSelectMenuOptions): ImplementEpisodeSelectMenuResult {
  assertRuntimeCommand(options.command);
  assertEpisodeMenuState(options.menu);

  const menuAction = handleMenuKey(options.menu, KEY_ENTER);
  if (menuAction.kind !== 'selectEpisode') {
    throw new Error(`implementEpisodeSelectMenu requires an episode selection; received ${menuAction.kind}`);
  }

  const demoPlaybackWasActive = options.frontEndSequence.inDemoPlayback;

  openMenu(options.menu, MenuKind.Skill);
  setMenuActive(options.frontEndSequence, options.menu.active);

  return Object.freeze({
    demoPlaybackWasActive,
    frontEndMenuActive: options.frontEndSequence.menuActive,
    menuAction,
    nextMenu: MenuKind.Skill,
    selectedEpisode: menuAction.episode,
  });
}
