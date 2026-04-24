import { describe, expect, it } from 'bun:test';

import { FRACUNIT } from '../../src/core/fixed.ts';
import { ML_TWOSIDED } from '../../src/map/lineSectorGeometry.ts';
import { PlaneMoveResult } from '../../src/specials/doors.ts';
import { FLOORSPEED, FloorDirection, FloorMove, FloorType, tMoveFloor } from '../../src/specials/floors.ts';
import type { FloorCallbacks } from '../../src/specials/floors.ts';
import { DONUT_SPEED, STAIR_16_UNIT_SIZE, STAIR_8_UNIT_SIZE, STAIR_BUILD8_SPEED, STAIR_TURBO16_SPEED, StairType, evBuildStairs, evDoDonut } from '../../src/specials/stairsDonut.ts';
import type { DonutCallbacks, StairsDonutLine, StairsDonutLinedef, StairsDonutSector } from '../../src/specials/stairsDonut.ts';
import { ThinkerList } from '../../src/world/thinkers.ts';

// ── Harness helpers ─────────────────────────────────────────────────

interface MutableSector extends StairsDonutSector {
  lines: StairsDonutLinedef[];
  floorheight: number;
  ceilingheight: number;
  floorpic: number;
  special: number;
}

function makeSector(options: { floorheight?: number; ceilingheight?: number; floorpic?: number; special?: number; tag?: number } = {}): MutableSector {
  return {
    floorheight: options.floorheight ?? 0,
    ceilingheight: options.ceilingheight ?? 256 * FRACUNIT,
    floorpic: options.floorpic ?? 0,
    special: options.special ?? 0,
    specialdata: null,
    tag: options.tag ?? 0,
    lines: [],
  };
}

function linkLine(front: MutableSector, back: MutableSector | null, flags: number = ML_TWOSIDED): StairsDonutLinedef {
  const line: StairsDonutLinedef = { flags, frontSector: front, backSector: back };
  front.lines.push(line);
  if (back !== null) back.lines.push(line);
  return line;
}

function makeLine(tag: number): StairsDonutLine {
  return { tag };
}

function makeCallbacks(leveltime = 0): FloorCallbacks {
  return {
    movePlane(sector, speed, destheight, _crush, floorOrCeiling, direction) {
      if (floorOrCeiling !== 0) {
        throw new Error('stairs/donut moved a ceiling plane');
      }
      if (direction === 1) {
        const next = sector.floorheight + speed;
        if (next >= destheight) {
          sector.floorheight = destheight;
          return PlaneMoveResult.pastdest;
        }
        sector.floorheight = next;
        return PlaneMoveResult.ok;
      }
      const next = sector.floorheight - speed;
      if (next <= destheight) {
        sector.floorheight = destheight;
        return PlaneMoveResult.pastdest;
      }
      sector.floorheight = next;
      return PlaneMoveResult.ok;
    },
    findLowestFloorSurrounding() {
      return 0;
    },
    findHighestFloorSurrounding() {
      return 0;
    },
    findNextHighestFloor() {
      return 0;
    },
    findLowestCeilingSurrounding() {
      return 0;
    },
    findShortestLowerTexture() {
      return 0;
    },
    findAdjacentSectorAtFloorHeight() {
      return null;
    },
    getLevelTime() {
      return leveltime;
    },
  };
}

// ── Constants ───────────────────────────────────────────────────────

describe('stairs/donut constants', () => {
  it('pins vanilla stair riser sizes', () => {
    expect(STAIR_8_UNIT_SIZE).toBe(8 * FRACUNIT);
    expect(STAIR_16_UNIT_SIZE).toBe(16 * FRACUNIT);
  });

  it('pins vanilla stair speeds relative to FLOORSPEED', () => {
    expect(STAIR_BUILD8_SPEED).toBe(FLOORSPEED / 4);
    expect(STAIR_TURBO16_SPEED).toBe(FLOORSPEED * 4);
  });

  it('pins donut speed to FLOORSPEED/2', () => {
    expect(DONUT_SPEED).toBe(FLOORSPEED / 2);
  });

  it('StairType codes match stair_e order', () => {
    expect(StairType.build8).toBe(0);
    expect(StairType.turbo16).toBe(1);
  });
});

