import { describe, expect, it } from 'bun:test';

import { PRIMARY_TARGET } from '../../src/reference/target.ts';
import manifest from '../../reference/manifests/compatibility-targets.json';

describe('compatibility-targets.json manifest', () => {
  const findTarget = (id: string) => manifest.targets.find((target) => target.id === id);

  const VALID_GAME_MODES = ['commercial', 'registered', 'retail', 'shareware'];
  const VALID_GAME_MISSIONS = ['doom', 'doom2', 'pack_plut', 'pack_tnt'];
  const VALID_MAP_NAMING = ['ExMy', 'MAPxx'];
  const VALID_STATUSES = ['active', 'planned'];

  it('contains exactly 6 targets', () => {
    expect(manifest.targets).toHaveLength(6);
    expect(manifest.totalTargets).toBe(6);
  });

  it('has required fields on every target', () => {
    for (const target of manifest.targets) {
      expect(target.id).toBeString();
      expect(target.id.length).toBeGreaterThan(0);
      expect(target.name).toBeString();
      expect(target.name.length).toBeGreaterThan(0);
      expect(target.status).toBeString();
      expect(target.gameMode).toBeString();
      expect(target.gameMission).toBeString();
      expect(target.emulatedVersion).toBeString();
      expect(target.iwad).toBeString();
      expect(target.mapNamingConvention).toBeString();
      expect(target.episodeCount).toBeNumber();
      expect(target.mapsPerEpisode).toBeNumber();
      expect(target.totalMaps).toBeNumber();
      expect(target.mapRange).toBeString();
      expect(Array.isArray(target.prerequisites)).toBe(true);
      expect(Array.isArray(target.newFeaturesOverPrevious)).toBe(true);
      expect(target.notes).toBeString();
      expect(target.notes.length).toBeGreaterThan(0);
    }
  });

  it('sorts targets by id', () => {
    const ids = manifest.targets.map((target) => target.id);
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });

  it('has unique target ids', () => {
    const ids = manifest.targets.map((target) => target.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('sorts gameModes ASCIIbetically', () => {
    const sorted = [...manifest.gameModes].sort();
    expect(manifest.gameModes).toEqual(sorted);
  });

  it('sorts gameMissions ASCIIbetically', () => {
    const sorted = [...manifest.gameMissions].sort();
    expect(manifest.gameMissions).toEqual(sorted);
  });

  it('uses only valid game modes', () => {
    for (const target of manifest.targets) {
      expect(VALID_GAME_MODES).toContain(target.gameMode);
    }
  });

  it('uses only valid game missions', () => {
    for (const target of manifest.targets) {
      expect(VALID_GAME_MISSIONS).toContain(target.gameMission);
    }
  });

  it('uses only valid map naming conventions', () => {
    for (const target of manifest.targets) {
      expect(VALID_MAP_NAMING).toContain(target.mapNamingConvention);
    }
  });

  it('uses only valid statuses', () => {
    for (const target of manifest.targets) {
      expect(VALID_STATUSES).toContain(target.status);
    }
  });

  it('has exactly one active target (C1)', () => {
    const activeTargets = manifest.targets.filter((target) => target.status === 'active');
    expect(activeTargets).toHaveLength(1);
    expect(activeTargets[0].id).toBe('C1');
  });

  it('C1 cross-references PRIMARY_TARGET', () => {
    const c1 = findTarget('C1')!;
    expect(c1).toBeDefined();
    expect(c1.gameMode).toBe(PRIMARY_TARGET.gameMode);
    expect(c1.emulatedVersion).toBe(PRIMARY_TARGET.emulatedVersion);
    expect(c1.iwad).toBe(PRIMARY_TARGET.wadFilename);
    expect(c1.totalMaps).toBe(9);
  });

  it('has totalMaps equal to episodeCount * mapsPerEpisode', () => {
    for (const target of manifest.targets) {
      expect(target.totalMaps).toBe(target.episodeCount * target.mapsPerEpisode);
    }
  });

  it('all emulated versions are 1.9', () => {
    for (const target of manifest.targets) {
      expect(target.emulatedVersion).toBe('1.9');
    }
  });

  it('Doom 1 family uses ExMy naming, Doom 2 family uses MAPxx', () => {
    for (const target of manifest.targets) {
      if (target.gameMission === 'doom') {
        expect(target.mapNamingConvention).toBe('ExMy');
      } else {
        expect(target.mapNamingConvention).toBe('MAPxx');
      }
    }
  });

  it('shareware uses DOOM1.WAD while registered and retail share DOOM.WAD', () => {
    const c1 = findTarget('C1')!;
    const c2 = findTarget('C2')!;
    const c3 = findTarget('C3')!;
    expect(c1.iwad).toBe('DOOM1.WAD');
    expect(c2.iwad).toBe('DOOM.WAD');
    expect(c3.iwad).toBe('DOOM.WAD');
    expect(c1.iwad).not.toBe(c2.iwad);
  });

  it('prerequisite chain forms a valid DAG with no forward references', () => {
    const seenIds = new Set<string>();
    for (const target of manifest.targets) {
      for (const prereq of target.prerequisites) {
        expect(seenIds.has(prereq)).toBe(true);
      }
      seenIds.add(target.id);
    }
  });

  it('C1 has no prerequisites and no new features', () => {
    const c1 = findTarget('C1')!;
    expect(c1.prerequisites).toHaveLength(0);
    expect(c1.newFeaturesOverPrevious).toHaveLength(0);
  });

  it('all planned targets have at least one new feature', () => {
    const planned = manifest.targets.filter((target) => target.status === 'planned');
    for (const target of planned) {
      expect(target.newFeaturesOverPrevious.length).toBeGreaterThan(0);
    }
  });

  it('sorts newFeaturesOverPrevious ASCIIbetically within each target', () => {
    for (const target of manifest.targets) {
      const features = target.newFeaturesOverPrevious;
      const sorted = [...features].sort();
      expect(features).toEqual(sorted);
    }
  });

  it('C4 introduces the super shotgun and 8+ new monster types', () => {
    const c4 = findTarget('C4')!;
    expect(c4).toBeDefined();
    expect(c4.newFeaturesOverPrevious).toContain('super-shotgun-weapon');
    const monsterFeatures = c4.newFeaturesOverPrevious.filter((feature) => feature.endsWith('-monster') || feature.endsWith('-entity'));
    expect(monsterFeatures.length).toBeGreaterThanOrEqual(8);
  });

  it('retail title sequence variant differs from shareware (parity edge case)', () => {
    const c3 = findTarget('C3')!;
    expect(c3).toBeDefined();
    expect(c3.newFeaturesOverPrevious).toContain('retail-title-sequence-variant');
    expect(c3.gameMode).toBe('retail');
    const c1 = findTarget('C1')!;
    expect(c1.gameMode).toBe('shareware');
  });

  it('Final Doom targets (C5, C6) both depend on C4, not on each other', () => {
    const c5 = findTarget('C5')!;
    const c6 = findTarget('C6')!;
    expect(c5.prerequisites).toEqual(['C4']);
    expect(c6.prerequisites).toEqual(['C4']);
  });

  it('commercial targets all have 32 maps and MAPxx naming', () => {
    const commercial = manifest.targets.filter((target) => target.gameMode === 'commercial');
    expect(commercial.length).toBeGreaterThanOrEqual(3);
    for (const target of commercial) {
      expect(target.totalMaps).toBe(32);
      expect(target.mapNamingConvention).toBe('MAPxx');
      expect(target.episodeCount).toBe(1);
      expect(target.mapsPerEpisode).toBe(32);
    }
  });

  it('Doom 1 episode progression is monotonically increasing', () => {
    const doomTargets = manifest.targets.filter((target) => target.gameMission === 'doom').sort((a, b) => a.id.localeCompare(b.id));
    for (let i = 1; i < doomTargets.length; i++) {
      expect(doomTargets[i].episodeCount).toBeGreaterThan(doomTargets[i - 1].episodeCount);
      expect(doomTargets[i].totalMaps).toBeGreaterThan(doomTargets[i - 1].totalMaps);
    }
  });

  it('every game mode in the manifest is represented in at least one target', () => {
    const usedModes = new Set(manifest.targets.map((target) => target.gameMode));
    for (const mode of manifest.gameModes) {
      expect(usedModes.has(mode)).toBe(true);
    }
  });

  it('every game mission in the manifest is represented in at least one target', () => {
    const usedMissions = new Set(manifest.targets.map((target) => target.gameMission));
    for (const mission of manifest.gameMissions) {
      expect(usedMissions.has(mission)).toBe(true);
    }
  });
});
