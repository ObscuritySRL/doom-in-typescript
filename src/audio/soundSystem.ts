/**
 * Per-frame sound start/stop/update composition (s_sound.c
 * `S_StartSound` + `S_StopSound` + `S_UpdateSounds`).
 *
 * Vanilla Doom routes every digital sfx request through a single
 * `S_StartSound(origin, sfx_id)` entry point that chains six ordered
 * steps before the hardware `I_StartSound` is even considered:
 *
 *  1. Validate `sfx_id` against `[1, NUMSFX]` (I_Error on failure —
 *     modelled here as a `RangeError`).
 *  2. Seed `volume = snd_SfxVolume` and `pitch = NORM_PITCH` from the
 *     global sfx volume slider / pitch baseline.
 *  3. When the sfx carries a `sfxinfo_t.link` row, add `sfx->volume`
 *     to `volume` and REPLACE `pitch` with `sfx->pitch`.  The call
 *     returns immediately when `volume < 1`, and clamps `volume` back
 *     down when it exceeds `snd_SfxVolume`.  The early-return fires
 *     BEFORE the audibility and origin-dedup work that follows —
 *     identical to the `S_UpdateSounds` link-stop precedence modelled
 *     in {@link ./soundOrigins.ts}.
 *  4. Remote origins (`origin && origin != listener`) go through
 *     {@link adjustSoundParams} for the distance/pan computation.
 *     Anonymous (`origin === null`) and self-originated (`origin
 *     === listener`) sounds skip the adjust call and take
 *     `separation = NORM_SEP` verbatim.  The vanilla same-position
 *     override runs BEFORE the audibility check and forces
 *     `separation = NORM_SEP` when the source sits at the listener's
 *     exact world position, even though `adjustSoundParams` would
 *     have returned `sep = NORM_SEP + 1` for that case (see F-154's
 *     off-by-one quirk).  An inaudible result aborts the start.
 *  5. Pitch perturbation: the saw family (`sfx_sawup` through
 *     `sfx_sawhit`) adds `8 - (M_Random() & 15)`; `sfx_itemup` and
 *     `sfx_tink` get NO perturbation; every other sfx adds `16 -
 *     (M_Random() & 31)`.  The result is clamped to `[0, 255]`
 *     before being handed to the mixer.
 *  6. Kill any existing sound from the same origin via
 *     {@link stopSound} and then {@link allocateChannel} for a fresh
 *     slot.  Vanilla keeps both calls even though `allocateChannel`
 *     would have found the same origin-match on its own — we preserve
 *     that sequence so an untyped extension of the allocator never
 *     changes the observable ordering.
 *
 * The chocolate-doom 2.2.1 reference is:
 *
 * ```c
 * void S_StartSound(void *origin_p, int sfx_id) {
 *     if (sfx_id < 1 || sfx_id > NUMSFX) I_Error(...);
 *     sfx = &S_sfx[sfx_id];
 *     pitch = NORM_PITCH;
 *     if (sfx->link) {
 *         volume += sfx->volume;
 *         pitch = sfx->pitch;
 *         if (volume < 1) return;
 *         if (volume > snd_SfxVolume) volume = snd_SfxVolume;
 *     }
 *     if (origin && origin != players[consoleplayer].mo) {
 *         rc = S_AdjustSoundParams(players[consoleplayer].mo, origin,
 *                                  &volume, &sep);
 *         if (origin->x == listener->x && origin->y == listener->y)
 *             sep = NORM_SEP;
 *         if (!rc) return;
 *     } else sep = NORM_SEP;
 *     if (sfx_id >= sfx_sawup && sfx_id <= sfx_sawhit)
 *         pitch += 8 - (M_Random() & 15);
 *     else if (sfx_id != sfx_itemup && sfx_id != sfx_tink)
 *         pitch += 16 - (M_Random() & 31);
 *     pitch = Clamp(pitch);
 *     S_StopSound(origin);
 *     cnum = S_GetChannel(origin, sfx);
 *     if (cnum < 0) return;
 *     channels[cnum].pitch = pitch;
 *     channels[cnum].handle = I_StartSound(sfx, cnum, volume, sep, pitch);
 * }
 * ```
 *
 * Parity-critical details preserved here:
 *
 *  - The link-silence early return fires BEFORE the audibility /
 *    origin-dedup block.  A link that zeros volume is a hard drop —
 *    the caller never calls adjust or allocate.
 *  - The same-position override runs BEFORE the audibility check
 *    (`if (!rc) return`).  Under vanilla the override is a dead
 *    store for non-audible sources, but we match the order so any
 *    future parity test that asserts "sep was forced to NORM_SEP"
 *    still sees the override in the started-action payload.
 *  - Pitch perturbation uses `mRandom()` (the non-deterministic menu
 *    stream), NOT `pRandom()`.  Demo parity tolerates menu RNG drift
 *    because sfx pitch does not propagate into the gameplay state —
 *    preserving the stream choice keeps the menu/demo isolation from
 *    step 04-007 intact.
 *  - `Clamp(x)` in i_sound.c clips the pitch to `[0, 255]` by
 *    returning `0` when `x < 0` and `255` when `x > 255`.  We inline
 *    the same bounds via {@link clampPitch}.
 *  - `S_StopSound(origin)` is called even though
 *    {@link allocateChannel} would have origin-matched on its own.
 *    Preserving both calls keeps the cnum selection deterministic
 *    when a port's allocator ever changes the origin-dedup branch.
 *  - Anonymous (`origin === null`) and self-originated sounds use
 *    `sep = NORM_SEP` WITHOUT calling adjust.  An adjust call for
 *    the listener's own weapon would re-pan the pistol every frame.
 *  - The allocator's `handle` default (0) is left in place; the host
 *    bridge writes the real hardware handle into
 *    `table.channels[cnum].handle` after `I_StartSound` returns.
 *    The started-action payload does NOT carry a handle because the
 *    handle does not exist until the bridge calls out.
 *
 * The module is pure: no Win32 bindings, no audio playback, no global
 * state.  The only mutation is on the caller-supplied
 * {@link ChannelTable} via {@link stopSound} and
 * {@link allocateChannel}.
 *
 * @example
 * ```ts
 * import { DoomRandom } from "../src/core/rng.ts";
 * import { createChannelTable, NORM_PRIORITY } from "../src/audio/channels.ts";
 * import { startSound, NUMSFX } from "../src/audio/soundSystem.ts";
 *
 * const table = createChannelTable();
 * const rng = new DoomRandom();
 * const result = startSound({
 *   sfxId: 1, // sfx_pistol
 *   priority: NORM_PRIORITY,
 *   pitchClass: "default",
 *   origin: 42,
 *   sourcePosition: { x: 0, y: 0 },
 *   listener: { x: 0, y: 0, angle: 0 },
 *   listenerOrigin: 1,
 *   sfxVolume: 15,
 *   isBossMap: false,
 *   linkVolumeAdjust: null,
 *   linkPitch: null,
 *   rng,
 *   table,
 * });
 * if (result.kind === "started") {
 *   // dispatch I_StartSound(sfxId, cnum, volume, separation, pitch)
 *   // then table.channels[result.cnum].handle = I_StartSound(...);
 * }
 * ```
 */

