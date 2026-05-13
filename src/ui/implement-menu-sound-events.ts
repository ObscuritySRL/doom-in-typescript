/**
 * Vanilla DOOM 1.9 menu sound-event contract.
 *
 * From Chocolate Doom 2.2.1 m_menu.c, sounds played at menu state transitions:
 *
 *   - sfx_pstop:  cursor moved up or down (M_Responder up/down keys).
 *   - sfx_pistol: menu item selected (Enter / mouse click / activate hotkey).
 *   - sfx_swtchn: menu opened (M_StartControlPanel) and submenu entered.
 *   - sfx_swtchx: menu closed (M_ClearMenus, Escape from top-level menu).
 *   - sfx_stnmov: slider value changed (M_SfxVol, M_MusicVol, M_ChangeSensitivity,
 *                 M_SizeDisplay one-step adjustments).
 *   - sfx_oof:    invalid action (M_QuickSave with no slot, M_EndGame in netgame,
 *                 unconfirmable menu input, save during demo, etc.).
 *
 * Notes for parity:
 *   - Each event maps to a single sfxenum_t value at code-time. The exact
 *     numeric ID depends on the sounds.h order (which is part of audio-lane parity);
 *     the upstream identifier (sfx_*) is what's load-bearing here.
 *   - Sound events do not stack — each menu-state transition fires at most one
 *     sound. Nested submenus (e.g. options -> sound volume) fire sfx_swtchn each
 *     time M_StartControlPanel is invoked, not on inner submenu transitions.
 *   - Slider value adjustments fire sfx_stnmov per arrow-key tick; held arrow keys
 *     fire repeatedly at the menu repeat rate (separate from the press itself).
 */

export type VanillaMenuSoundEvent = 'cursor-move' | 'select' | 'menu-open' | 'menu-close' | 'slider-step' | 'invalid';

export type VanillaMenuSfxId = 'sfx_pstop' | 'sfx_pistol' | 'sfx_swtchn' | 'sfx_swtchx' | 'sfx_stnmov' | 'sfx_oof';

const EVENT_TO_SFX: { readonly [K in VanillaMenuSoundEvent]: VanillaMenuSfxId } = Object.freeze({
  'cursor-move': 'sfx_pstop',
  select: 'sfx_pistol',
  'menu-open': 'sfx_swtchn',
  'menu-close': 'sfx_swtchx',
  'slider-step': 'sfx_stnmov',
  invalid: 'sfx_oof',
});

export function getVanillaMenuSfx(event: VanillaMenuSoundEvent): VanillaMenuSfxId {
  return EVENT_TO_SFX[event];
}

export function listVanillaMenuSoundEvents(): readonly VanillaMenuSoundEvent[] {
  return Object.freeze(['cursor-move', 'select', 'menu-open', 'menu-close', 'slider-step', 'invalid'] as const);
}
