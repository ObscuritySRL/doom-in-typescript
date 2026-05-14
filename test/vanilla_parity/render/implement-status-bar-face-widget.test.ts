import { describe, expect, test } from 'bun:test';

import {
  VANILLA_ST_DEADFACE,
  VANILLA_ST_EVILGRINOFFSET,
  VANILLA_ST_FACESTRIDE,
  VANILLA_ST_FACEX,
  VANILLA_ST_FACEY,
  VANILLA_ST_GODFACE,
  VANILLA_ST_NUMEXTRAFACES,
  VANILLA_ST_NUMPAINFACES,
  VANILLA_ST_NUMSPECIALFACES,
  VANILLA_ST_NUMSTRAIGHTFACES,
  VANILLA_ST_NUMTURNFACES,
  VANILLA_ST_OUCHOFFSET,
  VANILLA_ST_RAMPAGEOFFSET,
  VANILLA_ST_TOTAL_FACES,
  VANILLA_ST_TURNOFFSET,
} from '../../../src/render/implement-status-bar-face-widget.ts';

describe('vanilla status bar face widget constants', () => {
  test('face position (143, 168)', () => {
    expect(VANILLA_ST_FACEX).toBe(143);
    expect(VANILLA_ST_FACEY).toBe(168);
  });

  test('face state counts: pain=5, straight=3, turn=2, special=3, extra=2', () => {
    expect(VANILLA_ST_NUMPAINFACES).toBe(5);
    expect(VANILLA_ST_NUMSTRAIGHTFACES).toBe(3);
    expect(VANILLA_ST_NUMTURNFACES).toBe(2);
    expect(VANILLA_ST_NUMSPECIALFACES).toBe(3);
    expect(VANILLA_ST_NUMEXTRAFACES).toBe(2);
  });

  test('FACESTRIDE = 8, total faces = 42', () => {
    expect(VANILLA_ST_FACESTRIDE).toBe(8);
    expect(VANILLA_ST_TOTAL_FACES).toBe(42);
  });

  test('face offset constants', () => {
    expect(VANILLA_ST_TURNOFFSET).toBe(3);
    expect(VANILLA_ST_OUCHOFFSET).toBe(5);
    expect(VANILLA_ST_EVILGRINOFFSET).toBe(6);
    expect(VANILLA_ST_RAMPAGEOFFSET).toBe(7);
    expect(VANILLA_ST_GODFACE).toBe(40);
    expect(VANILLA_ST_DEADFACE).toBe(41);
  });
});
