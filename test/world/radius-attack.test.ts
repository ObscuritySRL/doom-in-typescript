import { describe, expect, it } from 'bun:test';

import type { Fixed } from '../../src/core/fixed.ts';
import { FRACBITS, FRACUNIT } from '../../src/core/fixed.ts';
import type { Blockmap } from '../../src/map/blockmap.ts';
import { MAPBLOCKSHIFT } from '../../src/map/blockmap.ts';
import { MAXRADIUS } from '../../src/map/mapSetup.ts';
import { MF_SHOOTABLE, MF_SOLID, Mobj, MobjType } from '../../src/world/mobj.ts';
import { createBlockThingsGrid } from '../../src/world/checkPosition.ts';
import type { BlockThingsGrid } from '../../src/world/checkPosition.ts';
import { radiusAttack } from '../../src/world/radiusAttack.ts';
import type { RadiusAttackCallbacks } from '../../src/world/radiusAttack.ts';

// ── Helpers ──────────────────────────────────────────────────────────

const F = FRACUNIT;

function createEmptyBlockmap(columns: number, rows: number, originX: Fixed = 0, originY: Fixed = 0): Blockmap {
  const cellCount = columns * rows;
  const offsets: number[] = [];
  const words: number[] = [];
  let cursor = 0;

  for (let i = 0; i < cellCount; i++) {
    offsets.push(cursor);
    words.push(-1);
    cursor++;
  }

  const lumpData = Buffer.alloc(words.length * 2);
  for (let i = 0; i < words.length; i++) {
    lumpData.writeInt16LE(words[i]!, i * 2);
  }

  return {
    originX,
    originY,
    columns,
    rows,
    offsets: Object.freeze(offsets),
    lumpData,
  };
}

function createMobj(props: { x?: Fixed; y?: Fixed; z?: Fixed; radius?: Fixed; height?: Fixed; flags?: number; health?: number; type?: MobjType }): Mobj {
  const mobj = new Mobj();
  mobj.x = props.x ?? 0;
  mobj.y = props.y ?? 0;
  mobj.z = props.z ?? 0;
  mobj.radius = props.radius ?? (20 * F) | 0;
  mobj.height = props.height ?? (56 * F) | 0;
  mobj.flags = props.flags ?? 0;
  mobj.health = props.health ?? 100;
  mobj.type = props.type ?? MobjType.POSSESSED;
  return mobj;
}

function placeInBlocklinks(mobj: Mobj, blocklinks: BlockThingsGrid, cellIndex: number): void {
  mobj.blockNext = blocklinks[cellIndex] ?? null;
  if (blocklinks[cellIndex] !== null) {
    (blocklinks[cellIndex] as Mobj).blockPrev = mobj;
  }
  blocklinks[cellIndex] = mobj;
}

/** Compute blockmap cell index for a position in a grid with given origin. */
function cellIndexFor(x: Fixed, y: Fixed, blockmap: Blockmap): number {
  const col = (x - blockmap.originX) >> MAPBLOCKSHIFT;
  const row = (y - blockmap.originY) >> MAPBLOCKSHIFT;
  return row * blockmap.columns + col;
}

/** Collect all (target, inflictor, source, damage) tuples from radiusAttack. */
function collectDamage(
  spot: Mobj,
  source: Mobj,
  damage: number,
  blockmap: Blockmap,
  blocklinks: BlockThingsGrid,
  checkSight?: (looker: Mobj, target: Mobj) => boolean,
): Array<{ target: Mobj; inflictor: Mobj; source: Mobj; damage: number }> {
  const results: Array<{
    target: Mobj;
    inflictor: Mobj;
    source: Mobj;
    damage: number;
  }> = [];

  const callbacks: RadiusAttackCallbacks = {
    checkSight,
    damageMobj: (target, inflictor, src, dmg) => {
      results.push({
        target,
        inflictor: inflictor!,
        source: src!,
        damage: dmg,
      });
    },
  };

  radiusAttack(spot, source, damage, blockmap, blocklinks, callbacks);
  return results;
}

// ── PIT_RadiusAttack filtering ──────────────────────────────────────

