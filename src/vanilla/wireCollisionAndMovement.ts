/**
 * Vanilla DOOM 1.9 collision + movement runtime facade.
 *
 * Plan_final step `08-003` (lane: map-world) aggregates the
 * canonical collision and movement entry points the per-tic mobj
 * ticker and the sector-special scheduler call every tic into a
 * single cohesive re-export barrel.  The underlying primitives
 * already implement vanilla `p_map.c` / `p_mobj.c` semantics and
 * are SHA-pinned by the `plan_vanilla_parity` map-and-world
 * inventory; this module does NOT modify them — it only re-exports
 * them and pins the entry-point manifest so downstream runtime
 * steps resolve the movement surface from one place.
 *
 * The wired entry points and their Chocolate Doom 2.2.1 origins:
 *
 *   - `checkPosition`   — `p_map.c` `P_CheckPosition`
 *   - `tryMove`         — `p_map.c` `P_TryMove`
 *   - `slideMove`       — `p_map.c` `P_SlideMove`
 *   - `xyMovement`      — `p_mobj.c` `P_XYMovement`
 *   - `zMovement`       — `p_mobj.c` `P_ZMovement`
 *   - `changeSector`    — `p_map.c` `P_ChangeSector` (crush)
 *   - `thingHeightClip` — `p_map.c` `P_ThingHeightClip`
 *   - `teleportMove`    — `p_map.c` `P_TeleportMove`
 *   - `evTeleport`      — `p_telept.c` `EV_Teleport`
 *
 * @example
 * ```ts
 * import { tryMove, xyMovement, VANILLA_MOVEMENT_ENTRY_POINTS } from './wireCollisionAndMovement.ts';
 * VANILLA_MOVEMENT_ENTRY_POINTS.length; // 9
 * ```
 */

export { checkPosition } from '../world/checkPosition.ts';
export { tryMove } from '../world/tryMove.ts';
export { slideMove } from '../world/slideMove.ts';
export { explodeMissile, xyMovement } from '../world/xyMovement.ts';
export { approxDistance, zMovement } from '../world/zMovement.ts';
export { changeSector, thingHeightClip } from '../world/sectorChange.ts';
export { evTeleport, pitStompThing, teleportMove } from '../world/teleport.ts';

/**
 * Frozen manifest of the nine canonical collision/movement entry
 * point names this facade wires, in the order the vanilla per-tic
 * mobj ticker + sector-special scheduler invoke them.  Used by the
 * focused test to pin the surface so a later refactor cannot drop
 * or rename an entry point without updating this manifest.
 */
export const VANILLA_MOVEMENT_ENTRY_POINTS: readonly string[] = Object.freeze(['checkPosition', 'tryMove', 'slideMove', 'xyMovement', 'zMovement', 'changeSector', 'thingHeightClip', 'teleportMove', 'evTeleport']);
