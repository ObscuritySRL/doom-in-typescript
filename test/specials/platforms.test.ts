import { describe, expect, it } from 'bun:test';

import { FRACUNIT } from '../../src/core/fixed.ts';
import { PlaneMoveResult } from '../../src/specials/doors.ts';
import { ActivePlats, MAXPLATS, PLATSPEED, PLATWAIT, PLATWAIT_TICS, Platform, PlatStatus, PlatType, SFX_PSTART, SFX_PSTOP, SFX_STNMOV, TICRATE, evDoPlat, evStopPlat, pActivateInStasis, tPlatRaise } from '../../src/specials/platforms.ts';
import type { PlatCallbacks, PlatLine, PlatSector } from '../../src/specials/platforms.ts';
import { ThinkerList, REMOVED } from '../../src/world/thinkers.ts';
import type { ThinkFunction } from '../../src/world/thinkers.ts';

// ── Harness helpers ─────────────────────────────────────────────────

interface SoundEvent {
  readonly kind: 'sector';
  readonly sfx: number;
  readonly sector: PlatSector;
}

function makeSector(options: { floorheight: number; ceilingheight?: number; floorpic?: number; tag?: number; special?: number }): PlatSector {
  return {
    floorheight: options.floorheight,
    ceilingheight: options.ceilingheight ?? 256 * FRACUNIT,
    floorpic: options.floorpic ?? 0,
    special: options.special ?? 0,
    specialdata: null,
    tag: options.tag ?? 0,
  };
}

function makeLine(tag: number, frontFloorpic = 42): PlatLine {
  return { tag, frontFloorpic };
}

interface Harness {
  readonly callbacks: PlatCallbacks;
  readonly sounds: SoundEvent[];
  lowestFloor: number;
  highestFloor: number;
  nextHighestFloor: number;
  blockMove: boolean;
  rngQueue: number[];
  leveltime: number;
}

