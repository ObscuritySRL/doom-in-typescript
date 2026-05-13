/**
 * Vanilla Chocolate Doom 2.2.1 host message pump ordering contract.
 *
 * Pins the canonical per-tic ordering: the host pumps the OS input message
 * queue exactly once before each batch of game tics. Pumped events go into
 * a single FIFO local event queue; the game drains it via D_ProcessEvents
 * before running the simulation tics. No event is processed twice and no
 * event is dropped except by an explicit overflow guard.
 */

/** Discriminator for a per-tic pump phase. */
export type MessagePumpPhase = 'd_process_events' | 'd_run_tics' | 'i_start_tic' | 'i_update_no_blit' | 'i_finish_update';

/**
 * Frozen, ASCIIbetically sorted list of the canonical per-tic pump phases
 * that vanilla Chocolate Doom 2.2.1 executes between successive `tryRunTics`
 * invocations on the Windows host (i_video.c::I_StartTic and d_main.c::D_DoomLoop).
 */
export const VANILLA_PER_TIC_MESSAGE_PUMP_PHASES: readonly MessagePumpPhase[] = Object.freeze(['d_process_events', 'd_run_tics', 'i_finish_update', 'i_start_tic', 'i_update_no_blit'] as const);

/**
 * Canonical per-tic phase order: vanilla pumps OS input once, drains the
 * local event queue into G_Responder/M_Responder, runs game tics, then
 * does the no-blit update followed by the final blit.
 */
export const VANILLA_PER_TIC_PHASE_ORDER: readonly MessagePumpPhase[] = Object.freeze(['i_start_tic', 'd_process_events', 'd_run_tics', 'i_update_no_blit', 'i_finish_update'] as const);

/** Maximum number of events drained from the local FIFO per `D_ProcessEvents` call. */
export const VANILLA_D_PROCESS_EVENTS_MAX_PER_TIC = 16;

/** Whether vanilla drops events when the local FIFO overflows (yes; the oldest events are kept and new ones lost). */
export const VANILLA_DROPS_NEW_EVENTS_ON_FIFO_OVERFLOW = true;

/** Whether vanilla pumps the OS message queue more than once per tic. */
export const VANILLA_PUMPS_OS_MESSAGE_QUEUE_MORE_THAN_ONCE_PER_TIC = false;

/** Whether `D_ProcessEvents` drains events out of order. */
export const VANILLA_D_PROCESS_EVENTS_DRAINS_OUT_OF_ORDER = false;

export interface MessagePumpInput {
  readonly observedPhaseOrder: readonly MessagePumpPhase[];
  readonly observedEventsDrainedThisTic: number;
  readonly observedPumpsOsQueueExtra: boolean;
  readonly observedOverflowDropsNewEvents: boolean;
}

export type MessagePumpViolation = 'extra_os_pump' | 'fifo_overflow_drops_old_events' | 'out_of_order_phases' | 'too_many_events_drained';

export interface MessagePumpDecision {
  readonly matches: boolean;
  readonly violations: readonly MessagePumpViolation[];
}

function comparePhaseOrder(observedOrder: readonly MessagePumpPhase[], expectedOrder: readonly MessagePumpPhase[]): boolean {
  if (observedOrder.length !== expectedOrder.length) {
    return false;
  }
  for (let phaseIndex = 0; phaseIndex < expectedOrder.length; phaseIndex += 1) {
    if (observedOrder[phaseIndex] !== expectedOrder[phaseIndex]) {
      return false;
    }
  }
  return true;
}

export function evaluateMessagePumpOrdering(input: MessagePumpInput): MessagePumpDecision {
  const violations: MessagePumpViolation[] = [];
  if (!comparePhaseOrder(input.observedPhaseOrder, VANILLA_PER_TIC_PHASE_ORDER)) {
    violations.push('out_of_order_phases');
  }
  if (input.observedEventsDrainedThisTic > VANILLA_D_PROCESS_EVENTS_MAX_PER_TIC) {
    violations.push('too_many_events_drained');
  }
  if (input.observedPumpsOsQueueExtra !== VANILLA_PUMPS_OS_MESSAGE_QUEUE_MORE_THAN_ONCE_PER_TIC) {
    violations.push('extra_os_pump');
  }
  if (input.observedOverflowDropsNewEvents !== VANILLA_DROPS_NEW_EVENTS_ON_FIFO_OVERFLOW) {
    violations.push('fifo_overflow_drops_old_events');
  }
  return Object.freeze({
    matches: violations.length === 0,
    violations: Object.freeze(violations.sort()),
  });
}
