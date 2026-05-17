/**
 * Animated-flat `flattranslation` — Chocolate Doom 2.2.1 p_spec.c
 * `P_InitPicAnims` + the `P_UpdateSpecials` flat-cycle loop.
 *
 * The idle E1M1 spawn view animates perpetually because
 * `P_UpdateSpecials` rewrites `flattranslation[i]` every tic for each
 * flat in an `animdefs` cycle (NUKAGE / FWATER / … pools). The
 * assembled flat catalog uses identity translation (static), so its
 * single frame can never match the reference's cycling set. This is
 * the missing per-tic translation.
 *
 * Verbatim p_spec.c (transcribed from the 2.2.1 source):
 *
 *   P_InitPicAnims: for each flat animdef
 *     if (W_CheckNumForName(startname) == -1) continue;   // skip absent
 *     picnum  = R_FlatNumForName(endname);
 *     basepic = R_FlatNumForName(startname);
 *     numpics = picnum - basepic + 1;
 *     if (numpics < 2) I_Error("P_InitPicAnims: bad cycle ...");
 *     speed   = animdefs.speed;
 *
 *   P_UpdateSpecials: for each anim, for i in [basepic, basepic+numpics)
 *     pic = basepic + ((leveltime/anim->speed + i) % anim->numpics);
 *     flattranslation[i] = pic;
 *
 * `leveltime/speed` is C integer division (`leveltime >= 0` →
 * `(leveltime / speed) | 0`); `% numpics` over non-negative operands
 * matches JS `%`. A flat outside every cycle keeps identity
 * translation. The shareware DOOM1.WAD lacks SWATER/LAVA/BLOOD — those
 * `animdefs` are skipped via the start-name check exactly as vanilla.
 *
 * Pure; no Win32 or runtime dependencies.
 */

import { VANILLA_FLAT_ANIMS } from '../ai/implement-animated-flats-and-textures.ts';
import type { VanillaAnimDef } from '../ai/implement-animated-flats-and-textures.ts';

import type { FlatNumberResolver } from './segRenderModel.ts';

/** One resolved flat cycle (`P_InitPicAnims` `anim_t`). */
interface ResolvedFlatAnim {
  readonly basepic: number;
  readonly numpics: number;
  readonly speed: number;
}

/** `flattranslation[picnum]` for the current `leveltime` (identity outside any cycle). */
export type FlatTranslation = (picnum: number, leveltime: number) => number;

/**
 * Build the `flattranslation` resolver from the flat animdefs,
 * reproducing `P_InitPicAnims` (absent start flat ⇒ skip; `numpics <
 * 2` ⇒ I_Error) and the `P_UpdateSpecials` per-tic cycle.
 *
 * @param flatNumber - `R_FlatNumForName` (throws on a genuinely missing flat).
 * @param flatExists - `W_CheckNumForName(name) != -1` (the skip-if-absent guard).
 * @param animDefs - Flat animdefs (defaults to {@link VANILLA_FLAT_ANIMS}; injectable for tests).
 * @returns `(picnum, leveltime) => translated flat number`.
 *
 * @example
 * ```ts
 * const flatTranslation = makeFlatAnimation(flats.flatNumber, (n) => flats.flatExists(n));
 * const dsSource = flats.flatSource(flatTranslation(sector.floorpic, session.levelTime));
 * ```
 */
export function makeFlatAnimation(flatNumber: FlatNumberResolver, flatExists: (name: string) => boolean, animDefs: readonly VanillaAnimDef[] = VANILLA_FLAT_ANIMS): FlatTranslation {
  const anims: ResolvedFlatAnim[] = [];

  for (const def of animDefs) {
    if (def.isTexture) {
      continue; // texturetranslation is a sibling concern.
    }
    // P_InitPicAnims: W_CheckNumForName(startname) == -1 → skip.
    if (!flatExists(def.startName)) {
      continue;
    }
    const basepic = flatNumber(def.startName);
    const picnum = flatNumber(def.endName);
    const numpics = picnum - basepic + 1;
    if (numpics < 2) {
      throw new Error(`P_InitPicAnims: bad cycle from ${def.startName} to ${def.endName}`);
    }
    anims.push({ basepic, numpics, speed: def.tics });
  }

  return (picnum: number, leveltime: number): number => {
    for (const anim of anims) {
      if (picnum >= anim.basepic && picnum < anim.basepic + anim.numpics) {
        // P_UpdateSpecials: basepic + ((leveltime/speed + i) % numpics).
        return anim.basepic + ((((leveltime / anim.speed) | 0) + picnum) % anim.numpics);
      }
    }
    return picnum;
  };
}
