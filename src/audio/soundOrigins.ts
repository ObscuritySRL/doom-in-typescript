/**
 * Per-tic sound-origin update pass (`S_UpdateSounds` in s_sound.c).
 *
 * Vanilla's `S_UpdateSounds(listener)` walks every slot in the
 * eight-entry channel table once per tic and does three things:
 *
 *  1. Reap any slot whose hardware handle has finished playing
 *     (`!I_SoundIsPlaying(c->handle)` branch → `S_StopChannel`).
 *  2. Apply the `sfxinfo_t.link` volume adjustment.  When
 *     `sfx->link != NULL` the baseline volume (`snd_SfxVolume`) is
 *     shifted by `sfx->volume`.  The resulting volume is stopped
 *     when `< 1` and clamped back to `snd_SfxVolume` when `>`.
 *  3. For slots whose origin is a remote mobj (non-null AND not the
 *     listener) recompute `(volume, separation)` via
 *     {@link adjustSoundParams} and either stop the channel when the
 *     sound is no longer audible or push the new params to the host
 *     mixer via `I_UpdateSoundParams`.  Anonymous (`origin === null`)
 *     and self-originated (`origin === listener`) sounds keep the
 *     volume and separation they were started with; the reference
 *     code loads the defaults at the top of the loop and then
 *     discards them when the `c->origin && listener != c->origin`
 *     guard fails, so the host mixer is never re-touched in that
 *     case.
 *
 * The chocolate-doom 2.2.1 reference body is:
 *
 * ```c
 * void S_UpdateSounds(mobj_t *listener) {
 *     I_UpdateSound();
 *     for (cnum=0; cnum<snd_channels; cnum++) {
 *         c = &channels[cnum];
 *         sfx = c->sfxinfo;
 *         if (c->sfxinfo) {
 *             if (I_SoundIsPlaying(c->handle)) {
 *                 volume = snd_SfxVolume;
 *                 sep = NORM_SEP;
 *                 if (sfx->link) {
 *                     volume += sfx->volume;
 *                     if (volume < 1) { S_StopChannel(cnum); continue; }
 *                     else if (volume > snd_SfxVolume) volume = snd_SfxVolume;
 *                 }
 *                 if (c->origin && listener != c->origin) {
 *                     audible = S_AdjustSoundParams(listener, c->origin,
 *                                                   &volume, &sep);
 *                     if (!audible) S_StopChannel(cnum);
 *                     else I_UpdateSoundParams(c->handle, volume, sep);
 *                 }
 *             }
 *             else S_StopChannel(cnum);
 *         }
 *     }
 * }
 * ```
 *
 * Parity-critical details preserved here:
 *
 *  - The per-channel volume/sep baselines are (re)computed from
 *    `snd_SfxVolume` and {@link NORM_SEP} at every iteration.  The
 *    `sfx->link` branch can STOP a channel even when the origin is
 *    anonymous or local — the `continue` fires before the origin
 *    check — so a link that pushes volume `< 1` is a hard kill.
 *  - The origin guard is `c->origin && listener != c->origin`.
 *    `origin === null` slots (UI sounds, ENDOOM, intermission cues)
 *    never go through `adjustSoundParams`.  Slots whose `origin`
 *    equals the listener (the player's own weapon, pain, land
 *    sounds) also skip the adjust call — they keep the initial
 *    full-volume / centred-pan parameters supplied at
 *    `S_StartSoundAtVolume` time.  A port that always calls
 *    adjust would re-pan the player's own footsteps every tic.
 *  - When the handle reports not-playing, vanilla calls
 *    `S_StopChannel` unconditionally — even if the slot was only
 *    just allocated this tic and the mixer hasn't wound up yet.
 *    Our {@link updateSounds} produces the same `kind: "stop"`
 *    action, and the caller is responsible for the
 *    `I_StopSound(handle)` bridge.
 *  - The `stopChannel` side-effect on the shared {@link ChannelTable}
 *    matters: once a slot is freed in the update pass, the next
 *    `S_StartSound` request in the same frame can reuse it.  This
 *    mirrors vanilla's shared-global channels array.  The returned
 *    action list preserves the original `handle` so the host layer
 *    can dispatch `I_StopSound(oldHandle)` even after the slot has
 *    been cleared.
 *  - The link-volume `< 1` early-stop uses strict `<` (not `<=`) per
 *    vanilla.  A link that zeroes volume exactly is therefore also a
 *    stop because `volume < 1` — the ≥1 branch requires a positive
 *    integer.
 *  - The clamp direction is `> snd_SfxVolume` — it preserves
 *    `snd_SfxVolume` itself as a valid value.  A link that produces
 *    `volume = snd_SfxVolume` exactly passes through unclamped.
 *
 * `I_UpdateSound` (the first line of the vanilla function) is a
 * host bookkeeping hook (SDL_mixer queue pump in chocolate-doom).
 * It has no simulation-visible state change, so it is not modelled
 * here; the host bridge (future step) calls it before invoking
 * {@link updateSounds}.
 *
 * The module is pure: no Win32 bindings, no audio playback, no
 * global mutable state.  The only mutation is on the passed-in
 * {@link ChannelTable} via {@link stopChannel}, matching the
 * existing {@link allocateChannel} contract.
 *
 * @example
 * ```ts
 * import { createChannelTable, allocateChannel } from "../src/audio/channels.ts";
 * import { updateSounds } from "../src/audio/soundOrigins.ts";
 *
 * const table = createChannelTable();
 * allocateChannel(table, { origin: 42, sfxId: SFX_PISTOL, priority: 64, handle: 17 });
 *
 * const actions = updateSounds({
 *   table,
 *   listener:        { x: 0, y: 0, angle: 0 },
 *   listenerOrigin:  1, // player mobj id
 *   sfxVolume:       15,
 *   isBossMap:       false,
 *   channelState: [
 *     { isPlaying: true, sourcePosition: { x: 500 * FRACUNIT, y: 0 }, linkVolumeAdjust: null },
 *     // ... one entry per channel
 *   ],
 * });
 * // actions = [{ kind: "update-params", cnum: 0, handle: 17, volume: ..., separation: ... }]
 * ```
 */

