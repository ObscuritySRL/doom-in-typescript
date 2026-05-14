import { describe, expect, test } from 'bun:test';

import { STATUS_AUTOMAP_PARITY_GATE } from '../../../src/render/gate-status-bar-and-automap-parity.ts';

describe('gate: status bar and automap parity', () => {
  test('status bar widget X positions', () => {
    expect(STATUS_AUTOMAP_PARITY_GATE.stHealthX).toBe(90);
    expect(STATUS_AUTOMAP_PARITY_GATE.stArmorX).toBe(221);
    expect(STATUS_AUTOMAP_PARITY_GATE.stAmmoX).toBe(44);
  });

  test('face widget position and state count', () => {
    expect(STATUS_AUTOMAP_PARITY_GATE.stFaceX).toBe(143);
    expect(STATUS_AUTOMAP_PARITY_GATE.stFaceY).toBe(168);
    expect(STATUS_AUTOMAP_PARITY_GATE.stGodFace).toBe(40);
    expect(STATUS_AUTOMAP_PARITY_GATE.stDeadFace).toBe(41);
    expect(STATUS_AUTOMAP_PARITY_GATE.stTotalFaces).toBe(42);
  });

  test('keys: 6 sprites at x=239', () => {
    expect(STATUS_AUTOMAP_PARITY_GATE.stKeyX).toBe(239);
    expect(STATUS_AUTOMAP_PARITY_GATE.stNumKeySprites).toBe(6);
  });

  test('automap: 10 markpoints, state enum 0/1', () => {
    expect(STATUS_AUTOMAP_PARITY_GATE.amNumMarkpoints).toBe(10);
    expect(STATUS_AUTOMAP_PARITY_GATE.amStateInactive).toBe(0);
    expect(STATUS_AUTOMAP_PARITY_GATE.amStateActive).toBe(1);
  });
});
