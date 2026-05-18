/**
 * Vanilla DOOM 1.9 `sounds.c` `S_sfx[]` runtime catalog (sfx id →
 * lump name + priority).
 *
 * Every gameplay subsystem (`src/player/`, `src/ai/`, `src/specials/`)
 * routes its digital sfx through an injected
 * `StartSoundFunction = (origin, sfxId) => void` where `sfxId` is the
 * numeric `sfxenum_t` value from Chocolate Doom 2.2.1 `sounds.h`
 * (`sfx_None = 0`, `sfx_pistol = 1`, … `sfx_radio = 108`,
 * `NUMSFX = 109`).  The read-only `src/audio/soundSystem.ts`
 * `startSound` entry point, by contrast, needs the per-sfx
 * `sfxinfo_t` metadata vanilla keeps in the `S_sfx[]` table: the
 * DMX lump name (`DS<NAME>`), the channel-allocation `priority`, and
 * the `link` row.  This module is the faithful transcription of that
 * table so the live game host can translate a numeric sfx id into a
 * `StartSoundRequest`.
 *
 * Reference: Chocolate Doom 2.2.1 `src/doom/sounds.c` `S_sfx[]` and
 * `src/doom/sounds.h` `sfxenum_t`.  Every stock Doom-1 sfx has
 * `link == NULL` and `pitch == -1` / `volume == -1` (the `S_sfx[]`
 * initialiser only ever sets `link` for the DOOM II `sfx_*` rows that
 * are not on the shareware/registered DOOM-1 path), so the
 * `linkVolumeAdjust` / `linkPitch` fields are always `null` here —
 * the vanilla `sfxinfo_t.link` early-return in `S_StartSound` is a
 * dead branch for DOOM 1.
 *
 * The pitch-perturbation class follows the `S_StartSound` id ranges
 * pinned in `src/audio/soundSystem.ts`: the saw family
 * `sfx_sawup`(10)…`sfx_sawhit`(13) is `'saw'`, `sfx_itemup`(32) and
 * `sfx_tink`(87) are `'static'` (no perturbation, no RNG advance),
 * everything else is `'default'`.
 *
 * @example
 * ```ts
 * import { sfxCatalogEntry } from './sfxCatalog.ts';
 * const pistol = sfxCatalogEntry(1);
 * pistol.lumpName;   // 'DSPISTOL'
 * pistol.priority;   // 64 (NORM_PRIORITY)
 * pistol.pitchClass; // 'default'
 * ```
 */

import type { SfxPitchClass } from '../audio/soundSystem.ts';

/** One resolved `sfxinfo_t` row: DMX lump name + arbitration priority + pitch class. */
export interface SfxCatalogEntry {
  /** `sfxenum_t` numeric id (1-based, matches `sounds.h`). */
  readonly sfxId: number;
  /** DMX lump name (`DS` + uppercased `sfxinfo_t.name`). */
  readonly lumpName: string;
  /** `sfxinfo_t.priority` (lower = more important; NORM_PRIORITY = 64). */
  readonly priority: number;
  /** Pitch-perturbation class for the `S_StartSound` pitch jitter. */
  readonly pitchClass: SfxPitchClass;
}

/** Vanilla `NORM_PRIORITY` (sounds.c). */
const P_NORM = 64;

/**
 * `S_sfx[]` rows in `sfxenum_t` order (index === sfx id).  `name`
 * and `priority` are transcribed verbatim from Chocolate Doom 2.2.1
 * `src/doom/sounds.c`; index 0 (`sfx_None`) is intentionally absent
 * so a lookup of the invalid id falls through to the range guard.
 */