describe('PIT_RadiusAttack filtering', () => {
  it('skips non-MF_SHOOTABLE things', () => {
    const blockmap = createEmptyBlockmap(4, 4);
    const blocklinks = createBlockThingsGrid(4, 4);

    const spot = createMobj({ x: (64 * F) | 0, y: (64 * F) | 0, flags: 0 });
    const victim = createMobj({
      x: (64 * F) | 0,
      y: (64 * F) | 0,
      flags: MF_SOLID, // not shootable
    });
    placeInBlocklinks(victim, blocklinks, cellIndexFor(victim.x, victim.y, blockmap));

    const source = createMobj({});
    const results = collectDamage(spot, source, 128, blockmap, blocklinks);
    expect(results.length).toBe(0);
  });

  it('skips MT_CYBORG (boss concussion immunity)', () => {
    const blockmap = createEmptyBlockmap(4, 4);
    const blocklinks = createBlockThingsGrid(4, 4);

    const spot = createMobj({ x: (64 * F) | 0, y: (64 * F) | 0 });
    const cyborg = createMobj({
      x: (64 * F) | 0,
      y: (64 * F) | 0,
      flags: MF_SHOOTABLE,
      type: MobjType.CYBORG,
    });
    placeInBlocklinks(cyborg, blocklinks, cellIndexFor(cyborg.x, cyborg.y, blockmap));

    const source = createMobj({});
    const results = collectDamage(spot, source, 128, blockmap, blocklinks);
    expect(results.length).toBe(0);
  });

  it('skips MT_SPIDER (boss concussion immunity)', () => {
    const blockmap = createEmptyBlockmap(4, 4);
    const blocklinks = createBlockThingsGrid(4, 4);

    const spot = createMobj({ x: (64 * F) | 0, y: (64 * F) | 0 });
    const spider = createMobj({
      x: (64 * F) | 0,
      y: (64 * F) | 0,
      flags: MF_SHOOTABLE,
      type: MobjType.SPIDER,
    });
    placeInBlocklinks(spider, blocklinks, cellIndexFor(spider.x, spider.y, blockmap));

    const source = createMobj({});
    const results = collectDamage(spot, source, 128, blockmap, blocklinks);
    expect(results.length).toBe(0);
  });

  it('damages MF_SHOOTABLE things in range', () => {
    const blockmap = createEmptyBlockmap(4, 4);
    const blocklinks = createBlockThingsGrid(4, 4);

    const spot = createMobj({ x: (64 * F) | 0, y: (64 * F) | 0 });
    const victim = createMobj({
      x: (64 * F) | 0,
      y: (64 * F) | 0,
      flags: MF_SHOOTABLE,
      radius: (20 * F) | 0,
    });
    placeInBlocklinks(victim, blocklinks, cellIndexFor(victim.x, victim.y, blockmap));

    const source = createMobj({});
    const results = collectDamage(spot, source, 128, blockmap, blocklinks);
    expect(results.length).toBe(1);
    expect(results[0]!.target).toBe(victim);
  });

  it('skips things out of damage range', () => {
    const blockmap = createEmptyBlockmap(8, 8);
    const blocklinks = createBlockThingsGrid(8, 8);

    const spot = createMobj({ x: (64 * F) | 0, y: (64 * F) | 0 });
    // Place victim 200 map units away (> 128 damage range + 20 radius)
    const victim = createMobj({
      x: (264 * F) | 0,
      y: (64 * F) | 0,
      flags: MF_SHOOTABLE,
      radius: (20 * F) | 0,
    });
    placeInBlocklinks(victim, blocklinks, cellIndexFor(victim.x, victim.y, blockmap));

    const source = createMobj({});
    const results = collectDamage(spot, source, 128, blockmap, blocklinks);
    expect(results.length).toBe(0);
  });
});

// ── Chebyshev distance and radius subtraction ───────────────────────

