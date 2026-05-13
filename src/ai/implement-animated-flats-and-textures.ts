/**
 * Vanilla DOOM 1.9 animated flats and textures contract.
 *
 * From Chocolate Doom 2.2.1 p_spec.c P_InitPicAnims and animdefs[]:
 *   Each animation cycles a range of flats or wall textures at a fixed speed.
 *   Animation entries:
 *     NUKAGE   3 flats @ 8 tics  (NUKAGE1..3)
 *     FWATER   4 flats @ 8 tics  (FWATER1..4)
 *     SWATER   4 flats @ 8 tics  (SWATER1..4) — registered/retail
 *     LAVA     4 flats @ 8 tics  (LAVA1..4)
 *     BLOOD    3 flats @ 8 tics  (BLOOD1..3)
 *     RROCK   8 flats @ 8 tics — DOOM 2 only
 *     SLIME01..04, SLIME05..08, SLIME09..12 @ 8 tics — DOOM 2
 *   Plus wall texture animations: BLODGR1..4, SLADRIP1..3, BLODRIP1..4,
 *     FIREWAL[L|A|B], GSTFONT[1|2|3], FIRELAV[A|B], FIREMAG[1|2|3], etc.
 *
 *   Animation speed unit: 8 tics per frame.
 */

export const VANILLA_ANIM_FRAME_DURATION_TICS = 8;

export interface VanillaAnimDef {
  readonly startName: string;
  readonly endName: string;
  readonly isTexture: boolean;
  readonly tics: number;
}

export const VANILLA_FLAT_ANIMS: readonly VanillaAnimDef[] = Object.freeze([
  Object.freeze({ startName: 'NUKAGE1', endName: 'NUKAGE3', isTexture: false, tics: 8 }),
  Object.freeze({ startName: 'FWATER1', endName: 'FWATER4', isTexture: false, tics: 8 }),
  Object.freeze({ startName: 'LAVA1', endName: 'LAVA4', isTexture: false, tics: 8 }),
  Object.freeze({ startName: 'BLOOD1', endName: 'BLOOD3', isTexture: false, tics: 8 }),
]);