import type { DoomRandom } from '../core/rng.ts';
import type { ChannelTable } from './channels.ts';
import { NORM_PITCH, allocateChannel, stopSound } from './channels.ts';
import type { SpatialListener, SpatialSource } from './spatial.ts';
import { NORM_SEP, adjustSoundParams } from './spatial.ts';

/**
 * Vanilla `NUMSFX` (sounds.h) — the sfx-enum terminator used as the
 * inclusive upper bound of the valid `sfx_id` range.  Equals `109`
 * under Doom 1.9 (the enum runs `sfx_None` at 0, `sfx_pistol` at 1,
 * through `sfx_radio` at 108, and `NUMSFX` sits at 109).  The
 * vanilla validation `sfx_id < 1 || sfx_id > NUMSFX` accepts the
 * terminator value itself; the resulting `S_sfx[NUMSFX]` read is a
 * preserved vanilla quirk.
 */
export const NUMSFX = 109;

/** Inclusive lower bound of the valid `sfx_id` range (matches `> 0`). */
export const SFX_ID_MIN = 1;

/** Inclusive upper bound (matches vanilla `<= NUMSFX`, quirk included). */
export const SFX_ID_MAX = NUMSFX;

/**
 * Minimum post-link volume that survives the link-silence early
 * return.  Mirrors the soundOrigins.ts constant of the same purpose
 * so the start and update paths stay in lock-step.
 */
export const START_SOUND_LINK_MIN_VOLUME = 1;

/** Lower bound of the i_sound.c `Clamp` routine applied to pitch. */
export const PITCH_CLAMP_MIN = 0;

/** Upper bound of the i_sound.c `Clamp` routine applied to pitch. */
export const PITCH_CLAMP_MAX = 255;

/**
 * Pitch-perturbation classification for a given sfx id.  The caller
 * resolves this from the vanilla `sfx_id` ranges:
 *
 *  - `"saw"`   — `sfx_sawup` (10) through `sfx_sawhit` (13).
 *                Mask `15`, swing `±8`.
 *  - `"static"` — `sfx_itemup` (32) and `sfx_tink` (87).
 *                No perturbation (pitch stays at its link-or-norm
 *                value).
 *  - `"default"` — every other sfx.  Mask `31`, swing `±16`.
 */