describe('Chebyshev distance', () => {
  it('uses max(dx, dy) not Euclidean distance', () => {
    const blockmap = createEmptyBlockmap(8, 8);
    const blocklinks = createBlockThingsGrid(8, 8);

    const spot = createMobj({ x: (64 * F) | 0, y: (64 * F) | 0 });
    // Place victim diagonally: dx=50, dy=50. Chebyshev = 50 - 20 radius = 30
    const victim = createMobj({
      x: (114 * F) | 0,
      y: (114 * F) | 0,
      flags: MF_SHOOTABLE,
      radius: (20 * F) | 0,
    });
    placeInBlocklinks(victim, blocklinks, cellIndexFor(victim.x, victim.y, blockmap));

    const source = createMobj({});
    const results = collectDamage(spot, source, 128, blockmap, blocklinks);
    expect(results.length).toBe(1);
    // Chebyshev dist = max(50, 50) = 50. After radius: (50*F - 20*F) >> 16 = 30.
    // Damage = 128 - 30 = 98.
    expect(results[0]!.damage).toBe(98);
  });

  it('subtracts thing radius before integer conversion', () => {
    const blockmap = createEmptyBlockmap(4, 4);
    const blocklinks = createBlockThingsGrid(4, 4);

    const spot = createMobj({ x: (64 * F) | 0, y: (64 * F) | 0 });
    // dx=30, dy=0. Chebyshev = 30. After radius(20): 10. Damage = 128-10 = 118.
    const victim = createMobj({
      x: (94 * F) | 0,
      y: (64 * F) | 0,
      flags: MF_SHOOTABLE,
      radius: (20 * F) | 0,
    });
    placeInBlocklinks(victim, blocklinks, cellIndexFor(victim.x, victim.y, blockmap));

    const source = createMobj({});
    const results = collectDamage(spot, source, 128, blockmap, blocklinks);
    expect(results.length).toBe(1);
    expect(results[0]!.damage).toBe(118);
  });

  it('clamps negative distance to zero after radius subtraction', () => {
    const blockmap = createEmptyBlockmap(4, 4);
    const blocklinks = createBlockThingsGrid(4, 4);

    const spot = createMobj({ x: (64 * F) | 0, y: (64 * F) | 0 });
    // Same position, radius 20. dist = max(0,0) = 0. (0 - 20*F) >> 16 = -20 → clamp to 0.
    const victim = createMobj({
      x: (64 * F) | 0,
      y: (64 * F) | 0,
      flags: MF_SHOOTABLE,
      radius: (20 * F) | 0,
    });
    placeInBlocklinks(victim, blocklinks, cellIndexFor(victim.x, victim.y, blockmap));

    const source = createMobj({});
    const results = collectDamage(spot, source, 128, blockmap, blocklinks);
    expect(results.length).toBe(1);
    // Full damage because dist is clamped to 0.
    expect(results[0]!.damage).toBe(128);
  });

  it('uses asymmetric axis distances correctly (dx > dy)', () => {
    const blockmap = createEmptyBlockmap(8, 8);
    const blocklinks = createBlockThingsGrid(8, 8);

    const spot = createMobj({ x: (64 * F) | 0, y: (64 * F) | 0 });
    // dx=80, dy=10. Chebyshev = max(80,10) = 80. After radius(20): 60.
    const victim = createMobj({
      x: (144 * F) | 0,
      y: (74 * F) | 0,
      flags: MF_SHOOTABLE,
      radius: (20 * F) | 0,
    });
    placeInBlocklinks(victim, blocklinks, cellIndexFor(victim.x, victim.y, blockmap));

    const source = createMobj({});
    const results = collectDamage(spot, source, 128, blockmap, blocklinks);
    expect(results.length).toBe(1);
    expect(results[0]!.damage).toBe(68); // 128 - 60
  });
});

// ── Damage falloff ──────────────────────────────────────────────────

