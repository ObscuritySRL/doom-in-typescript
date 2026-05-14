import { describe, expect, test } from 'bun:test';

import {
  VANILLA_MUSIC_OPL_PARITY_GATE_ALLOWABLE_DRIFT,
  VANILLA_MUSIC_OPL_PARITY_GATE_BLOCKS,
  VANILLA_MUSIC_OPL_PARITY_GATE_COMPOSES,
  VANILLA_MUSIC_OPL_PARITY_GATE_EVENT_TYPES,
  VANILLA_MUSIC_OPL_PARITY_GATE_FIXTURE_PATH,
  VANILLA_MUSIC_OPL_PARITY_GATE_ID,
  VANILLA_MUSIC_OPL_PARITY_GATE_LUMPS,
  VANILLA_MUSIC_OPL_PARITY_GATE_SCOPE,
  vanillaMusicOplParityCheckPasses,
  vanillaMusicOplParityEventIsGated,
} from '../../../src/audio/gate-music-opl-parity.ts';

describe('vanilla music/OPL parity gate constants', () => {
  test('gate id = 11-031', () => {
    expect(VANILLA_MUSIC_OPL_PARITY_GATE_ID).toBe('11-031');
  });

  test('scope is MUS event stream (not synthesized PCM)', () => {
    expect(VANILLA_MUSIC_OPL_PARITY_GATE_SCOPE).toBe('mus-event-stream');
  });

  test('allowable drift = 0 (strict equality)', () => {
    expect(VANILLA_MUSIC_OPL_PARITY_GATE_ALLOWABLE_DRIFT).toBe(0);
  });

  test('blocks Phase 13 acceptance gates 13-001, 13-002, 13-003', () => {
    expect([...VANILLA_MUSIC_OPL_PARITY_GATE_BLOCKS]).toEqual(['13-001', '13-002', '13-003']);
  });

  test('composes 11-014..11-021, 11-027, 11-029', () => {
    expect(VANILLA_MUSIC_OPL_PARITY_GATE_COMPOSES.length).toBe(10);
    expect([...VANILLA_MUSIC_OPL_PARITY_GATE_COMPOSES]).toEqual(['11-014', '11-015', '11-016', '11-017', '11-018', '11-019', '11-020', '11-021', '11-027', '11-029']);
  });

  test('shareware DOOM 1 music lump scope: D_INTRO/D_INTROA/D_VICTOR/D_E1M1', () => {
    expect([...VANILLA_MUSIC_OPL_PARITY_GATE_LUMPS]).toEqual(['D_INTRO', 'D_INTROA', 'D_VICTOR', 'D_E1M1']);
  });

  test('5 of 8 MUS event types are gated', () => {
    expect(VANILLA_MUSIC_OPL_PARITY_GATE_EVENT_TYPES.length).toBe(6);
    expect([...VANILLA_MUSIC_OPL_PARITY_GATE_EVENT_TYPES]).toEqual(['NOTE_ON', 'NOTE_OFF', 'PITCH_BEND', 'CHANGE_CONTROLLER', 'SYSTEM_EVENT', 'SCORE_END']);
  });

  test('fixture path under test/oracles/fixtures/audio/', () => {
    expect(VANILLA_MUSIC_OPL_PARITY_GATE_FIXTURE_PATH).toBe('test/oracles/fixtures/audio/music-opl-windows.json');
  });
});

describe('vanillaMusicOplParityCheckPasses', () => {
  test('0 divergences passes', () => {
    expect(vanillaMusicOplParityCheckPasses(0)).toBe(true);
  });

  test('any positive divergence fails', () => {
    expect(vanillaMusicOplParityCheckPasses(1)).toBe(false);
    expect(vanillaMusicOplParityCheckPasses(100)).toBe(false);
  });

  test('rejects negative or non-integer', () => {
    expect(() => vanillaMusicOplParityCheckPasses(-1)).toThrow();
    expect(() => vanillaMusicOplParityCheckPasses(1.5)).toThrow();
  });
});

describe('vanillaMusicOplParityEventIsGated', () => {
  test('gated event types', () => {
    expect(vanillaMusicOplParityEventIsGated('NOTE_ON')).toBe(true);
    expect(vanillaMusicOplParityEventIsGated('NOTE_OFF')).toBe(true);
    expect(vanillaMusicOplParityEventIsGated('PITCH_BEND')).toBe(true);
    expect(vanillaMusicOplParityEventIsGated('CHANGE_CONTROLLER')).toBe(true);
    expect(vanillaMusicOplParityEventIsGated('SYSTEM_EVENT')).toBe(true);
    expect(vanillaMusicOplParityEventIsGated('SCORE_END')).toBe(true);
  });

  test('non-gated MUS event types', () => {
    expect(vanillaMusicOplParityEventIsGated('RELEASE_KEY')).toBe(false);
    expect(vanillaMusicOplParityEventIsGated('TICK')).toBe(false);
    expect(vanillaMusicOplParityEventIsGated('UNKNOWN')).toBe(false);
  });
});
