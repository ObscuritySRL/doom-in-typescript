/**
 * Parity tests for the level glue (`src/specials/lightsLevel.ts`):
 * the mutable-sector substitution + the `MapData → LightSector[]`
 * adapter that feeds the vanilla light thinkers.
 *
 * The single most important invariant: the {@link LightSector} the
 * thinkers mutate must write straight through to the SAME
 * `mapData.sectors[i]` object the software renderer re-snapshots
 * every frame — otherwise the oscillation would be invisible. The
 * adapter is also checked for vanilla `sector->lines[]` /
 * `getNextSector` / `P_FindMinSurroundingLight` fidelity, and an
 * end-to-end synthetic level proves a glow(8) and a sync-strobe(12)
 * sector oscillate the renderer-visible `sectors[i].lightlevel`.
 */

import { describe, expect, test } from 'bun:test';

import type { MapSector } from '../../src/map/lineSectorGeometry.ts';
import { ML_TWOSIDED } from '../../src/map/lineSectorGeometry.ts';
import { getNextSector, pFindMinSurroundingLight, pSpawnSpecialsLights, tickLight } from '../../src/specials/lights.ts';
import type { LightLevelMap } from '../../src/specials/lightsLevel.ts';
import { buildLightSectors, cloneSectorsMutable } from '../../src/specials/lightsLevel.ts';

function sec(lightlevel: number, special: number): MapSector {
  return { floorheight: 0, ceilingheight: 128 << 16, floorpic: 'FLOOR', ceilingpic: 'CEIL', lightlevel, special, tag: 0 };
}

describe('lightsLevel: cloneSectorsMutable', () => {
  test('produces unfrozen mutable byte-identical clones; leaves the frozen parsed input intact', () => {
    const parsed = [Object.freeze(sec(160, 8)), Object.freeze(sec(40, 0))];
    expect(Object.isFrozen(parsed[0])).toBe(true);

    const clones = cloneSectorsMutable(parsed);
    expect(clones.length).toBe(2);
    expect(clones[0]).toEqual({ floorheight: 0, ceilingheight: 128 << 16, floorpic: 'FLOOR', ceilingpic: 'CEIL', lightlevel: 160, special: 8, tag: 0 });
    expect(Object.isFrozen(clones[0])).toBe(false);

    clones[0]!.lightlevel = 99;
    clones[0]!.special = 0;
    expect(clones[0]!.lightlevel).toBe(99);
    // The parsed (frozen) source is untouched — its pin holds.
    expect(parsed[0]!.lightlevel).toBe(160);
    expect(parsed[0]!.special).toBe(8);
    expect(Object.isFrozen(parsed[0])).toBe(true);
  });
});

// A 3-sector level: glow(8) sec0 and sync-strobe(12) sec2 both
// border the dim sec1 through two-sided lines; sec0 also has a
// one-sided line (must be skipped by getNextSector).
function makeMap(): LightLevelMap {
  const sectors = cloneSectorsMutable([sec(200, 8), sec(40, 0), sec(160, 12)]);
  return {
    sectors,
    linedefs: [{ flags: ML_TWOSIDED }, { flags: ML_TWOSIDED }, { flags: 0 }],
    lineSectors: [
      { frontsector: 0, backsector: 1 },
      { frontsector: 2, backsector: 1 },
      { frontsector: 0, backsector: -1 },
    ],
    sectorGroups: [{ lineIndices: [0, 2] }, { lineIndices: [0, 1] }, { lineIndices: [1] }],
  };
}

describe('lightsLevel: buildLightSectors adapter fidelity', () => {
  test('one write-through view per sector — mutating the view IS mutating the renderer-visible sectors[i]', () => {
    const map = makeMap();
    const views = buildLightSectors(map);
    expect(views.length).toBe(3);

    views[0]!.lightlevel = 123;
    expect(map.sectors[0]!.lightlevel).toBe(123); // renderer reads this
    map.sectors[0]!.lightlevel = 77;
    expect(views[0]!.lightlevel).toBe(77); // and back again
    views[2]!.special = 0;
    expect(map.sectors[2]!.special).toBe(0);
  });

  test('sector->lines resolve to shared view identities; one-sided → null; flags carried', () => {
    const map = makeMap();
    const views = buildLightSectors(map);

    expect(views[0]!.lines.length).toBe(2);
    const twoSided = views[0]!.lines[0]!;
    expect(twoSided.flags).toBe(ML_TWOSIDED);
    expect(twoSided.frontsector).toBe(views[0]); // same instance
    expect(twoSided.backsector).toBe(views[1]);
    const oneSided = views[0]!.lines[1]!;
    expect(oneSided.flags).toBe(0);
    expect(oneSided.backsector).toBeNull();

    // getNextSector (lights.ts) over the adapter == vanilla.
    expect(getNextSector(twoSided, views[0]!)).toBe(views[1]);
    expect(getNextSector(twoSided, views[1]!)).toBe(views[0]);
    expect(getNextSector(oneSided, views[0]!)).toBeNull();
  });

  test('P_FindMinSurroundingLight over the adapter takes the min two-sided neighbor', () => {
    const map = makeMap();
    const views = buildLightSectors(map);
    // sec0 (200) borders sec1 (40) two-sided + a one-sided line → min 40.
    expect(pFindMinSurroundingLight(views[0]!, views[0]!.lightlevel)).toBe(40);
    // sec1 (40) borders sec0 (200) and sec2 (160) → seed 40 wins.
    expect(pFindMinSurroundingLight(views[1]!, views[1]!.lightlevel)).toBe(40);
  });
});

describe('lightsLevel: end-to-end — renderer-visible sectors[i].lightlevel oscillates', () => {
  test('P_SpawnSpecials light branch + per-tic tick drives glow(8) and sync-strobe(12) through the shared sectors', () => {
    const map = makeMap();
    let seed = 0;
    const rng = () => {
      seed = (seed + 1) & 0xff;
      return seed;
    };

    const thinkers = pSpawnSpecialsLights(buildLightSectors(map), rng, true);
    // glow + strobe spawned; specials cleared on the shared sectors.
    expect(thinkers.map((t) => t.kind).sort()).toEqual(['glow', 'strobe']);
    expect(map.sectors[0]!.special).toBe(0); // glow cleared
    expect(map.sectors[2]!.special).toBe(0); // strobe cleared

    const glowLevels = new Set<number>();
    const strobeLevels = new Set<number>();
    for (let tic = 0; tic < 120; tic += 1) {
      for (const t of thinkers) tickLight(t, rng);
      // Read the RENDERER-VISIBLE value (map.sectors[i]), not the view.
      glowLevels.add(map.sectors[0]!.lightlevel);
      strobeLevels.add(map.sectors[2]!.lightlevel);
    }

    // Glow ramps by GLOWSPEED within [40,200] → many distinct levels.
    expect(glowLevels.size).toBeGreaterThan(3);
    for (const v of glowLevels) {
      expect(v).toBeGreaterThanOrEqual(40 - 8);
      expect(v).toBeLessThanOrEqual(200 + 8);
    }
    // Sync strobe toggles between minlight(40) and maxlight(160).
    expect([...strobeLevels].sort((a, b) => a - b)).toEqual([40, 160]);
  });
});
