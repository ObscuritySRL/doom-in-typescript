/**
 * Vanilla DOOM 1.9 sound priority arbitration contract.
 *
 * From Chocolate Doom 2.2.1 s_sound.c S_StartSoundAtVolume / S_getChannel:
 *
 *   sfxinfo_t carries a numeric `priority` field. Lower numeric values
 *   mean MORE important. When all channels are occupied, S_getChannel
 *   walks the channel table and evicts the channel whose currently
 *   playing sfx has the LARGEST priority value (least important).
 *
 *   The arbitration excerpt:
 *     // Find the lowest priority active sound and replace it.
 *     for (i=0; i<numChannels; i++)
 *       if (channels[i].sfxinfo->priority >= sfxinfo->priority)
 *         break;
 *     if (i >= numChannels)
 *       return -1;  // new sound is lower priority than all active sounds, drop it
 *
 *   Tied priorities mean the iteration order through the channel table
 *   selects the first channel encountered.  An incoming sound that is
 *   strictly higher priority (smaller value) than every active channel
 *   is dropped — there is no preemption-by-equal-priority.
 *
 *   Vanilla NORM_PRIORITY = 64 (sounds.c S_sfx[] entries for pistol,
 *   shotgun, chaingun, plasma, bfg, sawup, sawhit, sawful, rlaunc, punch,
 *   chgun all use the NORM_PRIORITY baseline). Priorities above 64 are
 *   ambient/low-importance (e.g. sawidle, stnmov, posact ~118-120); the
 *   high-importance death/teleport sounds use ~32.
 */

export const VANILLA_NORM_PRIORITY = 64;

export const VANILLA_PRIORITY_ARBITRATION_RULE = 'lower-number-wins' as const;

export const VANILLA_NEW_SOUND_DROP_RULE = 'reject-if-priority-strictly-larger-than-all-active' as const;

export interface SoundPriorityArbitrationInput {
  readonly incomingPriority: number;
  readonly activeChannelPriorities: readonly number[];
}

export interface SoundPriorityArbitrationDecision {
  readonly evictChannelIndex: number | null;
  readonly drop: boolean;
}

export function arbitrateVanillaSoundPriority(input: SoundPriorityArbitrationInput): SoundPriorityArbitrationDecision {
  const { incomingPriority, activeChannelPriorities } = input;
  for (let channelIndex = 0; channelIndex < activeChannelPriorities.length; channelIndex += 1) {
    const activePriority = activeChannelPriorities[channelIndex]!;
    if (activePriority >= incomingPriority) {
      return Object.freeze({ evictChannelIndex: channelIndex, drop: false });
    }
  }
  return Object.freeze({ evictChannelIndex: null, drop: true });
}
