import { describe, expect, it } from 'bun:test';

import type { CleanupRegistration, CleanupStepName } from '../../src/bootstrap/quitFlow.ts';
import { CANONICAL_QUIT_ORDER, CANONICAL_REGISTRATION_ORDER, CLEANUP_STEP_COUNT, QuitFlow } from '../../src/bootstrap/quitFlow.ts';
import { INIT_ORDER } from '../../src/bootstrap/initOrder.ts';

/** Register the full canonical shareware cleanup sequence. */
function registerCanonical(flow: QuitFlow): void {
  for (const registration of CANONICAL_REGISTRATION_ORDER) {
    flow.register(registration.name, registration.runOnError);
  }
}

/** Collect step names dispatched during executeQuit. */
function collectQuit(flow: QuitFlow): readonly CleanupStepName[] {
  const log: CleanupStepName[] = [];
  return flow.executeQuit((name) => {
    log.push(name);
  }) as readonly CleanupStepName[];
}

/** Collect step names dispatched during executeErrorQuit. */
function collectErrorQuit(flow: QuitFlow): readonly CleanupStepName[] {
  const log: CleanupStepName[] = [];
  return flow.executeErrorQuit((name) => {
    log.push(name);
  }) as readonly CleanupStepName[];
}

describe('CANONICAL_REGISTRATION_ORDER', () => {
  it('has exactly CLEANUP_STEP_COUNT entries', () => {
    expect(CANONICAL_REGISTRATION_ORDER).toHaveLength(CLEANUP_STEP_COUNT);
  });

  it('matches the constant count of 8', () => {
    expect(CLEANUP_STEP_COUNT).toBe(8);
  });

  it('contains unique step names', () => {
    const names = CANONICAL_REGISTRATION_ORDER.map((r) => r.name);
    expect(new Set(names).size).toBe(CLEANUP_STEP_COUNT);
  });

  it('is frozen at the array level', () => {
    expect(Object.isFrozen(CANONICAL_REGISTRATION_ORDER)).toBe(true);
  });

  it('has frozen entries', () => {
    for (const registration of CANONICAL_REGISTRATION_ORDER) {
      expect(Object.isFrozen(registration)).toBe(true);
    }
  });

  it('starts with M_SaveDefaults (first registered, from M_LoadDefaults)', () => {
    expect(CANONICAL_REGISTRATION_ORDER[0]!.name).toBe('M_SaveDefaults');
  });

  it('ends with I_ShutdownGraphics (last registered, from D_DoomLoop)', () => {
    expect(CANONICAL_REGISTRATION_ORDER[CLEANUP_STEP_COUNT - 1]!.name).toBe('I_ShutdownGraphics');
  });

  it('has all entries with runOnError=true in Chocolate Doom 2.2.1', () => {
    for (const registration of CANONICAL_REGISTRATION_ORDER) {
      expect(registration.runOnError).toBe(true);
    }
  });
});

describe('CANONICAL_QUIT_ORDER', () => {
  it('has exactly CLEANUP_STEP_COUNT entries', () => {
    expect(CANONICAL_QUIT_ORDER).toHaveLength(CLEANUP_STEP_COUNT);
  });

  it('is the LIFO reverse of CANONICAL_REGISTRATION_ORDER', () => {
    const reversed = [...CANONICAL_REGISTRATION_ORDER].reverse().map((r) => r.name);
    expect([...CANONICAL_QUIT_ORDER]).toEqual(reversed);
  });

  it('starts with I_ShutdownGraphics (last registered = first to execute)', () => {
    expect(CANONICAL_QUIT_ORDER[0]).toBe('I_ShutdownGraphics');
  });

  it('ends with M_SaveDefaults (first registered = last to execute)', () => {
    expect(CANONICAL_QUIT_ORDER[CLEANUP_STEP_COUNT - 1]).toBe('M_SaveDefaults');
  });

  it('is frozen', () => {
    expect(Object.isFrozen(CANONICAL_QUIT_ORDER)).toBe(true);
  });

  it('contains unique step names', () => {
    expect(new Set(CANONICAL_QUIT_ORDER).size).toBe(CLEANUP_STEP_COUNT);
  });
});

describe('QuitFlow: construction', () => {
  it('starts with hasQuit=false', () => {
    const flow = new QuitFlow();
    expect(flow.hasQuit).toBe(false);
  });

  it('starts with registrationCount=0', () => {
    const flow = new QuitFlow();
    expect(flow.registrationCount).toBe(0);
  });
});

