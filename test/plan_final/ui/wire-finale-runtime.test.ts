import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  BUNNY_SCROLL_LUMPS,
  E2_ART_LUMP,
  E4_ART_LUMP,
  FINALE_CAST_MAP,
  FINALE_COMMERCIAL_SKIP_DELAY,
  FINALE_TEXT_START_DELAY,
  MAXPLAYERS,
  TEXTSPEED,
  TEXTWAIT,
  VANILLA_FINALE_RUNTIME_INVARIANTS,
  createFinaleState,
  getFinaleScreen,
  getVisibleCharacterCount,
  startFinale,
  tickFinale,
} from '../../../src/vanilla/wireFinaleRuntime.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireFinaleRuntime.ts');

describe('plan_final ui: wire-finale-runtime', () => {
  test('src/vanilla/wireFinaleRuntime.ts exists, is a regular file, and cites plan_final step 07-008', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('07-008');
    expect(fileText).toContain('VANILLA_FINALE_RUNTIME_INVARIANTS');
  });

  test('the facade re-exports only from the read-only finale module', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    const moduleSpecifiers = [...fileText.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((match) => match[1]!).filter((specifier) => specifier.startsWith('../'));
    expect(moduleSpecifiers.length).toBeGreaterThan(0);
    expect([...new Set(moduleSpecifiers)].sort()).toEqual(['../ui/finale.ts']);
  });

  test('VANILLA_FINALE_RUNTIME_INVARIANTS pins the five parity rules and is frozen', () => {
    expect(VANILLA_FINALE_RUNTIME_INVARIANTS.length).toBe(5);
    expect(Object.isFrozen(VANILLA_FINALE_RUNTIME_INVARIANTS)).toBe(true);
    const ids = VANILLA_FINALE_RUNTIME_INVARIANTS.map((invariant) => invariant.id).sort();
    expect(ids).toEqual(['BUNNY_SCROLL_USES_PFUB1_PFUB2_ON_EPISODE_3', 'CAST_CALL_IS_COMMERCIAL_MAP_30', 'FINALE_TEXT_TYPES_AT_TEXTSPEED_THEN_WAITS', 'FINALE_USES_VICTOR_THEN_BUNNY_MUSIC', 'TICK_FINALE_SIGNALS_THE_TRANSITION_EXIT']);
    for (const invariant of VANILLA_FINALE_RUNTIME_INVARIANTS) {
      expect(invariant.rule.length).toBeGreaterThan(0);
      expect(Object.isFrozen(invariant)).toBe(true);
    }
  });

  test('the finale constants match vanilla f_finale.c', () => {
    expect(TEXTSPEED).toBe(3);
    expect(TEXTWAIT).toBe(250);
    expect(FINALE_TEXT_START_DELAY).toBe(10);
    expect(FINALE_COMMERCIAL_SKIP_DELAY).toBe(50);
    expect(FINALE_CAST_MAP).toBe(30);
    expect(MAXPLAYERS).toBe(4);
    expect(E2_ART_LUMP).toBe('VICTORY2');
    expect(E4_ART_LUMP).toBe('ENDPIC');
    expect([...BUNNY_SCROLL_LUMPS]).toEqual(['PFUB1', 'PFUB2']);
    expect(Object.isFrozen(BUNNY_SCROLL_LUMPS)).toBe(true);
  });

  test('the finale runtime entry points are re-exported as callable functions', () => {
    expect(typeof getFinaleScreen).toBe('function');
    expect(typeof createFinaleState).toBe('function');
    expect(typeof startFinale).toBe('function');
    expect(typeof tickFinale).toBe('function');
    expect(typeof getVisibleCharacterCount).toBe('function');
    expect(typeof createFinaleState()).toBe('object');
    expect(typeof getFinaleScreen(1)).toBe('object');
  });

  test('the re-exported symbols are the SAME references as the read-only finale module', async () => {
    const finaleSource = await import('../../../src/ui/finale.ts');
    expect(createFinaleState).toBe(finaleSource.createFinaleState);
    expect(tickFinale).toBe(finaleSource.tickFinale);
    expect(TEXTSPEED).toBe(finaleSource.TEXTSPEED);
    expect(BUNNY_SCROLL_LUMPS).toBe(finaleSource.BUNNY_SCROLL_LUMPS);
  });
});