const S_SFX: readonly (readonly [name: string, priority: number])[] = Object.freeze([
  ['pistol', P_NORM], // 1  sfx_pistol
  ['shotgn', P_NORM], // 2  sfx_shotgn
  ['sgcock', P_NORM], // 3  sfx_sgcock
  ['dshtgn', P_NORM], // 4  sfx_dshtgn
  ['dbopn', P_NORM], // 5  sfx_dbopn
  ['dbcls', P_NORM], // 6  sfx_dbcls
  ['dbload', P_NORM], // 7  sfx_dbload
  ['plasma', P_NORM], // 8  sfx_plasma
  ['bfg', P_NORM], // 9  sfx_bfg
  ['sawup', P_NORM], // 10 sfx_sawup
  ['sawidl', 118], // 11 sfx_sawidl
  ['sawful', P_NORM], // 12 sfx_sawful
  ['sawhit', P_NORM], // 13 sfx_sawhit
  ['rlaunc', P_NORM], // 14 sfx_rlaunc
  ['rxplod', P_NORM], // 15 sfx_rxplod
  ['firsht', P_NORM], // 16 sfx_firsht
  ['firxpl', P_NORM], // 17 sfx_firxpl
  ['pstart', 100], // 18 sfx_pstart
  ['pstop', 100], // 19 sfx_pstop
  ['doropn', 100], // 20 sfx_doropn
  ['dorcls', 100], // 21 sfx_dorcls
  ['stnmov', 119], // 22 sfx_stnmov
  ['swtchn', 78], // 23 sfx_swtchn
  ['swtchx', 78], // 24 sfx_swtchx
  ['plpain', 96], // 25 sfx_plpain
  ['dmpain', 96], // 26 sfx_dmpain
  ['popain', 96], // 27 sfx_popain
  ['vipain', 96], // 28 sfx_vipain
  ['mnpain', 96], // 29 sfx_mnpain
  ['pepain', 96], // 30 sfx_pepain
  ['slop', 78], // 31 sfx_slop
  ['itemup', 78], // 32 sfx_itemup
  ['wpnup', 78], // 33 sfx_wpnup
  ['oof', 96], // 34 sfx_oof
  ['telept', 32], // 35 sfx_telept
  ['posit1', 98], // 36 sfx_posit1
  ['posit2', 98], // 37 sfx_posit2
  ['posit3', 98], // 38 sfx_posit3
  ['bgsit1', 98], // 39 sfx_bgsit1
  ['bgsit2', 98], // 40 sfx_bgsit2
  ['sgtsit', 98], // 41 sfx_sgtsit
  ['cacsit', 98], // 42 sfx_cacsit
  ['brssit', 94], // 43 sfx_brssit
  ['cybsit', 92], // 44 sfx_cybsit
  ['spisit', 90], // 45 sfx_spisit
  ['bspsit', 90], // 46 sfx_bspsit
  ['kntsit', 90], // 47 sfx_kntsit
  ['vilsit', 90], // 48 sfx_vilsit
  ['mansit', 90], // 49 sfx_mansit
  ['pesit', 90], // 50 sfx_pesit
  ['sklatk', 70], // 51 sfx_sklatk
  ['sgtatk', 70], // 52 sfx_sgtatk
  ['skepch', 70], // 53 sfx_skepch
  ['vilatk', 70], // 54 sfx_vilatk
  ['claw', 70], // 55 sfx_claw
  ['skeswg', 70], // 56 sfx_skeswg
  ['pldeth', 32], // 57 sfx_pldeth
  ['pdiehi', 32], // 58 sfx_pdiehi
  ['podth1', 70], // 59 sfx_podth1
  ['podth2', 70], // 60 sfx_podth2
  ['podth3', 70], // 61 sfx_podth3
  ['bgdth1', 70], // 62 sfx_bgdth1
  ['bgdth2', 70], // 63 sfx_bgdth2
  ['sgtdth', 70], // 64 sfx_sgtdth
  ['cacdth', 70], // 65 sfx_cacdth
  ['skldth', 70], // 66 sfx_skldth
  ['brsdth', 32], // 67 sfx_brsdth
  ['cybdth', 32], // 68 sfx_cybdth
  ['spidth', 32], // 69 sfx_spidth
  ['bspdth', 32], // 70 sfx_bspdth
  ['vildth', 32], // 71 sfx_vildth
  ['kntdth', 32], // 72 sfx_kntdth
  ['pedth', 32], // 73 sfx_pedth
  ['skedth', 32], // 74 sfx_skedth
  ['posact', 120], // 75 sfx_posact
  ['bgact', 120], // 76 sfx_bgact
  ['dmact', 120], // 77 sfx_dmact
  ['bspact', 100], // 78 sfx_bspact
  ['bspwlk', 100], // 79 sfx_bspwlk
  ['vilact', 100], // 80 sfx_vilact
  ['noway', 78], // 81 sfx_noway
  ['barexp', 60], // 82 sfx_barexp
  ['punch', P_NORM], // 83 sfx_punch
  ['hoof', 70], // 84 sfx_hoof
  ['metal', 70], // 85 sfx_metal
  ['chgun', P_NORM], // 86 sfx_chgun (links to sfx_pistol in DOOM II only — null here)
  ['tink', 60], // 87 sfx_tink
  ['bdopn', 100], // 88 sfx_bdopn
  ['bdcls', 100], // 89 sfx_bdcls
  ['itmbk', 100], // 90 sfx_itmbk
  ['flame', 32], // 91 sfx_flame
  ['flamst', 32], // 92 sfx_flamst
  ['getpow', 60], // 93 sfx_getpow
  ['bospit', 70], // 94 sfx_bospit
  ['boscub', 70], // 95 sfx_boscub
  ['bossit', 70], // 96 sfx_bossit
  ['bospn', 70], // 97 sfx_bospn
  ['bosdth', 70], // 98 sfx_bosdth
  ['manatk', 70], // 99 sfx_manatk
  ['mandth', 70], // 100 sfx_mandth
  ['sssit', 70], // 101 sfx_sssit
  ['ssdth', 70], // 102 sfx_ssdth
  ['keenpn', 70], // 103 sfx_keenpn
  ['keendt', 70], // 104 sfx_keendt
  ['skeact', 70], // 105 sfx_skeact
  ['skesit', 70], // 106 sfx_skesit
  ['skeatk', 70], // 107 sfx_skeatk
  ['radio', 60], // 108 sfx_radio
]);

