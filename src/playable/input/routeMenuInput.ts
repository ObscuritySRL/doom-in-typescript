import { KEY_BACKSPACE, KEY_DOWNARROW, KEY_ENTER, KEY_ESCAPE, KEY_LEFTARROW, KEY_RIGHTARROW, KEY_UPARROW } from '../../input/keyboard.ts';
import { EMPTY_TICCMD, TICCMD_SIZE } from '../../input/ticcmd.ts';
import type { TicCommand } from '../../input/ticcmd.ts';

const MENU_INPUT_RUNTIME_COMMAND = 'bun run doom.ts';

export type MenuInputAction = 'activate' | 'back' | 'move-down' | 'move-left' | 'move-right' | 'move-up' | 'open-menu';
export type MenuInputEventType = 'keydown' | 'keyup';
export type MenuInputTransition = 'closed-to-open' | 'open-to-open';

export interface RouteMenuInputRequest {
  readonly doomKey: number;
  readonly eventType: MenuInputEventType;
  readonly menuActive: boolean;
  readonly runtimeCommand: string;
}

export interface RoutedMenuInput {
  readonly action: MenuInputAction;
  readonly consumed: true;
  readonly route: 'menu';
  readonly ticCommand: TicCommand;
  readonly ticCommandSize: number;
  readonly transition: MenuInputTransition;
}

export const ROUTE_MENU_INPUT_CONTRACT = Object.freeze({
  auditManifestPath: 'plan_fps/manifests/01-010-audit-missing-live-input.json',
  auditSurface: 'menu-input-routing',
  ignoredEventType: 'keyup',
  replayCompatibility: 'menu-routing-returns-neutral-ticcmd',
  routeTable: Object.freeze([
    Object.freeze({ action: 'open-menu', doomKey: KEY_ESCAPE, menuActive: false, transition: 'closed-to-open' }),
    Object.freeze({ action: 'back', doomKey: KEY_BACKSPACE, menuActive: true, transition: 'open-to-open' }),
    Object.freeze({ action: 'move-down', doomKey: KEY_DOWNARROW, menuActive: true, transition: 'open-to-open' }),
    Object.freeze({ action: 'activate', doomKey: KEY_ENTER, menuActive: true, transition: 'open-to-open' }),
    Object.freeze({ action: 'back', doomKey: KEY_ESCAPE, menuActive: true, transition: 'open-to-open' }),
    Object.freeze({ action: 'move-left', doomKey: KEY_LEFTARROW, menuActive: true, transition: 'open-to-open' }),
    Object.freeze({ action: 'move-right', doomKey: KEY_RIGHTARROW, menuActive: true, transition: 'open-to-open' }),
    Object.freeze({ action: 'move-up', doomKey: KEY_UPARROW, menuActive: true, transition: 'open-to-open' }),
  ]),
  runtimeCommand: MENU_INPUT_RUNTIME_COMMAND,
  ticCommandSize: TICCMD_SIZE,
} as const);

export function routeMenuInput(request: RouteMenuInputRequest): RoutedMenuInput | null {
  if (request.runtimeCommand !== MENU_INPUT_RUNTIME_COMMAND) {
    throw new Error(`routeMenuInput requires ${MENU_INPUT_RUNTIME_COMMAND}; received ${request.runtimeCommand}`);
  }

  if (request.eventType !== 'keydown' && request.eventType !== 'keyup') {
    throw new Error(`Unsupported menu input event type: ${String(request.eventType)}`);
  }

  if (request.eventType === ROUTE_MENU_INPUT_CONTRACT.ignoredEventType) {
    return null;
  }

  if (!request.menuActive) {
    if (request.doomKey !== KEY_ESCAPE) {
      return null;
    }

    return Object.freeze({
      action: 'open-menu',
      consumed: true,
      route: 'menu',
      ticCommand: EMPTY_TICCMD,
      ticCommandSize: TICCMD_SIZE,
      transition: 'closed-to-open',
    } satisfies RoutedMenuInput);
  }

  switch (request.doomKey) {
    case KEY_BACKSPACE:
      return Object.freeze({
        action: 'back',
        consumed: true,
        route: 'menu',
        ticCommand: EMPTY_TICCMD,
        ticCommandSize: TICCMD_SIZE,
        transition: 'open-to-open',
      } satisfies RoutedMenuInput);
    case KEY_DOWNARROW:
      return Object.freeze({
        action: 'move-down',
        consumed: true,
        route: 'menu',
        ticCommand: EMPTY_TICCMD,
        ticCommandSize: TICCMD_SIZE,
        transition: 'open-to-open',
      } satisfies RoutedMenuInput);
    case KEY_ENTER:
      return Object.freeze({
        action: 'activate',
        consumed: true,
        route: 'menu',
        ticCommand: EMPTY_TICCMD,
        ticCommandSize: TICCMD_SIZE,
        transition: 'open-to-open',
      } satisfies RoutedMenuInput);
    case KEY_ESCAPE:
      return Object.freeze({
        action: 'back',
        consumed: true,
        route: 'menu',
        ticCommand: EMPTY_TICCMD,
        ticCommandSize: TICCMD_SIZE,
        transition: 'open-to-open',
      } satisfies RoutedMenuInput);
    case KEY_LEFTARROW:
      return Object.freeze({
        action: 'move-left',
        consumed: true,
        route: 'menu',
        ticCommand: EMPTY_TICCMD,
        ticCommandSize: TICCMD_SIZE,
        transition: 'open-to-open',
      } satisfies RoutedMenuInput);
    case KEY_RIGHTARROW:
      return Object.freeze({
        action: 'move-right',
        consumed: true,
        route: 'menu',
        ticCommand: EMPTY_TICCMD,
        ticCommandSize: TICCMD_SIZE,
        transition: 'open-to-open',
      } satisfies RoutedMenuInput);
    case KEY_UPARROW:
      return Object.freeze({
        action: 'move-up',
        consumed: true,
        route: 'menu',
        ticCommand: EMPTY_TICCMD,
        ticCommandSize: TICCMD_SIZE,
        transition: 'open-to-open',
      } satisfies RoutedMenuInput);
    default:
      return null;
  }
}
