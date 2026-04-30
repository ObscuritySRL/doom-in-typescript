import { describe, expect, it } from 'bun:test';

import {
  AUDITED_MAIN_LOOP_PER_FRAME_PHASE_COUNT,
  AUDITED_MAIN_LOOP_PER_FRAME_PHASES,
  DOOM_MAIN_LOOP_PER_FRAME_ORDERING_INVARIANTS,
  DOOM_MAIN_LOOP_PER_FRAME_ORDERING_REFERENCE_CANDIDATE,
  crossCheckDoomMainLoopPerFrameOrdering,
} from '../../../src/core/implement-main-loop-per-frame-ordering.ts';

import type { DoomMainLoopPerFrameCallbacks, DoomMainLoopPerFrameOrderingCandidate } from '../../../src/core/implement-main-loop-per-frame-ordering.ts';

const DISPLAY_BEFORE_SOUND_CANDIDATE: DoomMainLoopPerFrameOrderingCandidate = Object.freeze({
  create: () => {
    let frameCount = 0;
    let started = false;

    return {
      get frameCount(): number {
        return frameCount;
      },
      runOneFrame(callbacks: DoomMainLoopPerFrameCallbacks): void {
        if (!started) {
          throw new Error('not started');
        }

        callbacks.startFrame();
        callbacks.tryRunTics();
        callbacks.display();
        callbacks.updateSounds();
        frameCount++;
      },
      setup(): void {
        started = true;
      },
      get started(): boolean {
        return started;
      },
    };
  },
});

const PRE_INCREMENT_CANDIDATE: DoomMainLoopPerFrameOrderingCandidate = Object.freeze({
  create: () => {
    let frameCount = 0;
    let started = false;

    return {
      get frameCount(): number {
        return frameCount;
      },
      runOneFrame(callbacks: DoomMainLoopPerFrameCallbacks): void {
        if (!started) {
          throw new Error('not started');
        }

        frameCount++;
        callbacks.startFrame();
        callbacks.tryRunTics();
        callbacks.updateSounds();
        callbacks.display();
      },
      setup(): void {
        started = true;
      },
      get started(): boolean {
        return started;
      },
    };
  },
});

const UNGATED_FRAME_CANDIDATE: DoomMainLoopPerFrameOrderingCandidate = Object.freeze({
  create: () => {
    let frameCount = 0;
    let started = false;

    return {
      get frameCount(): number {
        return frameCount;
      },
      runOneFrame(callbacks: DoomMainLoopPerFrameCallbacks): void {
        callbacks.startFrame();
        callbacks.tryRunTics();
        callbacks.updateSounds();
        callbacks.display();
        frameCount++;
      },
      setup(): void {
        started = true;
      },
      get started(): boolean {
        return started;
      },
    };
  },
});

describe('Doom main-loop per-frame ordering audit', () => {
  it('pins the canonical per-frame phase sequence independently of runtime constants', () => {
    expect(AUDITED_MAIN_LOOP_PER_FRAME_PHASE_COUNT).toBe(4);
    expect(AUDITED_MAIN_LOOP_PER_FRAME_PHASES).toEqual(['startFrame', 'tryRunTics', 'updateSounds', 'display']);
    expect(Object.isFrozen(AUDITED_MAIN_LOOP_PER_FRAME_PHASES)).toBe(true);
  });

  it('keeps the invariant ledger closed and sorted', () => {
    const invariantIdentifiers = DOOM_MAIN_LOOP_PER_FRAME_ORDERING_INVARIANTS.map((invariant) => invariant.identifier);
    const sortedInvariantIdentifiers = [...invariantIdentifiers].sort();

    expect(DOOM_MAIN_LOOP_PER_FRAME_ORDERING_INVARIANTS.length).toBe(8);
    expect(new Set(invariantIdentifiers).size).toBe(invariantIdentifiers.length);
    expect(invariantIdentifiers).toEqual(sortedInvariantIdentifiers);
    expect(Object.isFrozen(DOOM_MAIN_LOOP_PER_FRAME_ORDERING_INVARIANTS)).toBe(true);
  });

  it('passes the hand-rolled reference candidate', () => {
    expect(crossCheckDoomMainLoopPerFrameOrdering(DOOM_MAIN_LOOP_PER_FRAME_ORDERING_REFERENCE_CANDIDATE)).toEqual([]);
  });

  it('reports a canonical-order failure when display runs before sound update', () => {
    const failures = crossCheckDoomMainLoopPerFrameOrdering(DISPLAY_BEFORE_SOUND_CANDIDATE);

    expect(failures).toContain('MAIN_LOOP_PER_FRAME_RUNS_CANONICAL_ORDER');
    expect(failures).toContain('MAIN_LOOP_PER_FRAME_REPEATS_ORDER_EACH_FRAME');
  });

  it('reports a frame-count timing failure when frameCount increments before callbacks', () => {
    const failures = crossCheckDoomMainLoopPerFrameOrdering(PRE_INCREMENT_CANDIDATE);

    expect(failures).toContain('MAIN_LOOP_PER_FRAME_INCREMENTS_FRAME_COUNT_AFTER_CALLBACKS');
  });

  it('reports a setup-gate failure when a frame can run before setup', () => {
    const failures = crossCheckDoomMainLoopPerFrameOrdering(UNGATED_FRAME_CANDIDATE);

    expect(failures).toContain('MAIN_LOOP_PER_FRAME_REJECTS_RUN_BEFORE_SETUP');
  });
});
