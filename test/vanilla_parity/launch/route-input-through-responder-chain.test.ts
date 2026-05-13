import { describe, expect, test } from 'bun:test';

import { VANILLA_RESPONDER_CHAIN, routeEventThroughResponderChain } from '../../../src/bootstrap/route-input-through-responder-chain.ts';

describe('vanilla responder chain', () => {
  test('pins the canonical priority order M -> AM -> ST -> HU -> G', () => {
    expect(VANILLA_RESPONDER_CHAIN).toEqual(['M_Responder', 'AM_Responder', 'ST_Responder', 'HU_Responder', 'G_Responder']);
  });

  test('event consumed by M_Responder skips every later responder', () => {
    const decision = routeEventThroughResponderChain([
      { responder: 'M_Responder', consumed: true },
      { responder: 'AM_Responder', consumed: false },
      { responder: 'ST_Responder', consumed: false },
      { responder: 'HU_Responder', consumed: false },
      { responder: 'G_Responder', consumed: false },
    ]);
    expect(decision.consumedBy).toBe('M_Responder');
    expect(decision.skippedResponders).toEqual(['AM_Responder', 'ST_Responder', 'HU_Responder', 'G_Responder']);
  });

  test('event consumed by G_Responder skips nothing', () => {
    const decision = routeEventThroughResponderChain([
      { responder: 'M_Responder', consumed: false },
      { responder: 'AM_Responder', consumed: false },
      { responder: 'ST_Responder', consumed: false },
      { responder: 'HU_Responder', consumed: false },
      { responder: 'G_Responder', consumed: true },
    ]);
    expect(decision.consumedBy).toBe('G_Responder');
    expect(decision.skippedResponders).toEqual([]);
  });

  test('uncomsumed event falls through with consumedBy null', () => {
    const decision = routeEventThroughResponderChain([
      { responder: 'M_Responder', consumed: false },
      { responder: 'AM_Responder', consumed: false },
      { responder: 'ST_Responder', consumed: false },
      { responder: 'HU_Responder', consumed: false },
      { responder: 'G_Responder', consumed: false },
    ]);
    expect(decision.consumedBy).toBeNull();
    expect(decision.skippedResponders).toEqual([]);
  });

  test('outcomes passed out of order are reordered by chain priority', () => {
    const decision = routeEventThroughResponderChain([
      { responder: 'G_Responder', consumed: true },
      { responder: 'AM_Responder', consumed: true },
      { responder: 'M_Responder', consumed: false },
    ]);
    expect(decision.consumedBy).toBe('AM_Responder');
    expect(decision.skippedResponders).toContain('G_Responder');
  });
});
