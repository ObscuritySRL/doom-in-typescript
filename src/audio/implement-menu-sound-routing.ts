/**
 * Vanilla DOOM 1.9 menu sound routing contract.
 *
 * From Chocolate Doom 2.2.1 m_menu.c and s_sound.c:
 *
 *   Menu sound events route through S_StartSound(NULL, sfx_id) — the
 *   first argument (origin) is always NULL.  This anonymous-origin
 *   routing has three direct consequences in the sound system:
 *
 *     1. S_AdjustSoundParams is NEVER called for menu sounds (the
 *        `c->origin && listener != c->origin` guard in S_UpdateSounds
 *        skips re-spatialization).
 *     2. Menu sounds play at full snd_SfxVolume with NORM_SEP centre
 *        separation — they sound the same regardless of player view
 *        angle or position.
 *     3. The channel slot's `origin` field stays NULL, so subsequent
 *        menu sounds do NOT reuse the same slot via the same-origin
 *        S_GetChannel branch — multiple menu sounds stack across
 *        available channels just like any anonymous sfx.
 *
 *   The five menu sound events (pinned by implement-menu-sound-events.ts
 *   in the UI lane) are sfx_swtchn (open / submenu / movement),
 *   sfx_swtchx (close / cancel), sfx_pistol (select), sfx_oof (invalid),
 *   and sfx_stnmov (slider step) — all routed through the same
 *   NULL-origin path.
 */

export const VANILLA_MENU_SOUND_ORIGIN = null;

export const VANILLA_MENU_SOUND_DOES_RESPATIALIZE = false;

export const VANILLA_MENU_SOUND_USES_FULL_VOLUME = true;

export const VANILLA_MENU_SOUND_CENTERED_SEPARATION = true;

export interface VanillaMenuSoundRoutingDecision {
  readonly originField: number | null;
  readonly callsAdjustSoundParams: boolean;
  readonly initialVolume: 'snd_SfxVolume-full';
  readonly initialSeparation: 'NORM_SEP-centred';
}

export function routeVanillaMenuSound(_sfxId: number): VanillaMenuSoundRoutingDecision {
  return Object.freeze({
    originField: VANILLA_MENU_SOUND_ORIGIN,
    callsAdjustSoundParams: VANILLA_MENU_SOUND_DOES_RESPATIALIZE,
    initialVolume: 'snd_SfxVolume-full',
    initialSeparation: 'NORM_SEP-centred',
  });
}
