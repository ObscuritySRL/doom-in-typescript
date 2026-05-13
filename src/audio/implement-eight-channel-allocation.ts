/**
 * Vanilla DOOM 1.9 eight-channel sfx allocation contract.
 *
 * From Chocolate Doom 2.2.1 src/s_sound.c S_GetChannel and S_Init:
 *
 *   snd_channels defaults to 8 (configurable, but the vanilla / shareware
 *   build runs with 8 simultaneous digital sfx mixed at any moment).
 *
 *   channels[] is allocated once with snd_channels entries and never
 *   resized at runtime. Each slot is a channel_t that holds an sfxinfo*,
 *   an origin (mobj_t* equivalent), a hardware handle, and a pitch.
 *
 *   S_GetChannel (the slot-picking algorithm):
 *
 *     // Pass 1: pick a free slot, or stop+reuse a same-origin slot.
 *     for (cnum=0; cnum<snd_channels; cnum++) {
 *       if (!channels[cnum].sfxinfo) break;          // free
 *       else if (origin && channels[cnum].origin == origin) {
 *         S_StopChannel(cnum); break;                // same origin -> reuse
 *       }
 *     }
 *
 *     // Pass 2: priority eviction.
 *     if (cnum == snd_channels) {
 *       for (cnum=0; cnum<snd_channels; cnum++)
 *         if (channels[cnum].sfxinfo->priority >= sfxinfo->priority)
 *           break;
 *       if (cnum == snd_channels) return -1;          // drop
 *       else S_StopChannel(cnum);
 *     }
 *
 *   Ordering invariants:
 *     - Channel indices scan ascending (0..N-1) in BOTH passes.
 *     - First pass short-circuits on the first free slot OR first origin
 *       match; `origin == null` requests skip the origin branch entirely
 *       and so multiple anonymous (UI / global) sounds stack across free
 *       slots without origin dedup.
 *     - Second pass picks the FIRST slot whose currently-playing priority
 *       is `>=` the incoming priority (equal allowed -> ties evict).
 */

export const VANILLA_SND_CHANNELS_DEFAULT = 8;

export const VANILLA_CHANNEL_TABLE_INITIAL_INDEX = 0;

export const VANILLA_GET_CHANNEL_DROP_SENTINEL = -1;

export interface VanillaChannelSnapshot {
  /** Sfx id occupying the slot, or null when free. */
  readonly sfxId: number | null;
  /** Origin (mobj* equivalent) for the slot, or null for anonymous sounds. */
  readonly origin: number | null;
  /** Cached sfxinfo->priority for the playing sound. */
  readonly priority: number;
}

export interface VanillaChannelAllocationRequest {
  readonly channels: readonly VanillaChannelSnapshot[];
  readonly incomingOrigin: number | null;
  readonly incomingPriority: number;
}

export type VanillaChannelAllocationOutcome =
  | { readonly kind: 'free'; readonly channelIndex: number }
  | { readonly kind: 'reuse-origin'; readonly channelIndex: number }
  | { readonly kind: 'evict-priority'; readonly channelIndex: number }
  | { readonly kind: 'drop' };

/**
 * Models S_GetChannel's two-pass slot selection. Returns the channel index
 * (and how it was reached) or `{ kind: 'drop' }` when every slot is occupied
 * by a strictly more important sound.
 */
export function vanillaGetChannel(input: VanillaChannelAllocationRequest): VanillaChannelAllocationOutcome {
  const { channels, incomingOrigin, incomingPriority } = input;
  for (let channelIndex = 0; channelIndex < channels.length; channelIndex += 1) {
    const slot = channels[channelIndex]!;
    if (slot.sfxId === null) {
      return Object.freeze({ kind: 'free' as const, channelIndex });
    }
    if (incomingOrigin !== null && slot.origin === incomingOrigin) {
      return Object.freeze({ kind: 'reuse-origin' as const, channelIndex });
    }
  }
  for (let channelIndex = 0; channelIndex < channels.length; channelIndex += 1) {
    const slot = channels[channelIndex]!;
    if (slot.priority >= incomingPriority) {
      return Object.freeze({ kind: 'evict-priority' as const, channelIndex });
    }
  }
  return Object.freeze({ kind: 'drop' as const });
}
