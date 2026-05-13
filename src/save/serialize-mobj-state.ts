/**
 * Vanilla DOOM 1.9 P_ArchiveThinkers mobj contract.
 *
 * From Chocolate Doom 2.2.1 p_saveg.c P_ArchiveThinkers /
 * P_UnArchiveThinkers:
 *   - Each mobj_t serializes as a 154-byte record prefixed by a
 *     thinker class byte (tc_mobj=1 from saveg_thinkerclass_t).
 *   - The end-of-thinkers list is marked by a single tc_end=0 byte.
 *   - Field layout (canonical p_saveg.c order):
 *     prev/next/x/y/z/snext/sprev/angle/sprite/frame/bnext/bprev/
 *     subsector/floorz/ceilingz/radius/height/momx/momy/momz/
 *     validcount/type/info/tics/state/flags/health/movedir/movecount/
 *     target/reactiontime/threshold/player/lastlook/spawnpoint/
 *     tracer.
 *   - Pointer fields (snext, sprev, bnext, bprev, subsector, info,
 *     state, target, player, tracer) are converted to integer
 *     identifiers on archive (mobj-index, sector-index, state-table
 *     index, etc.) and restored on unarchive via P_RestoreTargets.
 *   - The spawnpoint substructure (mapthing_t) is 10 bytes inline.
 */

export const VANILLA_SAVEGAME_MOBJ_SIZE = 154;

export const VANILLA_SAVEGAME_MAPTHING_SIZE = 10;

export const VANILLA_SAVEGAME_THINKER_CLASS_END = 0;
export const VANILLA_SAVEGAME_THINKER_CLASS_MOBJ = 1;

export const VANILLA_SAVEGAME_THINKER_CLASS_BYTE_SIZE = 1;

export function vanillaSerializedMobjBlockByteLength(mobjCount: number): number {
  if (!Number.isInteger(mobjCount) || mobjCount < 0) {
    throw new RangeError(`mobjCount must be a non-negative integer (got ${mobjCount})`);
  }
  return mobjCount * (VANILLA_SAVEGAME_THINKER_CLASS_BYTE_SIZE + VANILLA_SAVEGAME_MOBJ_SIZE) + VANILLA_SAVEGAME_THINKER_CLASS_BYTE_SIZE;
}

export function isVanillaThinkerClassByte(byte: number): boolean {
  return byte === VANILLA_SAVEGAME_THINKER_CLASS_END || byte === VANILLA_SAVEGAME_THINKER_CLASS_MOBJ;
}
