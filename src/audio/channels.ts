/**
 * Eight-channel SFX allocator (s_sound.c `S_GetChannel` / `S_StopChannel`
 * / `S_StopSound`).
 *
 * Vanilla Doom mixes at most `snd_channels = 8` simultaneous digital
 * sound effects.  Each slot is a {@link Channel} that either holds a
 * playing sfx (with its sfx id, origin handle, priority, hardware
 * handle, and pitch) or is free (all fields cleared and `sfxId` is
 * `null`).  The allocator coordinates four operations:
 *
 *  1. Pick a free slot when one is available.
 *  2. Stop and reuse a slot when the same `origin` already has a sound
 *     playing — vanilla guarantees one channel per origin.
 *  3. Evict the first slot whose currently playing sfx has a priority
 *     value `>=` the incoming sfx priority — i.e. an equally- or
 *     less-important sound — to make room for the new one.
 *  4. Refuse the request (`null` return) if every slot is occupied by
 *     a strictly more important sound.
 *
 * The chocolate-doom 2.2.1 reference loops this way:
 *
 * ```c
 * for (cnum=0 ; cnum<snd_channels ; cnum++) {
 *     if (!channels[cnum].sfxinfo) break;
 *     else if (origin && channels[cnum].origin == origin) {
 *         S_StopChannel(cnum); break;
 *     }
 * }
 * if (cnum == snd_channels) {
 *     for (cnum=0 ; cnum<snd_channels ; cnum++)
 *         if (channels[cnum].sfxinfo->priority >= sfxinfo->priority) break;
 *     if (cnum == snd_channels) return -1;
 *     else S_StopChannel(cnum);
 * }
 * ```
 *
 * Parity-critical details preserved here:
 *
 *  - `priority` is INVERTED: lower numeric value means a more important
 *    sound (e.g. `telept = 32` is more important than `pistol = 64`).
 *    The `>=` test therefore evicts equally- or less-important
 *    channels.  Equal-priority kicks are allowed by design (a second
 *    pistol shot can boot the first when all eight slots are pistols).
 *  - The first loop short-circuits on the FIRST origin match and stops
 *    that channel, mirroring the `break` in `S_GetChannel`.  An
 *    `origin === null` request never matches the origin branch, so
 *    multiple anonymous (UI / global) sounds can stack in different
 *    slots.
 *  - The eviction loop searches by ascending channel index and breaks
 *    on the first eligible victim, matching the deterministic vanilla
 *    selection order.
 *  - Stopping a slot clears `sfxId`, `origin`, `priority`, `handle`,
 *    and `pitch` to their free-state defaults so the next allocation
 *    sees a clean slot.  `S_StopChannel`'s `usefulness--` bookkeeping
 *    on the sfxinfo is the caller's concern (handled by the sfx
 *    cache, see step 15-001) and is not modeled here.
 *
 * The module is pure: no Win32 bindings, no audio playback, no global
 * mutable state.  Each {@link ChannelTable} is an isolated object with
 * its own backing array.  Hardware mixer integration is the concern of
 * later steps (15-006 mixer, 15-011 music device).
 *
 * @example
 * ```ts
 * import { createChannelTable, allocateChannel, stopSound } from "../src/audio/channels.ts";
 *
 * const table = createChannelTable();
 * const cnum = allocateChannel(table, { origin: 42, sfxId: SFX_PISTOL, priority: 64 });
 * // cnum === 0, table.channels[0] = { sfxId, origin: 42, priority: 64, ... }
 * stopSound(table, 42); // frees the slot
 * ```
 */

/** Vanilla `snd_channels` default — eight simultaneous digital sfx. */
export const NUM_CHANNELS = 8;

/** Sentinel `sfxId` for an unoccupied channel slot. */
export const CHANNEL_FREE_SFX: null = null;

/** Sentinel `origin` for an anonymous (UI / global) sound. */
export const CHANNEL_NO_ORIGIN: null = null;

/** Default `handle` for a free slot (vanilla resets the handle on stop). */
export const CHANNEL_FREE_HANDLE = 0;

/** Default `priority` for a free slot. */
export const CHANNEL_FREE_PRIORITY = 0;

/** Default `pitch` for a free slot. */
export const CHANNEL_FREE_PITCH = 0;

/** Vanilla `NORM_PRIORITY` baseline used by most sfx (e.g. pistol, shotgun). */
export const NORM_PRIORITY = 64;

