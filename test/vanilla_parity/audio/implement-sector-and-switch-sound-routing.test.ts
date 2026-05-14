import { describe, expect, test } from 'bun:test';

import {
  VANILLA_SECTOR_SFX_NAMES,
  VANILLA_SECTOR_SOUND_ORIGIN_FIELD,
  VANILLA_SECTOR_SOUNDORG_TYPE,
  VANILLA_SECTOR_SOUND_RESPATIALIZES,
  VANILLA_SWITCH_SOUND_ORIGIN_FIELD,
  routeVanillaSectorSound,
} from '../../../src/audio/implement-sector-and-switch-sound-routing.ts';

describe('vanilla sector and switch sound routing pin', () => {
  test('sector origin field is sector.soundorg degenmobj at sector centre', () => {
    expect(VANILLA_SECTOR_SOUND_ORIGIN_FIELD).toBe('sector.soundorg');
    expect(VANILLA_SECTOR_SOUNDORG_TYPE).toBe('degenmobj_t-at-sector-centre');
  });

  test('switch origin field is the trigger line frontsector soundorg', () => {
    expect(VANILLA_SWITCH_SOUND_ORIGIN_FIELD).toBe('line.frontsector.soundorg');
  });

  test('sector sounds re-spatialize every tic via S_AdjustSoundParams', () => {
    expect(VANILLA_SECTOR_SOUND_RESPATIALIZES).toBe(true);
  });

  test('pinned sector sfx names cover doors, lifts, stairs, and switches', () => {
    expect([...VANILLA_SECTOR_SFX_NAMES]).toEqual(['sfx_doropn', 'sfx_dorcls', 'sfx_bdopn', 'sfx_bdcls', 'sfx_pstart', 'sfx_pstop', 'sfx_stnmov', 'sfx_swtchn', 'sfx_swtchx']);
  });

  test('door sfx routes to sector.soundorg', () => {
    const decision = routeVanillaSectorSound('sfx_doropn');
    expect(decision.originSource).toBe('sector.soundorg');
    expect(decision.callsAdjustSoundParams).toBe(true);
  });

  test('blazing door sfx routes to sector.soundorg', () => {
    const decision = routeVanillaSectorSound('sfx_bdcls');
    expect(decision.originSource).toBe('sector.soundorg');
  });

  test('platform start sfx routes to sector.soundorg', () => {
    const decision = routeVanillaSectorSound('sfx_pstart');
    expect(decision.originSource).toBe('sector.soundorg');
  });

  test('switch on sfx routes to line.frontsector.soundorg', () => {
    const decision = routeVanillaSectorSound('sfx_swtchn');
    expect(decision.originSource).toBe('line.frontsector.soundorg');
    expect(decision.callsAdjustSoundParams).toBe(true);
  });

  test('switch off sfx routes to line.frontsector.soundorg', () => {
    const decision = routeVanillaSectorSound('sfx_swtchx');
    expect(decision.originSource).toBe('line.frontsector.soundorg');
  });

  test('stair movement sfx routes to sector.soundorg', () => {
    const decision = routeVanillaSectorSound('sfx_stnmov');
    expect(decision.originSource).toBe('sector.soundorg');
  });
});
