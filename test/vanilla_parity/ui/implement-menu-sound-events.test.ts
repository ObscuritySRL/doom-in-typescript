import { describe, expect, test } from 'bun:test';

import { getVanillaMenuSfx, listVanillaMenuSoundEvents } from '../../../src/ui/implement-menu-sound-events.ts';

describe('getVanillaMenuSfx — event mapping', () => {
  test('cursor-move -> sfx_pstop', () => {
    expect(getVanillaMenuSfx('cursor-move')).toBe('sfx_pstop');
  });

  test('select -> sfx_pistol', () => {
    expect(getVanillaMenuSfx('select')).toBe('sfx_pistol');
  });

  test('menu-open -> sfx_swtchn', () => {
    expect(getVanillaMenuSfx('menu-open')).toBe('sfx_swtchn');
  });

  test('menu-close -> sfx_swtchx', () => {
    expect(getVanillaMenuSfx('menu-close')).toBe('sfx_swtchx');
  });

  test('slider-step -> sfx_stnmov', () => {
    expect(getVanillaMenuSfx('slider-step')).toBe('sfx_stnmov');
  });

  test('invalid -> sfx_oof', () => {
    expect(getVanillaMenuSfx('invalid')).toBe('sfx_oof');
  });
});

describe('listVanillaMenuSoundEvents', () => {
  test('lists all 6 distinct menu sound events', () => {
    const events = listVanillaMenuSoundEvents();
    expect(events.length).toBe(6);
    expect(new Set(events).size).toBe(6);
  });

  test('every event maps to a distinct sfx', () => {
    const sfxs = listVanillaMenuSoundEvents().map((event) => getVanillaMenuSfx(event));
    expect(new Set(sfxs).size).toBe(sfxs.length);
  });
});