// ── EV_BuildStairs: starter thinker ─────────────────────────────────

describe('EV_BuildStairs starter thinker', () => {
  it('creates a single lowerFloor mover on the starter sector (build8)', () => {
    const starter = makeSector({ tag: 1, floorheight: 0, floorpic: 7 });
    const list = new ThinkerList();
    const callbacks = makeCallbacks();

    const rtn = evBuildStairs(makeLine(1), StairType.build8, [starter], list, callbacks);

    expect(rtn).toBe(1);
    expect(starter.specialdata).not.toBeNull();
    const floor = starter.specialdata as FloorMove;
    expect(floor.type).toBe(FloorType.lowerFloor);
    expect(floor.direction).toBe(FloorDirection.up);
    expect(floor.speed).toBe(STAIR_BUILD8_SPEED);
    expect(floor.floordestheight).toBe(STAIR_8_UNIT_SIZE);
    expect(floor.crush).toBe(true);
    expect(floor.action).toBe(tMoveFloor);
  });

  it('stair crush is true on every hop (vanilla STAIRS_UNINITIALIZED_CRUSH_FIELD_VALUE parity)', () => {
    const a = makeSector({ tag: 1, floorheight: 0, floorpic: 3 });
    const b = makeSector({ floorheight: 0, floorpic: 3 });
    const c = makeSector({ floorheight: 0, floorpic: 3 });
    linkLine(a, b);
    linkLine(b, c);
    const list = new ThinkerList();

    evBuildStairs(makeLine(1), StairType.build8, [a, b, c], list, makeCallbacks());

    expect((a.specialdata as FloorMove).crush).toBe(true);
    expect((b.specialdata as FloorMove).crush).toBe(true);
    expect((c.specialdata as FloorMove).crush).toBe(true);
  });

  it('uses turbo16 speed and 16-unit riser', () => {
    const starter = makeSector({ tag: 2, floorheight: 0, floorpic: 9 });
    const list = new ThinkerList();

    const rtn = evBuildStairs(makeLine(2), StairType.turbo16, [starter], list, makeCallbacks());

    expect(rtn).toBe(1);
    const floor = starter.specialdata as FloorMove;
    expect(floor.speed).toBe(STAIR_TURBO16_SPEED);
    expect(floor.floordestheight).toBe(STAIR_16_UNIT_SIZE);
  });

  it('returns 0 and creates no thinkers when no sector matches the tag', () => {
    const starter = makeSector({ tag: 5 });
    const list = new ThinkerList();

    const rtn = evBuildStairs(makeLine(9), StairType.build8, [starter], list, makeCallbacks());

    expect(rtn).toBe(0);
    expect(starter.specialdata).toBeNull();
    expect(list.isEmpty).toBe(true);
  });

  it('skips tag-matching sectors with pre-existing specialdata without bumping rtn', () => {
    const starter = makeSector({ tag: 3 });
    starter.specialdata = new FloorMove(starter, FloorType.lowerFloor, makeCallbacks());
    const list = new ThinkerList();
    const preexistingSpecialData = starter.specialdata;

    const rtn = evBuildStairs(makeLine(3), StairType.build8, [starter], list, makeCallbacks());

    expect(rtn).toBe(0);
    expect(starter.specialdata).toBe(preexistingSpecialData);
  });
});

// ── EV_BuildStairs: traversal ──────────────────────────────────────