function makeHarness(
  options: {
    lowestFloor?: number;
    highestFloor?: number;
    nextHighestFloor?: number;
    blockMove?: boolean;
    rngQueue?: number[];
    leveltime?: number;
  } = {},
): Harness {
  const sounds: SoundEvent[] = [];
  const state = {
    lowestFloor: options.lowestFloor ?? 0,
    highestFloor: options.highestFloor ?? 64 * FRACUNIT,
    nextHighestFloor: options.nextHighestFloor ?? 64 * FRACUNIT,
    blockMove: options.blockMove ?? false,
    rngQueue: options.rngQueue ? [...options.rngQueue] : [],
    leveltime: options.leveltime ?? 0,
  };
  const callbacks: PlatCallbacks = {
    movePlane(sector, speed, destheight, _crush, floorOrCeiling, direction) {
      if (floorOrCeiling !== 0) {
        throw new Error('plat moved a ceiling plane — not vanilla');
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
    startSectorSound(sector, sfx) {
      sounds.push({ kind: 'sector', sfx, sector });
    },
    pRandom() {
      return state.rngQueue.shift() ?? 0;
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
    set lowestFloor(value: number) {
      state.lowestFloor = value;
    },
    get highestFloor() {
      return state.highestFloor;
    },
    set highestFloor(value: number) {
      state.highestFloor = value;
    },
    get nextHighestFloor() {
      return state.nextHighestFloor;
    },
    set nextHighestFloor(value: number) {
      state.nextHighestFloor = value;
    },
    get blockMove() {
      return state.blockMove;
    },
    set blockMove(value: boolean) {
      state.blockMove = value;
    },
    get rngQueue() {
      return state.rngQueue;
    },
    set rngQueue(value: number[]) {
      state.rngQueue = value;
    },
    get leveltime() {
      return state.leveltime;
    },
    set leveltime(value: number) {
      state.leveltime = value;
    },
  };
}

// ── Constants ───────────────────────────────────────────────────────

describe('platform constants', () => {
  it('pins vanilla PLATSPEED, PLATWAIT, MAXPLATS', () => {
    expect(PLATSPEED).toBe(FRACUNIT);
    expect(PLATWAIT).toBe(3);
    expect(PLATWAIT_TICS).toBe(TICRATE * PLATWAIT);
    expect(MAXPLATS).toBe(30);
  });

  it('exposes sfxenum_t indices for plat sounds', () => {
    expect(SFX_PSTART).toBe(18);
    expect(SFX_PSTOP).toBe(19);
    expect(SFX_STNMOV).toBe(22);
  });

  it('PlatStatus codes match vanilla plat_e order', () => {
    expect(PlatStatus.up).toBe(0);
    expect(PlatStatus.down).toBe(1);
    expect(PlatStatus.waiting).toBe(2);
    expect(PlatStatus.inStasis).toBe(3);
  });

  it('PlatType codes match vanilla plattype_e order', () => {
    expect(PlatType.perpetualRaise).toBe(0);
    expect(PlatType.downWaitUpStay).toBe(1);
    expect(PlatType.raiseAndChange).toBe(2);
    expect(PlatType.raiseToNearestAndChange).toBe(3);
    expect(PlatType.blazeDWUS).toBe(4);
  });
});

// ── T_PlatRaise: down branch ───────────────────────────────────────

describe('T_PlatRaise down branch', () => {
  it('lowers floorheight one speed per tic until pastdest, then waits with sfx_pstop', () => {
    const sector = makeSector({ floorheight: 4 * FRACUNIT });
    const harness = makeHarness();
    const plats = new ActivePlats();
    const plat = new Platform(sector, PlatType.downWaitUpStay, harness.callbacks);
    plat.action = (t) => tPlatRaise(t, plats);
    plat.speed = FRACUNIT;
    plat.high = 4 * FRACUNIT;
    plat.low = 2 * FRACUNIT;
    plat.wait = PLATWAIT_TICS;
    plat.status = PlatStatus.down;
    plats.add(plat);

    tPlatRaise(plat, plats);
    expect(sector.floorheight).toBe(3 * FRACUNIT);
    expect<PlatStatus>(plat.status).toBe(PlatStatus.down);

    tPlatRaise(plat, plats);
    expect(sector.floorheight).toBe(2 * FRACUNIT);
    expect<PlatStatus>(plat.status).toBe(PlatStatus.waiting);
    expect(plat.count).toBe(PLATWAIT_TICS);
    expect(harness.sounds).toEqual([{ kind: 'sector', sfx: SFX_PSTOP, sector }]);
  });
});

// ── T_PlatRaise: up branch ─────────────────────────────────────────

describe('T_PlatRaise up branch', () => {
  it('raises floor and removes downWaitUpStay on pastdest with sfx_pstop', () => {
    const sector = makeSector({ floorheight: 0 });
    const harness = makeHarness();
    const plats = new ActivePlats();
    const plat = new Platform(sector, PlatType.downWaitUpStay, harness.callbacks);
    plat.action = (t) => tPlatRaise(t, plats);
    plat.speed = FRACUNIT;
    plat.high = FRACUNIT;
    plat.wait = PLATWAIT_TICS;
    plat.status = PlatStatus.up;
    sector.specialdata = plat;
    plats.add(plat);

    tPlatRaise(plat, plats);

    expect(sector.floorheight).toBe(FRACUNIT);
    expect<PlatStatus>(plat.status).toBe(PlatStatus.waiting);
    expect<ThinkFunction | typeof REMOVED | null>(plat.action).toBe(REMOVED);
    expect(sector.specialdata).toBeNull();
    expect(plats.slots[0]).toBeNull();
    expect(harness.sounds).toEqual([{ kind: 'sector', sfx: SFX_PSTOP, sector }]);
  });

  it('perpetualRaise stays alive after up-pastdest (only enters waiting)', () => {
    const sector = makeSector({ floorheight: 0 });
    const harness = makeHarness();
    const plats = new ActivePlats();
    const plat = new Platform(sector, PlatType.perpetualRaise, harness.callbacks);
    plat.action = (t) => tPlatRaise(t, plats);
    plat.speed = FRACUNIT;
    plat.high = FRACUNIT;
    plat.low = -2 * FRACUNIT;
    plat.wait = PLATWAIT_TICS;
    plat.status = PlatStatus.up;
    sector.specialdata = plat;
    plats.add(plat);

    tPlatRaise(plat, plats);

    expect<PlatStatus>(plat.status).toBe(PlatStatus.waiting);
    expect(plats.slots[0]).toBe(plat);
    expect(sector.specialdata).toBe(plat);
    expect(plat.action).not.toBe(REMOVED);
  });

  it('crush-reverses to down with sfx_pstart when blocked and crush=false', () => {
    const sector = makeSector({ floorheight: 0 });
    const harness = makeHarness({ blockMove: true });
    const plats = new ActivePlats();
    const plat = new Platform(sector, PlatType.downWaitUpStay, harness.callbacks);
    plat.action = (t) => tPlatRaise(t, plats);
    plat.speed = FRACUNIT;
    plat.high = 4 * FRACUNIT;
    plat.low = 0;
    plat.wait = PLATWAIT_TICS;
    plat.status = PlatStatus.up;
    plat.crush = false;
    plats.add(plat);

    tPlatRaise(plat, plats);

    expect<PlatStatus>(plat.status).toBe(PlatStatus.down);
    expect(plat.count).toBe(PLATWAIT_TICS);
    expect(harness.sounds).toEqual([{ kind: 'sector', sfx: SFX_PSTART, sector }]);
    expect(plat.action).not.toBe(REMOVED);
  });

  it('does NOT reverse on crush when plat.crush is true', () => {
    const sector = makeSector({ floorheight: 0 });
    const harness = makeHarness({ blockMove: true });
    const plats = new ActivePlats();
    const plat = new Platform(sector, PlatType.downWaitUpStay, harness.callbacks);
    plat.action = (t) => tPlatRaise(t, plats);
    plat.speed = FRACUNIT;
    plat.high = 4 * FRACUNIT;
    plat.low = 0;
    plat.status = PlatStatus.up;
    plat.crush = true;
    plats.add(plat);

    tPlatRaise(plat, plats);

    expect<PlatStatus>(plat.status).toBe(PlatStatus.up);
    expect(harness.sounds).toEqual([]);
  });

  it('raiseAndChange replays sfx_stnmov every 8 leveltime tics during up', () => {
    const sector = makeSector({ floorheight: 0 });
    const harness = makeHarness({ leveltime: 0 });
    const plats = new ActivePlats();
    const plat = new Platform(sector, PlatType.raiseAndChange, harness.callbacks);
    plat.action = (t) => tPlatRaise(t, plats);
    plat.speed = FRACUNIT;
    plat.high = 64 * FRACUNIT;
    plat.status = PlatStatus.up;
    plats.add(plat);

    harness.leveltime = 0;
    tPlatRaise(plat, plats);
    harness.leveltime = 1;
    tPlatRaise(plat, plats);
    harness.leveltime = 7;
    tPlatRaise(plat, plats);
    harness.leveltime = 8;
    tPlatRaise(plat, plats);
    harness.leveltime = 16;
    tPlatRaise(plat, plats);

    const stnmovHits = harness.sounds.filter((s) => s.sfx === SFX_STNMOV);
    expect(stnmovHits.length).toBe(3); // leveltime 0, 8, 16
  });

  it('downWaitUpStay does NOT replay sfx_stnmov during up', () => {
    const sector = makeSector({ floorheight: 0 });
    const harness = makeHarness({ leveltime: 0 });
    const plats = new ActivePlats();
    const plat = new Platform(sector, PlatType.downWaitUpStay, harness.callbacks);
    plat.action = (t) => tPlatRaise(t, plats);
    plat.speed = FRACUNIT;
    plat.high = 64 * FRACUNIT;
    plat.status = PlatStatus.up;
    plats.add(plat);

    tPlatRaise(plat, plats);
    expect(harness.sounds.filter((s) => s.sfx === SFX_STNMOV).length).toBe(0);
  });
});

// ── T_PlatRaise: waiting branch ────────────────────────────────────

describe('T_PlatRaise waiting branch', () => {
  it('counts down to zero then chooses up if floorheight equals low', () => {
    const sector = makeSector({ floorheight: 2 * FRACUNIT });
    const harness = makeHarness();
    const plats = new ActivePlats();
    const plat = new Platform(sector, PlatType.downWaitUpStay, harness.callbacks);
    plat.action = (t) => tPlatRaise(t, plats);
    plat.low = 2 * FRACUNIT;
    plat.high = 8 * FRACUNIT;
    plat.count = 2;
    plat.status = PlatStatus.waiting;
    plats.add(plat);

    tPlatRaise(plat, plats);
    expect<PlatStatus>(plat.status).toBe(PlatStatus.waiting);
    expect(plat.count).toBe(1);

    tPlatRaise(plat, plats);
    expect<PlatStatus>(plat.status).toBe(PlatStatus.up);
    expect(harness.sounds).toEqual([{ kind: 'sector', sfx: SFX_PSTART, sector }]);
  });

  it('counts down to zero then chooses down when floorheight is above low', () => {
    const sector = makeSector({ floorheight: 8 * FRACUNIT });
    const harness = makeHarness();
    const plats = new ActivePlats();
    const plat = new Platform(sector, PlatType.downWaitUpStay, harness.callbacks);
    plat.action = (t) => tPlatRaise(t, plats);
    plat.low = 2 * FRACUNIT;
    plat.high = 8 * FRACUNIT;
    plat.count = 1;
    plat.status = PlatStatus.waiting;
    plats.add(plat);

    tPlatRaise(plat, plats);
    expect<PlatStatus>(plat.status).toBe(PlatStatus.down);
  });
});

// ── T_PlatRaise: in_stasis ─────────────────────────────────────────

describe('T_PlatRaise in_stasis branch', () => {
  it('is a no-op', () => {
    const sector = makeSector({ floorheight: 4 * FRACUNIT });
    const harness = makeHarness();
    const plats = new ActivePlats();
    const plat = new Platform(sector, PlatType.downWaitUpStay, harness.callbacks);
    plat.status = PlatStatus.inStasis;
    plats.add(plat);

    tPlatRaise(plat, plats);

    expect(sector.floorheight).toBe(4 * FRACUNIT);
    expect(harness.sounds).toEqual([]);
  });
});

// ── EV_DoPlat: per-type construction ───────────────────────────────

describe('EV_DoPlat downWaitUpStay', () => {
  it('creates a plat at the matching tag with low clamped to floorheight', () => {
    const sector = makeSector({ floorheight: 16 * FRACUNIT, tag: 1 });
    const harness = makeHarness({ lowestFloor: 32 * FRACUNIT });
    const plats = new ActivePlats();
    const thinkerList = new ThinkerList();

    const created = evDoPlat(makeLine(1), PlatType.downWaitUpStay, 0, [sector], thinkerList, plats, harness.callbacks);

    expect(created).toBe(1);
    const plat = sector.specialdata as Platform;
    expect(plat).toBeInstanceOf(Platform);
    expect(plat.speed).toBe(PLATSPEED * 4);
    expect(plat.low).toBe(16 * FRACUNIT); // clamped down to floorheight
    expect(plat.high).toBe(16 * FRACUNIT);
    expect(plat.wait).toBe(PLATWAIT_TICS);
    expect(plat.status).toBe(PlatStatus.down);
    expect(plat.tag).toBe(1);
    expect(plats.slots[0]).toBe(plat);
    expect(harness.sounds).toEqual([{ kind: 'sector', sfx: SFX_PSTART, sector }]);
  });

  it('uses findLowestFloorSurrounding when below floorheight', () => {
    const sector = makeSector({ floorheight: 32 * FRACUNIT, tag: 5 });
    const harness = makeHarness({ lowestFloor: 8 * FRACUNIT });
    const plats = new ActivePlats();
    const thinkerList = new ThinkerList();

    evDoPlat(makeLine(5), PlatType.downWaitUpStay, 0, [sector], thinkerList, plats, harness.callbacks);

    const plat = sector.specialdata as Platform;
    expect(plat.low).toBe(8 * FRACUNIT);
  });

  it('skips sectors that already have specialdata (no rtn bump)', () => {
    const blocked = makeSector({ floorheight: 0, tag: 1 });
    const harness = makeHarness({ lowestFloor: -16 * FRACUNIT });
    const plats = new ActivePlats();
    const thinkerList = new ThinkerList();
    const dummy = new Platform(blocked, PlatType.downWaitUpStay, harness.callbacks);
    blocked.specialdata = dummy;

    const created = evDoPlat(makeLine(1), PlatType.downWaitUpStay, 0, [blocked], thinkerList, plats, harness.callbacks);

    expect(created).toBe(0);
    expect(plats.slots[0]).toBeNull();
    expect(blocked.specialdata).toBe(dummy);
  });
});

describe('EV_DoPlat blazeDWUS', () => {
  it('uses 8x PLATSPEED', () => {
    const sector = makeSector({ floorheight: 0, tag: 2 });
    const harness = makeHarness({ lowestFloor: -16 * FRACUNIT });
    const plats = new ActivePlats();
    const thinkerList = new ThinkerList();

    evDoPlat(makeLine(2), PlatType.blazeDWUS, 0, [sector], thinkerList, plats, harness.callbacks);

    const plat = sector.specialdata as Platform;
    expect(plat.speed).toBe(PLATSPEED * 8);
    expect(plat.status).toBe(PlatStatus.down);
  });
});

describe('EV_DoPlat raiseAndChange', () => {
  it('raises by amount*FRACUNIT, copies floorpic, plays sfx_stnmov', () => {
    const sector = makeSector({ floorheight: 16 * FRACUNIT, floorpic: 1, tag: 7 });
    const harness = makeHarness();
    const plats = new ActivePlats();
    const thinkerList = new ThinkerList();

    evDoPlat(makeLine(7, 99), PlatType.raiseAndChange, 24, [sector], thinkerList, plats, harness.callbacks);

    const plat = sector.specialdata as Platform;
    expect(plat.speed).toBe((PLATSPEED / 2) | 0);
    expect(plat.high).toBe(16 * FRACUNIT + 24 * FRACUNIT);
    expect(plat.wait).toBe(0);
    expect(plat.status).toBe(PlatStatus.up);
    expect(sector.floorpic).toBe(99);
    expect(harness.sounds).toEqual([{ kind: 'sector', sfx: SFX_STNMOV, sector }]);
  });
});

describe('EV_DoPlat raiseToNearestAndChange', () => {
  it('targets findNextHighestFloor and clears sec.special', () => {
    const sector = makeSector({
      floorheight: 0,
      floorpic: 1,
      tag: 8,
      special: 5,
    });
    const harness = makeHarness({ nextHighestFloor: 24 * FRACUNIT });
    const plats = new ActivePlats();
    const thinkerList = new ThinkerList();

    evDoPlat(makeLine(8, 77), PlatType.raiseToNearestAndChange, 0, [sector], thinkerList, plats, harness.callbacks);

    const plat = sector.specialdata as Platform;
    expect(plat.speed).toBe((PLATSPEED / 2) | 0);
    expect(plat.high).toBe(24 * FRACUNIT);
    expect(plat.status).toBe(PlatStatus.up);
    expect(sector.floorpic).toBe(77);
    expect(sector.special).toBe(0);
    expect(harness.sounds).toEqual([{ kind: 'sector', sfx: SFX_STNMOV, sector }]);
  });
});

describe('EV_DoPlat perpetualRaise', () => {
  it('seeds high/low from neighbors and randomizes initial direction with P_Random()&1', () => {
    const sector = makeSector({ floorheight: 16 * FRACUNIT, tag: 9 });
    // pRandom returns values; P_Random()&1 picks 0 (up) for an even byte.
    const harness = makeHarness({
      lowestFloor: 0,
      highestFloor: 64 * FRACUNIT,
      rngQueue: [8],
    });
    const plats = new ActivePlats();
    const thinkerList = new ThinkerList();

    evDoPlat(makeLine(9), PlatType.perpetualRaise, 0, [sector], thinkerList, plats, harness.callbacks);

    const plat = sector.specialdata as Platform;
    expect(plat.low).toBe(0);
    expect(plat.high).toBe(64 * FRACUNIT);
    expect(plat.wait).toBe(PLATWAIT_TICS);
    // 8 & 1 === 0 → PlatStatus.up
    expect(plat.status).toBe(PlatStatus.up);
    expect(harness.sounds).toEqual([{ kind: 'sector', sfx: SFX_PSTART, sector }]);
  });

  it('starts going down when P_Random()&1 is 1', () => {
    const sector = makeSector({ floorheight: 16 * FRACUNIT, tag: 9 });
    const harness = makeHarness({
      lowestFloor: 0,
      highestFloor: 64 * FRACUNIT,
      rngQueue: [9], // 9 & 1 === 1 → PlatStatus.down
    });
    const plats = new ActivePlats();
    const thinkerList = new ThinkerList();

    evDoPlat(makeLine(9), PlatType.perpetualRaise, 0, [sector], thinkerList, plats, harness.callbacks);

    const plat = sector.specialdata as Platform;
    expect(plat.status).toBe(PlatStatus.down);
  });

  it('clamps high to floorheight if neighbors are below', () => {
    const sector = makeSector({ floorheight: 100 * FRACUNIT, tag: 9 });
    const harness = makeHarness({
      lowestFloor: 0,
      highestFloor: 50 * FRACUNIT, // below floor
      rngQueue: [0],
    });
    const plats = new ActivePlats();
    const thinkerList = new ThinkerList();

    evDoPlat(makeLine(9), PlatType.perpetualRaise, 0, [sector], thinkerList, plats, harness.callbacks);

    const plat = sector.specialdata as Platform;
    expect(plat.high).toBe(100 * FRACUNIT);
  });

  it('activates stasised plats with the same tag before scanning sectors', () => {
    const sector = makeSector({ floorheight: 16 * FRACUNIT, tag: 9 });
    const harness = makeHarness({
      lowestFloor: 0,
      highestFloor: 64 * FRACUNIT,
      rngQueue: [0],
    });
    const plats = new ActivePlats();
    const thinkerList = new ThinkerList();

    // Pre-existing stasised plat with tag 9.
    const stasisSector = makeSector({ floorheight: 0, tag: 9 });
    const stasisPlat = new Platform(stasisSector, PlatType.perpetualRaise, harness.callbacks);
    stasisPlat.tag = 9;
    stasisPlat.status = PlatStatus.inStasis;
    stasisPlat.oldstatus = PlatStatus.up;
    stasisPlat.action = null;
    stasisSector.specialdata = stasisPlat;
    plats.add(stasisPlat);

    evDoPlat(makeLine(9), PlatType.perpetualRaise, 0, [sector], thinkerList, plats, harness.callbacks);

    expect<PlatStatus>(stasisPlat.status).toBe(PlatStatus.up);
    expect(stasisPlat.action).not.toBeNull();
  });
});

describe('EV_DoPlat tag matching', () => {
  it('ignores sectors with different tags', () => {
    const matching = makeSector({ floorheight: 0, tag: 4 });
    const other = makeSector({ floorheight: 0, tag: 5 });
    const harness = makeHarness({ lowestFloor: -16 * FRACUNIT });
    const plats = new ActivePlats();
    const thinkerList = new ThinkerList();

    const created = evDoPlat(makeLine(4), PlatType.downWaitUpStay, 0, [matching, other], thinkerList, plats, harness.callbacks);

    expect(created).toBe(1);
    expect(matching.specialdata).not.toBeNull();
    expect(other.specialdata).toBeNull();
  });

  it('returns 0 when the sectors array is empty', () => {
    const harness = makeHarness();
    const plats = new ActivePlats();
    const thinkerList = new ThinkerList();

    const created = evDoPlat(makeLine(1), PlatType.downWaitUpStay, 0, [], thinkerList, plats, harness.callbacks);

    expect(created).toBe(0);
    expect(plats.slots[0]).toBeNull();
    expect(harness.sounds).toEqual([]);
  });

  it('downWaitUpStay does NOT reactivate stasis plats (perpetualRaise-only behavior)', () => {
    const stasisSector = makeSector({ floorheight: 0, tag: 5 });
    const harness = makeHarness();
    const plats = new ActivePlats();
    const thinkerList = new ThinkerList();

    const stasisPlat = new Platform(stasisSector, PlatType.perpetualRaise, harness.callbacks);
    stasisPlat.tag = 5;
    stasisPlat.status = PlatStatus.inStasis;
    stasisPlat.oldstatus = PlatStatus.up;
    stasisPlat.action = null;
    stasisSector.specialdata = stasisPlat;
    plats.add(stasisPlat);

    const mover = makeSector({ floorheight: 0, tag: 5 });
    evDoPlat(makeLine(5), PlatType.downWaitUpStay, 0, [mover], thinkerList, plats, harness.callbacks);

    expect<PlatStatus>(stasisPlat.status).toBe(PlatStatus.inStasis);
    expect(stasisPlat.action).toBeNull();
  });

  it('perpetualRaise returns 0 when only stasis activation happens (no new sectors)', () => {
    const harness = makeHarness({ rngQueue: [0] });
    const plats = new ActivePlats();
    const thinkerList = new ThinkerList();

    const stasisSector = makeSector({ floorheight: 0, tag: 9 });
    const stasisPlat = new Platform(stasisSector, PlatType.perpetualRaise, harness.callbacks);
    stasisPlat.tag = 9;
    stasisPlat.status = PlatStatus.inStasis;
    stasisPlat.oldstatus = PlatStatus.up;
    stasisPlat.action = null;
    stasisSector.specialdata = stasisPlat;
    plats.add(stasisPlat);

    const decoy = makeSector({ floorheight: 0, tag: 99 });
    const created = evDoPlat(makeLine(9), PlatType.perpetualRaise, 0, [decoy], thinkerList, plats, harness.callbacks);

    expect(created).toBe(0);
    expect<PlatStatus>(stasisPlat.status).toBe(PlatStatus.up);
    expect(stasisPlat.action).not.toBeNull();
  });
});

// ── EV_StopPlat / P_ActivateInStasis ──────────────────────────────

describe('EV_StopPlat / P_ActivateInStasis round trip', () => {
  it('stops only matching active plats and saves oldstatus', () => {
    const harness = makeHarness();
    const plats = new ActivePlats();

    const plat1 = new Platform(makeSector({ floorheight: 0 }), PlatType.perpetualRaise, harness.callbacks);
    plat1.tag = 11;
    plat1.status = PlatStatus.up;
    plat1.action = (t) => tPlatRaise(t, plats);
    plats.add(plat1);

    const plat2 = new Platform(makeSector({ floorheight: 0 }), PlatType.perpetualRaise, harness.callbacks);
    plat2.tag = 22;
    plat2.status = PlatStatus.down;
    plat2.action = (t) => tPlatRaise(t, plats);
    plats.add(plat2);

    evStopPlat(makeLine(11), plats);

    expect<PlatStatus>(plat1.status).toBe(PlatStatus.inStasis);
    expect<PlatStatus>(plat1.oldstatus).toBe(PlatStatus.up);
    expect(plat1.action).toBeNull();

    expect<PlatStatus>(plat2.status).toBe(PlatStatus.down);
    expect(plat2.action).not.toBeNull();
  });

  it('does NOT stop a plat already in stasis (no-op for status, no oldstatus overwrite)', () => {
    const harness = makeHarness();
    const plats = new ActivePlats();

    const plat = new Platform(makeSector({ floorheight: 0 }), PlatType.perpetualRaise, harness.callbacks);
    plat.tag = 11;
    plat.status = PlatStatus.inStasis;
    plat.oldstatus = PlatStatus.up;
    plats.add(plat);

    evStopPlat(makeLine(11), plats);

    expect<PlatStatus>(plat.status).toBe(PlatStatus.inStasis);
    expect(plat.oldstatus).toBe(PlatStatus.up);
  });

  it('is a no-op when no active plats match the tag', () => {
    const harness = makeHarness();
    const plats = new ActivePlats();

    const plat = new Platform(makeSector({ floorheight: 0 }), PlatType.perpetualRaise, harness.callbacks);
    plat.tag = 11;
    plat.status = PlatStatus.up;
    plat.oldstatus = PlatStatus.down;
    plat.action = (t) => tPlatRaise(t, plats);
    plats.add(plat);

    evStopPlat(makeLine(99), plats);

    expect<PlatStatus>(plat.status).toBe(PlatStatus.up);
    expect<PlatStatus>(plat.oldstatus).toBe(PlatStatus.down);
    expect(plat.action).not.toBeNull();
  });

  it('pActivateInStasis restores oldstatus and re-attaches the action', () => {
    const harness = makeHarness();
    const plats = new ActivePlats();
    const plat = new Platform(makeSector({ floorheight: 0 }), PlatType.perpetualRaise, harness.callbacks);
    plat.tag = 13;
    plat.status = PlatStatus.inStasis;
    plat.oldstatus = PlatStatus.down;
    plat.action = null;
    plats.add(plat);

    pActivateInStasis(13, plats);

    expect<PlatStatus>(plat.status).toBe(PlatStatus.down);
    expect(plat.action).not.toBeNull();
  });

  it('pActivateInStasis ignores non-matching tags and non-stasis plats', () => {
    const harness = makeHarness();
    const plats = new ActivePlats();

    const wrongTag = new Platform(makeSector({ floorheight: 0 }), PlatType.perpetualRaise, harness.callbacks);
    wrongTag.tag = 99;
    wrongTag.status = PlatStatus.inStasis;
    wrongTag.oldstatus = PlatStatus.up;
    wrongTag.action = null;
    plats.add(wrongTag);

    const notInStasis = new Platform(makeSector({ floorheight: 0 }), PlatType.perpetualRaise, harness.callbacks);
    notInStasis.tag = 13;
    notInStasis.status = PlatStatus.up;
    plats.add(notInStasis);

    pActivateInStasis(13, plats);

    expect(wrongTag.status).toBe(PlatStatus.inStasis);
    expect(notInStasis.status).toBe(PlatStatus.up);
  });
});

// ── ActivePlats registry ──────────────────────────────────────────

describe('ActivePlats registry', () => {
  it('uses the first NULL slot for add (vanilla linear scan)', () => {
    const harness = makeHarness();
    const plats = new ActivePlats();
    const a = new Platform(makeSector({ floorheight: 0 }), PlatType.downWaitUpStay, harness.callbacks);
    const b = new Platform(makeSector({ floorheight: 0 }), PlatType.downWaitUpStay, harness.callbacks);
    plats.add(a);
    plats.add(b);
    expect(plats.slots[0]).toBe(a);
    expect(plats.slots[1]).toBe(b);

    plats.remove(a);
    const c = new Platform(makeSector({ floorheight: 0 }), PlatType.downWaitUpStay, harness.callbacks);
    plats.add(c);
    expect(plats.slots[0]).toBe(c);
    expect(plats.slots[1]).toBe(b);
  });

  it('throws when the registry exceeds MAXPLATS — vanilla I_Error parity', () => {
    const harness = makeHarness();
    const plats = new ActivePlats();
    for (let i = 0; i < MAXPLATS; i++) {
      plats.add(new Platform(makeSector({ floorheight: 0 }), PlatType.downWaitUpStay, harness.callbacks));
    }
    expect(() => plats.add(new Platform(makeSector({ floorheight: 0 }), PlatType.downWaitUpStay, harness.callbacks))).toThrow('P_AddActivePlat: no more plats!');
  });

  it('remove clears specialdata, marks REMOVED, and frees the slot', () => {
    const harness = makeHarness();
    const plats = new ActivePlats();
    const sector = makeSector({ floorheight: 0 });
    const plat = new Platform(sector, PlatType.downWaitUpStay, harness.callbacks);
    sector.specialdata = plat;
    plats.add(plat);

    plats.remove(plat);

    expect(sector.specialdata).toBeNull();
    expect(plat.action).toBe(REMOVED);
    expect(plats.slots[0]).toBeNull();
  });

  it('remove throws when the plat is not registered', () => {
    const harness = makeHarness();
    const plats = new ActivePlats();
    const stray = new Platform(makeSector({ floorheight: 0 }), PlatType.downWaitUpStay, harness.callbacks);
    expect(() => plats.remove(stray)).toThrow("P_RemoveActivePlat: can't find plat!");
  });
});
