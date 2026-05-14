/**
 * Vanilla DOOM 1.9 G_DoLoadGame state-restoration contract.
 *
 * From Chocolate Doom 2.2.1 g_game.c G_DoLoadGame's tail, after all
 * archive sections have been read:
 *
 *   P_UnArchivePlayers   ();
 *   P_UnArchiveWorld     ();
 *   P_UnArchiveThinkers  ();   // mobjs first, with pointers as indices
 *   P_UnArchiveSpecials  ();   // T_*-style thinkers
 *   if (*save_p != SAVE_GAME_TERMINATOR)
 *     I_Error ("Bad savegame");
 *   P_RestoreTargets ();       // fix up index→pointer references
 *   gameaction = ga_nothing;
 *
 * P_RestoreTargets walks the restored mobj list and re-attaches the
 * `target`, `tracer`, and other pointer fields by looking up the
 * archived integer indices in the freshly-rebuilt mobj index table.
 *
 * Parity-critical details:
 *   - Order of restoration is FIXED: players → world → thinkers
 *     (mobjs) → specials → terminator → P_RestoreTargets. Reordering
 *     desyncs because mobjs reference players (target pointers),
 *     specials reference sectors (in world state), etc.
 *   - P_RestoreTargets MUST run after all sections are loaded;
 *     otherwise the target indices have nothing to point to.
 *   - `gameaction = ga_nothing` clears any pending end-of-level
 *     transition so the loaded state is the immediate next frame.
 *   - The active-list scratch tables (activeplats, activeceilings,
 *     buttonlist) are reconstructed by P_UnArchiveSpecials during
 *     the thinker walk — they are NOT carried in the file directly.
 *   - Mobj pointer fields encoded as zero (NULL) on archive stay
 *     null on restore; the index zero is reserved as "no target".
 *     The first archived mobj gets index 1.
 */

export const VANILLA_NULL_MOBJ_INDEX = 0;

export const VANILLA_FIRST_ARCHIVED_MOBJ_INDEX = 1;

export const VANILLA_LOAD_RESTORATION_ORDER: readonly string[] = Object.freeze(['P_UnArchivePlayers', 'P_UnArchiveWorld', 'P_UnArchiveThinkers', 'P_UnArchiveSpecials', 'verifySaveGameTerminator', 'P_RestoreTargets', 'clearGameAction']);

export const VANILLA_GAMEACTION_CLEAR_VALUE = 0;

export function isVanillaNullMobjIndex(index: number): boolean {
  return index === VANILLA_NULL_MOBJ_INDEX;
}

export function vanillaRestoreOrderIndex(stepName: string): number {
  return VANILLA_LOAD_RESTORATION_ORDER.indexOf(stepName);
}
