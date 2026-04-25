import { KEY_F11 } from '../../input/keyboard.ts';
import { setMenuActive } from '../../ui/frontEndSequence.ts';
import { KEY_LEFTARROW, KEY_RIGHTARROW, MenuKind, handleMenuKey } from '../../ui/menus.ts';

import type { FrontEndSequenceState } from '../../ui/frontEndSequence.ts';
import type { MenuAction, MenuState } from '../../ui/menus.ts';

export type DetailMode = 'high' | 'low';

export interface GammaAdjustmentAction {
  readonly kind: 'adjustGamma';
  readonly nextGammaLevel: number;
  readonly previousGammaLevel: number;
}

export interface ImplementScreenSizeDetailGammaControlsOptions {
  readonly detailMode: DetailMode;
  readonly frontEndSequence: FrontEndSequenceState;
  readonly gammaLevel: number;
  readonly key: number;
  readonly menu: MenuState;
  readonly runtimeCommand: string;
  readonly screenSize: number;
}

export interface ImplementScreenSizeDetailGammaControlsResult {
  readonly action: GammaAdjustmentAction | MenuAction;
  readonly detailMode: DetailMode;
  readonly gammaLevel: number;
  readonly screenSize: number;
}

export const IMPLEMENT_SCREEN_SIZE_DETAIL_GAMMA_CONTROLS_CONTRACT = Object.freeze({
  auditManifestPath: 'plan_fps/manifests/01-008-audit-missing-launch-to-menu.json',
  currentMenu: MenuKind.Options,
  detailItemIndex: 2,
  functionName: 'implementScreenSizeDetailGammaControls',
  gammaHotkey: 'KEY_F11',
  gammaRange: Object.freeze({
    maximum: 4,
    minimum: 0,
    wraps: true,
  }),
  runtimeCommand: 'bun run doom.ts',
  screenSizeItemIndex: 3,
  screenSizeRange: Object.freeze({
    maximum: 8,
    minimum: 0,
  }),
  supportedMenuActionKinds: Object.freeze(['adjustScreenSize', 'toggleDetail'] as const),
});

/**
 * Apply the playable front-end control surface for the Options-menu
 * screen-size slider, detail toggle, and F11 gamma cycling.
 *
 * @param options Current runtime/menu/control state.
 * @returns The next control values plus the emitted menu or gamma action.
 * @example
 * ```ts
 * import { createFrontEndSequence } from "../../ui/frontEndSequence.ts";
 * import { KEY_RIGHTARROW, MenuKind, createMenuState, openMenu } from "../../ui/menus.ts";
 * import { implementScreenSizeDetailGammaControls } from "./implementScreenSizeDetailGammaControls.ts";
 *
 * const frontEndSequence = createFrontEndSequence("shareware");
 * const menu = createMenuState();
 * openMenu(menu, MenuKind.Options);
 * menu.itemOn = 3;
 *
 * const result = implementScreenSizeDetailGammaControls({
 *   detailMode: "high",
 *   frontEndSequence,
 *   gammaLevel: 0,
 *   key: KEY_RIGHTARROW,
 *   menu,
 *   runtimeCommand: "bun run doom.ts",
 *   screenSize: 5,
 * });
 *
 * console.log(result.screenSize); // 6
 * ```
 */
