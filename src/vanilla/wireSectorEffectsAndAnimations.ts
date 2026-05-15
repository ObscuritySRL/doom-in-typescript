/**
 * Vanilla DOOM 1.9 sector-effect + texture/flat-animation facade.
 *
 * Plan_final step `08-007` (lane: map-world) aggregates the
 * sector-special and animated-texture/flat entry points the per-tic
 * special scheduler (`P_UpdateSpecials`) and the player ticker
 * (`P_PlayerInSpecialSector`) call every tic into one cohesive
 * re-export barrel.  The read-only primitives already implement
 * vanilla `p_spec.c` semantics and are SHA-pinned by the
 * `plan_vanilla_parity` map-and-world inventory; this module does
 * NOT modify them.
 *
 * Wired entry points and their Chocolate Doom 2.2.1 origins:
 *
 *   - `playerInSpecialSector` — `p_spec.c` `P_PlayerInSpecialSector`
 *     (damaging nukage/hellslime/super-damage floors, the secret-
 *     count special, the end-level damage special).
 *   - `initPicAnims`          — `p_spec.c` `P_InitPicAnims`
 *     (builds the animated texture/flat record list from ANIMDEFS).
 *   - `updateAnimTranslation` — the `P_UpdateSpecials` anim pass
 *     that advances `texturetranslation[]` / `flattranslation[]`
 *     each tic.
 *
 * @example
 * ```ts
 * import { playerInSpecialSector, MAXANIMS, VANILLA_SECTOR_EFFECT_ENTRY_POINTS } from './wireSectorEffectsAndAnimations.ts';
 * MAXANIMS;                                   // 32
 * VANILLA_SECTOR_EFFECT_ENTRY_POINTS.length;  // 3
 * ```
 */

export { DAMAGE_EXIT_SUPER, DAMAGE_HELLSLIME, DAMAGE_NUKAGE, DAMAGE_STROBE_SUPER, EXIT_DAMAGE_HEALTH_THRESHOLD, IRONFEET_BYPASS_THRESHOLD, playerInSpecialSector } from '../specials/sectorSpecials.ts';
export { ANIMDEFS, MAXANIMS, initPicAnims, updateAnimTranslation } from '../specials/animations.ts';

/**
 * Frozen manifest of the three canonical sector-effect / animation
 * entry-point names this facade wires, in the order the per-tic
 * special scheduler invokes them (init at level load, then the
 * per-tic player-sector check and the anim-translation advance).
 */
export const VANILLA_SECTOR_EFFECT_ENTRY_POINTS: readonly string[] = Object.freeze(['initPicAnims', 'playerInSpecialSector', 'updateAnimTranslation']);
