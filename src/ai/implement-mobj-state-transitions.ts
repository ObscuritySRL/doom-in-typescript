/**
 * Vanilla DOOM 1.9 P_SetMobjState contract.
 *
 * From Chocolate Doom 2.2.1 p_mobj.c P_SetMobjState:
 *   boolean P_SetMobjState (mobj_t* mobj, statenum_t state) {
 *     state_t* st;
 *     do {
 *       if (state == S_NULL) {
 *         mobj->state = (state_t *) S_NULL;
 *         P_RemoveMobj (mobj);
 *         return false;
 *       }
 *       st = &states[state];
 *       mobj->state = st;
 *       mobj->tics = st->tics;
 *       mobj->sprite = st->sprite;
 *       mobj->frame = st->frame;
 *       if (st->action.acp1)
 *         st->action.acp1(mobj);
 *       state = st->nextstate;
 *     } while (!mobj->tics);
 *     return true;
 *   }
 *
 * Notes for parity:
 *   - State 0 (S_NULL) triggers P_RemoveMobj and returns false.
 *   - State action is called BEFORE updating to next state (action fires once
 *     per state entry).
 *   - The do/while loops while tics==0, meaning "fast" states (tics==0)
 *     chain to nextstate within the same tic. This is the basis for the
 *     vanilla "instant-state-loop" mobj crash if a cycle of tics==0 states
 *     has no terminating tics>0 state.
 *   - Recursion via action calls (e.g. A_Chase) can invalidate the mobj
 *     before the function returns; vanilla relies on the do/while terminating
 *     at tics>0 or P_RemoveMobj.
 */

export const VANILLA_S_NULL = 0;

export interface MobjState {
  readonly stateIndex: number;
  readonly tics: number;
  readonly nextStateIndex: number;
}

export function applyVanillaSetMobjState(
  stateTable: readonly MobjState[],
  initialStateIndex: number,
  maxTransitions = 64,
): { readonly resolvedStateIndex: number; readonly removed: boolean; readonly traversedStateIndices: readonly number[] } {
  const traversed: number[] = [];
  let state = initialStateIndex;
  let removed = false;
  for (let safety = 0; safety < maxTransitions; safety += 1) {
    if (state === VANILLA_S_NULL) {
      removed = true;
      break;
    }
    const st = stateTable[state];
    if (st === undefined) {
      break;
    }
    traversed.push(state);
    if (st.tics !== 0) {
      return { resolvedStateIndex: state, removed: false, traversedStateIndices: Object.freeze(traversed) };
    }
    state = st.nextStateIndex;
  }
  return { resolvedStateIndex: state, removed, traversedStateIndices: Object.freeze(traversed) };
}
