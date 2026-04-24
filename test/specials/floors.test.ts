import { describe, expect, it } from 'bun:test';

import { FRACUNIT } from '../../src/core/fixed.ts';
import { PlaneMoveResult } from '../../src/specials/doors.ts';
import { FLOORSPEED, FLOOR_24_UNIT_OFFSET, FLOOR_512_UNIT_OFFSET, FLOOR_8_UNIT_OFFSET, FloorDirection, FloorMove, FloorType, SFX_PSTOP, SFX_STNMOV, evDoFloor, tMoveFloor } from '../../src/specials/floors.ts';
import type { AdjacentSectorFloorMatch, FloorCallbacks, FloorLine, FloorSector } from '../../src/specials/floors.ts';
import { REMOVED, ThinkerList } from '../../src/world/thinkers.ts';
import type { ThinkFunction } from '../../src/world/thinkers.ts';

// ── Harness helpers ─────────────────────────────────────────────────

interface SoundEvent {
  readonly kind: 'sector';
  readonly sfx: number;
  readonly sector: FloorSector;
}

function makeSector(options: { floorheight: number; ceilingheight?: number; floorpic?: number; special?: number; tag?: number }): FloorSector {
  return {
    floorheight: options.floorheight,
    ceilingheight: options.ceilingheight ?? 256 * FRACUNIT,
    floorpic: options.floorpic ?? 0,
    special: options.special ?? 0,
    specialdata: null,
    tag: options.tag ?? 0,
  };
}

function makeLine(tag: number, frontFloorpic = 42, frontSpecial = 0): FloorLine {
  return { tag, frontFloorpic, frontSpecial };
}

interface Harness {
  readonly callbacks: FloorCallbacks;
  readonly sounds: SoundEvent[];
  lowestFloor: number;
  highestFloor: number;
  nextHighestFloor: number;
  lowestCeiling: number;
  shortestLowerTexture: number;
  adjacent: AdjacentSectorFloorMatch | null;
  blockMove: boolean;
  leveltime: number;
}