/** Vanilla `NORM_PITCH` baseline (mid-range pitch wheel value). */
export const NORM_PITCH = 128;

/**
 * One slot in the {@link ChannelTable}.  A slot is "free" when
 * {@link Channel.sfxId} is `null`; the remaining fields then hold their
 * `CHANNEL_FREE_*` defaults.
 */
export interface Channel {
  /** Vanilla `channel_t.sfxinfo` reduced to a numeric sfx id. `null` when free. */
  sfxId: number | null;

  /**
   * Opaque caller-supplied identifier for the sound's origin (`mobj_t *`
   * in vanilla).  `null` indicates an anonymous sound that does not
   * participate in origin-based dedup.
   */
  origin: number | null;

  /** Cached `sfxinfo->priority` for the playing sound (lower value = more important). */
  priority: number;

  /** Hardware mixer handle from `I_StartSound`.  `0` when free. */
  handle: number;

  /** Pitch wheel value from `S_StartSound`'s pitch perturbation. */
  pitch: number;
}

/**
 * Fixed-size collection of {@link Channel} slots backing the SFX
 * mixer.  `capacity` matches vanilla `snd_channels` (default 8) and is
 * fixed at construction time.
 */
export interface ChannelTable {
  /** Mutable slot array, length === `capacity`. */
  readonly channels: Channel[];

  /** Number of slots; matches vanilla `snd_channels`. */
  readonly capacity: number;
}

/** Request payload for {@link allocateChannel}. */
export interface AllocateChannelRequest {
  /** `mobj_t *` equivalent.  `null` skips origin-based dedup. */
  origin: number | null;

  /** Numeric sfx id (e.g. one of the `SFX_*` constants in the source catalog). */
  sfxId: number;

  /** Vanilla `sfxinfo->priority` (lower = more important). */
  priority: number;

  /** Optional hardware handle to install in the slot.  Defaults to `CHANNEL_FREE_HANDLE`. */
  handle?: number;

  /** Optional pitch value to install in the slot.  Defaults to `NORM_PITCH`. */
  pitch?: number;
}

function makeFreeChannel(): Channel {
  return {
    sfxId: CHANNEL_FREE_SFX,
    origin: CHANNEL_NO_ORIGIN,
    priority: CHANNEL_FREE_PRIORITY,
    handle: CHANNEL_FREE_HANDLE,
    pitch: CHANNEL_FREE_PITCH,
  };
}

function clearChannelSlot(channel: Channel): void {
  channel.sfxId = CHANNEL_FREE_SFX;
  channel.origin = CHANNEL_NO_ORIGIN;
  channel.priority = CHANNEL_FREE_PRIORITY;
  channel.handle = CHANNEL_FREE_HANDLE;
  channel.pitch = CHANNEL_FREE_PITCH;
}

/**
 * Construct a fresh {@link ChannelTable} with `capacity` free slots.
 *
 * @param capacity - Number of mixer slots.  Must be `>= 1`.  Defaults
 *   to {@link NUM_CHANNELS} (vanilla 8).
 */
export function createChannelTable(capacity: number = NUM_CHANNELS): ChannelTable {
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new RangeError(`channel table capacity must be a positive integer, got ${capacity}`);
  }

  const channels: Channel[] = [];
  for (let i = 0; i < capacity; i++) {
    channels.push(makeFreeChannel());
  }

  return {
    channels,
    capacity,
  };
}

/** True iff the slot has no playing sound (`sfxId === null`). */
export function isChannelFree(channel: Channel): boolean {
  return channel.sfxId === CHANNEL_FREE_SFX;
}

/**
 * Index of the first free slot, or `null` if every slot is occupied.
 * Mirrors the `if (!channels[cnum].sfxinfo) break;` branch of
 * `S_GetChannel`.
 */
export function findFreeChannel(table: ChannelTable): number | null {
  for (let cnum = 0; cnum < table.capacity; cnum++) {
    if (isChannelFree(table.channels[cnum]!)) {
      return cnum;
    }
  }
  return null;
}

/**
 * Index of the first slot whose `origin` matches the supplied value.
 * Returns `null` when nothing matches OR when `origin` is `null` —
 * vanilla guards origin dedup with `if (origin && ...)`.
 */
