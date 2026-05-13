/**
 * Vanilla DOOM 1.9 P_RunThinkers ordering contract.
 *
 * From Chocolate Doom 2.2.1 p_tick.c P_RunThinkers:
 *   thinkercap is a doubly-linked sentinel; thinkers are inserted at the
 *   tail of the list (just before thinkercap). Each tic, P_RunThinkers
 *   walks the list forward from thinkercap.next.
 *
 *   void P_RunThinkers (void)
 *   {
 *     thinker_t* currentthinker;
 *     currentthinker = thinkercap.next;
 *     while (currentthinker != &thinkercap) {
 *       if (currentthinker->function.acv == (actionf_v) -1) {
 *         next = currentthinker->next;
 *         next->prev = currentthinker->prev;
 *         currentthinker->prev->next = next;
 *         Z_Free (currentthinker);
 *       } else if (currentthinker->function.acp1) {
 *         currentthinker->function.acp1 (currentthinker);
 *       }
 *       currentthinker = currentthinker->next;
 *     }
 *   }
 *
 * Parity-critical:
 *   - Forward iteration only (head to tail).
 *   - Removed thinkers (sentinel `function == -1`) are unlinked AND freed
 *     in the same pass; iteration then resumes from `next`.
 *   - New thinkers added during the iteration are inserted at the tail
 *     and thus run NEXT TIC, not this tic (vanilla quirk).
 */

export const VANILLA_THINKER_REMOVED_SENTINEL = -1;
export const VANILLA_THINKER_TRAVERSAL_DIRECTION = 'forward' as const;
export const VANILLA_THINKER_INSERTION_POSITION = 'tail' as const;

export interface ThinkerEntry {
  readonly id: string;
  readonly removed: boolean;
}

export interface ThinkerListSnapshot {
  readonly entries: readonly ThinkerEntry[];
}

export function iterateVanillaThinkers(snapshot: ThinkerListSnapshot): readonly string[] {
  const live: string[] = [];
  for (const entry of snapshot.entries) {
    if (!entry.removed) {
      live.push(entry.id);
    }
  }
  return live;
}

/** Filter the entries to drop removed thinkers, modeling the same-pass Z_Free behavior. */
export function compactRemovedThinkers(snapshot: ThinkerListSnapshot): ThinkerListSnapshot {
  return Object.freeze({
    entries: snapshot.entries.filter((entry) => !entry.removed),
  });
}
