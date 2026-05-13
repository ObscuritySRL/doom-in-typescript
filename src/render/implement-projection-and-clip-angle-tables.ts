/**
 * Vanilla DOOM 1.9 projection and viewangletox / xtoviewangle tables.
 *
 * From Chocolate Doom 2.2.1 r_main.c R_InitTextureMapping and r_main.h:
 *
 *   #define FIELDOFVIEW    2048   // BAM units (90 degrees in vanilla)
 *
 *   void R_InitTextureMapping(void)
 *   {
 *       int           i, x, t;
 *       fixed_t       focallength;
 *
 *       // Use tangent table to generate viewangletox: viewangletox will give
 *       // the next greatest x after the view angle.
 *       //
 *       // Calc focallength so FIELDOFVIEW angles covers SCREENWIDTH.
 *       focallength = FixedDiv(centerxfrac, finetangent[FINEANGLES/4 + FIELDOFVIEW/2]);
 *
 *       for (i = 0; i < FINEANGLES/2; i++)
 *       {
 *           if (finetangent[i] > FRACUNIT*2)
 *               t = -1;
 *           else if (finetangent[i] < -FRACUNIT*2)
 *               t = viewwidth + 1;
 *           else
 *           {
 *               t = FixedMul(finetangent[i], focallength);
 *               t = (centerxfrac - t + FRACUNIT - 1) >> FRACBITS;
 *               if (t < -1) t = -1;
 *               else if (t > viewwidth + 1) t = viewwidth + 1;
 *           }
 *           viewangletox[i] = t;
 *       }
 *
 *       // Scan viewangletox to generate xtoviewangle.
 *       for (x = 0; x <= viewwidth; x++)
 *       {
 *           i = 0;
 *           while (viewangletox[i] > x) i++;
 *           xtoviewangle[x] = (i << ANGLETOFINESHIFT) - ANG90;
 *       }
 *
 *       // Compensate for the long mapping of the screen edges.
 *       for (i = 0; i < FINEANGLES/2; i++)
 *           if (viewangletox[i] == -1) viewangletox[i] = 0;
 *           else if (viewangletox[i] == viewwidth+1) viewangletox[i] = viewwidth;
 *
 *       clipangle = xtoviewangle[0];
 *   }
 *
 * Notes for parity:
 *   - FIELDOFVIEW = 2048 BAM (binary angular measurement; 2048 BAM = 90 degrees).
 *   - FINEANGLES = 8192 (size of the fine-angle table, covers 360 degrees / ~0.044 deg each).
 *   - ANGLETOFINESHIFT = 19 (converts 32-bit BAM angle to fineangle index).
 *   - ANG90 = 0x40000000 (90 degrees as 32-bit BAM).
 *   - viewangletox is the projection lookup from fineangle [0..FINEANGLES/2) to screen x column.
 *   - xtoviewangle is the inverse from screen x column to BAM angle.
 *   - clipangle = xtoviewangle[0] — the angle of the leftmost screen column relative to view center.
 */

export const VANILLA_FIELDOFVIEW_BAM = 2048;
export const VANILLA_FINEANGLES = 8192;
export const VANILLA_FINEANGLES_HALF = 4096;
export const VANILLA_FINEANGLES_QUARTER = 2048;
export const VANILLA_ANGLETOFINESHIFT = 19;
export const VANILLA_ANG90 = 0x40000000;

export interface ProjectionInitInput {
  readonly viewwidth: number;
  readonly centerxfrac: number;
}

export interface ProjectionInitResult {
  readonly viewangletoxLength: number;
  readonly xtoviewangleLength: number;
  readonly focallengthFineangleIndex: number;
}

export function computeVanillaProjectionTableSizes(input: ProjectionInitInput): ProjectionInitResult {
  return Object.freeze({
    viewangletoxLength: VANILLA_FINEANGLES_HALF,
    xtoviewangleLength: input.viewwidth + 1,
    focallengthFineangleIndex: VANILLA_FINEANGLES_QUARTER + VANILLA_FIELDOFVIEW_BAM / 2,
  });
}

export function vanillaXToViewangleIndex(x: number, viewwidth: number): number {
  if (x < 0 || x > viewwidth) {
    throw new RangeError(`x ${x} is out of range 0..${viewwidth}`);
  }
  return x;
}

export function vanillaAngleToFineangleIndex(bamAngle: number): number {
  // Equivalent to `bamAngle >>> ANGLETOFINESHIFT` but accounts for the 32-bit BAM wrap.
  return (bamAngle >>> VANILLA_ANGLETOFINESHIFT) & (VANILLA_FINEANGLES - 1);
}