import type { ChannelTable } from './channels.ts';
import { stopChannel } from './channels.ts';
import type { SpatialListener, SpatialSource } from './spatial.ts';
import { NORM_SEP, adjustSoundParams } from './spatial.ts';

/**
 * Minimum post-link volume that lets a channel keep playing.  The
 * vanilla guard is `if (volume < 1) S_StopChannel(cnum);` so `1` is
 * the smallest value that survives.
 */
export const SOUND_UPDATE_LINK_MIN_VOLUME = 1;

/**
 * Per-channel state sampled from the host and world at the start of
 * each tic's update pass.  The caller populates one entry per slot
 * in {@link ChannelTable.channels} (index-aligned with `cnum`).
 * Entries for free slots (`channel.sfxId === null`) are ignored and
 * may contain any values — the update pass never reads them.
 */
export interface ChannelUpdateState {
  /**
   * Vanilla `I_SoundIsPlaying(c->handle)` — `true` when the host
   * mixer still has audio queued for this channel's handle, `false`
   * when it has finished and the slot should be reaped.
   */
  isPlaying: boolean;

  /**
   * Current world position of the channel's origin mobj in
   * fixed-point, or `null` when the slot's origin is anonymous
   * (`channel.origin === null`) or equal to the listener origin.
   * Required iff the slot has a remote origin; the update pass
   * throws when the slot is remote but no position is supplied.
   */
  sourcePosition: SpatialSource | null;

  /**
   * Vanilla `sfxinfo_t.volume` applied when `sfxinfo_t.link !== NULL`.
   * `null` when the sfx has no link (the common case — most DS\*
   * sounds in DOOM1.WAD carry `link = NULL`).  When non-null the
   * value is added to `snd_SfxVolume` before the origin branch
   * runs; a negative value reduces the baseline and may trigger the
   * `volume < 1` early-stop.
   */
  linkVolumeAdjust: number | null;
}

/**
 * Discriminator for {@link SoundUpdateAction} produced by
 * {@link updateSounds}.  `"stop"` corresponds to vanilla
 * `S_StopChannel(cnum)` (the host must call `I_StopSound(handle)`);
 * `"update-params"` corresponds to vanilla
 * `I_UpdateSoundParams(handle, volume, sep)`.
 */
export type SoundUpdateActionKind = 'stop' | 'update-params';

/**
 * One host-side effect produced by {@link updateSounds} for a single
 * channel.  Actions appear in ascending `cnum` order and never
 * duplicate — at most one action per channel per update pass.
 */
export interface SoundUpdateAction {
  /** Which of the two vanilla bridges this action maps to. */
  kind: SoundUpdateActionKind;

  /** Channel index in `table.channels` that produced the action. */
  cnum: number;

  /**
   * Opaque hardware handle carried over from the slot BEFORE
   * {@link stopChannel} cleared it.  Host layers call
   * `I_StopSound(handle)` for `"stop"` and
   * `I_UpdateSoundParams(handle, volume, separation)` for
   * `"update-params"`.
   */
  handle: number;

  /** Present only when `kind === "update-params"`. */
  volume?: number;

  /** Present only when `kind === "update-params"`. */
  separation?: number;
}

/** Inputs for {@link updateSounds}. */
export interface UpdateSoundsRequest {
  /**
   * Channel table to update.  Mutated in place: any slot that
   * produces a `"stop"` action is cleared to free state before the
   * function returns, matching vanilla's shared `channels[]` array.
   */
  table: ChannelTable;

  /**
   * Listener spatial snapshot (the player mobj's x/y/angle).
   * Consumed verbatim by {@link adjustSoundParams} for remote
   * origins.
   */
  listener: SpatialListener;

