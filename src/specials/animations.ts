/**
 * Animated textures and flats (p_spec.c animation subsystem).
 *
 * Mirrors the vanilla Doom `P_InitPicAnims` initializer and the
 * animation half of `P_UpdateSpecials`.  The module owns:
 *
 * - {@link ANIMDEFS} — the 22-entry source table from p_spec.c, in
 *   exact WAD/source order.  Nine flat cycles, thirteen texture cycles.
 * - {@link initPicAnims} — the resolver-filtered anim table builder.
 *   Entries whose start name is missing from the current WAD are
 *   silently dropped ("different episode").  Entries with a start name
 *   present but a `numpics < 2` cycle throw to surface the corruption,
 *   matching vanilla `I_Error`.
 * - {@link updateAnimTranslation} — the per-tic texture/flat cycle
 *   update.  For every anim and every `i` in `[basepic, basepic+numpics)`
 *   it writes `translation[i] = basepic + ((leveltime/speed + i) %
 *   numpics)` — rotating the cycle one frame every `speed` tics.
 *
 * Parity-critical details preserved byte-for-byte from Chocolate Doom
 * 2.2.1:
 *
 * - Integer division truncates toward zero to match C `/`.  Leveltime is
 *   always non-negative in vanilla so the sign ambiguity of `%` never
 *   arises; the implementation uses `Math.trunc` and positive operands
 *   to keep that invariant explicit.
 * - Translation tables are NOT reinitialized to identity by the update
 *   pass; anims only rewrite `[basepic..picnum]`, relying on
 *   `R_InitTextures` / `R_InitFlats` to have seeded every slot.
 * - Flat lookup uses `W_CheckNumForName` (ANY lump with that name is
 *   acceptable) whereas texture lookup uses `R_CheckTextureNumForName`
 *   (TEXTURE1/TEXTURE2-registered only).  This asymmetry is reflected
 *   in the {@link AnimResolver} contract.
 * - On the commercial iwad many of the 22 animdefs resolve; on the
 *   shareware iwad only a handful do.  Filtering is by start-name
 *   presence, NOT by a hardcoded episode flag.
 *
 * @example
 * ```ts
 * import {
 *   ANIMDEFS,
 *   initPicAnims,
 *   updateAnimTranslation,
 * } from "../src/specials/animations.ts";
 *
 * const anims = initPicAnims({
 *   checkTextureNumForName: (n) => textureIndex(n) ?? -1,
 *   textureNumForName: (n) => textureIndexOrThrow(n),
 *   checkFlatLumpForName: (n) => flatLump(n) ?? -1,
 *   flatNumForName: (n) => flatIndexOrThrow(n),
 * });
 *
 * updateAnimTranslation(anims, leveltime, textureTranslation, flatTranslation);
 * ```
 */

// ── Source table (animdefs[]) ───────────────────────────────────────

/**
 * One entry of the vanilla `animdefs[]` table as declared in p_spec.c.
 * `istexture` is `true` for TEXTURE1/2-resolved cycles, `false` for
 * F_START/F_END flat cycles.  `startname` and `endname` are the first
 * and last frame of the cycle in WAD/TEXTURE1 order, inclusive.
 * `speed` is the number of game tics between frame advances.
 */
export interface AnimDef {
  readonly istexture: boolean;
  readonly endname: string;
  readonly startname: string;
  readonly speed: number;
}

/**
 * Full vanilla p_spec.c `animdefs[]` table, copied verbatim in source
 * order.  Five original-Doom flats, four Doom II flats, then thirteen
 * textures (three E1/shareware, ten commercial-only).  The sentinel
 * `{istexture: -1, …}` row from the C source is not included — the
 * TypeScript array is the closed list and initialization iterates it.
 */
export const ANIMDEFS: readonly AnimDef[] = Object.freeze([
  { istexture: false, endname: 'NUKAGE3', startname: 'NUKAGE1', speed: 8 },
  { istexture: false, endname: 'FWATER4', startname: 'FWATER1', speed: 8 },
  { istexture: false, endname: 'SWATER4', startname: 'SWATER1', speed: 8 },
  { istexture: false, endname: 'LAVA4', startname: 'LAVA1', speed: 8 },
  { istexture: false, endname: 'BLOOD3', startname: 'BLOOD1', speed: 8 },

  { istexture: false, endname: 'RROCK08', startname: 'RROCK05', speed: 8 },
  { istexture: false, endname: 'SLIME04', startname: 'SLIME01', speed: 8 },
  { istexture: false, endname: 'SLIME08', startname: 'SLIME05', speed: 8 },
  { istexture: false, endname: 'SLIME12', startname: 'SLIME09', speed: 8 },

  { istexture: true, endname: 'BLODGR4', startname: 'BLODGR1', speed: 8 },
  { istexture: true, endname: 'SLADRIP3', startname: 'SLADRIP1', speed: 8 },

  { istexture: true, endname: 'BLODRIP4', startname: 'BLODRIP1', speed: 8 },
  { istexture: true, endname: 'FIREWALL', startname: 'FIREWALA', speed: 8 },
  { istexture: true, endname: 'GSTFONT3', startname: 'GSTFONT1', speed: 8 },
  { istexture: true, endname: 'FIRELAVA', startname: 'FIRELAV3', speed: 8 },
  { istexture: true, endname: 'FIREMAG3', startname: 'FIREMAG1', speed: 8 },
  { istexture: true, endname: 'FIREBLU2', startname: 'FIREBLU1', speed: 8 },
  { istexture: true, endname: 'ROCKRED3', startname: 'ROCKRED1', speed: 8 },

  { istexture: true, endname: 'BFALL4', startname: 'BFALL1', speed: 8 },
  { istexture: true, endname: 'SFALL4', startname: 'SFALL1', speed: 8 },
  { istexture: true, endname: 'WFALL4', startname: 'WFALL1', speed: 8 },
  { istexture: true, endname: 'DBRAIN4', startname: 'DBRAIN1', speed: 8 },
]);

