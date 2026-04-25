import type { FrontEndSequenceState } from '../../ui/frontEndSequence.ts';
import type { MenuState } from '../../ui/menus.ts';

import { setMenuActive } from '../../ui/frontEndSequence.ts';
import { LINEHEIGHT, MENU_TREE, MenuItemStatus } from '../../ui/menus.ts';

export const RENDER_MENU_TEXT_RUNTIME_CONTRACT = Object.freeze({
  audit: Object.freeze({
    schemaVersion: 1,
    stepId: '07-018',
    title: 'render-menu-text',
  }),
  command: Object.freeze({
    entryFile: 'doom.ts',
    program: 'bun',
    subcommand: 'run',
    value: 'bun run doom.ts',
  }),
  sourceAudit: Object.freeze({
    launchMode: 'gameplay-first',
    manifestPath: 'plan_fps/manifests/01-008-audit-missing-launch-to-menu.json',
    schemaVersion: 1,
    stepId: '01-008',
    title: 'audit-missing-launch-to-menu',
  }),
});

export interface RenderMenuTextEntry {
  readonly index: number;
  readonly isSelected: boolean;
  readonly lumpName: string;
  readonly status: MenuItemStatus;
  readonly x: number;
  readonly y: number;
}

export interface RenderMenuTextRequest {
  readonly frontEndSequenceState: FrontEndSequenceState;
  readonly menuState: MenuState;
  readonly runtimeCommand: string;
}

export interface RenderMenuTextResult {
  readonly currentMenu: MenuState['currentMenu'];
  readonly entries: readonly RenderMenuTextEntry[];
  readonly inDemoPlayback: boolean;
  readonly menuActive: boolean;
}

/**
 * Return the current menu's patch-text draw list for the Bun playable path.
 *
 * @param request Bun runtime command plus the live front-end/menu state to render.
 * @returns Render-ready menu text entries derived directly from `menus.ts`.
 * @example
 * ```ts
 * import { createFrontEndSequence } from '../../ui/frontEndSequence.ts';
 * import { createMenuState, MenuKind, openMenu } from '../../ui/menus.ts';
 * import { renderMenuText } from './renderMenuText.ts';
 *
 * const frontEndSequenceState = createFrontEndSequence('shareware');
 * const menuState = createMenuState();
 * openMenu(menuState, MenuKind.Main);
 *
 * console.log(
 *   renderMenuText({
 *     frontEndSequenceState,
 *     menuState,
 *     runtimeCommand: 'bun run doom.ts',
 *   }).entries[0]?.lumpName,
 * );
 * // M_NGAME
 * ```
 */
export function renderMenuText(request: RenderMenuTextRequest): RenderMenuTextResult {
  if (request.runtimeCommand !== RENDER_MENU_TEXT_RUNTIME_CONTRACT.command.value) {
    throw new Error('renderMenuText requires `bun run doom.ts`.');
  }

  setMenuActive(request.frontEndSequenceState, request.menuState.active);

  if (!request.menuState.active) {
    throw new Error('renderMenuText requires an active menu.');
  }

  const menuDefinition = MENU_TREE[request.menuState.currentMenu];
  const entries: RenderMenuTextEntry[] = [];

  for (let index = 0; index < menuDefinition.items.length; index++) {
    const item = menuDefinition.items[index]!;

    if (item.lump.length === 0) {
      continue;
    }

    entries.push(
      Object.freeze({
        index,
        isSelected: request.menuState.itemOn === index,
        lumpName: item.lump,
        status: item.status,
        x: menuDefinition.x,
        y: menuDefinition.y + index * LINEHEIGHT,
      }),
    );
  }

  return Object.freeze({
    currentMenu: request.menuState.currentMenu,
    entries: Object.freeze(entries),
    inDemoPlayback: request.frontEndSequenceState.inDemoPlayback,
    menuActive: request.frontEndSequenceState.menuActive,
  });
}
