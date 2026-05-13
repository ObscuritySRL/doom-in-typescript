import { describe, expect, test } from 'bun:test';

import { existsSync } from 'node:fs';

import { PHASE_04_DEMO_SYNC_PRIMITIVES_EXPECTATIONS, PHASE_04_DEMO_SYNC_PRIMITIVES_MODULES, evaluateDemoSyncGate } from '../../../src/core/gate-demo-sync-primitives.ts';

describe('phase 04 demo sync primitives gate', () => {
  test('every required module exists on disk', () => {
    for (const requiredModule of PHASE_04_DEMO_SYNC_PRIMITIVES_MODULES) {
      expect(existsSync(requiredModule)).toBe(true);
    }
  });

  test('pinned vanilla demo constants', () => {
    expect(PHASE_04_DEMO_SYNC_PRIMITIVES_EXPECTATIONS.demoHeaderBytes).toBe(13);
    expect(PHASE_04_DEMO_SYNC_PRIMITIVES_EXPECTATIONS.demoTiccmdBytes).toBe(4);
    expect(PHASE_04_DEMO_SYNC_PRIMITIVES_EXPECTATIONS.demoTerminatorByte).toBe(0x80);
    expect(PHASE_04_DEMO_SYNC_PRIMITIVES_EXPECTATIONS.demoVanillaVersion).toBe(109);
    expect(PHASE_04_DEMO_SYNC_PRIMITIVES_EXPECTATIONS.demoMaxPlayers).toBe(4);
    expect(PHASE_04_DEMO_SYNC_PRIMITIVES_EXPECTATIONS.demoByteLimit).toBe(0x20000);
    expect(PHASE_04_DEMO_SYNC_PRIMITIVES_EXPECTATIONS.playbackPhaseCount).toBe(5);
    expect(PHASE_04_DEMO_SYNC_PRIMITIVES_EXPECTATIONS.recordingPhaseCount).toBe(4);
  });

  test('gate closes with the canonical observed inputs', () => {
    const decision = evaluateDemoSyncGate({
      observedModules: [...PHASE_04_DEMO_SYNC_PRIMITIVES_MODULES],
      observedConstants: PHASE_04_DEMO_SYNC_PRIMITIVES_EXPECTATIONS,
    });
    expect(decision.closed).toBe(true);
    expect(decision.violations).toEqual([]);
  });

  test('flags missing_module when a primitive is absent', () => {
    const decision = evaluateDemoSyncGate({
      observedModules: PHASE_04_DEMO_SYNC_PRIMITIVES_MODULES.slice(0, -1),
      observedConstants: PHASE_04_DEMO_SYNC_PRIMITIVES_EXPECTATIONS,
    });
    expect(decision.closed).toBe(false);
    expect(decision.violations).toContain('missing_module');
  });

  test('flags wrong_constants when a constant differs', () => {
    const decision = evaluateDemoSyncGate({
      observedModules: [...PHASE_04_DEMO_SYNC_PRIMITIVES_MODULES],
      observedConstants: { ...PHASE_04_DEMO_SYNC_PRIMITIVES_EXPECTATIONS, demoHeaderBytes: 14 },
    });
    expect(decision.closed).toBe(false);
    expect(decision.violations).toContain('wrong_constants');
  });
});
