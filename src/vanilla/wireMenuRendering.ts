/**
 * Vanilla DOOM 1.9 menu-rendering runtime facade.
 *
 * Plan_final step `07-002` (lane: ui) aggregates the menu state
 * machine + key/tick handlers + the HU-font lump-name resolver the
 * menu-overlay composition pass drives into one cohesive re-export
 * barrel.  The read-only `src/ui/menus.ts` and `src/ui/assets.ts`
 * modules already implement vanilla `m_menu.c` `M_Drawer` /
 * `M_Responder` / `M_Ticker` and the `hu_stuff.c` STCFN font lump
 * naming, and are SHA-pinned by the `plan_vanilla_parity` UI
 * inventory; this module does NOT modify them.
 *
 * Wired entry points and their Chocolate Doom 2.2.1 origins:
 *
 *   - `createMenuState`            — `m_menu.c` `M_Init`.
 *   - `openMenu` / `closeMenu`     — `M_StartControlPanel` /
 *     `M_ClearMenus`.
 *   - `openMessage`                — `M_StartMessage` (yes/no +
 *     informational message overlay).
 *   - `tickMenu`                   — `M_Ticker` (skull cursor
 *     blink + message timeout).
 *   - `handleMenuKey`              — `M_Responder` key dispatch.
 *   - `canAcceptMouseInput` / `canAcceptJoyInput` /
 *     `markMouseInputConsumed` / `markJoyInputConsumed` — the
 *     mouse/joy repeat-delay gating.
 *   - `huFontLumpName`             — the `STCFN%.3d` HU-font patch
 *     lump-name resolver used to draw menu text.
 *
 * @example
 * ```ts
 * import { createMenuState, LINEHEIGHT, VANILLA_MENU_RENDERING_ENTRY_POINTS } from './wireMenuRendering.ts';
 * LINEHEIGHT;                                  // 16
 * VANILLA_MENU_RENDERING_ENTRY_POINTS.length;  // 7
 * ```
 */

export {
  HU_FONTEND,
  HU_FONTSTART,
  LINEHEIGHT,
  MAX_LOAD_SAVE_SLOTS,
  SAVESTRINGSIZE,
  SKULLXOFF,
  SKULL_ANIM_TIME,
  canAcceptJoyInput,
  canAcceptMouseInput,
  closeMenu,
  createMenuState,
  handleMenuKey,
  markJoyInputConsumed,
  markMouseInputConsumed,
  openMenu,
  openMessage,
  tickMenu,
} from '../ui/menus.ts';
export { huFontLumpName, statusBarFaceLumpName } from '../ui/assets.ts';

/**
 * Frozen manifest of the seven canonical menu-rendering entry-point
 * names this facade wires, in the order the menu-overlay pass
 * invokes them (create state, open the panel, per-tic skull-blink,
 * dispatch a key, open a message overlay, close on confirm; the
 * font resolver supplies the text glyphs the drawer composes).
 */
export const VANILLA_MENU_RENDERING_ENTRY_POINTS: readonly string[] = Object.freeze(['closeMenu', 'createMenuState', 'handleMenuKey', 'huFontLumpName', 'openMenu', 'openMessage', 'tickMenu']);