describe('EV_BuildStairs traversal', () => {
  it('walks the chain through matching-floorpic two-sided lines and stamps increasing heights', () => {
    const a = makeSector({ tag: 1, floorheight: 0, floorpic: 3 });
    const b = makeSector({ floorheight: 0, floorpic: 3 });
    const c = makeSector({ floorheight: 0, floorpic: 3 });
    linkLine(a, b);
    linkLine(b, c);
    const list = new ThinkerList();

    const rtn = evBuildStairs(makeLine(1), StairType.build8, [a, b, c], list, makeCallbacks());

    expect(rtn).toBe(1);
    const floorA = a.specialdata as FloorMove;
    const floorB = b.specialdata as FloorMove;
    const floorC = c.specialdata as FloorMove;
    expect(floorA.floordestheight).toBe(STAIR_8_UNIT_SIZE);
    expect(floorB.floordestheight).toBe((2 * STAIR_8_UNIT_SIZE) | 0);
    expect(floorC.floordestheight).toBe((3 * STAIR_8_UNIT_SIZE) | 0);
  });

  it('stops traversal when the next back-sector floorpic differs', () => {
    const a = makeSector({ tag: 1, floorheight: 0, floorpic: 3 });
    const b = makeSector({ floorheight: 0, floorpic: 3 });
    const c = makeSector({ floorheight: 0, floorpic: 42 });
    linkLine(a, b);
    linkLine(b, c);
    const list = new ThinkerList();

    evBuildStairs(makeLine(1), StairType.build8, [a, b, c], list, makeCallbacks());

    expect(a.specialdata).not.toBeNull();
    expect(b.specialdata).not.toBeNull();
    expect(c.specialdata).toBeNull();
  });

  it('stops when the candidate line is not ML_TWOSIDED', () => {
    const a = makeSector({ tag: 1, floorheight: 0, floorpic: 3 });
    const b = makeSector({ floorheight: 0, floorpic: 3 });
    linkLine(a, b, 0);
    const list = new ThinkerList();

    evBuildStairs(makeLine(1), StairType.build8, [a, b], list, makeCallbacks());

    expect(a.specialdata).not.toBeNull();
    expect(b.specialdata).toBeNull();
  });

  it('only hops through lines whose FRONT side is the current sector (directed traversal)', () => {
    const a = makeSector({ tag: 1, floorheight: 0, floorpic: 3 });
    const b = makeSector({ floorheight: 0, floorpic: 3 });
    linkLine(b, a);
    const list = new ThinkerList();

    evBuildStairs(makeLine(1), StairType.build8, [a, b], list, makeCallbacks());

    expect(a.specialdata).not.toBeNull();
    expect(b.specialdata).toBeNull();
  });

  it('skips a back-sector hop with specialdata but still bumps height (vanilla quirk)', () => {
    const a = makeSector({ tag: 1, floorheight: 0, floorpic: 3 });
    const blocked = makeSector({ floorheight: 0, floorpic: 3 });
    blocked.specialdata = new FloorMove(blocked, FloorType.lowerFloor, makeCallbacks());
    const c = makeSector({ floorheight: 0, floorpic: 3 });
    linkLine(a, blocked);
    linkLine(a, c);
    const list = new ThinkerList();

    evBuildStairs(makeLine(1), StairType.build8, [a, blocked, c], list, makeCallbacks());

    const floorA = a.specialdata as FloorMove;
    const floorC = c.specialdata as FloorMove;
    expect(floorA.floordestheight).toBe(STAIR_8_UNIT_SIZE);
    expect(floorC.floordestheight).toBe((3 * STAIR_8_UNIT_SIZE) | 0);
  });

  it('freezes the texture from the starter sector — back-sector comparison uses starter.floorpic', () => {
    const a = makeSector({ tag: 1, floorheight: 0, floorpic: 3 });
    const b = makeSector({ floorheight: 0, floorpic: 3 });
    const c = makeSector({ floorheight: 0, floorpic: 99 });
    linkLine(a, b);
    linkLine(b, c);
    const list = new ThinkerList();

    evBuildStairs(makeLine(1), StairType.build8, [a, b, c], list, makeCallbacks());

    expect(a.specialdata).not.toBeNull();
    expect(b.specialdata).not.toBeNull();
    expect(c.specialdata).toBeNull();
  });

  it('processes multiple tag-matching starter sectors independently', () => {
    const a = makeSector({ tag: 7, floorheight: 0, floorpic: 2 });
    const otherStarter = makeSector({ tag: 7, floorheight: 32 * FRACUNIT, floorpic: 5 });
    const list = new ThinkerList();

    const rtn = evBuildStairs(makeLine(7), StairType.build8, [a, otherStarter], list, makeCallbacks());

    expect(rtn).toBe(1);
    const floorA = a.specialdata as FloorMove;
    const floorOther = otherStarter.specialdata as FloorMove;
    expect(floorA.floordestheight).toBe(STAIR_8_UNIT_SIZE);
    expect(floorOther.floordestheight).toBe(((32 * FRACUNIT) | 0) + STAIR_8_UNIT_SIZE);
  });
});

// ── EV_DoDonut ─────────────────────────────────────────────────────