export type SfxPitchClass = 'saw' | 'static' | 'default';

/** Inputs for {@link startSound}. */
export interface StartSoundRequest {
  /**
   * `sfx_id` in `[SFX_ID_MIN, SFX_ID_MAX]`.  Values outside the
   * range throw `RangeError`, matching vanilla's `I_Error` abort.
   */
  sfxId: number;

  /**
   * Vanilla `sfxinfo_t.priority` (lower = more important).  Passed
   * straight through to {@link allocateChannel}.
   */
  priority: number;

  /**
   * Pitch-perturbation class for this sfx.  Selects the saw mask
   * (`& 15`, swing `±8`), the static branch (no perturbation), or
   * the default mask (`& 31`, swing `±16`).
   */
  pitchClass: SfxPitchClass;

  /**
   * Opaque `mobj_t *` equivalent — `null` for anonymous (UI /
   * global) sounds.  An anonymous sound skips the audibility /
   * stereo branch and takes `separation = NORM_SEP`.
   */
  origin: number | null;

  /**
   * World-space position of the source mobj in fixed-point.
   * Required when the origin routes through {@link adjustSoundParams}
   * (remote origin — `origin !== null && origin !== listenerOrigin`).
   * Ignored for anonymous / self-originated sounds; the function
   * throws {@link TypeError} when a remote origin has no
   * `sourcePosition`.
   */
  sourcePosition: SpatialSource | null;

  /** Listener spatial snapshot (player mobj's x/y/angle). */
  listener: SpatialListener;

  /**
   * Origin id of the listener mobj, used by the pointer-equality
   * check that distinguishes remote from self-originated sounds.
   * Pass `null` when the caller has no listener mobj (rare —
   * vanilla always does) and any non-null `origin` therefore routes
   * through the adjust branch.
   */
  listenerOrigin: number | null;

  /**
   * `snd_SfxVolume` at the moment of the request.  Seeds the
   * pre-adjust `volume` and caps the clamp that follows the
   * `sfxinfo_t.link` adjustment.
   */
  sfxVolume: number;

  /**
   * `true` iff the current `gamemap === 8`.  Propagated to
   * {@link adjustSoundParams} so MAP08 sounds honour the
   * floor-of-15 distance branch.
   */
  isBossMap: boolean;

  /**
   * Vanilla `sfxinfo_t.volume` applied when `sfxinfo_t.link !== NULL`.
   * `null` when the sfx has no link (the common case).  When
   * non-null it is added to `sfxVolume`, and a result below
   * {@link START_SOUND_LINK_MIN_VOLUME} drops the sound entirely.
   */
  linkVolumeAdjust: number | null;

  /**
   * Vanilla `sfxinfo_t.pitch` applied when `sfxinfo_t.link !== NULL`.
   * When non-null it REPLACES the {@link NORM_PITCH} baseline before
   * the per-class perturbation runs.  `null` leaves the baseline in
   * place.
   */
  linkPitch: number | null;

  /**
   * Non-deterministic RNG stream used by the pitch perturbation.
   * The function advances {@link DoomRandom.mRandom} exactly once
   * for the saw and default classes, and zero times for the static
   * class — matching vanilla's `M_Random()` call site in s_sound.c.
   */
  rng: DoomRandom;

  /**
   * Channel table to mutate.  The function first calls
   * {@link stopSound} on the origin (a no-op when no matching slot
   * exists) and then {@link allocateChannel} for the fresh slot.
   */
  table: ChannelTable;
}

/**
 * Discriminator for {@link StartSoundResult} describing the exit
 * path of the request.  `"started"` is the only success token; the
 * other three correspond one-for-one with the three vanilla
 * early-returns (link-silenced, audibility failed, allocator refused).
 */
export type StartSoundResultKind = 'started' | 'link-silenced' | 'inaudible' | 'no-channel';

/**
 * Successful allocation result.  Carries everything the host bridge
 * needs to dispatch `I_StartSound(sfx, cnum, volume, separation,
 * pitch)` and then write the returned hardware handle back into
 * `table.channels[cnum].handle`.
 */
export interface StartSoundStartedResult {
  kind: 'started';

  /** Channel index chosen by the allocator. */
  cnum: number;

  /** Echo of `request.sfxId` — convenience for the dispatcher. */
  sfxId: number;

  /**
   * Per-channel mix volume.  Either `sfxVolume` (close-range or
   * anonymous/local fast path), the link-clamped value, or the
   * distance-attenuated `adjustSoundParams` result.
   */
  volume: number;

