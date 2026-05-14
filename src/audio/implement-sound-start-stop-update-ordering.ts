/**
 * Vanilla DOOM 1.9 sound start/stop/update call ordering contract.
 *
 * From Chocolate Doom 2.2.1 s_sound.c:
 *   - S_StartSound(origin, sfx_id) sequence:
 *       1. If sfx_id == sfx_None or sfx_id == 0, return immediately.
 *       2. If origin is null, treat as the listener (no attenuation).
 *       3. S_AdjustSoundParams: compute volume, separation, priority for
 *          this (origin, listener) pair. If volume <= 0, abort.
 *       4. If the origin already has a playing channel and the new sfx has
 *          a different sfx_id, stop the existing channel first (S_StopChannel).
 *          If the same sfx is already playing on this origin and is in its
 *          first few tics (singularity), do not restart it.
 *       5. S_GetChannel: find the channel slot, evicting the lowest-priority
 *          active channel if all are busy and the new priority outranks it.
 *       6. Cache the lump if needed (sfxinfo->lumpnum, sfxinfo->data, usefulness),
 *          then call I_StartSound.
 *   - S_StopSound(origin):
 *       walks all channels and stops any channel matching `origin`.
 *   - S_UpdateSounds(listener):
 *       walks all channels each tic, calls S_AdjustSoundParams against the
 *       current listener position, and either updates volume/separation
 *       (I_UpdateSoundParams) or stops the channel if it has finished or
 *       become inaudible.
 *
 * Per-tic ordering (D_DoomLoop → tryRunTics → game tic):
 *   1. S_UpdateSounds(player.mo) is invoked once after the tic's thinkers
 *      and player tic complete (G_Ticker / D_Display path).
 *   2. New S_StartSound calls made during the same tic act after the update
 *      pass for this tic and are visible to next tic's S_UpdateSounds.
 *
 * Singularity rule (sfxinfo_t.singularity):
 *   When set, only one instance of that sound may play across all channels.
 *   A new request stops the existing instance first.
 */

export type VanillaSoundOriginIdentifier = number | null;
export type VanillaSoundIdentifier = number;

export const VANILLA_SFX_NONE: VanillaSoundIdentifier = 0;

export type VanillaSoundCallKind = 'start' | 'stop' | 'update';

export interface VanillaSoundCall {
  readonly kind: VanillaSoundCallKind;
  readonly origin: VanillaSoundOriginIdentifier;
  readonly sfxId: VanillaSoundIdentifier;
}

/**
 * Vanilla per-tic sound-system ordering: a single S_UpdateSounds runs first,
 * then all S_StartSound and S_StopSound calls from the tic's thinkers are
 * processed in the order they were issued. This matches s_sound.c where
 * S_UpdateSounds is invoked from D_Display once per frame and gameplay
 * thinkers call S_StartSound during G_Ticker.
 */
export function orderTicSoundCalls(updateFirst: readonly VanillaSoundCall[], thinkerCalls: readonly VanillaSoundCall[]): readonly VanillaSoundCall[] {
  for (const call of updateFirst) {
    if (call.kind !== 'update') {
      throw new Error(`updateFirst must contain only "update" calls; got "${call.kind}"`);
    }
  }
  return [...updateFirst, ...thinkerCalls];
}

/** Mirrors the S_StartSound sfx_None / sfx_id == 0 guard. */
export function shouldStartSoundCallSkip(sfxId: VanillaSoundIdentifier): boolean {
  return sfxId === VANILLA_SFX_NONE;
}

/**
 * Mirrors the singularity-and-same-origin guard in S_StartSound:
 *   - If the origin already has a playing channel for a DIFFERENT sfx, the
 *     existing channel is stopped before the new start.
 *   - If the origin already has the SAME sfx playing, the new request is
 *     dropped (vanilla does not restart a same-sfx same-origin call).
 */
export function classifyStartAgainstExisting(existingSfxOnSameOrigin: VanillaSoundIdentifier | null, requestedSfx: VanillaSoundIdentifier): 'start-fresh' | 'stop-then-start' | 'drop' {
  if (existingSfxOnSameOrigin === null) {
    return 'start-fresh';
  }
  if (existingSfxOnSameOrigin === requestedSfx) {
    return 'drop';
  }
  return 'stop-then-start';
}