export function implementScreenSizeDetailGammaControls(options: ImplementScreenSizeDetailGammaControlsOptions): ImplementScreenSizeDetailGammaControlsResult {
  if (options.runtimeCommand !== IMPLEMENT_SCREEN_SIZE_DETAIL_GAMMA_CONTROLS_CONTRACT.runtimeCommand) {
    throw new Error('implementScreenSizeDetailGammaControls requires "bun run doom.ts".');
  }

  if (!options.menu.active || options.menu.currentMenu !== IMPLEMENT_SCREEN_SIZE_DETAIL_GAMMA_CONTROLS_CONTRACT.currentMenu) {
    throw new Error('implementScreenSizeDetailGammaControls requires the active Options menu.');
  }

  if (options.gammaLevel < IMPLEMENT_SCREEN_SIZE_DETAIL_GAMMA_CONTROLS_CONTRACT.gammaRange.minimum || options.gammaLevel > IMPLEMENT_SCREEN_SIZE_DETAIL_GAMMA_CONTROLS_CONTRACT.gammaRange.maximum) {
    throw new Error('Gamma level must stay within 0..4.');
  }

  if (options.screenSize < IMPLEMENT_SCREEN_SIZE_DETAIL_GAMMA_CONTROLS_CONTRACT.screenSizeRange.minimum || options.screenSize > IMPLEMENT_SCREEN_SIZE_DETAIL_GAMMA_CONTROLS_CONTRACT.screenSizeRange.maximum) {
    throw new Error('Screen size must stay within 0..8.');
  }

  setMenuActive(options.frontEndSequence, options.menu.active);

  if (options.key === KEY_F11) {
    const nextGammaLevel = options.gammaLevel >= IMPLEMENT_SCREEN_SIZE_DETAIL_GAMMA_CONTROLS_CONTRACT.gammaRange.maximum ? IMPLEMENT_SCREEN_SIZE_DETAIL_GAMMA_CONTROLS_CONTRACT.gammaRange.minimum : options.gammaLevel + 1;

    return {
      action: Object.freeze({
        kind: 'adjustGamma',
        nextGammaLevel,
        previousGammaLevel: options.gammaLevel,
      }),
      detailMode: options.detailMode,
      gammaLevel: nextGammaLevel,
      screenSize: options.screenSize,
    };
  }

  const itemOnBeforeKey = options.menu.itemOn;
  const menuAction = handleMenuKey(options.menu, options.key);

  setMenuActive(options.frontEndSequence, options.menu.active);

  if (
    itemOnBeforeKey === IMPLEMENT_SCREEN_SIZE_DETAIL_GAMMA_CONTROLS_CONTRACT.detailItemIndex &&
    menuAction.kind === 'none' &&
    options.menu.itemOn === IMPLEMENT_SCREEN_SIZE_DETAIL_GAMMA_CONTROLS_CONTRACT.detailItemIndex &&
    (options.key === KEY_LEFTARROW || options.key === KEY_RIGHTARROW)
  ) {
    // menus.ts keeps detail as a pure menu action; the playable surface applies the
    // vanilla-style arrow toggle here without broadening the shared menu state machine.
    return {
      action: Object.freeze({ kind: 'toggleDetail' }),
      detailMode: options.detailMode === 'high' ? 'low' : 'high',
      gammaLevel: options.gammaLevel,
      screenSize: options.screenSize,
    };
  }

  if (menuAction.kind === 'adjustScreenSize') {
    let screenSize = options.screenSize + menuAction.direction;
    if (screenSize < IMPLEMENT_SCREEN_SIZE_DETAIL_GAMMA_CONTROLS_CONTRACT.screenSizeRange.minimum) {
      screenSize = IMPLEMENT_SCREEN_SIZE_DETAIL_GAMMA_CONTROLS_CONTRACT.screenSizeRange.minimum;
    }
    if (screenSize > IMPLEMENT_SCREEN_SIZE_DETAIL_GAMMA_CONTROLS_CONTRACT.screenSizeRange.maximum) {
      screenSize = IMPLEMENT_SCREEN_SIZE_DETAIL_GAMMA_CONTROLS_CONTRACT.screenSizeRange.maximum;
    }

    return {
      action: menuAction,
      detailMode: options.detailMode,
      gammaLevel: options.gammaLevel,
      screenSize,
    };
  }

  if (menuAction.kind === 'toggleDetail') {
    return {
      action: menuAction,
      detailMode: options.detailMode === 'high' ? 'low' : 'high',
      gammaLevel: options.gammaLevel,
      screenSize: options.screenSize,
    };
  }

  if (menuAction.kind === 'toggleMessages') {
    throw new Error('Messages toggle is not implemented by implementScreenSizeDetailGammaControls.');
  }

  if (menuAction.kind === 'adjustSensitivity' || menuAction.kind === 'endGame' || menuAction.kind === 'openMenu' || menuAction.kind === 'openMessage') {
    throw new Error(`Unsupported options action: ${menuAction.kind}.`);
  }

  return {
    action: menuAction,
    detailMode: options.detailMode,
    gammaLevel: options.gammaLevel,
    screenSize: options.screenSize,
  };
}
