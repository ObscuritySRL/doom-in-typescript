/**
 * Vanilla DOOM 1.9 extralight + PLAYPAL palette-effect selection contract.
 *
 * From Chocolate Doom 2.2.1 st_stuff.c ST_doPaletteStuff and r_main.c extralight:
 *
 *   #define STARTREDPALS    1
 *   #define STARTBONUSPALS  9
 *   #define NUMREDPALS      8
 *   #define NUMBONUSPALS    4
 *   #define RADIATIONPAL    13
 *
 *   void ST_doPaletteStuff(void)
 *   {
 *       int palette;
 *
 *       cnt = plyr->damagecount;
 *       if (plyr->powers[pw_strength])
 *           bzc = 12 - (plyr->powers[pw_strength] >> 6);
 *       else
 *           bzc = 0;
 *       if (bzc > cnt) cnt = bzc;
 *
 *       if (cnt)
 *       {
 *           palette = (cnt + 7) >> 3;
 *           if (palette >= NUMREDPALS) palette = NUMREDPALS - 1;
 *           palette += STARTREDPALS;
 *       }
 *       else if (plyr->bonuscount)
 *       {
 *           palette = (plyr->bonuscount + 7) >> 3;
 *           if (palette >= NUMBONUSPALS) palette = NUMBONUSPALS - 1;
 *           palette += STARTBONUSPALS;
 *       }
 *       else if (plyr->powers[pw_ironfeet] > 4 * 32
 *                || plyr->powers[pw_ironfeet] & 8)
 *       {
 *           palette = RADIATIONPAL;
 *       }
 *       else
 *           palette = 0;
 *
 *       if (palette != st_palette)
 *           I_SetPalette(W_CacheLumpName("PLAYPAL", PU_CACHE) + palette * 768);
 *   }
 *
 * Notes for parity:
 *   - PLAYPAL lump contains 14 palettes of 256 colors x 3 bytes (RGB) = 768 bytes each.
 *   - Palette 0 = normal; 1..8 = red damage tint (8 intensity steps);
 *     9..12 = yellow bonus tint (4 intensity steps); 13 = green radiation tint.
 *   - Damage palette index = ((damagecount + 7) >> 3) clamped to NUMREDPALS-1 = 7.
 *   - Bonus palette index = ((bonuscount + 7) >> 3) clamped to NUMBONUSPALS-1 = 3.
 *   - Berserk strength power = max(strengthcount, damagecount) effective level
 *     (via `bzc = 12 - (powers[pw_strength] >> 6)` boost during early strength tics).
 *   - Radiation suit triggers palette 13 when powers[pw_ironfeet] > 4*32=128
 *     OR when the blink phase bit is set (powers[pw_ironfeet] & 8).
 *   - Damage takes precedence over bonus, which takes precedence over radiation.
 */

export const VANILLA_NUMREDPALS = 8;
export const VANILLA_NUMBONUSPALS = 4;
export const VANILLA_STARTREDPALS = 1;
export const VANILLA_STARTBONUSPALS = 9;
export const VANILLA_RADIATIONPAL = 13;
export const VANILLA_PLAYPAL_TOTAL_PALETTES = 14;
export const VANILLA_PLAYPAL_BYTES_PER_PALETTE = 768;

export interface PaletteSelectInput {
  readonly damagecount: number;
  readonly bonuscount: number;
  readonly powersStrength: number;
  readonly powersIronfeet: number;
}

export function selectVanillaPlayerPaletteIndex(input: PaletteSelectInput): number {
  let cnt = input.damagecount;
  const bzc = input.powersStrength > 0 ? 12 - (input.powersStrength >> 6) : 0;
  if (bzc > cnt) {
    cnt = bzc;
  }

  if (cnt > 0) {
    let palette = (cnt + 7) >> 3;
    if (palette >= VANILLA_NUMREDPALS) {
      palette = VANILLA_NUMREDPALS - 1;
    }
    return palette + VANILLA_STARTREDPALS;
  }

  if (input.bonuscount > 0) {
    let palette = (input.bonuscount + 7) >> 3;
    if (palette >= VANILLA_NUMBONUSPALS) {
      palette = VANILLA_NUMBONUSPALS - 1;
    }
    return palette + VANILLA_STARTBONUSPALS;
  }

  if (input.powersIronfeet > 4 * 32 || (input.powersIronfeet & 8) !== 0) {
    return VANILLA_RADIATIONPAL;
  }

  return 0;
}