  /**
   * Origin id of the listener mobj, used by the `listener != c->origin`
   * pointer-equality check.  Pass `null` when the caller has no
   * listener mobj (rare — vanilla always does).  A `null` value
   * routes every non-null origin through the adjust branch because
   * `channel.origin !== null && channel.origin !== null` is vacuously
   * `channel.origin !== null`.
   */
  listenerOrigin: number | null;

  /**
   * `snd_SfxVolume` at the start of the tic.  Used as the volume
   * baseline before the `sfx->link` adjustment and as the ceiling
   * for the post-link clamp.  Typical vanilla range is `0..15`.
   */
  sfxVolume: number;

  /**
   * `true` iff the current `gamemap === 8`.  Propagated to
   * {@link adjustSoundParams} so MAP08 sounds honour the
   * floor-of-15 distance branch.
   */
  isBossMap: boolean;

  /**
   * Per-channel state sampled from the host / world.  Length MUST
   * equal `table.capacity`; the function throws otherwise.
   */
  channelState: ChannelUpdateState[];
}

/**
 * Run one tic of the vanilla `S_UpdateSounds` pass.  Mutates
 * `request.table` in place (freeing any slot that stops playing or
 * becomes inaudible) and returns the ordered list of host-side
 * actions the caller must dispatch — `I_StopSound` for
 * `kind: "stop"` entries and `I_UpdateSoundParams` for
 * `kind: "update-params"` entries.
 *
 * Returns an empty array when every slot is free or every occupied
 * slot is anonymous/local with `isPlaying === true` and no
 * `sfx->link` adjustment.
 *
 * @throws RangeError when `channelState.length !== table.capacity`.
 * @throws TypeError  when a remote channel
 *                    (`channel.origin !== null && channel.origin !== listenerOrigin`)
 *                    has no `sourcePosition` supplied.
 */
export function updateSounds(request: UpdateSoundsRequest): SoundUpdateAction[] {
  const { table, listener, listenerOrigin, sfxVolume, isBossMap, channelState } = request;

  if (channelState.length !== table.capacity) {
    throw new RangeError(`channelState length ${channelState.length} does not match table capacity ${table.capacity}`);
  }

  const actions: SoundUpdateAction[] = [];

  for (let cnum = 0; cnum < table.capacity; cnum++) {
    const channel = table.channels[cnum]!;
    if (channel.sfxId === null) {
      continue;
    }

    const state = channelState[cnum]!;
    const handle = channel.handle;

    if (!state.isPlaying) {
      stopChannel(table, cnum);
      actions.push({ kind: 'stop', cnum, handle });
      continue;
    }

    let volume = sfxVolume;

    if (state.linkVolumeAdjust !== null) {
      volume = volume + state.linkVolumeAdjust;
      if (volume < SOUND_UPDATE_LINK_MIN_VOLUME) {
        stopChannel(table, cnum);
        actions.push({ kind: 'stop', cnum, handle });
        continue;
      }
      if (volume > sfxVolume) {
        volume = sfxVolume;
      }
    }

    const hasRemoteOrigin = channel.origin !== null && channel.origin !== listenerOrigin;
    if (!hasRemoteOrigin) {
      continue;
    }

    if (state.sourcePosition === null) {
      throw new TypeError(`channel ${cnum} has remote origin ${channel.origin} but sourcePosition is null`);
    }

    const result = adjustSoundParams({
      listener,
      source: state.sourcePosition,
      sfxVolume: volume,
      isBossMap,
    });

    if (!result.audible) {
      stopChannel(table, cnum);
      actions.push({ kind: 'stop', cnum, handle });
      continue;
    }

    actions.push({
      kind: 'update-params',
      cnum,
      handle,
      volume: result.volume,
      separation: result.separation,
    });
  }

  return actions;
}

/**
 * Build a {@link ChannelUpdateState} for every slot in `table` by
 * invoking `resolve(cnum)` once per index.  Convenience wrapper for
 * callers that keep per-channel origin state in a map or registry;
 * pure helper that does no I/O of its own.
 */
export function buildChannelUpdateStates(table: ChannelTable, resolve: (cnum: number) => ChannelUpdateState): ChannelUpdateState[] {
  const states: ChannelUpdateState[] = [];
  for (let cnum = 0; cnum < table.capacity; cnum++) {
    states.push(resolve(cnum));
  }
  return states;
}

/**
 * Silence placeholder returned by default for free slots.  Exported
 * so callers can plug it into {@link buildChannelUpdateStates} when
 * they only track state for occupied slots; the update pass ignores
 * the entry unless the slot is occupied.
 */
export const CHANNEL_UPDATE_STATE_UNUSED: Readonly<ChannelUpdateState> = Object.freeze({
  isPlaying: false,
  sourcePosition: null,
  linkVolumeAdjust: null,
});