describe('damage falloff', () => {
  it('applies linear falloff: bombdamage - dist', () => {
    const blockmap = createEmptyBlockmap(8, 8);
    const blocklinks = createBlockThingsGrid(8, 8);

    const spot = createMobj({ x: (64 * F) | 0, y: (64 * F) | 0 });
    const source = createMobj({});

    // Place victims at different distances (all with 0 radius for clarity)
    const distances = [0, 10, 50, 100, 127];
    const expected = [128, 118, 78, 28, 1];

    for (let i = 0; i < distances.length; i++) {
      const grid = createBlockThingsGrid(8, 8);
      const victim = createMobj({
        x: ((64 + distances[i]!) * F) | 0,
        y: (64 * F) | 0,
        flags: MF_SHOOTABLE,
        radius: 0,
      });
      placeInBlocklinks(victim, grid, cellIndexFor(victim.x, victim.y, blockmap));

      const results = collectDamage(spot, source, 128, blockmap, grid);
      expect(results.length).toBe(1);
      expect(results[0]!.damage).toBe(expected[i]!);
    }
  });

  it('excludes things at exactly bombdamage distance (>= check)', () => {
    const blockmap = createEmptyBlockmap(8, 8);
    const blocklinks = createBlockThingsGrid(8, 8);

    const spot = createMobj({ x: (64 * F) | 0, y: (64 * F) | 0 });
    // Distance exactly 128 (equal to damage) with radius=0
    const victim = createMobj({
      x: (192 * F) | 0,
      y: (64 * F) | 0,
      flags: MF_SHOOTABLE,
      radius: 0,
    });
    placeInBlocklinks(victim, blocklinks, cellIndexFor(victim.x, victim.y, blockmap));

    const source = createMobj({});
    const results = collectDamage(spot, source, 128, blockmap, blocklinks);
    expect(results.length).toBe(0);
  });
});

// ── Line-of-sight callback ──────────────────────────────────────────

describe('line-of-sight callback', () => {
  it('skips damage when checkSight returns false', () => {
    const blockmap = createEmptyBlockmap(4, 4);
    const blocklinks = createBlockThingsGrid(4, 4);

    const spot = createMobj({ x: (64 * F) | 0, y: (64 * F) | 0 });
    const victim = createMobj({
      x: (64 * F) | 0,
      y: (64 * F) | 0,
      flags: MF_SHOOTABLE,
    });
    placeInBlocklinks(victim, blocklinks, cellIndexFor(victim.x, victim.y, blockmap));

    const source = createMobj({});
    const results = collectDamage(
      spot,
      source,
      128,
      blockmap,
      blocklinks,
      () => false, // no line of sight
    );
    expect(results.length).toBe(0);
  });

  it('applies damage when checkSight returns true', () => {
    const blockmap = createEmptyBlockmap(4, 4);
    const blocklinks = createBlockThingsGrid(4, 4);

    const spot = createMobj({ x: (64 * F) | 0, y: (64 * F) | 0 });
    const victim = createMobj({
      x: (64 * F) | 0,
      y: (64 * F) | 0,
      flags: MF_SHOOTABLE,
    });
    placeInBlocklinks(victim, blocklinks, cellIndexFor(victim.x, victim.y, blockmap));

    const source = createMobj({});
    const results = collectDamage(spot, source, 128, blockmap, blocklinks, () => true);
    expect(results.length).toBe(1);
  });

  it('defaults to visible (true) when no checkSight callback is provided', () => {
    const blockmap = createEmptyBlockmap(4, 4);
    const blocklinks = createBlockThingsGrid(4, 4);

    const spot = createMobj({ x: (64 * F) | 0, y: (64 * F) | 0 });
    const victim = createMobj({
      x: (64 * F) | 0,
      y: (64 * F) | 0,
      flags: MF_SHOOTABLE,
    });
    placeInBlocklinks(victim, blocklinks, cellIndexFor(victim.x, victim.y, blockmap));

    const source = createMobj({});
    // No checkSight callback — should default to visible
    const results = collectDamage(spot, source, 128, blockmap, blocklinks);
    expect(results.length).toBe(1);
  });

  it('passes correct (thing, bombspot) to checkSight', () => {
    const blockmap = createEmptyBlockmap(4, 4);
    const blocklinks = createBlockThingsGrid(4, 4);

    const spot = createMobj({ x: (64 * F) | 0, y: (64 * F) | 0 });
    const victim = createMobj({
      x: (64 * F) | 0,
      y: (64 * F) | 0,
      flags: MF_SHOOTABLE,
    });
    placeInBlocklinks(victim, blocklinks, cellIndexFor(victim.x, victim.y, blockmap));

    const source = createMobj({});
    const received: { looker: Mobj | null; target: Mobj | null } = {
      looker: null,
      target: null,
    };

    collectDamage(spot, source, 128, blockmap, blocklinks, (looker, target) => {
      received.looker = looker;
      received.target = target;
      return true;
    });

    expect(received.looker).not.toBeNull();
    expect(received.target).not.toBeNull();
    expect(received.looker === victim).toBe(true);
    expect(received.target === spot).toBe(true);
  });
});