export function findChannelByOrigin(table: ChannelTable, origin: number | null): number | null {
  if (origin === null) {
    return null;
  }
  for (let cnum = 0; cnum < table.capacity; cnum++) {
    const channel = table.channels[cnum]!;
    if (!isChannelFree(channel) && channel.origin === origin) {
      return cnum;
    }
  }
  return null;
}

/**
 * Index of the first OCCUPIED slot whose currently playing sfx is
 * evictable for a new sound at the requested `priority`.  A slot is
 * evictable when `channel.priority >= priority` — i.e. its current
 * sound is equally- or less-important than the incoming one.  Free
 * slots are skipped (vanilla `S_GetChannel`'s eviction loop only runs
 * when the free-slot loop already failed).  Returns `null` when every
 * occupied slot holds a strictly more-important sound, or when the
 * table is empty of occupied slots.
 */
export function findEvictableChannel(table: ChannelTable, priority: number): number | null {
  for (let cnum = 0; cnum < table.capacity; cnum++) {
    const channel = table.channels[cnum]!;
    if (isChannelFree(channel)) {
      continue;
    }
    if (channel.priority >= priority) {
      return cnum;
    }
  }
  return null;
}

/**
 * Stop the channel at index `cnum`, clearing all slot fields back to
 * their free-state defaults.  No-op when the slot is already free or
 * when `cnum` is out of range.  Mirrors `S_StopChannel`.
 */
export function stopChannel(table: ChannelTable, cnum: number): void {
  if (cnum < 0 || cnum >= table.capacity) {
    return;
  }
  const channel = table.channels[cnum]!;
  if (isChannelFree(channel)) {
    return;
  }
  clearChannelSlot(channel);
}

/**
 * Stop the first channel matching `origin` and return its index, or
 * `null` when no slot matches.  Returns `null` immediately when
 * `origin` is `null` (anonymous sounds are not deduped).  Mirrors
 * `S_StopSound`'s `for/break` scan.
 */
export function stopSound(table: ChannelTable, origin: number | null): number | null {
  const cnum = findChannelByOrigin(table, origin);
  if (cnum === null) {
    return null;
  }
  clearChannelSlot(table.channels[cnum]!);
  return cnum;
}

/**
 * Allocate a slot for a new sfx using the vanilla `S_GetChannel`
 * algorithm.  Returns the chosen channel index, or `null` when every
 * slot holds a strictly more-important sound.
 *
 * Algorithm (matches s_sound.c verbatim):
 *
 *  1. Scan slots in order: the first free slot wins; an origin-match
 *     wins by stopping that slot and reusing it.
 *  2. If neither succeeded, scan again for the first slot whose
 *     `priority >= request.priority` and evict it.
 *  3. If no slot is evictable, return `null` (vanilla `-1`).
 *  4. Populate the chosen slot with `sfxId`, `origin`, `priority`,
 *     `handle` (default {@link CHANNEL_FREE_HANDLE}), and `pitch`
 *     (default {@link NORM_PITCH}).
 */
export function allocateChannel(table: ChannelTable, request: AllocateChannelRequest): number | null {
  let cnum: number | null = null;

  for (let i = 0; i < table.capacity; i++) {
    const channel = table.channels[i]!;
    if (isChannelFree(channel)) {
      cnum = i;
      break;
    }
    if (request.origin !== null && channel.origin === request.origin) {
      clearChannelSlot(channel);
      cnum = i;
      break;
    }
  }

  if (cnum === null) {
    for (let i = 0; i < table.capacity; i++) {
      const channel = table.channels[i]!;
      if (channel.priority >= request.priority) {
        clearChannelSlot(channel);
        cnum = i;
        break;
      }
    }
  }

  if (cnum === null) {
    return null;
  }

  const slot = table.channels[cnum]!;
  slot.sfxId = request.sfxId;
  slot.origin = request.origin;
  slot.priority = request.priority;
  slot.handle = request.handle ?? CHANNEL_FREE_HANDLE;
  slot.pitch = request.pitch ?? NORM_PITCH;
  return cnum;
}

/** Number of currently occupied slots. */
export function getOccupiedChannelCount(table: ChannelTable): number {
  let count = 0;
  for (let cnum = 0; cnum < table.capacity; cnum++) {
    if (!isChannelFree(table.channels[cnum]!)) {
      count++;
    }
  }
  return count;
}
