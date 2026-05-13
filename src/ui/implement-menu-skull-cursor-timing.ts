/**
 * Vanilla DOOM 1.9 menu skull-cursor animation contract.
 *
 * From Chocolate Doom 2.2.1 m_menu.c M_Ticker:
 *
 *   void M_Ticker(void)
 *   {
 *       if (--skullAnimCounter <= 0)
 *       {
 *           whichSkull ^= 1;
 *           skullAnimCounter = 8;
 *       }
 *   }
 *
 *   #define SKULLXOFF -32
 *   #define LINEHEIGHT 16
 *   patch_t* skullName[2];   // "M_SKULL1" and "M_SKULL2"
 *
 *   void M_Init(void)
 *   {
 *       ...
 *       skullAnimCounter = 10;   // start with a slightly longer first phase
 *       whichSkull = 0;
 *       ...
 *   }
 *
 * Notes for parity:
 *   - The skull cursor toggles between M_SKULL1 (whichSkull=0) and M_SKULL2 (whichSkull=1).
 *   - The counter decrements every menu-ticker call; when it reaches 0, whichSkull is XORed
 *     with 1 and the counter is reset to 8.
 *   - The initial value of skullAnimCounter at M_Init is 10 (not 8), so the very first
 *     toggle takes 10 tics instead of 8.
 *   - Steady-state period is 8 tics per toggle, so a full M_SKULL1->M_SKULL2->M_SKULL1
 *     cycle is 16 tics (~0.46 seconds at TICRATE 35).
 *   - SKULLXOFF = -32 (horizontal offset from menu item x).
 *   - LINEHEIGHT = 16 (vertical spacing between menu items / skull line position).
 */

export const VANILLA_SKULL_ANIM_RESET_TICS = 8;
export const VANILLA_SKULL_ANIM_INITIAL_TICS = 10;
export const VANILLA_SKULL_LUMP_M_SKULL1 = 'M_SKULL1';
export const VANILLA_SKULL_LUMP_M_SKULL2 = 'M_SKULL2';
export const VANILLA_SKULLXOFF = -32;
export const VANILLA_LINEHEIGHT = 16;

export interface SkullTickInput {
  readonly skullAnimCounter: number;
  readonly whichSkull: 0 | 1;
}

export interface SkullTickResult {
  readonly skullAnimCounterAfter: number;
  readonly whichSkullAfter: 0 | 1;
  readonly toggled: boolean;
}

export function tickVanillaSkullCursor(input: SkullTickInput): SkullTickResult {
  const decremented = input.skullAnimCounter - 1;
  if (decremented <= 0) {
    const toggled: 0 | 1 = input.whichSkull === 0 ? 1 : 0;
    return Object.freeze({
      skullAnimCounterAfter: VANILLA_SKULL_ANIM_RESET_TICS,
      whichSkullAfter: toggled,
      toggled: true,
    });
  }
  return Object.freeze({
    skullAnimCounterAfter: decremented,
    whichSkullAfter: input.whichSkull,
    toggled: false,
  });
}

export function getVanillaSkullLumpForFrame(whichSkull: 0 | 1): string {
  return whichSkull === 0 ? VANILLA_SKULL_LUMP_M_SKULL1 : VANILLA_SKULL_LUMP_M_SKULL2;
}
