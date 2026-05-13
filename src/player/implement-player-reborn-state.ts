/**
 * Vanilla DOOM 1.9 G_PlayerReborn contract.
 *
 * From Chocolate Doom 2.2.1 g_game.c G_PlayerReborn, after death the player
 * state is reset while preserving session-spanning fields (killcount, itemcount,
 * secretcount, frags). The reset gives the player:
 *   - INITIAL_HEALTH (100) hit points
 *   - WP_PISTOL ready, WP_FIST and WP_PISTOL owned
 *   - INITIAL_BULLETS (50) bullets
 *   - All other weapons/keys/powerups cleared
 *   - usedown / attackdown set true so the keys must be released before firing
 *
 * `playerstate` becomes PST_LIVE.
 */

import { INITIAL_BULLETS, INITIAL_HEALTH, MAX_AMMO } from './playerSpawn.ts';

export const VANILLA_INITIAL_HEALTH = INITIAL_HEALTH;
export const VANILLA_INITIAL_BULLETS = INITIAL_BULLETS;
export const VANILLA_MAX_AMMO_BY_TYPE = MAX_AMMO;

export interface RebornPreservedStats {
  readonly killCount: number;
  readonly itemCount: number;
  readonly secretCount: number;
  readonly frags: readonly number[];
}

export interface RebornFreshState {
  readonly health: number;
  readonly armorPoints: number;
  readonly armorType: number;
  readonly bullets: number;
  readonly shells: number;
  readonly cells: number;
  readonly missiles: number;
  readonly hasFist: boolean;
  readonly hasPistol: boolean;
  readonly hasShotgun: boolean;
  readonly hasChaingun: boolean;
  readonly hasRocketLauncher: boolean;
  readonly hasPlasmaRifle: boolean;
  readonly hasBfg: boolean;
  readonly hasChainsaw: boolean;
  readonly usedown: boolean;
  readonly attackdown: boolean;
}

export function buildVanillaRebornFreshState(): RebornFreshState {
  return Object.freeze({
    health: VANILLA_INITIAL_HEALTH,
    armorPoints: 0,
    armorType: 0,
    bullets: VANILLA_INITIAL_BULLETS,
    shells: 0,
    cells: 0,
    missiles: 0,
    hasFist: true,
    hasPistol: true,
    hasShotgun: false,
    hasChaingun: false,
    hasRocketLauncher: false,
    hasPlasmaRifle: false,
    hasBfg: false,
    hasChainsaw: false,
    usedown: true,
    attackdown: true,
  });
}
