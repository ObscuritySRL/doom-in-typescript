import { describe, expect, test } from 'bun:test';

import { VANILLA_TELEFRAG_DAMAGE, evaluateTeleportMove } from '../../../src/map/implement-teleport-move-semantics.ts';

describe('evaluateTeleportMove', () => {
  test('telefrag damage is 10000 (vanilla P_TouchSpecialThing / Teleport)', () => {
    expect(VANILLA_TELEFRAG_DAMAGE).toBe(10000);
  });

  test('out-of-range destination is rejected', () => {
    const result = evaluateTeleportMove({ destinationX: 0, destinationY: 0, destinationCellInRange: false, otherThingsAtDestination: 0, teleporterIsVoodooSafe: false });
    expect(result.committed).toBe(false);
  });

  test('in-range with no other things commits without telefrag', () => {
    const result = evaluateTeleportMove({ destinationX: 0, destinationY: 0, destinationCellInRange: true, otherThingsAtDestination: 0, teleporterIsVoodooSafe: false });
    expect(result.committed).toBe(true);
    expect(result.telefragVictimCount).toBe(0);
  });

  test('in-range with other things telefrags them', () => {
    const result = evaluateTeleportMove({ destinationX: 0, destinationY: 0, destinationCellInRange: true, otherThingsAtDestination: 2, teleporterIsVoodooSafe: false });
    expect(result.committed).toBe(true);
    expect(result.telefragVictimCount).toBe(2);
  });

  test('voodoo-safe teleporter does not telefrag', () => {
    const result = evaluateTeleportMove({ destinationX: 0, destinationY: 0, destinationCellInRange: true, otherThingsAtDestination: 2, teleporterIsVoodooSafe: true });
    expect(result.telefragVictimCount).toBe(0);
  });
});
