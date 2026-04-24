import { describe, expect, it } from 'bun:test';

import type { MainLoopCallbacks, MainLoopPhase, PreLoopCallbacks, PreLoopStep } from '../../src/mainLoop.ts';
import { MAIN_LOOP_PHASE_COUNT, MAIN_LOOP_PHASES, MainLoop, PRE_LOOP_STEP_COUNT, PRE_LOOP_STEPS } from '../../src/mainLoop.ts';

/** Create a PreLoopCallbacks that records calls in order. */
function createPreLoopCallbacks(): PreLoopCallbacks & { callLog: string[] } {
  const callLog: string[] = [];
  return {
    callLog,
    executeSetViewSize() {
      callLog.push('executeSetViewSize');
    },
    initialTryRunTics() {
      callLog.push('initialTryRunTics');
    },
    restoreBuffer() {
      callLog.push('restoreBuffer');
    },
    startGameLoop() {
      callLog.push('startGameLoop');
    },
  };
}

/** Create a MainLoopCallbacks that records calls in order. */
function createFrameCallbacks(): MainLoopCallbacks & { callLog: string[] } {
  const callLog: string[] = [];
  return {
    callLog,
    display() {
      callLog.push('display');
    },
    startFrame() {
      callLog.push('startFrame');
    },
    tryRunTics() {
      callLog.push('tryRunTics');
    },
    updateSounds() {
      callLog.push('updateSounds');
    },
  };
}

describe('MAIN_LOOP_PHASES', () => {
  it('has exactly 4 phases', () => {
    expect(MAIN_LOOP_PHASES).toHaveLength(MAIN_LOOP_PHASE_COUNT);
  });

  it('matches the constant count', () => {
    expect(MAIN_LOOP_PHASE_COUNT).toBe(4);
  });

  it('is in canonical D_DoomLoop execution order', () => {
    expect(MAIN_LOOP_PHASES).toEqual(['startFrame', 'tryRunTics', 'updateSounds', 'display']);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(MAIN_LOOP_PHASES)).toBe(true);
  });

  it('contains no duplicates', () => {
    const unique = new Set(MAIN_LOOP_PHASES);
    expect(unique.size).toBe(MAIN_LOOP_PHASES.length);
  });
});

describe('PRE_LOOP_STEPS', () => {
  it('has exactly 4 steps', () => {
    expect(PRE_LOOP_STEPS).toHaveLength(PRE_LOOP_STEP_COUNT);
  });

  it('matches the constant count', () => {
    expect(PRE_LOOP_STEP_COUNT).toBe(4);
  });

  it('is in canonical D_DoomLoop pre-loop order', () => {
    expect(PRE_LOOP_STEPS).toEqual(['initialTryRunTics', 'restoreBuffer', 'executeSetViewSize', 'startGameLoop']);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(PRE_LOOP_STEPS)).toBe(true);
  });

  it('contains no duplicates', () => {
    const unique = new Set(PRE_LOOP_STEPS);
    expect(unique.size).toBe(PRE_LOOP_STEPS.length);
  });
});

describe('MainLoop: construction', () => {
  it('starts with started=false', () => {
    const loop = new MainLoop();
    expect(loop.started).toBe(false);
  });

  it('starts with frameCount=0', () => {
    const loop = new MainLoop();
    expect(loop.frameCount).toBe(0);
  });
});

describe('MainLoop: setup', () => {
  it('calls pre-loop steps in canonical order', () => {
    const loop = new MainLoop();
    const callbacks = createPreLoopCallbacks();
    loop.setup(callbacks);

    expect(callbacks.callLog).toEqual(['initialTryRunTics', 'restoreBuffer', 'executeSetViewSize', 'startGameLoop']);
  });

  it('sets started=true after setup', () => {
    const loop = new MainLoop();
    loop.setup(createPreLoopCallbacks());
    expect(loop.started).toBe(true);
  });

  it('does not advance frameCount', () => {
    const loop = new MainLoop();
    loop.setup(createPreLoopCallbacks());
    expect(loop.frameCount).toBe(0);
  });

  it('throws on duplicate setup call', () => {
    const loop = new MainLoop();
    loop.setup(createPreLoopCallbacks());
    expect(() => loop.setup(createPreLoopCallbacks())).toThrow('MainLoop.setup called more than once');
  });

  it('calls exactly PRE_LOOP_STEP_COUNT callbacks', () => {
    const loop = new MainLoop();
    const callbacks = createPreLoopCallbacks();
    loop.setup(callbacks);
    expect(callbacks.callLog).toHaveLength(PRE_LOOP_STEP_COUNT);
  });
});

