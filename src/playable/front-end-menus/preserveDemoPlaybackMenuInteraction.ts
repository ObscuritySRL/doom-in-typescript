import type { FrontEndKeyAction, FrontEndSequenceState } from '../../ui/frontEndSequence.ts';
import { FRONTEND_KEY_NONE, handleFrontEndKey, setMenuActive } from '../../ui/frontEndSequence.ts';
import type { MenuAction, MenuState } from '../../ui/menus.ts';
import { MENU_ACTION_NONE, MenuKind, handleMenuKey, openMenu } from '../../ui/menus.ts';

export const PRESERVE_DEMO_PLAYBACK_MENU_INTERACTION_CONTRACT = Object.freeze({
  auditManifestPath: 'plan_fps/manifests/01-008-audit-missing-launch-to-menu.json',
  auditSurface: 'menu-render-controller',
  command: 'bun run doom.ts',
  deterministicReplaySafe: true,
  runtime: Object.freeze({
    entryFile: 'doom.ts',
    program: 'bun',
    subcommand: 'run',
  }),
  stepId: '07-003',
  title: 'preserve-demo-playback-menu-interaction',
});

export interface PreserveDemoPlaybackMenuInteractionResult {
  readonly frontEndAction: FrontEndKeyAction;
  readonly inDemoPlayback: boolean;
  readonly menuAction: MenuAction;
  readonly menuActive: boolean;
  readonly openedMenu: MenuKind | null;
  readonly route: 'frontEnd' | 'menu';
}

function assertRuntimeCommand(runtimeCommand: string): void {
  if (runtimeCommand !== PRESERVE_DEMO_PLAYBACK_MENU_INTERACTION_CONTRACT.command) {
    throw new Error(`preserveDemoPlaybackMenuInteraction requires ${PRESERVE_DEMO_PLAYBACK_MENU_INTERACTION_CONTRACT.command}, received ${runtimeCommand}`);
  }
}

function getHelpMenuKindFromLump(lump: 'HELP' | 'HELP1' | 'HELP2'): MenuKind {
  if (lump === 'HELP1') {
    return MenuKind.ReadThis2;
  }

  return MenuKind.ReadThis1;
}

export function preserveDemoPlaybackMenuInteraction(runtimeCommand: string, frontEndState: FrontEndSequenceState, menuState: MenuState, key: number): PreserveDemoPlaybackMenuInteractionResult {
  assertRuntimeCommand(runtimeCommand);

  let frontEndAction: FrontEndKeyAction = FRONTEND_KEY_NONE;
  let menuAction: MenuAction = MENU_ACTION_NONE;
  let openedMenu: MenuKind | null = null;
  let route: 'frontEnd' | 'menu' = 'frontEnd';

  setMenuActive(frontEndState, menuState.active);

  if (menuState.active) {
    route = 'menu';
    menuAction = handleMenuKey(menuState, key);

    if (menuAction.kind === 'openMenu') {
      openedMenu = menuAction.target;
    }
  } else {
    frontEndAction = handleFrontEndKey(frontEndState, key);

    if (frontEndAction.kind === 'openHelp') {
      openedMenu = getHelpMenuKindFromLump(frontEndAction.lump);
      openMenu(menuState, openedMenu);
    }

    if (frontEndAction.kind === 'openMenu') {
      openedMenu = MenuKind.Main;
      openMenu(menuState, openedMenu);
    }
  }

  setMenuActive(frontEndState, menuState.active);

  return Object.freeze({
    frontEndAction,
    inDemoPlayback: frontEndState.inDemoPlayback,
    menuAction,
    menuActive: menuState.active,
    openedMenu,
    route,
  });
}