describe('EV_DoDonut pair creation', () => {
  it('creates an outer-rim donutRaise mover and an inner-hole lowerFloor mover', () => {
    const pillar = makeSector({ tag: 1, floorheight: 64 * FRACUNIT, floorpic: 11 });
    const outer = makeSector({ floorheight: 32 * FRACUNIT, floorpic: 22 });
    const reference = makeSector({ floorheight: 8 * FRACUNIT, floorpic: 33 });
    linkLine(outer, pillar);
    linkLine(outer, reference);
    const list = new ThinkerList();

    const rtn = evDoDonut(makeLine(1), [pillar, outer, reference], list, makeCallbacks());

    expect(rtn).toBe(1);
    const rim = outer.specialdata as FloorMove;
    const hole = pillar.specialdata as FloorMove;

    expect(rim.type).toBe(FloorType.donutRaise);
    expect(rim.direction).toBe(FloorDirection.up);
    expect(rim.speed).toBe(DONUT_SPEED);
    expect(rim.floordestheight).toBe(8 * FRACUNIT);
    expect(rim.texture).toBe(33);
    expect(rim.newspecial).toBe(0);
    expect(rim.crush).toBe(false);
    expect(rim.action).toBe(tMoveFloor);

    expect(hole.type).toBe(FloorType.lowerFloor);
    expect(hole.direction).toBe(FloorDirection.down);
    expect(hole.speed).toBe(DONUT_SPEED);
    expect(hole.floordestheight).toBe(8 * FRACUNIT);
    expect(hole.crush).toBe(false);
    expect(hole.action).toBe(tMoveFloor);
  });

  it('skips the lines[0] back-self entry when locating s3', () => {
    const pillar = makeSector({ tag: 1, floorheight: 0, floorpic: 1 });
    const outer = makeSector({ floorheight: 0, floorpic: 2 });
    const reference = makeSector({ floorheight: 24 * FRACUNIT, floorpic: 77 });
    linkLine(outer, pillar);
    linkLine(outer, reference);
    const list = new ThinkerList();

    evDoDonut(makeLine(1), [pillar, outer, reference], list, makeCallbacks());

    const rim = outer.specialdata as FloorMove;
    expect(rim.floordestheight).toBe(24 * FRACUNIT);
    expect(rim.texture).toBe(77);
  });

  it('skips candidate lines whose back-sector is null when no overrun hook is supplied', () => {
    const pillar = makeSector({ tag: 1 });
    const outer = makeSector({ floorheight: 8 * FRACUNIT, floorpic: 4 });
    const reference = makeSector({ floorheight: 16 * FRACUNIT, floorpic: 55 });
    linkLine(outer, pillar);
    linkLine(outer, null);
    linkLine(outer, reference);
    const list = new ThinkerList();

    const rtn = evDoDonut(makeLine(1), [pillar, outer, reference], list, makeCallbacks());

    expect(rtn).toBe(1);
    const rim = outer.specialdata as FloorMove;
    expect(rim.floordestheight).toBe(16 * FRACUNIT);
    expect(rim.texture).toBe(55);
  });

  it('uses onDonutOverrun when the candidate back-sector is null', () => {
    const pillar = makeSector({ tag: 1 });
    const outer = makeSector();
    linkLine(outer, pillar);
    linkLine(outer, null);
    const list = new ThinkerList();
    const baseCallbacks = makeCallbacks();
    let hookCallCount = 0;
    const callbacks: DonutCallbacks = {
      ...baseCallbacks,
      onDonutOverrun(line, pillarSector) {
        hookCallCount++;
        expect(pillarSector).toBe(pillar);
        expect(line.tag).toBe(1);
        return { floorheight: 123 * FRACUNIT, floorpic: 88 };
      },
    };

    const rtn = evDoDonut(makeLine(1), [pillar, outer], list, callbacks);

    expect(rtn).toBe(1);
    expect(hookCallCount).toBe(1);
    const rim = outer.specialdata as FloorMove;
    expect(rim.floordestheight).toBe(123 * FRACUNIT);
    expect(rim.texture).toBe(88);
  });

  it('returns 0 and creates no movers when no sector matches the tag', () => {
    const pillar = makeSector({ tag: 99 });
    const outer = makeSector();
    const reference = makeSector({ floorheight: 24 * FRACUNIT });
    linkLine(outer, pillar);
    linkLine(outer, reference);
    const list = new ThinkerList();

    const rtn = evDoDonut(makeLine(1), [pillar, outer, reference], list, makeCallbacks());

    expect(rtn).toBe(0);
    expect(pillar.specialdata).toBeNull();
    expect(outer.specialdata).toBeNull();
  });

  it('skips tag-matching pillars with pre-existing specialdata without bumping rtn', () => {
    const pillar = makeSector({ tag: 4 });
    pillar.specialdata = new FloorMove(pillar, FloorType.lowerFloor, makeCallbacks());
    const outer = makeSector();
    const reference = makeSector({ floorheight: 16 * FRACUNIT });
    linkLine(outer, pillar);
    linkLine(outer, reference);
    const list = new ThinkerList();

    const rtn = evDoDonut(makeLine(4), [pillar, outer, reference], list, makeCallbacks());

    expect(rtn).toBe(0);
    expect(outer.specialdata).toBeNull();
  });

  it('aborts the outer loop when s2 is null — rtn reflects the pre-abort flip', () => {
    const pillar = makeSector({ tag: 1, floorheight: 0 });
    linkLine(pillar, null);
    const laterPillar = makeSector({ tag: 1, floorheight: 0 });
    const outer = makeSector();
    const reference = makeSector({ floorheight: 16 * FRACUNIT });
    linkLine(outer, laterPillar);
    linkLine(outer, reference);
    const list = new ThinkerList();

    const rtn = evDoDonut(makeLine(1), [pillar, laterPillar, outer, reference], list, makeCallbacks());

    expect(rtn).toBe(1);
    expect(laterPillar.specialdata).toBeNull();
    expect(outer.specialdata).toBeNull();
  });

  it('breaks out of the inner s2.lines loop after the first valid s3 — one pair per pillar', () => {
    const pillar = makeSector({ tag: 1 });
    const outer = makeSector();
    const reference = makeSector({ floorheight: 5 * FRACUNIT, floorpic: 10 });
    const otherReference = makeSector({ floorheight: 99 * FRACUNIT, floorpic: 99 });
    linkLine(outer, pillar);
    linkLine(outer, reference);
    linkLine(outer, otherReference);
    const list = new ThinkerList();

    evDoDonut(makeLine(1), [pillar, outer, reference, otherReference], list, makeCallbacks());

    const rim = outer.specialdata as FloorMove;
    expect(rim.floordestheight).toBe(5 * FRACUNIT);
    expect(rim.texture).toBe(10);
  });
});

