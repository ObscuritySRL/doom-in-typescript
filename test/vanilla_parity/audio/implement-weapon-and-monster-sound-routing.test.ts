import { describe, expect, test } from 'bun:test';

import { VANILLA_FULLSCREEN_BOSS_SFX_ROUTING, VANILLA_MONSTER_SFX_ROUTING, VANILLA_WEAPON_SFX_ROUTING, classifyVanillaCombatSfxRouting } from '../../../src/audio/implement-weapon-and-monster-sound-routing.ts';

describe('vanilla weapon and monster sound routing pin', () => {
  test('weapon sfx use the player mobj as origin', () => {
    expect(VANILLA_WEAPON_SFX_ROUTING.originSource).toBe('player.mo');
    expect(VANILLA_WEAPON_SFX_ROUTING.callsAdjustSoundParams).toBe(false);
  });

  test('weapon sfx skip respatialization (origin == listener short-circuits)', () => {
    expect(VANILLA_WEAPON_SFX_ROUTING.callsAdjustSoundParams).toBe(false);
  });

  test('monster sfx use the monster mobj as origin', () => {
    expect(VANILLA_MONSTER_SFX_ROUTING.originSource).toBe('monster.mo');
  });

  test('monster sfx re-spatialize every tic', () => {
    expect(VANILLA_MONSTER_SFX_ROUTING.callsAdjustSoundParams).toBe(true);
  });

  test('boss / fullscreen sfx use NULL origin to escape spatialization', () => {
    expect(VANILLA_FULLSCREEN_BOSS_SFX_ROUTING.originSource).toBe('null');
    expect(VANILLA_FULLSCREEN_BOSS_SFX_ROUTING.callsAdjustSoundParams).toBe(false);
  });

  test('classifier returns the canonical decision for each known profile', () => {
    expect(classifyVanillaCombatSfxRouting('weapon-self-origin')).toBe(VANILLA_WEAPON_SFX_ROUTING);
    expect(classifyVanillaCombatSfxRouting('monster-mobj-origin')).toBe(VANILLA_MONSTER_SFX_ROUTING);
    expect(classifyVanillaCombatSfxRouting('fullscreen-anonymous')).toBe(VANILLA_FULLSCREEN_BOSS_SFX_ROUTING);
  });

  test('only the monster-mobj-origin profile calls S_AdjustSoundParams per tic', () => {
    const profiles = [VANILLA_WEAPON_SFX_ROUTING, VANILLA_MONSTER_SFX_ROUTING, VANILLA_FULLSCREEN_BOSS_SFX_ROUTING];
    const spatialized = profiles.filter((profile) => profile.callsAdjustSoundParams);
    expect(spatialized).toHaveLength(1);
    expect(spatialized[0]!.profile).toBe('monster-mobj-origin');
  });
});
