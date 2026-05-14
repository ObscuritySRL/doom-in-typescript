/**
 * Vanilla DOOM 1.9 MUS scheduler contract pin.
 *
 * From Chocolate Doom 2.2.1 mus2mid.c (the only authoritative MUS
 * scheduler shipped with id source) and the matching i_music.c driver:
 *
 *   MUS scores tick at 140 Hz (MUS_TICK_HZ). DOOM gameplay ticks at
 *   35 Hz. The music system advances by exactly 4 MUS quickticks per
 *   gametic so a single quartertic of music advances per gameplay tic.
 *
 *   Per-channel velocity cache (channelvelocities[16]):
 *     - 16 entries, one per MUS channel (0..15; 15 is percussion).
 *     - Seeded with MUS_DEFAULT_VELOCITY (127) at score start. Vanilla
 *       does not reset the cache between maps or loops; a track that
 *       drops the explicit-velocity bit on its first play-note still
 *       sounds audible because the cache is 127.
 *     - On every play-note WITH the velocity bit set (note byte bit 7),
 *       the second body byte updates channelvelocities[channel].
 *     - On every play-note WITHOUT the velocity bit, the dispatched
 *       event reuses the current channelvelocities[channel] value.
 *
 *   Tick advancement:
 *     - Each call to "advance" subtracts the requested quicktick count
 *       from the residual delay until residual hits 0; then the next
 *       event fires and the new residual is its trailing delay.
 *     - Events with delay 0 fire back-to-back inside the same advance
 *       window — no per-event gap is forced. This matches the
 *       "last-event-of-group flag" semantics in parse-mus-event-stream.
 *
 *   Looping: when a ScoreEnd event is dispatched on a looping
 *   scheduler, the next advance restarts at event index 0 and preserves
 *   the ScoreEnd's own delay as the pause before the loop fires again.
 *   Vanilla's mus2mid converter does not loop intrinsically; the music
 *   driver (i_music.c) handles loop = true by resetting the read
 *   pointer when the score-end event is seen.
 */

export const VANILLA_MUS_TICK_RATE_HZ = 140;
export const VANILLA_GAMEPLAY_TICK_RATE_HZ = 35;
export const VANILLA_MUS_TICKS_PER_GAMETIC = VANILLA_MUS_TICK_RATE_HZ / VANILLA_GAMEPLAY_TICK_RATE_HZ;

export const VANILLA_MUS_CHANNEL_COUNT = 16;
export const VANILLA_MUS_PERCUSSION_CHANNEL = 15;
export const VANILLA_MUS_DEFAULT_VELOCITY = 127;

export const VANILLA_MUS_PLAY_NOTE_VELOCITY_BIT_MASK = 0x80;

export interface VanillaMusVelocityResolutionInput {
  readonly channel: number;
  readonly hasExplicitVelocity: boolean;
  readonly explicitVelocity: number | null;
  readonly cachedVelocity: number;
}

/**
 * Returns the dispatched velocity for a MUS play-note and signals whether
 * the per-channel cache should be updated. When `hasExplicitVelocity` is
 * true, the explicit byte is dispatched AND cached; otherwise the cached
 * velocity is reused and the cache is left untouched.
 */
export function resolveVanillaMusPlayNoteVelocity(input: VanillaMusVelocityResolutionInput): { readonly dispatchedVelocity: number; readonly cacheUpdated: boolean } {
  if (input.hasExplicitVelocity) {
    if (input.explicitVelocity === null) {
      throw new TypeError('resolveVanillaMusPlayNoteVelocity: hasExplicitVelocity is true but explicitVelocity is null');
    }
    return Object.freeze({ dispatchedVelocity: input.explicitVelocity & 0x7f, cacheUpdated: true });
  }
  return Object.freeze({ dispatchedVelocity: input.cachedVelocity & 0x7f, cacheUpdated: false });
}

/**
 * Compute how many MUS quickticks should be advanced for a given count of
 * gameplay tics. Returns an integer scale of MUS_TICKS_PER_GAMETIC.
 */
export function vanillaMusQuickticksForGameTics(gameTics: number): number {
  return (gameTics * VANILLA_MUS_TICKS_PER_GAMETIC) | 0;
}
