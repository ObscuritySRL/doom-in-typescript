import { describe, expect, test } from 'bun:test';

import { VANILLA_IWAD_CAPABILITIES, detectIwadCapability, evaluateIwadDetectionGate } from '../../../src/assets/gate-user-supplied-doom-wad-detection.ts';

describe('vanilla IWAD capability set', () => {
  test('declares shareware, registered, ultimate, unknown', () => {
    expect(VANILLA_IWAD_CAPABILITIES).toEqual(['shareware', 'registered', 'ultimate', 'unknown']);
  });
});

describe('detectIwadCapability', () => {
  test('shareware: only E1 maps', () => {
    expect(detectIwadCapability({ hasE1Maps: true, hasE2Maps: false, hasE3Maps: false, hasE4Maps: false })).toBe('shareware');
  });

  test('registered: E1, E2, E3', () => {
    expect(detectIwadCapability({ hasE1Maps: true, hasE2Maps: true, hasE3Maps: true, hasE4Maps: false })).toBe('registered');
  });

  test('ultimate: E1, E2, E3, E4', () => {
    expect(detectIwadCapability({ hasE1Maps: true, hasE2Maps: true, hasE3Maps: true, hasE4Maps: true })).toBe('ultimate');
  });

  test('unknown: no E1 maps', () => {
    expect(detectIwadCapability({ hasE1Maps: false, hasE2Maps: true, hasE3Maps: true, hasE4Maps: true })).toBe('unknown');
  });

  test('unknown: E1 + E2 but no E3', () => {
    expect(detectIwadCapability({ hasE1Maps: true, hasE2Maps: true, hasE3Maps: false, hasE4Maps: false })).toBe('unknown');
  });
});

describe('evaluateIwadDetectionGate', () => {
  test('passes on shareware with no violations', () => {
    const decision = evaluateIwadDetectionGate({ hasE1Maps: true, hasE2Maps: false, hasE3Maps: false, hasE4Maps: false });
    expect(decision.capability).toBe('shareware');
    expect(decision.violations).toEqual([]);
  });

  test('flags inconsistent_episode_set when E4 present without E1/E2/E3', () => {
    const decision = evaluateIwadDetectionGate({ hasE1Maps: true, hasE2Maps: false, hasE3Maps: false, hasE4Maps: true });
    expect(decision.violations).toContain('inconsistent_episode_set');
  });

  test('flags unknown_iwad for unrecognized lump set', () => {
    const decision = evaluateIwadDetectionGate({ hasE1Maps: false, hasE2Maps: false, hasE3Maps: false, hasE4Maps: false });
    expect(decision.violations).toContain('unknown_iwad');
  });
});