  /**
   * Stereo balance in `[MIN_STEREO_SEP, MAX_STEREO_SEP]` (or
   * {@link NORM_SEP} when the anonymous / local / same-position
   * paths force the center-pan override).
   */
  separation: number;

  /**
   * Clamped pitch in `[PITCH_CLAMP_MIN, PITCH_CLAMP_MAX]`.  Already
   * installed on `table.channels[cnum].pitch`.
   */
  pitch: number;
}

/** Tagged dropped-request result — no mixer action required. */
export interface StartSoundDroppedResult {
  kind: 'link-silenced' | 'inaudible' | 'no-channel';
}

/** Union of success + drop variants returned by {@link startSound}. */
export type StartSoundResult = StartSoundStartedResult | StartSoundDroppedResult;

function clampPitch(pitch: number): number {
  if (pitch < PITCH_CLAMP_MIN) {
    return PITCH_CLAMP_MIN;
  }
  if (pitch > PITCH_CLAMP_MAX) {
    return PITCH_CLAMP_MAX;
  }
  return pitch | 0;
}

function applyPitchPerturbation(pitch: number, pitchClass: SfxPitchClass, rng: DoomRandom): number {
  switch (pitchClass) {
    case 'saw':
      return pitch + (8 - (rng.mRandom() & 15));
    case 'default':
      return pitch + (16 - (rng.mRandom() & 31));
    case 'static':
      return pitch;
  }
}

/**
 * Compose one vanilla-equivalent `S_StartSound` call.  Mutates
 * `request.table` via {@link stopSound} and {@link allocateChannel}
 * and returns the dispatch action the caller forwards to
 * `I_StartSound`.
 *
 * The function is pure in its output: given the same {@link ChannelTable}
 * contents, the same {@link DoomRandom} state, and the same request,
 * it produces the same {@link StartSoundResult} and the same
 * post-call table state.
 *
 * @throws RangeError when `sfxId` is outside `[SFX_ID_MIN,
 *                    SFX_ID_MAX]`.
 * @throws TypeError  when the request routes through the remote
 *                    adjust branch but `sourcePosition` is `null`.
 */
export function startSound(request: StartSoundRequest): StartSoundResult {
  const { sfxId, priority, pitchClass, origin, sourcePosition, listener, listenerOrigin, sfxVolume, isBossMap, linkVolumeAdjust, linkPitch, rng, table } = request;

  if (!Number.isInteger(sfxId) || sfxId < SFX_ID_MIN || sfxId > SFX_ID_MAX) {
    throw new RangeError(`sfxId ${sfxId} is outside the valid range [${SFX_ID_MIN}, ${SFX_ID_MAX}]`);
  }

  // Preserve C pointer truthiness: numeric 0 is equivalent to NULL.
  const normalizedOrigin = origin === 0 ? null : origin;
  const normalizedListenerOrigin = listenerOrigin === 0 ? null : listenerOrigin;
  let volume = sfxVolume;
  let pitch = NORM_PITCH;

  if (linkVolumeAdjust !== null) {
    volume = volume + linkVolumeAdjust;
    if (linkPitch !== null) {
      pitch = linkPitch;
    }
    if (volume < START_SOUND_LINK_MIN_VOLUME) {
      return { kind: 'link-silenced' };
    }
    if (volume > sfxVolume) {
      volume = sfxVolume;
    }
  }

  let separation: number;
  const hasRemoteOrigin = normalizedOrigin !== null && normalizedOrigin !== normalizedListenerOrigin;

  if (hasRemoteOrigin) {
    if (sourcePosition === null) {
      throw new TypeError(`remote origin ${normalizedOrigin} requires sourcePosition but got null`);
    }

    const adjusted = adjustSoundParams({
      listener,
      source: sourcePosition,
      sfxVolume: volume,
      isBossMap,
    });

    separation = sourcePosition.x === listener.x && sourcePosition.y === listener.y ? NORM_SEP : adjusted.separation;

    if (!adjusted.audible) {
      return { kind: 'inaudible' };
    }

    volume = adjusted.volume;
  } else {
    separation = NORM_SEP;
  }

  pitch = clampPitch(applyPitchPerturbation(pitch, pitchClass, rng));

  stopSound(table, normalizedOrigin);

  const cnum = allocateChannel(table, {
    origin: normalizedOrigin,
    sfxId,
    priority,
    pitch,
  });

  if (cnum === null) {
    return { kind: 'no-channel' };
  }

  return {
    kind: 'started',
    cnum,
    sfxId,
    volume,
    separation,
    pitch,
  };
}
