import { describe, expect, test } from 'bun:test';

import {
  VANILLA_INTERMISSION_AND_FINALE_GATE_INVARIANTS,
  assertVanillaIntermissionAndFinaleGateInvariants,
  computeVanillaFinaleVisibleCharCount,
  computeVanillaIntermissionPercent,
  getVanillaIntermissionBackgroundLump,
  resolveVanillaFinalePostTextScope,
} from '../../../src/ui/gate-intermission-and-finale-parity.ts';

describe('VANILLA_INTERMISSION_AND_FINALE_GATE_INVARIANTS', () => {
  test('records the four core intermission/finale timing invariants', () => {
    expect(VANILLA_INTERMISSION_AND_FINALE_GATE_INVARIANTS.intermissionPercentStep).toBe(2);
    expect(VANILLA_INTERMISSION_AND_FINALE_GATE_INVARIANTS.intermissionYouAreHereBlinkTics).toBe(9);
    expect(VANILLA_INTERMISSION_AND_FINALE_GATE_INVARIANTS.finaleTextSpeedTicsPerChar).toBe(3);
    expect(VANILLA_INTERMISSION_AND_FINALE_GATE_INVARIANTS.finaleTextWaitTics).toBe(250);
  });

  test('invariants object is frozen', () => {
    expect(Object.isFrozen(VANILLA_INTERMISSION_AND_FINALE_GATE_INVARIANTS)).toBe(true);
  });
});

describe('assertVanillaIntermissionAndFinaleGateInvariants', () => {
  test('passes against the canonical intermission/finale wiring', () => {
    expect(() => assertVanillaIntermissionAndFinaleGateInvariants()).not.toThrow();
  });
});

describe('re-exports surface', () => {
  test('intermission percent compute is reachable', () => {
    expect(computeVanillaIntermissionPercent({ killed: 50, maxKilled: 100 })).toBe(50);
  });

  test('intermission background lump is reachable', () => {
    expect(getVanillaIntermissionBackgroundLump({ episode: 1, isCommercial: false })).toBe('WIMAP0');
  });

  test('finale visible char count is reachable', () => {
    expect(computeVanillaFinaleVisibleCharCount({ finalecount: 13, textLength: 100 })).toBe(1);
  });

  test('finale post-text scope is reachable', () => {
    expect(resolveVanillaFinalePostTextScope({ gameMode: 'commercial', episode: 1 })).toBe('cast-call');
  });
});
