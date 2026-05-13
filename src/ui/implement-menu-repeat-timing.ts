/**
 * Vanilla DOOM 1.9 menu joystick/mouse repeat-timing contract.
 *
 * From Chocolate Doom 2.2.1 m_menu.c M_Responder:
 *
 *   if (ev->type == ev_joystick && joywait < I_GetTime())
 *   {
 *       if (ev->data3 == -1)
 *       {
 *           key = key_menu_up;
 *           joywait = I_GetTime() + 5;
 *       }
 *       else if (ev->data3 == 1)
 *       {
 *           key = key_menu_down;
 *           joywait = I_GetTime() + 5;
 *       }
 *       // ... left/right
 *       if (ev->data1 & 1)
 *       {
 *           key = key_menu_forward;
 *           joywait = I_GetTime() + 5;
 *       }
 *       if (ev->data1 & 2)
 *       {
 *           key = key_menu_back;
 *           joywait = I_GetTime() + 5;
 *       }
 *   }
 *   else if (ev->type == ev_mouse && mousewait < I_GetTime())
 *   {
 *       mousey += ev->data3;
 *       if (mousey < lasty - 30)
 *       {
 *           key = key_menu_down;
 *           mousewait = I_GetTime() + 5;
 *           lasty -= 30;
 *           mousey = lasty;
 *       }
 *       // ...
 *   }
 *
 * Notes for parity:
 *   - Joystick and mouse menu inputs use a 5-tic wait gate (joywait/mousewait).
 *     Until I_GetTime() exceeds the wait, the input is ignored.
 *   - Mouse vertical menu navigation uses a 30-pixel threshold (lasty - 30 / lasty + 30)
 *     to convert deltas into discrete up/down events.
 *   - Keyboard input does NOT use this gate; it relies on the underlying keyboard
 *     auto-repeat from the OS/input layer.
 *   - The wait of 5 tics is universal across all menu directions and all menu states.
 *   - TICRATE is 35, so 5 tics = ~143ms (~7 Hz repeat rate).
 */

export const VANILLA_MENU_JOYWAIT_TICS = 5;
export const VANILLA_MENU_MOUSEWAIT_TICS = 5;
export const VANILLA_MENU_MOUSE_VERTICAL_THRESHOLD_PIXELS = 30;

export interface MenuRepeatGateInput {
  readonly currentTime: number;
  readonly waitUntil: number;
}

export function vanillaMenuInputIsGated(input: MenuRepeatGateInput): boolean {
  return input.waitUntil >= input.currentTime;
}

export function computeVanillaMenuWaitUntil(currentTime: number): number {
  return currentTime + VANILLA_MENU_JOYWAIT_TICS;
}

export interface MouseVerticalAccumulatorInput {
  readonly mouseY: number;
  readonly lastY: number;
}

export type VanillaMouseVerticalDirection = 'up' | 'down' | 'none';

export interface MouseVerticalResult {
  readonly direction: VanillaMouseVerticalDirection;
  readonly nextLastY: number;
}

export function classifyVanillaMouseVerticalDelta(input: MouseVerticalAccumulatorInput): MouseVerticalResult {
  if (input.mouseY < input.lastY - VANILLA_MENU_MOUSE_VERTICAL_THRESHOLD_PIXELS) {
    return Object.freeze({ direction: 'down', nextLastY: input.lastY - VANILLA_MENU_MOUSE_VERTICAL_THRESHOLD_PIXELS });
  }
  if (input.mouseY > input.lastY + VANILLA_MENU_MOUSE_VERTICAL_THRESHOLD_PIXELS) {
    return Object.freeze({ direction: 'up', nextLastY: input.lastY + VANILLA_MENU_MOUSE_VERTICAL_THRESHOLD_PIXELS });
  }
  return Object.freeze({ direction: 'none', nextLastY: input.lastY });
}