function makeHarness(
  options: {
    lowestFloor?: number;
    highestFloor?: number;
    nextHighestFloor?: number;
    lowestCeiling?: number;
    shortestLowerTexture?: number;
    adjacent?: AdjacentSectorFloorMatch | null;
    blockMove?: boolean;
    leveltime?: number;
  } = {},
): Harness {
  const sounds: SoundEvent[] = [];
  const state = {
    lowestFloor: options.lowestFloor ?? 0,
    highestFloor: options.highestFloor ?? 64 * FRACUNIT,
    nextHighestFloor: options.nextHighestFloor ?? 64 * FRACUNIT,
    lowestCeiling: options.lowestCeiling ?? 128 * FRACUNIT,
    shortestLowerTexture: options.shortestLowerTexture ?? 32 * FRACUNIT,
    adjacent: options.adjacent ?? null,
    blockMove: options.blockMove ?? false,
    leveltime: options.leveltime ?? 0,
  };
  const callbacks: FloorCallbacks = {
    movePlane(sector, speed, destheight, _crush, floorOrCeiling, direction) {
      if (floorOrCeiling !== 0) {
        throw new Error('floor mover moved a ceiling plane — not vanilla');
      }
      if (state.blockMove) {
        return PlaneMoveResult.crushed;
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
      return state.lowestFloor;
    },
    findHighestFloorSurrounding() {
      return state.highestFloor;
    },
    findNextHighestFloor() {
      return state.nextHighestFloor;
    },
    findLowestCeilingSurrounding() {
      return state.lowestCeiling;
    },
    findShortestLowerTexture() {
      return state.shortestLowerTexture;
    },
    findAdjacentSectorAtFloorHeight() {
      return state.adjacent;
    },
    startSectorSound(sector, sfx) {
      sounds.push({ kind: 'sector', sfx, sector });
    },
    getLevelTime() {
      return state.leveltime;
    },
  };
  return {
    callbacks,
    sounds,
    get lowestFloor() {
      return state.lowestFloor;
    },
    set lowestFloor(v: number) {
      state.lowestFloor = v;
    },
    get highestFloor() {
      return state.highestFloor;
    },
    set highestFloor(v: number) {
      state.highestFloor = v;
    },
    get nextHighestFloor() {
      return state.nextHighestFloor;
    },
    set nextHighestFloor(v: number) {
      state.nextHighestFloor = v;
    },
    get lowestCeiling() {
      return state.lowestCeiling;
    },
    set lowestCeiling(v: number) {
      state.lowestCeiling = v;
    },
    get shortestLowerTexture() {
      return state.shortestLowerTexture;
    },
    set shortestLowerTexture(v: number) {
      state.shortestLowerTexture = v;
    },
    get adjacent() {
      return state.adjacent;
    },
    set adjacent(v: AdjacentSectorFloorMatch | null) {
      state.adjacent = v;
    },
    get blockMove() {
      return state.blockMove;
    },
    set blockMove(v: boolean) {
      state.blockMove = v;
    },
    get leveltime() {
      return state.leveltime;
    },
    set leveltime(v: number) {
      state.leveltime = v;
    },
  };
}

// ── Constants ───────────────────────────────────────────────────────

describe('floor constants', () => {
  it('pins vanilla FLOORSPEED and per-type offsets', () => {
    expect(FLOORSPEED).toBe(FRACUNIT);
    expect(FLOOR_8_UNIT_OFFSET).toBe(8 * FRACUNIT);
    expect(FLOOR_24_UNIT_OFFSET).toBe(24 * FRACUNIT);
    expect(FLOOR_512_UNIT_OFFSET).toBe(512 * FRACUNIT);
  });

  it('exposes sfxenum_t indices', () => {
    expect(SFX_STNMOV).toBe(22);
    expect(SFX_PSTOP).toBe(19);
  });

  it('FloorType codes match vanilla floor_e order', () => {
    expect(FloorType.lowerFloor).toBe(0);
    expect(FloorType.lowerFloorToLowest).toBe(1);
    expect(FloorType.turboLower).toBe(2);
    expect(FloorType.raiseFloor).toBe(3);
    expect(FloorType.raiseFloorToNearest).toBe(4);
    expect(FloorType.raiseToTexture).toBe(5);
    expect(FloorType.lowerAndChange).toBe(6);
    expect(FloorType.raiseFloor24).toBe(7);
    expect(FloorType.raiseFloor24AndChange).toBe(8);
    expect(FloorType.raiseFloorCrush).toBe(9);
    expect(FloorType.raiseFloorTurbo).toBe(10);
    expect(FloorType.donutRaise).toBe(11);
    expect(FloorType.raiseFloor512).toBe(12);
  });

  it('FloorDirection codes double as T_MovePlane direction argument', () => {
    expect(FloorDirection.down).toBe(-1);
    expect(FloorDirection.up).toBe(1);
  });
});

// ── T_MoveFloor: sfx_stnmov cadence ────────────────────────────────

describe('T_MoveFloor sfx_stnmov cadence', () => {
  it('plays sfx_stnmov every 8 leveltime tics regardless of direction', () => {
    const sector = makeSector({ floorheight: 16 * FRACUNIT });
    const harness = makeHarness();
    const floor = new FloorMove(sector, FloorType.lowerFloor, harness.callbacks);
    floor.action = tMoveFloor;
    floor.speed = FLOORSPEED;
    floor.direction = FloorDirection.down;
    floor.floordestheight = 0;

    for (let lt = 0; lt < 17; lt++) {
      harness.leveltime = lt;
      tMoveFloor(floor);
    }

    const stnmovs = harness.sounds.filter((s) => s.sfx === SFX_STNMOV);
    expect(stnmovs.length).toBe(3); // leveltime 0, 8, 16
  });

  it('plays sfx_stnmov for an ascending floor', () => {
    const sector = makeSector({ floorheight: 0 });
    const harness = makeHarness({ leveltime: 0 });
    const floor = new FloorMove(sector, FloorType.raiseFloor, harness.callbacks);
    floor.action = tMoveFloor;
    floor.speed = FLOORSPEED;
    floor.direction = FloorDirection.up;
    floor.floordestheight = 64 * FRACUNIT;

    tMoveFloor(floor);

    expect(harness.sounds).toEqual([{ kind: 'sector', sfx: SFX_STNMOV, sector }]);
  });

  it('still plays sfx_stnmov on the pastdest arrival tic when leveltime & 7 === 0', () => {
    const sector = makeSector({ floorheight: FRACUNIT });
    const harness = makeHarness({ leveltime: 8 });
    const floor = new FloorMove(sector, FloorType.raiseFloor, harness.callbacks);
    floor.action = tMoveFloor;
    floor.speed = FLOORSPEED;
    floor.direction = FloorDirection.up;
    floor.floordestheight = FRACUNIT;

    tMoveFloor(floor);

    const sfxOrder = harness.sounds.map((s) => s.sfx);
    expect(sfxOrder).toEqual([SFX_STNMOV, SFX_PSTOP]);
  });
});

// ── T_MoveFloor: pastdest ──────────────────────────────────────────

describe('T_MoveFloor pastdest', () => {
  it('clears specialdata, marks REMOVED, plays sfx_pstop', () => {
    const sector = makeSector({ floorheight: FRACUNIT });
    const harness = makeHarness({ leveltime: 1 });
    const floor = new FloorMove(sector, FloorType.raiseFloor, harness.callbacks);
    floor.action = tMoveFloor;
    floor.speed = FLOORSPEED;
    floor.direction = FloorDirection.up;
    floor.floordestheight = FRACUNIT;
    sector.specialdata = floor;

    tMoveFloor(floor);

    expect(sector.specialdata).toBeNull();
    expect<ThinkFunction | typeof REMOVED | null>(floor.action).toBe(REMOVED);
    expect(harness.sounds.filter((s) => s.sfx === SFX_PSTOP).length).toBe(1);
  });

  it('up + donutRaise copies newspecial/texture into the sector at pastdest', () => {
    const sector = makeSector({
      floorheight: FRACUNIT,
      floorpic: 1,
      special: 5,
    });
    const harness = makeHarness({ leveltime: 1 });
    const floor = new FloorMove(sector, FloorType.donutRaise, harness.callbacks);
    floor.action = tMoveFloor;
    floor.speed = FLOORSPEED;
    floor.direction = FloorDirection.up;
    floor.floordestheight = FRACUNIT;
    floor.newspecial = 11;
    floor.texture = 77;

    tMoveFloor(floor);

    expect(sector.special).toBe(11);
    expect(sector.floorpic).toBe(77);
  });

  it('down + lowerAndChange copies newspecial/texture into the sector at pastdest', () => {
    const sector = makeSector({
      floorheight: FRACUNIT,
      floorpic: 1,
      special: 5,
    });
    const harness = makeHarness({ leveltime: 1 });
    const floor = new FloorMove(sector, FloorType.lowerAndChange, harness.callbacks);
    floor.action = tMoveFloor;
    floor.speed = FLOORSPEED;
    floor.direction = FloorDirection.down;
    floor.floordestheight = FRACUNIT;
    floor.newspecial = 9;
    floor.texture = 123;

    tMoveFloor(floor);

    expect(sector.special).toBe(9);
    expect(sector.floorpic).toBe(123);
  });

  it('up + lowerAndChange does NOT apply the down-only swap', () => {
    const sector = makeSector({
      floorheight: FRACUNIT,
      floorpic: 1,
      special: 5,
    });
    const harness = makeHarness({ leveltime: 1 });
    const floor = new FloorMove(sector, FloorType.lowerAndChange, harness.callbacks);
    floor.action = tMoveFloor;
    floor.speed = FLOORSPEED;
    floor.direction = FloorDirection.up;
    floor.floordestheight = FRACUNIT;
    floor.newspecial = 9;
    floor.texture = 123;

    tMoveFloor(floor);

    expect(sector.floorpic).toBe(1);
    expect(sector.special).toBe(5);
  });

  it('down + donutRaise does NOT apply the up-only swap', () => {
    const sector = makeSector({
      floorheight: FRACUNIT,
      floorpic: 1,
      special: 5,
    });
    const harness = makeHarness({ leveltime: 1 });
    const floor = new FloorMove(sector, FloorType.donutRaise, harness.callbacks);
    floor.action = tMoveFloor;
    floor.speed = FLOORSPEED;
    floor.direction = FloorDirection.down;
    floor.floordestheight = FRACUNIT;
    floor.newspecial = 11;
    floor.texture = 77;

    tMoveFloor(floor);

    expect(sector.floorpic).toBe(1);
    expect(sector.special).toBe(5);
  });

  it('other types leave floorpic/special untouched on pastdest', () => {
    const sector = makeSector({
      floorheight: FRACUNIT,
      floorpic: 1,
      special: 5,
    });
    const harness = makeHarness({ leveltime: 1 });
    const floor = new FloorMove(sector, FloorType.raiseFloor, harness.callbacks);
    floor.action = tMoveFloor;
    floor.speed = FLOORSPEED;
    floor.direction = FloorDirection.up;
    floor.floordestheight = FRACUNIT;
    floor.newspecial = 11;
    floor.texture = 77;

    tMoveFloor(floor);

    expect(sector.floorpic).toBe(1);
    expect(sector.special).toBe(5);
  });
});

// ── T_MoveFloor: per-tic motion ─────────────────────────────────────

describe('T_MoveFloor motion', () => {
  it('moves one speed unit per tic when not at pastdest', () => {
    const sector = makeSector({ floorheight: 4 * FRACUNIT });
    const harness = makeHarness({ leveltime: 1 });
    const floor = new FloorMove(sector, FloorType.lowerFloor, harness.callbacks);
    floor.action = tMoveFloor;
    floor.speed = FLOORSPEED;
    floor.direction = FloorDirection.down;
    floor.floordestheight = 0;

    tMoveFloor(floor);
    expect(sector.floorheight).toBe(3 * FRACUNIT);
    expect<ThinkFunction | typeof REMOVED | null>(floor.action).not.toBe(REMOVED);
  });

  it('silently continues when T_MovePlane returns crushed', () => {
    const sector = makeSector({ floorheight: 4 * FRACUNIT });
    const harness = makeHarness({ blockMove: true, leveltime: 1 });
    const floor = new FloorMove(sector, FloorType.raiseFloor, harness.callbacks);
    floor.action = tMoveFloor;
    floor.speed = FLOORSPEED;
    floor.direction = FloorDirection.up;
    floor.floordestheight = 64 * FRACUNIT;

    tMoveFloor(floor);

    expect<ThinkFunction | typeof REMOVED | null>(floor.action).not.toBe(REMOVED);
    expect(harness.sounds.filter((s) => s.sfx === SFX_PSTOP).length).toBe(0);
  });
});

// ── EV_DoFloor: per-type construction ──────────────────────────────

describe('EV_DoFloor lowerFloor', () => {
  it('creates a down-mover targeting findHighestFloorSurrounding', () => {
    const sector = makeSector({ floorheight: 32 * FRACUNIT, tag: 3 });
    const harness = makeHarness({ highestFloor: 16 * FRACUNIT });
    const plats = new ThinkerList();

    const created = evDoFloor(makeLine(3), FloorType.lowerFloor, [sector], plats, harness.callbacks);

    expect(created).toBe(1);
    const floor = sector.specialdata as FloorMove;
    expect(floor).toBeInstanceOf(FloorMove);
    expect(floor.speed).toBe(FLOORSPEED);
    expect<FloorDirection>(floor.direction).toBe(FloorDirection.down);
    expect(floor.floordestheight).toBe(16 * FRACUNIT);
    expect(floor.crush).toBe(false);
  });
});

describe('EV_DoFloor lowerFloorToLowest', () => {
  it('targets findLowestFloorSurrounding', () => {
    const sector = makeSector({ floorheight: 32 * FRACUNIT, tag: 4 });
    const harness = makeHarness({ lowestFloor: -8 * FRACUNIT });
    const thinkerList = new ThinkerList();

    evDoFloor(makeLine(4), FloorType.lowerFloorToLowest, [sector], thinkerList, harness.callbacks);

    const floor = sector.specialdata as FloorMove;
    expect(floor.floordestheight).toBe(-8 * FRACUNIT);
  });
});

describe('EV_DoFloor turboLower', () => {
  it('uses 4x speed and bumps dest by 8 when highest neighbor differs from floorheight', () => {
    const sector = makeSector({ floorheight: 64 * FRACUNIT, tag: 2 });
    const harness = makeHarness({ highestFloor: 16 * FRACUNIT });
    const thinkerList = new ThinkerList();

    evDoFloor(makeLine(2), FloorType.turboLower, [sector], thinkerList, harness.callbacks);

    const floor = sector.specialdata as FloorMove;
    expect(floor.speed).toBe(FLOORSPEED * 4);
    expect<FloorDirection>(floor.direction).toBe(FloorDirection.down);
    expect(floor.floordestheight).toBe(16 * FRACUNIT + 8 * FRACUNIT);
  });

  it('does NOT bump dest by 8 when highest neighbor equals the starting floorheight', () => {
    const sector = makeSector({ floorheight: 16 * FRACUNIT, tag: 2 });
    const harness = makeHarness({ highestFloor: 16 * FRACUNIT });
    const thinkerList = new ThinkerList();

    evDoFloor(makeLine(2), FloorType.turboLower, [sector], thinkerList, harness.callbacks);

    const floor = sector.specialdata as FloorMove;
    expect(floor.floordestheight).toBe(16 * FRACUNIT);
  });
});

describe('EV_DoFloor raiseFloor', () => {
  it('targets findLowestCeilingSurrounding, clamped to own ceiling', () => {
    const sector = makeSector({
      floorheight: 0,
      ceilingheight: 64 * FRACUNIT,
      tag: 5,
    });
    const harness = makeHarness({ lowestCeiling: 128 * FRACUNIT });
    const thinkerList = new ThinkerList();

    evDoFloor(makeLine(5), FloorType.raiseFloor, [sector], thinkerList, harness.callbacks);

    const floor = sector.specialdata as FloorMove;
    expect<FloorDirection>(floor.direction).toBe(FloorDirection.up);
    expect(floor.speed).toBe(FLOORSPEED);
    expect(floor.floordestheight).toBe(64 * FRACUNIT);
    expect(floor.crush).toBe(false);
  });

  it('keeps the neighbor-ceiling dest when it sits below own ceiling', () => {
    const sector = makeSector({
      floorheight: 0,
      ceilingheight: 128 * FRACUNIT,
      tag: 5,
    });
    const harness = makeHarness({ lowestCeiling: 96 * FRACUNIT });
    const thinkerList = new ThinkerList();

    evDoFloor(makeLine(5), FloorType.raiseFloor, [sector], thinkerList, harness.callbacks);

    const floor = sector.specialdata as FloorMove;
    expect(floor.floordestheight).toBe(96 * FRACUNIT);
  });
});

describe('EV_DoFloor raiseFloorCrush', () => {
  it('sets crush=true and subtracts 8 units from the ceiling clamp', () => {
    const sector = makeSector({
      floorheight: 0,
      ceilingheight: 128 * FRACUNIT,
      tag: 6,
    });
    const harness = makeHarness({ lowestCeiling: 96 * FRACUNIT });
    const thinkerList = new ThinkerList();

    evDoFloor(makeLine(6), FloorType.raiseFloorCrush, [sector], thinkerList, harness.callbacks);

    const floor = sector.specialdata as FloorMove;
    expect(floor.crush).toBe(true);
    expect(floor.floordestheight).toBe(96 * FRACUNIT - 8 * FRACUNIT);
  });
});

describe('EV_DoFloor raiseFloorTurbo', () => {
  it('uses 4x speed and targets findNextHighestFloor', () => {
    const sector = makeSector({ floorheight: 8 * FRACUNIT, tag: 7 });
    const harness = makeHarness({ nextHighestFloor: 24 * FRACUNIT });
    const thinkerList = new ThinkerList();

    evDoFloor(makeLine(7), FloorType.raiseFloorTurbo, [sector], thinkerList, harness.callbacks);

    const floor = sector.specialdata as FloorMove;
    expect(floor.speed).toBe(FLOORSPEED * 4);
    expect<FloorDirection>(floor.direction).toBe(FloorDirection.up);
    expect(floor.floordestheight).toBe(24 * FRACUNIT);
  });
});

describe('EV_DoFloor raiseFloorToNearest', () => {
  it('uses 1x speed and targets findNextHighestFloor', () => {
    const sector = makeSector({ floorheight: 8 * FRACUNIT, tag: 8 });
    const harness = makeHarness({ nextHighestFloor: 24 * FRACUNIT });
    const thinkerList = new ThinkerList();

    evDoFloor(makeLine(8), FloorType.raiseFloorToNearest, [sector], thinkerList, harness.callbacks);

    const floor = sector.specialdata as FloorMove;
    expect(floor.speed).toBe(FLOORSPEED);
    expect(floor.floordestheight).toBe(24 * FRACUNIT);
  });
});

describe('EV_DoFloor raiseFloor24 and raiseFloor512', () => {
  it('raiseFloor24 targets floorheight + 24 units', () => {
    const sector = makeSector({ floorheight: 16 * FRACUNIT, tag: 9 });
    const harness = makeHarness();
    const thinkerList = new ThinkerList();

    evDoFloor(makeLine(9), FloorType.raiseFloor24, [sector], thinkerList, harness.callbacks);

    const floor = sector.specialdata as FloorMove;
    expect(floor.floordestheight).toBe(16 * FRACUNIT + 24 * FRACUNIT);
  });

  it('raiseFloor512 targets floorheight + 512 units', () => {
    const sector = makeSector({ floorheight: 0, tag: 10 });
    const harness = makeHarness();
    const thinkerList = new ThinkerList();

    evDoFloor(makeLine(10), FloorType.raiseFloor512, [sector], thinkerList, harness.callbacks);

    const floor = sector.specialdata as FloorMove;
    expect(floor.floordestheight).toBe(512 * FRACUNIT);
  });
});

describe('EV_DoFloor raiseFloor24AndChange', () => {
  it("mutates sec.floorpic and sec.special immediately from the line's front sector", () => {
    const sector = makeSector({
      floorheight: 16 * FRACUNIT,
      floorpic: 1,
      special: 5,
      tag: 11,
    });
    const harness = makeHarness();
    const thinkerList = new ThinkerList();

    evDoFloor(makeLine(11, 99, 7), FloorType.raiseFloor24AndChange, [sector], thinkerList, harness.callbacks);

    const floor = sector.specialdata as FloorMove;
    expect(floor.floordestheight).toBe(16 * FRACUNIT + 24 * FRACUNIT);
    expect(sector.floorpic).toBe(99);
    expect(sector.special).toBe(7);
  });
});

describe('EV_DoFloor raiseToTexture', () => {
  it('adds the shortest lower-texture height to the starting floorheight', () => {
    const sector = makeSector({ floorheight: 0, tag: 12 });
    const harness = makeHarness({ shortestLowerTexture: 48 * FRACUNIT });
    const thinkerList = new ThinkerList();

    evDoFloor(makeLine(12), FloorType.raiseToTexture, [sector], thinkerList, harness.callbacks);

    const floor = sector.specialdata as FloorMove;
    expect(floor.floordestheight).toBe(48 * FRACUNIT);
  });
});

describe('EV_DoFloor lowerAndChange', () => {
  it('seeds texture to sec.floorpic and newspecial defaults when no adjacent match', () => {
    const sector = makeSector({
      floorheight: 32 * FRACUNIT,
      floorpic: 7,
      tag: 13,
    });
    const harness = makeHarness({ lowestFloor: 0, adjacent: null });
    const thinkerList = new ThinkerList();

    evDoFloor(makeLine(13), FloorType.lowerAndChange, [sector], thinkerList, harness.callbacks);

    const floor = sector.specialdata as FloorMove;
    expect(floor.floordestheight).toBe(0);
    expect<FloorDirection>(floor.direction).toBe(FloorDirection.down);
    expect(floor.texture).toBe(7);
    expect(floor.newspecial).toBe(0);
    // The sector's own floorpic/special are NOT mutated at creation —
    // the swap only runs at pastdest via T_MoveFloor.
    expect(sector.floorpic).toBe(7);
  });

  it('copies texture/special from the first adjacent sector at the destination height', () => {
    const sector = makeSector({
      floorheight: 32 * FRACUNIT,
      floorpic: 7,
      tag: 14,
    });
    const harness = makeHarness({
      lowestFloor: 0,
      adjacent: { floorpic: 42, special: 9 },
    });
    const thinkerList = new ThinkerList();

    evDoFloor(makeLine(14), FloorType.lowerAndChange, [sector], thinkerList, harness.callbacks);

    const floor = sector.specialdata as FloorMove;
    expect(floor.texture).toBe(42);
    expect(floor.newspecial).toBe(9);
  });
});

describe('EV_DoFloor donutRaise fall-through', () => {
  it('creates a bare thinker with default direction/speed/dest (EV_DoDonut finishes setup)', () => {
    const sector = makeSector({ floorheight: 8 * FRACUNIT, tag: 15 });
    const harness = makeHarness();
    const thinkerList = new ThinkerList();

    const created = evDoFloor(makeLine(15), FloorType.donutRaise, [sector], thinkerList, harness.callbacks);

    expect(created).toBe(1);
    const floor = sector.specialdata as FloorMove;
    expect(floor).toBeInstanceOf(FloorMove);
    expect<FloorDirection>(floor.direction).toBe(FloorDirection.up);
    expect(floor.speed).toBe(FLOORSPEED);
    expect(floor.floordestheight).toBe(0);
    expect(floor.crush).toBe(false);
  });
});

// ── EV_DoFloor: tag matching and active-slot skip ──────────────────

describe('EV_DoFloor tag matching', () => {
  it('ignores sectors with different tags', () => {
    const matching = makeSector({ floorheight: 0, tag: 20 });
    const other = makeSector({ floorheight: 0, tag: 21 });
    const harness = makeHarness({ highestFloor: -16 * FRACUNIT });
    const thinkerList = new ThinkerList();

    const created = evDoFloor(makeLine(20), FloorType.lowerFloor, [matching, other], thinkerList, harness.callbacks);

    expect(created).toBe(1);
    expect(matching.specialdata).not.toBeNull();
    expect(other.specialdata).toBeNull();
  });

  it('skips sectors that already have specialdata without bumping rtn', () => {
    const sector = makeSector({ floorheight: 0, tag: 22 });
    const harness = makeHarness();
    const thinkerList = new ThinkerList();
    const dummy = new FloorMove(sector, FloorType.raiseFloor, harness.callbacks);
    sector.specialdata = dummy;

    const created = evDoFloor(makeLine(22), FloorType.raiseFloor, [sector], thinkerList, harness.callbacks);

    expect(created).toBe(0);
    expect(sector.specialdata).toBe(dummy);
  });

  it('returns 0 when no sectors match the tag', () => {
    const sector = makeSector({ floorheight: 0, tag: 99 });
    const harness = makeHarness();
    const thinkerList = new ThinkerList();

    const created = evDoFloor(makeLine(1), FloorType.raiseFloor, [sector], thinkerList, harness.callbacks);

    expect(created).toBe(0);
    expect(sector.specialdata).toBeNull();
  });

  it('creates movers in every matching sector in a single call', () => {
    const a = makeSector({ floorheight: 0, tag: 30 });
    const b = makeSector({ floorheight: 0, tag: 30 });
    const harness = makeHarness();
    const thinkerList = new ThinkerList();

    const created = evDoFloor(makeLine(30), FloorType.raiseFloor24, [a, b], thinkerList, harness.callbacks);

    expect(created).toBe(1);
    expect(a.specialdata).not.toBeNull();
    expect(b.specialdata).not.toBeNull();
  });
});
