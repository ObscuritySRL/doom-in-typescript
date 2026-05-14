/**
 * Vanilla DOOM 1.9 sound shutdown ordering contract.
 *
 * From Chocolate Doom 2.2.1 i_sound.c I_ShutdownSound, i_music.c
 * I_ShutdownMusic, and d_main.c I_Quit:
 *
 *   The clean-shutdown order at exit (I_Quit -> shutdown chain) is:
 *
 *     1. I_StopSong(handle)        — halt the music driver scheduler.
 *     2. I_UnRegisterSong(handle)  — release the registered MUS data.
 *     3. I_ShutdownMusic()         — release the OPL device.
 *     4. For each active sfx channel: I_StopSound(handle) and
 *        S_StopChannel(cnum).
 *     5. I_ShutdownSound()         — release the wave audio device.
 *
 *   Music must shut down BEFORE sfx because the OPL driver writes to
 *   shared waveOut hardware that the sfx mixer also drives; reversing
 *   the order leaves a dangling music timer callback that fires after
 *   the audio device has been released.
 *
 *   Within sfx shutdown:
 *     - I_StopSound is called per-handle BEFORE I_ShutdownSound
 *       releases the driver.  This drains the in-flight hardware
 *       buffer of any sample that was queued during the previous
 *       I_UpdateSound tic; skipping the stop pass results in a tail
 *       of audible noise during the exit fade.
 *
 *   The shutdown chain is invoked at:
 *     - Normal quit (I_Quit -> M_QuitDoom confirm).
 *     - Fatal error (I_Error -> immediate teardown before atexit).
 *     - SIGINT / window close (mapped through I_Quit).
 */

export type VanillaSoundShutdownStep = 'I_StopSong' | 'I_UnRegisterSong' | 'I_ShutdownMusic' | 'I_StopSound-per-channel' | 'S_StopChannel-per-channel' | 'I_ShutdownSound';

export const VANILLA_SOUND_SHUTDOWN_ORDER: readonly VanillaSoundShutdownStep[] = Object.freeze(['I_StopSong', 'I_UnRegisterSong', 'I_ShutdownMusic', 'I_StopSound-per-channel', 'S_StopChannel-per-channel', 'I_ShutdownSound']);

export function vanillaSoundShutdownStepIndex(step: VanillaSoundShutdownStep): number {
  return VANILLA_SOUND_SHUTDOWN_ORDER.indexOf(step);
}

export function vanillaSoundShutdownStepPrecedes(earlier: VanillaSoundShutdownStep, later: VanillaSoundShutdownStep): boolean {
  return vanillaSoundShutdownStepIndex(earlier) < vanillaSoundShutdownStepIndex(later);
}
