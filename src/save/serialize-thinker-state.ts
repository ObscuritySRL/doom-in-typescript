/**
 * Vanilla DOOM 1.9 P_ArchiveThinkers traversal contract.
 *
 * From Chocolate Doom 2.2.1 p_saveg.c P_ArchiveThinkers /
 * P_UnArchiveThinkers:
 *
 *   void P_ArchiveThinkers (void) {
 *     thinker_t* th;
 *     for (th = thinkercap.next ; th != &thinkercap ; th = th->next) {
 *       if (th->function.acp1 == (actionf_p1) P_MobjThinker) {
 *         *save_p++ = tc_mobj;
 *         PADSAVEP();
 *         memcpy (...);
 *         save_p += sizeof (*mobj);
 *       }
 *     }
 *     *save_p++ = tc_end;
 *   }
 *
 * Parity-critical details:
 *   - The thinker ring is a doubly-linked sentinel-headed list
 *     (`thinkercap.next .. thinkercap`).
 *   - Traversal is FORWARD ordering (thinkercap.next → ... →
 *     thinkercap). The archive output preserves this order; the
 *     unarchive must re-link in the same order.
 *   - PADSAVEP() rounds `save_p` up to the next 4-byte boundary
 *     before each thinker class body. The class byte itself is
 *     unpadded; the pad happens immediately AFTER the class byte and
 *     BEFORE the record body.
 *   - Only thinkers whose `function.acp1 == P_MobjThinker` are
 *     archived. Other thinker functions (T_MoveCeiling, T_VerticalDoor,
 *     T_MoveFloor, T_PlatRaise, etc.) are archived separately by
 *     P_ArchiveSpecials.
 *   - The tc_end=0 terminator follows the last thinker record. No
 *     pad bytes between the terminator and the world record start.
 */

export const VANILLA_SAVEGAME_THINKER_CLASS_END = 0;
export const VANILLA_SAVEGAME_THINKER_CLASS_MOBJ = 1;

export const VANILLA_SAVEGAME_PADSAVEP_ALIGNMENT = 4;

export function vanillaPadSavePOffset(currentOffset: number): number {
  if (!Number.isInteger(currentOffset) || currentOffset < 0) {
    throw new RangeError(`PADSAVEP offset must be a non-negative integer (got ${currentOffset})`);
  }
  const remainder = currentOffset % VANILLA_SAVEGAME_PADSAVEP_ALIGNMENT;
  return remainder === 0 ? currentOffset : currentOffset + (VANILLA_SAVEGAME_PADSAVEP_ALIGNMENT - remainder);
}

export function vanillaPadSavePBytesAdded(currentOffset: number): number {
  return vanillaPadSavePOffset(currentOffset) - currentOffset;
}
