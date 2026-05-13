/**
 * Vanilla Chocolate Doom 2.2.1 input responder chain routing contract.
 *
 * D_ProcessEvents dispatches every queued event to the responder chain in
 * a fixed priority order: M_Responder (menu) -> AM_Responder (automap when
 * active) -> ST_Responder (status bar) -> HU_Responder (chat) -> G_Responder
 * (gameplay). The first responder that returns true consumes the event;
 * later responders never see it.
 */

/** Frozen, vanilla-canonical responder priority chain. */
export const VANILLA_RESPONDER_CHAIN = Object.freeze(['M_Responder', 'AM_Responder', 'ST_Responder', 'HU_Responder', 'G_Responder'] as const);

export type ResponderName = (typeof VANILLA_RESPONDER_CHAIN)[number];

export interface ResponderOutcome {
  readonly responder: ResponderName;
  readonly consumed: boolean;
}

export interface RouterDecision {
  readonly consumedBy: ResponderName | null;
  readonly skippedResponders: readonly ResponderName[];
}

export function routeEventThroughResponderChain(outcomes: readonly ResponderOutcome[]): RouterDecision {
  const sortedOutcomes = [...outcomes].sort((leftOutcome, rightOutcome) => VANILLA_RESPONDER_CHAIN.indexOf(leftOutcome.responder) - VANILLA_RESPONDER_CHAIN.indexOf(rightOutcome.responder));
  let consumedBy: ResponderName | null = null;
  const skipped: ResponderName[] = [];
  let consumedReached = false;
  for (const expectedResponder of VANILLA_RESPONDER_CHAIN) {
    const outcome = sortedOutcomes.find((candidateOutcome) => candidateOutcome.responder === expectedResponder);
    if (outcome === undefined) {
      continue;
    }
    if (consumedReached) {
      skipped.push(expectedResponder);
      continue;
    }
    if (outcome.consumed) {
      consumedBy = outcome.responder;
      consumedReached = true;
    }
  }
  return Object.freeze({ consumedBy, skippedResponders: Object.freeze(skipped) });
}