/** Maximum number of active anim records vanilla allocates (MAXANIMS). */
export const MAXANIMS = 32;

// ── Resolver and anim record types ──────────────────────────────────

/**
 * Bridge to the renderer's texture/flat number lookups consumed by
 * {@link initPicAnims}.  The four callbacks map directly to the C
 * names; the `check*` variants return `-1` when the name is absent
 * while the plain variants throw (`I_Error` in vanilla).
 *
 * `checkFlatLumpForName` corresponds to `W_CheckNumForName` — vanilla
 * uses the raw lump-check for flats because `R_FlatNumForName` aborts
 * on missing names.  `flatNumForName` is `R_FlatNumForName`.
 */
export interface AnimResolver {
  /** `R_CheckTextureNumForName(name)`: TEXTURE1/2 index or -1. */
  checkTextureNumForName(name: string): number;
  /** `R_TextureNumForName(name)`: TEXTURE1/2 index; throws on missing. */
  textureNumForName(name: string): number;
  /** `W_CheckNumForName(name)`: raw lump number, or -1 when absent. */
  checkFlatLumpForName(name: string): number;
  /** `R_FlatNumForName(name)`: F_START-relative flat index; throws on missing. */
  flatNumForName(name: string): number;
}

/**
 * One resolved animation cycle.  `basepic` and `picnum` are the start
 * and end indices in the appropriate translation table (TEXTURE1 for
 * `istexture`, F_START-relative for flats); the cycle covers every
 * index in `[basepic, picnum]` inclusive.  `numpics = picnum - basepic
 * + 1` (always ≥ 2; `initPicAnims` throws otherwise).  `speed` is the
 * tic interval from the source animdef.
 */
export interface AnimRecord {
  readonly istexture: boolean;
  readonly picnum: number;
  readonly basepic: number;
  readonly numpics: number;
  readonly speed: number;
}

// ── Initialization ──────────────────────────────────────────────────

/**
 * Build the anim table from the source {@link ANIMDEFS} list and a
 * resolver bridge.  Walks {@link ANIMDEFS} in order:
 *
 * 1. Look up the start name via the appropriate `check*` callback.
 *    If `-1`, skip this animdef silently (vanilla "different episode"
 *    fall-through — typical for Doom II textures on shareware iwad).
 * 2. Resolve the end name via the matching plain callback; if it
 *    throws (the resolver's responsibility), propagate — the WAD is
 *    malformed.
 * 3. Compute `numpics = picnum - basepic + 1`; throw if `< 2` to match
 *    vanilla `I_Error("P_InitPicAnims: bad cycle from %s to %s", …)`.
 *
 * Returns a fresh mutable array; callers store it alongside the
 * translation tables and feed both to {@link updateAnimTranslation}.
 */
export function initPicAnims(resolver: AnimResolver): AnimRecord[] {
  const anims: AnimRecord[] = [];
  for (const def of ANIMDEFS) {
    let basepic: number;
    let picnum: number;
    if (def.istexture) {
      if (resolver.checkTextureNumForName(def.startname) === -1) {
        continue;
      }
      picnum = resolver.textureNumForName(def.endname);
      basepic = resolver.textureNumForName(def.startname);
    } else {
      if (resolver.checkFlatLumpForName(def.startname) === -1) {
        continue;
      }
      picnum = resolver.flatNumForName(def.endname);
      basepic = resolver.flatNumForName(def.startname);
    }
    const numpics = picnum - basepic + 1;
    if (numpics < 2) {
      throw new Error(`P_InitPicAnims: bad cycle from ${def.startname} to ${def.endname}`);
    }
    anims.push(
      Object.freeze({
        istexture: def.istexture,
        picnum,
        basepic,
        numpics,
        speed: def.speed,
      }),
    );
  }
  return anims;
}

// ── Per-tic update ──────────────────────────────────────────────────

/**
 * Rotate every anim cycle one step for the given `leveltime`.  Mirrors
 * the animation loop of `P_UpdateSpecials`:
 *
 * ```
 * for (anim = anims; anim < lastanim; anim++)
 *   for (i = anim->basepic; i < anim->basepic + anim->numpics; i++) {
 *     pic = anim->basepic + ((leveltime/anim->speed + i) % anim->numpics);
 *     (anim->istexture ? texturetranslation : flattranslation)[i] = pic;
 *   }
 * ```
 *
 * The update is idempotent within a single tic and only overwrites
 * slots in `[basepic, picnum]` — unanimated translation entries keep
 * whatever value `R_InitTextures` / `R_InitFlats` seeded (identity in
 * vanilla, or whatever callers pre-wrote).
 *
 * Caller contract:
 * - `leveltime` must be a non-negative integer (the Doom engine
 *   guarantees this; passing negative would diverge from vanilla `%`).
 * - `textureTranslation.length` must be greater than every
 *   `picnum` of texture anims; likewise `flatTranslation.length` for
 *   flat anims.  Callers size the tables as `numtextures+1` /
 *   `numflats+1` to match vanilla.
 */
export function updateAnimTranslation(anims: readonly AnimRecord[], leveltime: number, textureTranslation: Int32Array, flatTranslation: Int32Array): void {
  for (const anim of anims) {
    const table = anim.istexture ? textureTranslation : flatTranslation;
    const step = Math.trunc(leveltime / anim.speed);
    const limit = anim.basepic + anim.numpics;
    for (let i = anim.basepic; i < limit; i++) {
      const pic = anim.basepic + ((step + i) % anim.numpics);
      table[i] = pic;
    }
  }
}