// ── Inflictor and source passing ────────────────────────────────────

describe('inflictor and source', () => {
  it('passes bombspot as inflictor and bombsource as source', () => {
    const blockmap = createEmptyBlockmap(4, 4);
    const blocklinks = createBlockThingsGrid(4, 4);

    const spot = createMobj({
      x: (64 * F) | 0,
      y: (64 * F) | 0,
      type: MobjType.BRUISERSHOT,
    });
    const source = createMobj({
      x: (10 * F) | 0,
      y: (10 * F) | 0,
      type: MobjType.PLAYER,
    });
    const victim = createMobj({
      x: (64 * F) | 0,
      y: (64 * F) | 0,
      flags: MF_SHOOTABLE,
    });
    placeInBlocklinks(victim, blocklinks, cellIndexFor(victim.x, victim.y, blockmap));

    const results = collectDamage(spot, source, 128, blockmap, blocklinks);
    expect(results.length).toBe(1);
    expect(results[0]!.inflictor).toBe(spot);
    expect(results[0]!.source).toBe(source);
  });
});

// ── Multiple things in range ────────────────────────────────────────

describe('multiple things', () => {
  it('damages all shootable things in range', () => {
    const blockmap = createEmptyBlockmap(8, 8);
    const blocklinks = createBlockThingsGrid(8, 8);

    const spot = createMobj({ x: (64 * F) | 0, y: (64 * F) | 0 });
    const source = createMobj({});

    // Three victims at different distances, all with radius=0
    const victim1 = createMobj({
      x: (64 * F) | 0,
      y: (64 * F) | 0,
      flags: MF_SHOOTABLE,
      radius: 0,
    });
    const victim2 = createMobj({
      x: (114 * F) | 0,
      y: (64 * F) | 0,
      flags: MF_SHOOTABLE,
      radius: 0,
    });
    const victim3 = createMobj({
      x: (64 * F) | 0,
      y: (124 * F) | 0,
      flags: MF_SHOOTABLE,
      radius: 0,
    });
    placeInBlocklinks(victim1, blocklinks, cellIndexFor(victim1.x, victim1.y, blockmap));
    placeInBlocklinks(victim2, blocklinks, cellIndexFor(victim2.x, victim2.y, blockmap));
    placeInBlocklinks(victim3, blocklinks, cellIndexFor(victim3.x, victim3.y, blockmap));

    const results = collectDamage(spot, source, 128, blockmap, blocklinks);
    expect(results.length).toBe(3);

    const targets = new Set(results.map((r) => r.target));
    expect(targets.has(victim1)).toBe(true);
    expect(targets.has(victim2)).toBe(true);
    expect(targets.has(victim3)).toBe(true);

    // Verify distances: v1=0, v2=50, v3=60
    const v1result = results.find((r) => r.target === victim1)!;
    const v2result = results.find((r) => r.target === victim2)!;
    const v3result = results.find((r) => r.target === victim3)!;
    expect(v1result.damage).toBe(128); // dist 0
    expect(v2result.damage).toBe(78); // dist 50
    expect(v3result.damage).toBe(68); // dist 60
  });

  it('damages things across different blockmap cells', () => {
    // Blockmap with origin at 0, cells of 128 units each
    const blockmap = createEmptyBlockmap(8, 8);
    const blocklinks = createBlockThingsGrid(8, 8);

    // Spot in cell (0, 0)
    const spot = createMobj({ x: (64 * F) | 0, y: (64 * F) | 0 });
    const source = createMobj({});

    // Victim in cell (1, 0) — 130 map units away on X
    const victim = createMobj({
      x: (194 * F) | 0,
      y: (64 * F) | 0,
      flags: MF_SHOOTABLE,
      radius: (20 * F) | 0,
    });
    placeInBlocklinks(victim, blocklinks, cellIndexFor(victim.x, victim.y, blockmap));

    const results = collectDamage(spot, source, 128, blockmap, blocklinks);
    // dx=130, dy=0. Chebyshev=130. After radius(20): 110. 110 < 128. In range.
    expect(results.length).toBe(1);
    expect(results[0]!.damage).toBe(18); // 128 - 110
  });
});

