/**
 * Vanilla DOOM 1.9 spatial-SFX runtime facade.
 *
 * Plan_final step `11-003` (lane: audio) aggregates the
 * S_AdjustSoundParams distance/pan/volume computation and the
 * S_UpdateSounds per-tic listener/origin pass the audio ticker
 * calls every tic into one cohesive re-export barrel.  The
 * read-only `src/audio/spatial.ts` and `src/audio/soundOrigins.ts`
 * modules already implement vanilla `s_sound.c`
 * `S_AdjustSoundParams` (P_AproxDistance attenuation +
 * R_PointToAngle2 stereo pan with the documented off-by-one
 * signed-angle wrap and the MAP08 boss-floor volume branch) and
 * `S_UpdateSounds` and are SHA-pinned by the `plan_vanilla_parity`
 * audio inventory; this module does NOT modify them.
 *
 * Wired entry points and their Chocolate Doom 2.2.1 origins:
 *
 *   - `adjustSoundParams`        — `s_sound.c` `S_AdjustSoundParams`
 *     (distance attenuation, stereo separation, boss-map floor).
 *   - `updateSounds`             — `s_sound.c` `S_UpdateSounds`
 *     (per-tic listener-relative re-evaluation of every active
 *     channel: drop inaudible, re-pan, re-attenuate).
 *   - `buildChannelUpdateStates` — the per-channel update-state
 *     snapshot the `updateSounds` pass consumes.
 *
 * @example
 * ```ts
 * import { adjustSoundParams, S_CLIPPING_DIST, VANILLA_SPATIAL_SFX_ENTRY_POINTS } from './wireSpatialSfxRuntime.ts';
 * VANILLA_SPATIAL_SFX_ENTRY_POINTS.length; // 3
 * ```
 */

export { BOSS_MAP_MIN_VOLUME, BOSS_MAP_NUMBER, MAX_STEREO_SEP, MIN_STEREO_SEP, NORM_SEP, S_ATTENUATOR, S_CLIPPING_DIST, S_CLOSE_DIST, S_STEREO_SWING, adjustSoundParams } from '../audio/spatial.ts';
export { buildChannelUpdateStates, updateSounds } from '../audio/soundOrigins.ts';

/**
 * Frozen manifest of the three canonical spatial-SFX entry-point
 * names this facade wires, in the order the audio ticker invokes
 * them (build the per-channel update-state snapshot, run the
 * per-tic S_UpdateSounds re-evaluation, and apply the
 * S_AdjustSoundParams distance/pan computation per channel).
 */
export const VANILLA_SPATIAL_SFX_ENTRY_POINTS: readonly string[] = Object.freeze(['adjustSoundParams', 'buildChannelUpdateStates', 'updateSounds']);
