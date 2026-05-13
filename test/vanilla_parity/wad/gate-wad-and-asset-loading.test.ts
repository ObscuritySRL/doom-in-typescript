import { describe, expect, test } from 'bun:test';

import { existsSync } from 'node:fs';

import { PHASE_05_REQUIRED_MODULES, PHASE_05_WAD_EXPECTATIONS, evaluateWadGate } from '../../../src/assets/gate-wad-and-asset-loading.ts';

describe('phase 05 wad and asset loading gate', () => {
  test('every required module exists on disk', () => {
    for (const requiredModule of PHASE_05_REQUIRED_MODULES) {
      expect(existsSync(requiredModule)).toBe(true);
    }
  });

  test('canonical WAD constants match vanilla', () => {
    expect(PHASE_05_WAD_EXPECTATIONS.shareware_iwad_total_lumps).toBe(1264);
    expect(PHASE_05_WAD_EXPECTATIONS.wad_type_iwad).toBe('IWAD');
    expect(PHASE_05_WAD_EXPECTATIONS.patch_header_bytes).toBe(8);
    expect(PHASE_05_WAD_EXPECTATIONS.playpal_palette_count).toBe(14);
    expect(PHASE_05_WAD_EXPECTATIONS.flat_dimension).toBe(64);
  });

  test('module list is ASCIIbetically sorted and unique', () => {
    expect([...PHASE_05_REQUIRED_MODULES].sort()).toEqual([...PHASE_05_REQUIRED_MODULES]);
    expect(new Set(PHASE_05_REQUIRED_MODULES).size).toBe(PHASE_05_REQUIRED_MODULES.length);
  });

  test('gate closes with canonical observed inputs', () => {
    const decision = evaluateWadGate({
      observedModules: [...PHASE_05_REQUIRED_MODULES],
      observedConstants: PHASE_05_WAD_EXPECTATIONS,
    });
    expect(decision.closed).toBe(true);
    expect(decision.violations).toEqual([]);
  });

  test('flags missing_module when a module is absent', () => {
    const decision = evaluateWadGate({
      observedModules: PHASE_05_REQUIRED_MODULES.slice(0, -1),
      observedConstants: PHASE_05_WAD_EXPECTATIONS,
    });
    expect(decision.closed).toBe(false);
    expect(decision.violations).toContain('missing_module');
  });
});
