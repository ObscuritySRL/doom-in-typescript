/**
 * Vanilla DOOM 1.9 sector and switch sound routing contract.
 *
 * From Chocolate Doom 2.2.1 p_doors.c, p_floor.c, p_plats.c, p_switch.c,
 * and r_defs.h:
 *
 *   Each sector_t embeds a `degenmobj_t soundorg` — a stripped-down
 *   mobj surrogate that carries only `(thinker, x, y, z)` and is
 *   positioned at the sector's geometric centre by P_SetupLevel.  The
 *   sector's moving-floor / moving-ceiling / button-press sounds route
 *   through:
 *     S_StartSound(&sector->soundorg, sfx_id);
 *
 *   For switches, the trigger line's frontsector soundorg is used:
 *     S_StartSound(&line->frontsector->soundorg, sfx_swtchn);
 *     S_StartSound(&line->frontsector->soundorg, sfx_swtchx);
 *
 *   Because soundorg is a non-null mobj reference distinct from the
 *   listener (the player mo), S_UpdateSounds takes the
 *   `c->origin && listener != c->origin` branch every tic and
 *   re-spatializes the sound via S_AdjustSoundParams — distance
 *   attenuation and left/right stereo pan follow the sector's centre
 *   as if it were a stationary mobj.
 *
 *   Door / lift sounds tracked here:
 *     sfx_doropn, sfx_dorcls — normal doors
 *     sfx_bdopn,  sfx_bdcls  — blazing doors (registered+)
 *     sfx_pstart, sfx_pstop  — platform / lift start and stop
 *     sfx_stnmov             — stair / floor moving cue
 *     sfx_swtchn, sfx_swtchx — switch on / off (gates exit-line use)
 */

export const VANILLA_SECTOR_SOUND_ORIGIN_FIELD = 'sector.soundorg' as const;
export const VANILLA_SWITCH_SOUND_ORIGIN_FIELD = 'line.frontsector.soundorg' as const;
export const VANILLA_SECTOR_SOUNDORG_TYPE = 'degenmobj_t-at-sector-centre' as const;
export const VANILLA_SECTOR_SOUND_RESPATIALIZES = true;

export type VanillaSectorSfxName = 'sfx_doropn' | 'sfx_dorcls' | 'sfx_bdopn' | 'sfx_bdcls' | 'sfx_pstart' | 'sfx_pstop' | 'sfx_stnmov' | 'sfx_swtchn' | 'sfx_swtchx';

export const VANILLA_SECTOR_SFX_NAMES: readonly VanillaSectorSfxName[] = Object.freeze(['sfx_doropn', 'sfx_dorcls', 'sfx_bdopn', 'sfx_bdcls', 'sfx_pstart', 'sfx_pstop', 'sfx_stnmov', 'sfx_swtchn', 'sfx_swtchx']);

export interface VanillaSectorSoundRoutingDecision {
  readonly originSource: typeof VANILLA_SECTOR_SOUND_ORIGIN_FIELD | typeof VANILLA_SWITCH_SOUND_ORIGIN_FIELD;
  readonly callsAdjustSoundParams: boolean;
  readonly soundorgType: typeof VANILLA_SECTOR_SOUNDORG_TYPE;
}

export function routeVanillaSectorSound(sfxName: VanillaSectorSfxName): VanillaSectorSoundRoutingDecision {
  const isSwitch = sfxName === 'sfx_swtchn' || sfxName === 'sfx_swtchx';
  return Object.freeze({
    originSource: isSwitch ? VANILLA_SWITCH_SOUND_ORIGIN_FIELD : VANILLA_SECTOR_SOUND_ORIGIN_FIELD,
    callsAdjustSoundParams: VANILLA_SECTOR_SOUND_RESPATIALIZES,
    soundorgType: VANILLA_SECTOR_SOUNDORG_TYPE,
  });
}
