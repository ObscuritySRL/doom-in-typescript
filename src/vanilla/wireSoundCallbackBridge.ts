/**
 * Vanilla DOOM 1.9 sound-callback bridge facade.
 *
 * Plan_final step `11-004` (lane: audio) connects the player,
 * monster, switch, door, pickup, teleport, and UI sound callback
 * sites to the single vanilla `s_sound.c` `S_StartSound` entry
 * point.  The read-only `src/audio/soundSystem.ts` module already
 * implements the six-step `S_StartSound` composition (sfx_id
 * validation with the `<= NUMSFX` quirk, the `sfxinfo_t.link`
 * volume/pitch early-return, the remote-origin
 * `S_AdjustSoundParams` distance/pan branch with the same-position
 * `NORM_SEP` override, the saw/static/default pitch perturbation,
 * and the `stopSound`-then-`allocateChannel` slot reuse) and is
 * SHA-pinned by the `plan_vanilla_parity` audio inventory; this
 * module does NOT modify it.  Every callback site forwards a
 * `StartSoundRequest` through this barrel so the bridge stays the
 * one observable path to the mixer.
 *
 * @example
 * ```ts
 * import { startSound, NUMSFX, VANILLA_SOUND_CALLBACK_BRIDGE_INVARIANTS } from './wireSoundCallbackBridge.ts';
 * VANILLA_SOUND_CALLBACK_BRIDGE_INVARIANTS.length; // 5
 * ```
 */

export { NUMSFX, PITCH_CLAMP_MAX, PITCH_CLAMP_MIN, SFX_ID_MAX, SFX_ID_MIN, START_SOUND_LINK_MIN_VOLUME, startSound } from '../audio/soundSystem.ts';
export type { SfxPitchClass, StartSoundDroppedResult, StartSoundRequest, StartSoundResult, StartSoundResultKind, StartSoundStartedResult } from '../audio/soundSystem.ts';

/** One pinned vanilla `S_StartSound` bridge invariant. */
export interface VanillaSoundCallbackBridgeInvariant {
  /** Stable ASCII-sortable identifier. */
  readonly id: string;
  /** Human-readable parity rule the bridge preserves. */
  readonly rule: string;
}

/**
 * Frozen manifest of the five parity rules every callback site
 * inherits by routing through the read-only `S_StartSound`
 * composition.  Ids are ASCII-sorted.
 */
export const VANILLA_SOUND_CALLBACK_BRIDGE_INVARIANTS: readonly VanillaSoundCallbackBridgeInvariant[] = Object.freeze([
  Object.freeze({
    id: 'LINK_VOLUME_EARLY_RETURN_PRECEDES_AUDIBILITY',
    rule: 'When sfxinfo_t.link is set the bridge adds sfx->volume and replaces pitch, returns link-silenced when the sum is below START_SOUND_LINK_MIN_VOLUME (1), and clamps back down to snd_SfxVolume — all before the remote-origin audibility work.',
  }),
  Object.freeze({
    id: 'PITCH_PERTURBATION_BY_SFX_CLASS',
    rule: 'The saw class adds 8 - (M_Random() & 15), the static class (sfx_itemup / sfx_tink) gets no perturbation and advances the RNG zero times, every other sfx adds 16 - (M_Random() & 31); the result is clamped to [PITCH_CLAMP_MIN 0, PITCH_CLAMP_MAX 255].',
  }),
  Object.freeze({
    id: 'REMOTE_ORIGIN_ADJUSTS_WITH_SAME_POSITION_NORM_SEP_OVERRIDE',
    rule: "A remote origin (origin !== null && origin !== listenerOrigin) routes through adjustSoundParams; a source at the listener's exact x/y forces separation = NORM_SEP before the audibility check, and an inaudible result drops the sound.",
  }),
  Object.freeze({
    id: 'SFX_ID_RANGE_INCLUDES_THE_NUMSFX_QUIRK',
    rule: 'sfxId must be an integer in [SFX_ID_MIN 1, SFX_ID_MAX = NUMSFX = 109]; out-of-range throws RangeError (vanilla I_Error). The inclusive upper bound preserves the vanilla `sfx_id <= NUMSFX` quirk that reads S_sfx[NUMSFX].',
  }),
  Object.freeze({
    id: 'STOP_THEN_ALLOCATE_CHANNEL_ORDER_IS_PRESERVED',
    rule: 'The bridge calls stopSound(origin) and then allocateChannel for the fresh slot; both calls are kept in that order even though the allocator would find the same origin-match on its own, and a null allocation returns no-channel.',
  }),
]);