// ── No damageMobj callback ──────────────────────────────────────────

describe('no callbacks', () => {
  it('does not throw when no callbacks are provided', () => {
    const blockmap = createEmptyBlockmap(4, 4);
    const blocklinks = createBlockThingsGrid(4, 4);

    const spot = createMobj({ x: (64 * F) | 0, y: (64 * F) | 0 });
    const source = createMobj({});
    const victim = createMobj({
      x: (64 * F) | 0,
      y: (64 * F) | 0,
      flags: MF_SHOOTABLE,
    });
    placeInBlocklinks(victim, blocklinks, cellIndexFor(victim.x, victim.y, blockmap));

    expect(() => {
      radiusAttack(spot, source, 128, blockmap, blocklinks);
    }).not.toThrow();
  });
});

// ── Parity-sensitive edge cases ─────────────────────────────────────

describe('parity-sensitive edge cases', () => {
  it('range overflow: (damage + MAXRADIUS) << FRACBITS matches C int32', () => {
    // In C: (128 + MAXRADIUS) << FRACBITS overflows int32.
    // MAXRADIUS = 32 * FRACUNIT = 0x200000. (128 + 0x200000) << 16 = 0x200080 << 16.
    // JS << coerces to int32, so the result is 0x00800000 (MAXRADIUS contribution lost).
    const dist = (128 + MAXRADIUS) << FRACBITS;
    expect(dist).toBe(128 << FRACBITS);
  });

  it('MAXRADIUS contribution is lost for all practical damage values', () => {
    // The (damage + MAXRADIUS) << FRACBITS expression loses MAXRADIUS
    // due to int32 overflow for any damage value, since MAXRADIUS << FRACBITS === 0.
    expect((MAXRADIUS << FRACBITS) | 0).toBe(0);
    // Therefore dist === (damage << FRACBITS) for all damage values
    for (const damage of [0, 1, 10, 50, 100, 128, 255]) {
      expect(((damage + MAXRADIUS) << FRACBITS) | 0).toBe((damage << FRACBITS) | 0);
    }
  });

  it('PIT_RadiusAttack always returns true (never stops early)', () => {
    const blockmap = createEmptyBlockmap(4, 4);
    const blocklinks = createBlockThingsGrid(4, 4);

    const spot = createMobj({ x: (64 * F) | 0, y: (64 * F) | 0 });
    const source = createMobj({});

    // Place three things in same cell: non-shootable, boss immune, and valid
    const nonShootable = createMobj({
      x: (64 * F) | 0,
      y: (64 * F) | 0,
      flags: MF_SOLID,
    });
    const boss = createMobj({
      x: (64 * F) | 0,
      y: (64 * F) | 0,
      flags: MF_SHOOTABLE,
      type: MobjType.CYBORG,
    });
    const valid = createMobj({
      x: (64 * F) | 0,
      y: (64 * F) | 0,
      flags: MF_SHOOTABLE,
    });

    const cellIndex = cellIndexFor(valid.x, valid.y, blockmap);
    placeInBlocklinks(nonShootable, blocklinks, cellIndex);
    placeInBlocklinks(boss, blocklinks, cellIndex);
    placeInBlocklinks(valid, blocklinks, cellIndex);

    const results = collectDamage(spot, source, 128, blockmap, blocklinks);
    // Only the valid shootable thing gets damaged, but iteration didn't stop
    expect(results.length).toBe(1);
    expect(results[0]!.target).toBe(valid);
  });

  it('self-damage: bombspot itself can be damaged if shootable and in blocklinks', () => {
    const blockmap = createEmptyBlockmap(4, 4);
    const blocklinks = createBlockThingsGrid(4, 4);

    const spot = createMobj({
      x: (64 * F) | 0,
      y: (64 * F) | 0,
      flags: MF_SHOOTABLE,
      radius: (20 * F) | 0,
    });
    const source = createMobj({});
    placeInBlocklinks(spot, blocklinks, cellIndexFor(spot.x, spot.y, blockmap));

    const results = collectDamage(spot, source, 128, blockmap, blocklinks);
    // Spot can damage itself — distance is 0, radius subtraction clamped to 0
    expect(results.length).toBe(1);
    expect(results[0]!.target).toBe(spot);
    expect(results[0]!.damage).toBe(128);
  });

  it('exact boundary: dist == bombdamage - 1 gives damage of 1', () => {
    const blockmap = createEmptyBlockmap(8, 8);
    const blocklinks = createBlockThingsGrid(8, 8);

    const spot = createMobj({ x: (64 * F) | 0, y: (64 * F) | 0 });
    const source = createMobj({});

    // With radius=0, place at exactly 127 map units away (damage=128, dist=127)
    const victim = createMobj({
      x: (191 * F) | 0,
      y: (64 * F) | 0,
      flags: MF_SHOOTABLE,
      radius: 0,
    });
    placeInBlocklinks(victim, blocklinks, cellIndexFor(victim.x, victim.y, blockmap));

    const results = collectDamage(spot, source, 128, blockmap, blocklinks);
    expect(results.length).toBe(1);
    expect(results[0]!.damage).toBe(1); // 128 - 127
  });

  it('Chebyshev dist uses >> FRACBITS integer truncation, not rounding', () => {
    const blockmap = createEmptyBlockmap(8, 8);
    const blocklinks = createBlockThingsGrid(8, 8);

    const spot = createMobj({ x: 0, y: 0 });
    const source = createMobj({});

    // Place victim at 50.5 map units: 50*F + F/2 = (50 << 16) + (1 << 15)
    const victim = createMobj({
      x: ((50 * F) | 0) + (F >> 1),
      y: 0,
      flags: MF_SHOOTABLE,
      radius: 0,
    });
    placeInBlocklinks(victim, blocklinks, cellIndexFor(victim.x, victim.y, blockmap));

    const results = collectDamage(spot, source, 128, blockmap, blocklinks);
    expect(results.length).toBe(1);
    // (50.5*F - 0) >> 16 = 50 (truncation, not rounding to 51)
    expect(results[0]!.damage).toBe(78); // 128 - 50
  });

  it('negative coordinate differences handled correctly', () => {
    const blockmap = createEmptyBlockmap(8, 8);
    const blocklinks = createBlockThingsGrid(8, 8);

    // Spot at (200, 200), victim at (160, 200) — negative dx
    const spot = createMobj({ x: (200 * F) | 0, y: (200 * F) | 0 });
    const source = createMobj({});
    const victim = createMobj({
      x: (160 * F) | 0,
      y: (200 * F) | 0,
      flags: MF_SHOOTABLE,
      radius: 0,
    });
    placeInBlocklinks(victim, blocklinks, cellIndexFor(victim.x, victim.y, blockmap));

    const results = collectDamage(spot, source, 128, blockmap, blocklinks);
    expect(results.length).toBe(1);
    // abs(-40*F) >> 16 = 40. Damage = 128 - 40 = 88.
    expect(results[0]!.damage).toBe(88);
  });

  it('blockmap range computation uses arithmetic right shift', () => {
    // Verify that >> MAPBLOCKSHIFT is arithmetic (preserves sign)
    // by checking that a spot at negative coordinates still works
    const blockmap = createEmptyBlockmap(8, 8, (-512 * F) | 0, (-512 * F) | 0);
    const blocklinks = createBlockThingsGrid(8, 8);

    const spot = createMobj({ x: (-400 * F) | 0, y: (-400 * F) | 0 });
    const source = createMobj({});
    const victim = createMobj({
      x: (-400 * F) | 0,
      y: (-400 * F) | 0,
      flags: MF_SHOOTABLE,
      radius: 0,
    });
    placeInBlocklinks(victim, blocklinks, cellIndexFor(victim.x, victim.y, blockmap));

    const results = collectDamage(spot, source, 128, blockmap, blocklinks);
    expect(results.length).toBe(1);
    expect(results[0]!.damage).toBe(128);
  });
});
