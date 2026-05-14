/**
 * Vanilla DOOM 1.9 S_StopChannel eviction contract.
 *
 * From Chocolate Doom 2.2.1 s_sound.c S_StopChannel(cnum):
 *
 *   void S_StopChannel(int cnum) {
 *     int i;
 *     channel_t *c = &channels[cnum];
 *     if (c->sfxinfo) {
 *       I_StopSound(c->handle);
 *       // Check to see if other channels are playing the sound.
 *       for (i=0; i<snd_channels; i++)
 *         if (cnum != i && c->sfxinfo == channels[i].sfxinfo)
 *           break;
 *       // Degrade usefulness of sound data.
 *       c->sfxinfo->usefulness--;
 *       c->sfxinfo = NULL;
 *       c->origin = NULL;
 *     }
 *   }
 *
 *   The eviction sequence is:
 *     1. Stop the hardware handle via I_StopSound.
 *     2. Decrement sfxinfo->usefulness (DMX cache aging counter).
 *     3. Null out sfxinfo and origin (handle is left at its prior value
 *        but the null sfxinfo causes future passes to treat the slot
 *        as free).
 *
 *   Order matters: hardware stop FIRST, then usefulness decrement, then
 *   bookkeeping. A port that nulls sfxinfo before calling I_StopSound
 *   would skip the usefulness decrement and corrupt the cache aging.
 */

export type VanillaStopChannelStep = 'i-stop-sound' | 'decrement-usefulness' | 'null-sfxinfo' | 'null-origin';

export const VANILLA_STOP_CHANNEL_ORDER: readonly VanillaStopChannelStep[] = Object.freeze(['i-stop-sound', 'decrement-usefulness', 'null-sfxinfo', 'null-origin']);

export const VANILLA_STOP_CHANNEL_PRESERVES_HANDLE = true;

export interface VanillaStopChannelOutcome {
  readonly handleStopped: boolean;
  readonly usefulnessDecremented: boolean;
  readonly sfxInfoCleared: boolean;
  readonly originCleared: boolean;
}

export function applyVanillaStopChannel(slotIsOccupied: boolean): VanillaStopChannelOutcome {
  if (!slotIsOccupied) {
    return Object.freeze({ handleStopped: false, usefulnessDecremented: false, sfxInfoCleared: false, originCleared: false });
  }
  return Object.freeze({ handleStopped: true, usefulnessDecremented: true, sfxInfoCleared: true, originCleared: true });
}
