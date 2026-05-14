/**
 * Vanilla DOOM 1.9 weapon and monster sound routing contract.
 *
 * From Chocolate Doom 2.2.1 p_pspr.c (player weapons), p_enemy.c (monster
 * AI actions), and s_sound.c (S_StartSound):
 *
 *   Weapon sound routing — every player weapon fire calls
 *     S_StartSound(player->mo, sfx_id)
 *   The origin is the player's own mobj.  In S_UpdateSounds this
 *   matches the `c->origin == listener` branch (when the listener is
 *   the player's mo), so weapon sounds skip S_AdjustSoundParams and
 *   keep their started-with full-volume / centred-pan parameters.
 *
 *   Monster sound routing — every monster see / pain / death / attack
 *   sound calls
 *     S_StartSound(monster, sfx_id)
 *   The origin is the attacking / wounded monster's mobj.  S_UpdateSounds
 *   recomputes (volume, separation) every tic via S_AdjustSoundParams,
 *   panning the sound left/right and attenuating it by distance to the
 *   listener.  A monster that wakes up across the map starts loud and
 *   fades as the player turns away.
 *
 *   The single exception inside monster code is A_Scream's BossDeath
 *   suffix path (and a small handful of bossbrain / pain-elemental
 *   spawn cues), which uses S_StartSound(NULL, sfx_id) for fullscreen
 *   sounds that should not pan — those route through the menu/anonymous
 *   path documented separately.
 */

export type VanillaSfxRoutingProfile = 'weapon-self-origin' | 'monster-mobj-origin' | 'fullscreen-anonymous';

export interface VanillaSfxRoutingDecision {
  readonly profile: VanillaSfxRoutingProfile;
  readonly originSource: 'player.mo' | 'monster.mo' | 'null';
  readonly callsAdjustSoundParams: boolean;
  readonly note: string;
}

export const VANILLA_WEAPON_SFX_ROUTING: VanillaSfxRoutingDecision = Object.freeze({
  profile: 'weapon-self-origin',
  originSource: 'player.mo',
  callsAdjustSoundParams: false,
  note: 'origin == listener short-circuits the S_AdjustSoundParams guard',
});

export const VANILLA_MONSTER_SFX_ROUTING: VanillaSfxRoutingDecision = Object.freeze({
  profile: 'monster-mobj-origin',
  originSource: 'monster.mo',
  callsAdjustSoundParams: true,
  note: 'remote origin triggers S_AdjustSoundParams every tic to attenuate by distance and pan by angle',
});

export const VANILLA_FULLSCREEN_BOSS_SFX_ROUTING: VanillaSfxRoutingDecision = Object.freeze({
  profile: 'fullscreen-anonymous',
  originSource: 'null',
  callsAdjustSoundParams: false,
  note: 'NULL origin escapes spatialization for bossbrain / fullscreen cues',
});

export function classifyVanillaCombatSfxRouting(profile: VanillaSfxRoutingProfile): VanillaSfxRoutingDecision {
  switch (profile) {
    case 'weapon-self-origin':
      return VANILLA_WEAPON_SFX_ROUTING;
    case 'monster-mobj-origin':
      return VANILLA_MONSTER_SFX_ROUTING;
    case 'fullscreen-anonymous':
      return VANILLA_FULLSCREEN_BOSS_SFX_ROUTING;
  }
}
