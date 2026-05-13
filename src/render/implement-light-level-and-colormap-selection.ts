/**
 * Vanilla DOOM 1.9 light-level and colormap selection contract.
 *
 * From Chocolate Doom 2.2.1 r_main.c R_InitLightTables and r_segs.c R_StoreWallRange:
 *
 *   #define LIGHTLEVELS      16
 *   #define LIGHTSEGSHIFT    4
 *   #define MAXLIGHTSCALE    48
 *   #define LIGHTSCALESHIFT  12
 *   #define MAXLIGHTZ        128
 *   #define LIGHTZSHIFT      20
 *   #define NUMCOLORMAPS     32
 *   #define LIGHTBRIGHT      1
 *
 *   // Wall light index calculation (R_StoreWallRange):
 *   lightnum = (frontsector->lightlevel >> LIGHTSEGSHIFT) + extralight;
 *   if (curline->v1->y == curline->v2->y)
 *       lightnum--;
 *   else if (curline->v1->x == curline->v2->x)
 *       lightnum++;
 *   if (lightnum < 0)
 *       walllights = scalelight[0];
 *   else if (lightnum >= LIGHTLEVELS)
 *       walllights = scalelight[LIGHTLEVELS - 1];
 *   else
 *       walllights = scalelight[lightnum];
 *
 *   // Scale-light lookup (per-column):
 *   index = rw_scale >> LIGHTSCALESHIFT;
 *   if (index >= MAXLIGHTSCALE)
 *       index = MAXLIGHTSCALE - 1;
 *   dc_colormap = walllights[index];
 *
 * Notes for parity:
 *   - 16 light levels (0..15) cover the 256 vanilla sector light values via `>> 4`.
 *   - Horizontal walls (v1.y == v2.y) get -1 brightness bonus (look dimmer head-on).
 *   - Vertical walls (v1.x == v2.x) get +1 brightness bonus (look brighter).
 *   - Diagonal walls get neutral.
 *   - extralight (gamma cycle or muzzle flash) is added before bounds clamp.
 *   - MAXLIGHTSCALE=48 clamps the per-column distance scale lookup.
 *   - The clamp uses `>=` so MAXLIGHTSCALE-1 is the dimmest valid scalelight entry.
 *   - Lightnum is clamped to [0, LIGHTLEVELS-1] for the scalelight[] table access.
 */

export const VANILLA_LIGHTLEVELS = 16;
export const VANILLA_LIGHTSEGSHIFT = 4;
export const VANILLA_MAXLIGHTSCALE = 48;
export const VANILLA_LIGHTSCALESHIFT = 12;
export const VANILLA_NUMCOLORMAPS = 32;
export const VANILLA_LIGHTBRIGHT = 1;

export interface WallLightLevelInput {
  readonly sectorLightLevel: number;
  readonly extralight: number;
  readonly wallOrientation: 'horizontal' | 'vertical' | 'diagonal';
}

export function computeVanillaWallLightLevel(input: WallLightLevelInput): number {
  let lightnum = (input.sectorLightLevel >> VANILLA_LIGHTSEGSHIFT) + input.extralight;
  if (input.wallOrientation === 'horizontal') {
    lightnum -= 1;
  } else if (input.wallOrientation === 'vertical') {
    lightnum += 1;
  }
  if (lightnum < 0) {
    return 0;
  }
  if (lightnum >= VANILLA_LIGHTLEVELS) {
    return VANILLA_LIGHTLEVELS - 1;
  }
  return lightnum;
}

export interface ScalelightIndexInput {
  readonly rwScale: number;
}

export function computeVanillaScalelightIndex(input: ScalelightIndexInput): number {
  let index = input.rwScale >> VANILLA_LIGHTSCALESHIFT;
  if (index < 0) {
    return 0;
  }
  if (index >= VANILLA_MAXLIGHTSCALE) {
    return VANILLA_MAXLIGHTSCALE - 1;
  }
  return index;
}