/** `sfx_sawup` (10) lower bound of the saw pitch-perturbation family. */
const SFX_SAWUP = 10;
/** `sfx_sawhit` (13) upper bound of the saw pitch-perturbation family. */
const SFX_SAWHIT = 13;
/** `sfx_itemup` (32) — no pitch perturbation. */
const SFX_ITEMUP = 32;
/** `sfx_tink` (87) — no pitch perturbation. */
const SFX_TINK = 87;

/**
 * Classify the `S_StartSound` pitch-perturbation bucket for `sfxId`,
 * matching the id ranges pinned in `src/audio/soundSystem.ts`.
 */
export function sfxPitchClass(sfxId: number): SfxPitchClass {
  if (sfxId >= SFX_SAWUP && sfxId <= SFX_SAWHIT) {
    return 'saw';
  }
  if (sfxId === SFX_ITEMUP || sfxId === SFX_TINK) {
    return 'static';
  }
  return 'default';
}

/**
 * Resolve the `S_sfx[]` row for a numeric `sfxenum_t` id.  Returns
 * `null` when the id is outside the catalog (`< 1` or `> 108`), which
 * lets the caller drop the request the way vanilla's `I_Error` /
 * `S_sfx[NUMSFX]` boundary would have aborted it — the live host
 * never crashes the game on a stray id.
 */
export function sfxCatalogEntry(sfxId: number): SfxCatalogEntry | null {
  if (!Number.isInteger(sfxId) || sfxId < 1 || sfxId > S_SFX.length) {
    return null;
  }
  const row = S_SFX[sfxId - 1];
  if (row === undefined) {
    return null;
  }
  return Object.freeze({
    sfxId,
    lumpName: `DS${row[0].toUpperCase()}`,
    priority: row[1],
    pitchClass: sfxPitchClass(sfxId),
  });
}

/** Number of catalogued sfx rows (`sfx_pistol`…`sfx_radio`, 108). */
export const SFX_CATALOG_SIZE = S_SFX.length;