describe('MainLoop: runOneFrame', () => {
  it('throws before setup', () => {
    const loop = new MainLoop();
    expect(() => loop.runOneFrame(createFrameCallbacks())).toThrow('MainLoop.runOneFrame called before setup');
  });

  it('calls frame phases in canonical D_DoomLoop order', () => {
    const loop = new MainLoop();
    loop.setup(createPreLoopCallbacks());
    const callbacks = createFrameCallbacks();
    loop.runOneFrame(callbacks);

    expect(callbacks.callLog).toEqual(['startFrame', 'tryRunTics', 'updateSounds', 'display']);
  });

  it('increments frameCount by 1 per call', () => {
    const loop = new MainLoop();
    loop.setup(createPreLoopCallbacks());
    const callbacks = createFrameCallbacks();

    loop.runOneFrame(callbacks);
    expect(loop.frameCount).toBe(1);

    loop.runOneFrame(callbacks);
    expect(loop.frameCount).toBe(2);

    loop.runOneFrame(callbacks);
    expect(loop.frameCount).toBe(3);
  });

  it('calls exactly MAIN_LOOP_PHASE_COUNT callbacks per frame', () => {
    const loop = new MainLoop();
    loop.setup(createPreLoopCallbacks());
    const callbacks = createFrameCallbacks();
    loop.runOneFrame(callbacks);
    expect(callbacks.callLog).toHaveLength(MAIN_LOOP_PHASE_COUNT);
  });

  it('produces fresh call log per frame with separate callbacks', () => {
    const loop = new MainLoop();
    loop.setup(createPreLoopCallbacks());

    const first = createFrameCallbacks();
    loop.runOneFrame(first);
    const second = createFrameCallbacks();
    loop.runOneFrame(second);

    expect(first.callLog).toEqual(second.callLog);
    expect(first.callLog).toHaveLength(MAIN_LOOP_PHASE_COUNT);
  });
});

describe('MainLoop: parity', () => {
  it('pre-loop step names match PRE_LOOP_STEPS identifiers', () => {
    const loop = new MainLoop();
    const callbacks = createPreLoopCallbacks();
    loop.setup(callbacks);

    for (let index = 0; index < PRE_LOOP_STEPS.length; index++) {
      expect(callbacks.callLog[index]).toBe(PRE_LOOP_STEPS[index]);
    }
  });

  it('frame phase names match MAIN_LOOP_PHASES identifiers', () => {
    const loop = new MainLoop();
    loop.setup(createPreLoopCallbacks());
    const callbacks = createFrameCallbacks();
    loop.runOneFrame(callbacks);

    for (let index = 0; index < MAIN_LOOP_PHASES.length; index++) {
      expect(callbacks.callLog[index]).toBe(MAIN_LOOP_PHASES[index]);
    }
  });

  it('display is always the last phase (D_Display after S_UpdateSounds)', () => {
    const loop = new MainLoop();
    loop.setup(createPreLoopCallbacks());
    const callbacks = createFrameCallbacks();
    loop.runOneFrame(callbacks);

    const displayIndex = callbacks.callLog.indexOf('display');
    const updateSoundsIndex = callbacks.callLog.indexOf('updateSounds');
    expect(displayIndex).toBe(callbacks.callLog.length - 1);
    expect(displayIndex).toBeGreaterThan(updateSoundsIndex);
  });

  it('tryRunTics precedes updateSounds (tic processing before audio)', () => {
    const loop = new MainLoop();
    loop.setup(createPreLoopCallbacks());
    const callbacks = createFrameCallbacks();
    loop.runOneFrame(callbacks);

    const tryRunTicsIndex = callbacks.callLog.indexOf('tryRunTics');
    const updateSoundsIndex = callbacks.callLog.indexOf('updateSounds');
    expect(tryRunTicsIndex).toBeLessThan(updateSoundsIndex);
  });

  it('startFrame is always the first phase (I_StartFrame before TryRunTics)', () => {
    const loop = new MainLoop();
    loop.setup(createPreLoopCallbacks());
    const callbacks = createFrameCallbacks();
    loop.runOneFrame(callbacks);

    expect(callbacks.callLog[0]).toBe('startFrame');
  });

  it('initialTryRunTics is the first pre-loop step', () => {
    const loop = new MainLoop();
    const callbacks = createPreLoopCallbacks();
    loop.setup(callbacks);

    expect(callbacks.callLog[0]).toBe('initialTryRunTics');
  });

  it('startGameLoop is the last pre-loop step', () => {
    const loop = new MainLoop();
    const callbacks = createPreLoopCallbacks();
    loop.setup(callbacks);

    expect(callbacks.callLog[callbacks.callLog.length - 1]).toBe('startGameLoop');
  });

  it('multi-frame sequence maintains strict ordering across 100 frames', () => {
    const loop = new MainLoop();
    loop.setup(createPreLoopCallbacks());
    const allCalls: string[] = [];
    const callbacks: MainLoopCallbacks = {
      display() {
        allCalls.push('display');
      },
      startFrame() {
        allCalls.push('startFrame');
      },
      tryRunTics() {
        allCalls.push('tryRunTics');
      },
      updateSounds() {
        allCalls.push('updateSounds');
      },
    };

    for (let frame = 0; frame < 100; frame++) {
      loop.runOneFrame(callbacks);
    }

    expect(allCalls).toHaveLength(400);
    for (let frame = 0; frame < 100; frame++) {
      const base = frame * MAIN_LOOP_PHASE_COUNT;
      expect(allCalls[base]).toBe('startFrame');
      expect(allCalls[base + 1]).toBe('tryRunTics');
      expect(allCalls[base + 2]).toBe('updateSounds');
      expect(allCalls[base + 3]).toBe('display');
    }
    expect(loop.frameCount).toBe(100);
  });
});

describe('MainLoop: type satisfaction', () => {
  it('MainLoopPhase covers all MAIN_LOOP_PHASES entries', () => {
    const phases: MainLoopPhase[] = [...MAIN_LOOP_PHASES];
    expect(phases).toHaveLength(MAIN_LOOP_PHASE_COUNT);
  });

  it('PreLoopStep covers all PRE_LOOP_STEPS entries', () => {
    const steps: PreLoopStep[] = [...PRE_LOOP_STEPS];
    expect(steps).toHaveLength(PRE_LOOP_STEP_COUNT);
  });
});
