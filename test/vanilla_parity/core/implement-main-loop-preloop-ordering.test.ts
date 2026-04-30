import { describe, expect, it } from 'bun:test';

import {
  AUDITED_MAIN_LOOP_PRELOOP_STEP_COUNT,
  AUDITED_MAIN_LOOP_PRELOOP_STEPS,
  DOOM_MAIN_LOOP_PRELOOP_ORDERING_INVARIANTS,
  DOOM_MAIN_LOOP_PRELOOP_ORDERING_REFERENCE_CANDIDATE,
  crossCheckDoomMainLoopPreLoopOrdering,
} from '../../../src/core/implement-main-loop-preloop-ordering.ts';
import type { DoomMainLoopPreLoopCallbacks, DoomMainLoopPreLoopOrderingCandidate, DoomMainLoopPreLoopOrderingCandidateInstance } from '../../../src/core/implement-main-loop-preloop-ordering.ts';

class ReorderedMainLoopPreLoopCandidateInstance implements DoomMainLoopPreLoopOrderingCandidateInstance {
  #started = false;

  get frameCount(): number {
    return 0;
  }

  setup(callbacks: DoomMainLoopPreLoopCallbacks): void {
    callbacks.restoreBuffer();
    callbacks.initialTryRunTics();
    callbacks.executeSetViewSize();
    callbacks.startGameLoop();
    this.#started = true;
  }

  get started(): boolean {
    return this.#started;
  }
}

const REORDERED_MAIN_LOOP_PRELOOP_CANDIDATE: DoomMainLoopPreLoopOrderingCandidate = Object.freeze({
  create: (): DoomMainLoopPreLoopOrderingCandidateInstance => new ReorderedMainLoopPreLoopCandidateInstance(),
});

describe('D_DoomLoop pre-loop ordering audit', () => {
  it('pins the four canonical setup callbacks in order', () => {
    expect(AUDITED_MAIN_LOOP_PRELOOP_STEP_COUNT).toBe(4);
    expect(AUDITED_MAIN_LOOP_PRELOOP_STEPS).toEqual(['initialTryRunTics', 'restoreBuffer', 'executeSetViewSize', 'startGameLoop']);
    expect(Object.isFrozen(AUDITED_MAIN_LOOP_PRELOOP_STEPS)).toBe(true);
  });

  it('keeps the invariant ledger closed', () => {
    expect(DOOM_MAIN_LOOP_PRELOOP_ORDERING_INVARIANTS.map((invariant) => invariant.identifier)).toEqual([
      'MAIN_LOOP_PRELOOP_FRESH_INSTANCE_FRAME_COUNT_IS_ZERO',
      'MAIN_LOOP_PRELOOP_FRESH_INSTANCE_NOT_STARTED',
      'MAIN_LOOP_PRELOOP_SETUP_DOES_NOT_ADVANCE_FRAME_COUNT',
      'MAIN_LOOP_PRELOOP_SETUP_MARKS_STARTED_AFTER_CALLBACKS',
      'MAIN_LOOP_PRELOOP_SETUP_REJECTS_SECOND_CALL',
      'MAIN_LOOP_PRELOOP_SETUP_RUNS_CANONICAL_ORDER',
      'MAIN_LOOP_PRELOOP_SETUP_RUNS_EACH_STEP_ONCE',
    ]);
    expect(Object.isFrozen(DOOM_MAIN_LOOP_PRELOOP_ORDERING_INVARIANTS)).toBe(true);
  });

  it('cross-checks the reference setup implementation', () => {
    expect(crossCheckDoomMainLoopPreLoopOrdering(DOOM_MAIN_LOOP_PRELOOP_ORDERING_REFERENCE_CANDIDATE)).toEqual([]);
  });

  it('reports a candidate that restores the buffer before the initial TryRunTics call', () => {
    expect(crossCheckDoomMainLoopPreLoopOrdering(REORDERED_MAIN_LOOP_PRELOOP_CANDIDATE)).toContain('MAIN_LOOP_PRELOOP_SETUP_RUNS_CANONICAL_ORDER');
  });
});