// ── Integration ─────────────────────────────────────────────────────

describe('stairs and donut integration with tMoveFloor', () => {
  it('stair mover ticks up to its destheight and is removed past it', () => {
    const starter = makeSector({ tag: 1, floorheight: 0, floorpic: 3 });
    const list = new ThinkerList();
    const callbacks = makeCallbacks();

    evBuildStairs(makeLine(1), StairType.turbo16, [starter], list, callbacks);

    for (let i = 0; i < 10; i++) list.run();

    expect(starter.floorheight).toBe(STAIR_16_UNIT_SIZE);
    expect(starter.specialdata).toBeNull();
    expect(list.isEmpty).toBe(true);
  });

  it('donut hole sector falls while the rim rises — both land on s3 floorheight', () => {
    const pillar = makeSector({ tag: 1, floorheight: 64 * FRACUNIT, floorpic: 11 });
    const outer = makeSector({ floorheight: 64 * FRACUNIT, floorpic: 22 });
    const reference = makeSector({ floorheight: 8 * FRACUNIT, floorpic: 33 });
    linkLine(outer, pillar);
    linkLine(outer, reference);
    const list = new ThinkerList();
    const callbacks = makeCallbacks();

    evDoDonut(makeLine(1), [pillar, outer, reference], list, callbacks);

    for (let i = 0; i < 300; i++) list.run();

    expect(pillar.floorheight).toBe(8 * FRACUNIT);
    expect(outer.floorheight).toBe(8 * FRACUNIT);
    expect(outer.floorpic).toBe(33);
    expect(outer.special).toBe(0);
    expect(pillar.specialdata).toBeNull();
    expect(outer.specialdata).toBeNull();
  });
});