describe('QuitFlow: register', () => {
  it('increments registrationCount', () => {
    const flow = new QuitFlow();
    flow.register('M_SaveDefaults', true);
    expect(flow.registrationCount).toBe(1);
    flow.register('I_ShutdownTimer', true);
    expect(flow.registrationCount).toBe(2);
  });

  it('accepts the full canonical sequence', () => {
    const flow = new QuitFlow();
    registerCanonical(flow);
    expect(flow.registrationCount).toBe(CLEANUP_STEP_COUNT);
  });

  it('throws after executeQuit', () => {
    const flow = new QuitFlow();
    flow.register('M_SaveDefaults', true);
    flow.executeQuit(() => {});
    expect(() => flow.register('I_ShutdownTimer', true)).toThrow('QuitFlow.register called after quit');
  });

  it('throws after executeErrorQuit', () => {
    const flow = new QuitFlow();
    flow.register('M_SaveDefaults', true);
    flow.executeErrorQuit(() => {});
    expect(() => flow.register('I_ShutdownTimer', true)).toThrow('QuitFlow.register called after quit');
  });
});

describe('QuitFlow: executeQuit', () => {
  it('executes all handlers in LIFO order', () => {
    const flow = new QuitFlow();
    registerCanonical(flow);
    const executed = collectQuit(flow);
    expect([...executed]).toEqual([...CANONICAL_QUIT_ORDER]);
  });

  it('sets hasQuit=true', () => {
    const flow = new QuitFlow();
    flow.register('M_SaveDefaults', true);
    flow.executeQuit(() => {});
    expect(flow.hasQuit).toBe(true);
  });

  it('returns a frozen array', () => {
    const flow = new QuitFlow();
    flow.register('M_SaveDefaults', true);
    const result = flow.executeQuit(() => {});
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('throws on second call', () => {
    const flow = new QuitFlow();
    flow.register('M_SaveDefaults', true);
    flow.executeQuit(() => {});
    expect(() => flow.executeQuit(() => {})).toThrow('QuitFlow.executeQuit called after quit');
  });

  it('returns empty array for zero registrations', () => {
    const flow = new QuitFlow();
    const executed = collectQuit(flow);
    expect(executed).toHaveLength(0);
  });

  it('dispatches to the callback in execution order', () => {
    const flow = new QuitFlow();
    flow.register('M_SaveDefaults', true);
    flow.register('I_ShutdownTimer', true);
    flow.register('I_ShutdownGraphics', true);

    const dispatched: CleanupStepName[] = [];
    flow.executeQuit((name) => dispatched.push(name));

    expect(dispatched).toEqual(['I_ShutdownGraphics', 'I_ShutdownTimer', 'M_SaveDefaults']);
  });

  it('includes handlers with runOnError=false', () => {
    const flow = new QuitFlow();
    flow.register('M_SaveDefaults', true);
    flow.register('D_Endoom', false);
    flow.register('I_ShutdownGraphics', true);

    const executed = collectQuit(flow);
    expect(executed).toContain('D_Endoom');
    expect(executed).toHaveLength(3);
  });
});

describe('QuitFlow: executeErrorQuit', () => {
  it('executes only runOnError handlers in LIFO order', () => {
    const flow = new QuitFlow();
    flow.register('M_SaveDefaults', true);
    flow.register('D_Endoom', false);
    flow.register('I_ShutdownGraphics', true);

    const executed = collectErrorQuit(flow);
    expect([...executed]).toEqual(['I_ShutdownGraphics', 'M_SaveDefaults']);
  });

  it('skips handlers with runOnError=false', () => {
    const flow = new QuitFlow();
    flow.register('M_SaveDefaults', true);
    flow.register('D_Endoom', false);
    flow.register('D_QuitNetGame', false);
    flow.register('I_ShutdownGraphics', true);

    const executed = collectErrorQuit(flow);
    expect(executed).not.toContain('D_Endoom');
    expect(executed).not.toContain('D_QuitNetGame');
    expect(executed).toHaveLength(2);
  });

  it('sets hasQuit=true', () => {
    const flow = new QuitFlow();
    flow.register('M_SaveDefaults', true);
    flow.executeErrorQuit(() => {});
    expect(flow.hasQuit).toBe(true);
  });

  it('returns a frozen array', () => {
    const flow = new QuitFlow();
    flow.register('M_SaveDefaults', true);
    const result = flow.executeErrorQuit(() => {});
    expect(Object.isFrozen(result)).toBe(true);
  });

  it('throws on second call', () => {
    const flow = new QuitFlow();
    flow.register('M_SaveDefaults', true);
    flow.executeErrorQuit(() => {});
    expect(() => flow.executeErrorQuit(() => {})).toThrow('QuitFlow.executeErrorQuit called after quit');
  });

  it('throws after executeQuit was already called', () => {
    const flow = new QuitFlow();
    flow.register('M_SaveDefaults', true);
    flow.executeQuit(() => {});
    expect(() => flow.executeErrorQuit(() => {})).toThrow('QuitFlow.executeErrorQuit called after quit');
  });

  it('returns empty array for zero registrations', () => {
    const flow = new QuitFlow();
    const executed = collectErrorQuit(flow);
    expect(executed).toHaveLength(0);
  });
});

describe('QuitFlow: parity', () => {
  it('canonical quit matches I_Quit LIFO execution for shareware Doom', () => {
    const flow = new QuitFlow();
    registerCanonical(flow);
    const executed = collectQuit(flow);

    expect([...executed]).toEqual(['I_ShutdownGraphics', 'D_Endoom', 'D_QuitNetGame', 'S_Shutdown', 'I_ShutdownMusic', 'I_ShutdownSound', 'I_ShutdownTimer', 'M_SaveDefaults']);
  });

  it('in Chocolate Doom 2.2.1, error quit executes all handlers (all runOnError=true)', () => {
    const flow = new QuitFlow();
    registerCanonical(flow);
    const executed = collectErrorQuit(flow);

    expect(executed).toHaveLength(CLEANUP_STEP_COUNT);
    expect([...executed]).toEqual([...CANONICAL_QUIT_ORDER]);
  });

  it('M_SaveDefaults is last to execute (config saved after all subsystems shut down)', () => {
    const flow = new QuitFlow();
    registerCanonical(flow);
    const executed = collectQuit(flow);

    expect(executed[executed.length - 1]).toBe('M_SaveDefaults');
  });

  it('I_ShutdownGraphics is first to execute (graphics torn down before ENDOOM)', () => {
    const flow = new QuitFlow();
    registerCanonical(flow);
    const executed = collectQuit(flow);

    expect(executed[0]).toBe('I_ShutdownGraphics');
  });

  it('cleanup reverses initialization: M_SaveDefaults registered at init, executed last on quit', () => {
    const mLoadDefaults = INIT_ORDER.find((step) => step.label === 'M_LoadDefaults');
    expect(mLoadDefaults).toBeDefined();
    expect(mLoadDefaults!.index).toBe(2);

    expect(CANONICAL_REGISTRATION_ORDER[0]!.name).toBe('M_SaveDefaults');
    expect(CANONICAL_QUIT_ORDER[CLEANUP_STEP_COUNT - 1]).toBe('M_SaveDefaults');
  });

  it('S_Init cleanup group preserves internal registration order (sound, music, then S_Shutdown)', () => {
    const soundIndex = CANONICAL_REGISTRATION_ORDER.findIndex((r) => r.name === 'I_ShutdownSound');
    const musicIndex = CANONICAL_REGISTRATION_ORDER.findIndex((r) => r.name === 'I_ShutdownMusic');
    const shutdownIndex = CANONICAL_REGISTRATION_ORDER.findIndex((r) => r.name === 'S_Shutdown');

    expect(soundIndex).toBeLessThan(musicIndex);
    expect(musicIndex).toBeLessThan(shutdownIndex);
  });

  it('D_QuitNetGame registered after S_Shutdown (D_CheckNetGame is init step 11, after S_Init step 10)', () => {
    const sShutdownIndex = CANONICAL_REGISTRATION_ORDER.findIndex((r) => r.name === 'S_Shutdown');
    const quitNetIndex = CANONICAL_REGISTRATION_ORDER.findIndex((r) => r.name === 'D_QuitNetGame');

    expect(quitNetIndex).toBeGreaterThan(sShutdownIndex);
  });

  it('hypothetical runOnError=false D_Endoom is skipped by error quit (mechanism test)', () => {
    const flow = new QuitFlow();
    flow.register('M_SaveDefaults', true);
    flow.register('I_ShutdownTimer', true);
    flow.register('D_Endoom', false);
    flow.register('I_ShutdownGraphics', true);

    const executed = collectErrorQuit(flow);
    expect(executed).not.toContain('D_Endoom');
    expect(executed).toHaveLength(3);
    expect([...executed]).toEqual(['I_ShutdownGraphics', 'I_ShutdownTimer', 'M_SaveDefaults']);
  });
});

describe('QuitFlow: type satisfaction', () => {
  it('CleanupStepName covers all CANONICAL_QUIT_ORDER entries', () => {
    const names: CleanupStepName[] = [...CANONICAL_QUIT_ORDER];
    expect(names).toHaveLength(CLEANUP_STEP_COUNT);
  });

  it('CleanupRegistration interface is satisfied by CANONICAL_REGISTRATION_ORDER entries', () => {
    const entries: CleanupRegistration[] = [...CANONICAL_REGISTRATION_ORDER];
    expect(entries).toHaveLength(CLEANUP_STEP_COUNT);
  });
});
