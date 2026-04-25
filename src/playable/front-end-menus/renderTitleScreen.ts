import type { GameMode } from '../../bootstrap/gameMode.ts';
import type { ShowPageTickAction } from '../../ui/frontEndSequence.ts';
import type { MenuState } from '../../ui/menus.ts';

import { createFrontEndSequence, setMenuActive, tickFrontEnd } from '../../ui/frontEndSequence.ts';
import { createMenuState } from '../../ui/menus.ts';

export const RENDER_TITLE_SCREEN_CONTRACT = Object.freeze({
  auditStepId: '01-008',
  auditSurface: 'launch-to-menu-transition',
  firstVisibleActionKind: 'showPage',
  firstVisibleLumpName: 'TITLEPIC',
  requiredRuntimeCommand: 'bun run doom.ts',
  transition: 'clean-launch-to-title-screen',
});

export interface RenderTitleScreenOptions {
  readonly gameMode: GameMode;
  readonly runtimeCommand: string;
}

export interface RenderTitleScreenResult {
  readonly contract: typeof RENDER_TITLE_SCREEN_CONTRACT;
  readonly frontEnd: Readonly<{
    readonly gameMode: GameMode;
    readonly inDemoPlayback: boolean;
    readonly menuActive: boolean;
  }>;
  readonly menu: Readonly<{
    readonly active: boolean;
    readonly currentMenu: MenuState['currentMenu'];
    readonly itemOn: number;
    readonly skullAnimCounter: number;
    readonly whichSkull: 0 | 1;
  }>;
  readonly titlePage: Readonly<ShowPageTickAction>;
  readonly transition: typeof RENDER_TITLE_SCREEN_CONTRACT.transition;
}

function createMenuSnapshot(menuState: MenuState): RenderTitleScreenResult['menu'] {
  return Object.freeze({
    active: menuState.active,
    currentMenu: menuState.currentMenu,
    itemOn: menuState.itemOn,
    skullAnimCounter: menuState.skullAnimCounter,
    whichSkull: menuState.whichSkull,
  });
}

function createTitlePageSnapshot(action: ShowPageTickAction): RenderTitleScreenResult['titlePage'] {
  return Object.freeze({
    kind: action.kind,
    lumpName: action.lumpName,
    musicLump: action.musicLump,
    pagetic: action.pagetic,
  });
}

/**
 * Build the first visible title-screen render snapshot for the Bun playable path.
 *
 * @param options Runtime command and game mode for the clean-launch snapshot.
 * @returns A deterministic clean-launch title-screen snapshot with the inactive menu state.
 * @example
 * ```ts
 * import { renderTitleScreen } from './src/playable/front-end-menus/renderTitleScreen.ts';
 *
 * const snapshot = renderTitleScreen({ gameMode: 'shareware', runtimeCommand: 'bun run doom.ts' });
 * console.log(snapshot.titlePage.lumpName);
 * ```
 */
export function renderTitleScreen(options: RenderTitleScreenOptions): RenderTitleScreenResult {
  if (options.runtimeCommand !== RENDER_TITLE_SCREEN_CONTRACT.requiredRuntimeCommand) {
    throw new Error(`renderTitleScreen requires ${RENDER_TITLE_SCREEN_CONTRACT.requiredRuntimeCommand}`);
  }

  const menuState = createMenuState();
  if (menuState.active) {
    throw new Error('renderTitleScreen requires an inactive menu at clean launch');
  }

  const frontEndState = createFrontEndSequence(options.gameMode);
  setMenuActive(frontEndState, menuState.active);

  const action = tickFrontEnd(frontEndState);
  if (action.kind !== RENDER_TITLE_SCREEN_CONTRACT.firstVisibleActionKind || action.lumpName !== RENDER_TITLE_SCREEN_CONTRACT.firstVisibleLumpName) {
    throw new Error(`renderTitleScreen expected ${RENDER_TITLE_SCREEN_CONTRACT.firstVisibleLumpName} on the first front-end tick`);
  }

  return Object.freeze({
    contract: RENDER_TITLE_SCREEN_CONTRACT,
    frontEnd: Object.freeze({
      gameMode: options.gameMode,
      inDemoPlayback: frontEndState.inDemoPlayback,
      menuActive: frontEndState.menuActive,
    }),
    menu: createMenuSnapshot(menuState),
    titlePage: createTitlePageSnapshot(action),
    transition: RENDER_TITLE_SCREEN_CONTRACT.transition,
  });
}
