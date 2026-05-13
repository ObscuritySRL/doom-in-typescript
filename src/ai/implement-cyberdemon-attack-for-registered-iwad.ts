/**
 * Vanilla DOOM 1.9 Cyberdemon (MT_CYBORG) attack contract (registered/retail IWAD).
 *
 * From Chocolate Doom 2.2.1 p_enemy.c A_CyberAttack:
 *   void A_CyberAttack (mobj_t* actor) {
 *     if (!actor->target) return;
 *     A_FaceTarget (actor);
 *     P_SpawnMissile (actor, actor->target, MT_ROCKET);
 *   }
 *
 *   Cyberdemon always fires a rocket (MT_ROCKET=10) — no melee, no random gate.
 *   Rocket explosion damage is 128 (MT_ROCKET info.damage) via P_RadiusAttack.
 *
 * MT_CYBORG = 18. Shareware IWAD does NOT include the cyberdemon (E1M8 uses
 * MT_BARONS instead); MT_CYBORG appears only in the registered/retail IWAD.
 */

export const VANILLA_MT_CYBORG = 18;
export const VANILLA_MT_ROCKET = 10;
export const VANILLA_CYBER_ROCKET_DAMAGE = 128;

export function getVanillaCyberAttackContract(): { readonly missileType: number; readonly explosionDamage: number } {
  return Object.freeze({ missileType: VANILLA_MT_ROCKET, explosionDamage: VANILLA_CYBER_ROCKET_DAMAGE });
}
