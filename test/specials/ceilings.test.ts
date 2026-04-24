import { describe, expect, it } from 'bun:test';

import { FRACUNIT } from '../../src/core/fixed.ts';
import {
  ActiveCeilings,
  CEILING_8_UNIT_OFFSET,
  CEILSPEED,
  CEILWAIT,
  Ceiling,
  CeilingDirection,
  CeilingType,
  MAXCEILINGS,
  SFX_PSTOP,
  SFX_STNMOV,
  evCeilingCrushStop,
  evDoCeiling,
  pActivateInStasisCeiling,
  tMoveCeiling,
} from '../../src/specials/ceilings.ts';
import type { CeilingCallbacks, CeilingLine, CeilingSector } from '../../src/specials/ceilings.ts';
import { PlaneMoveResult } from '../../src/specials/doors.ts';
import { REMOVED, ThinkerList } from '../../src/world/thinkers.ts';
import type { ThinkFunction } from '../../src/world/thinkers.ts';

// ── Harness helpers ─────────────────────────────────────────────────

interface SoundEvent {
  readonly kind: 'sector';
  readonly sfx: number;
  readonly sector: CeilingSector;
}

function makeSector(options: { ceilingheight: number; floorheight?: number; special?: number; tag?: number }): CeilingSector {
  return {
    floorheight: options.floorheight ?? 0,
    ceilingheight: options.ceilingheight,
    special: options.special ?? 0,
    specialdata: null,
    tag: options.tag ?? 0,
  };
}

function makeLine(tag: number): CeilingLine {
  return { tag };
}

interface Harness {
  readonly callbacks: CeilingCallbacks;
  readonly sounds: SoundEvent[];
  highestCeiling: number;
  /** Force movePlane to return `crushed` instead of progressing. */
  blockMove: boolean;
  leveltime: number;
}

function makeHarness(
  options: {
    highestCeiling?: number;
    blockMove?: boolean;
    leveltime?: number;
  } = {},
): Harness {
  const sounds: SoundEvent[] = [];
  const state = {
    highestCeiling: options.highestCeiling ?? 256 * FRACUNIT,
    blockMove: options.blockMove ?? false,
    leveltime: options.leveltime ?? 0,
  };
  const callbacks: CeilingCallbacks = {
    movePlane(sector, speed, destheight, _crush, floorOrCeiling, direction) {
      if (floorOrCeiling !== 1) {
        throw new Error('ceiling mover moved a floor plane — not vanilla');
      }
      if (state.blockMove) {
        return PlaneMoveResult.crushed;
      }
      if (direction === 1) {
        const next = sector.ceilingheight + speed;
        if (next >= destheight) {
          sector.ceilingheight = destheight;
          return PlaneMoveResult.pastdest;
        }
        sector.ceilingheight = next;
        return PlaneMoveResult.ok;
      }
      const next = sector.ceilingheight - speed;
      if (next <= destheight) {
        sector.ceilingheight = destheight;
        return PlaneMoveResult.pastdest;
      }
      sector.ceilingheight = next;
      return PlaneMoveResult.ok;
    },
    findHighestCeilingSurrounding() {
      return state.highestCeiling;
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
    get highestCeiling() {
      return state.highestCeiling;
    },
    set highestCeiling(v: number) {
      state.highestCeiling = v;
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

describe('ceiling constants', () => {
  it('pins vanilla CEILSPEED, CEILWAIT, MAXCEILINGS, and the 8-unit offset', () => {
    expect(CEILSPEED).toBe(FRACUNIT);
    expect(CEILWAIT).toBe(150);
    expect(MAXCEILINGS).toBe(30);
    expect(CEILING_8_UNIT_OFFSET).toBe(8 * FRACUNIT);
  });

  it('exposes sfxenum_t indices', () => {
    expect(SFX_STNMOV).toBe(22);
    expect(SFX_PSTOP).toBe(19);
  });

  it('CeilingType codes match vanilla ceiling_e order', () => {
    expect(CeilingType.lowerToFloor).toBe(0);
    expect(CeilingType.raiseToHighest).toBe(1);
    expect(CeilingType.lowerAndCrush).toBe(2);
    expect(CeilingType.crushAndRaise).toBe(3);
    expect(CeilingType.fastCrushAndRaise).toBe(4);
    expect(CeilingType.silentCrushAndRaise).toBe(5);
  });

  it('CeilingDirection codes double as T_MovePlane direction argument', () => {
    expect(CeilingDirection.down).toBe(-1);
    expect(CeilingDirection.inStasis).toBe(0);
    expect(CeilingDirection.up).toBe(1);
  });
});

// ── T_MoveCeiling: sfx_stnmov cadence ──────────────────────────────

describe('T_MoveCeiling sfx_stnmov cadence', () => {
  it('plays sfx_stnmov every 8 leveltime tics during an up move for non-silent types', () => {
    const sector = makeSector({ ceilingheight: 16 * FRACUNIT });
    const harness = makeHarness();
    const ceilings = new ActiveCeilings();
    const ceiling = new Ceiling(sector, CeilingType.raiseToHighest, harness.callbacks);
    ceiling.action = (t) => tMoveCeiling(t, ceilings);
    ceiling.speed = CEILSPEED;
    ceiling.direction = CeilingDirection.up;
    ceiling.topheight = 64 * FRACUNIT;

    for (let lt = 0; lt < 17; lt++) {
      harness.leveltime = lt;
      tMoveCeiling(ceiling, ceilings);
    }

    const stnmovs = harness.sounds.filter((s) => s.sfx === SFX_STNMOV);
    expect(stnmovs.length).toBe(3);
  });

  it('plays sfx_stnmov every 8 leveltime tics during a down move for non-silent types', () => {
    const sector = makeSector({ ceilingheight: 64 * FRACUNIT, floorheight: 0 });
    const harness = makeHarness();
    const ceilings = new ActiveCeilings();
    const ceiling = new Ceiling(sector, CeilingType.lowerAndCrush, harness.callbacks);
    ceiling.action = (t) => tMoveCeiling(t, ceilings);
    ceiling.speed = CEILSPEED;
    ceiling.direction = CeilingDirection.down;
    ceiling.bottomheight = 0;

    for (let lt = 0; lt < 17; lt++) {
      harness.leveltime = lt;
      tMoveCeiling(ceiling, ceilings);
    }

    const stnmovs = harness.sounds.filter((s) => s.sfx === SFX_STNMOV);
    expect(stnmovs.length).toBe(3);
  });

  it('does NOT play sfx_stnmov for silentCrushAndRaise in either direction', () => {
    const sector = makeSector({ ceilingheight: 64 * FRACUNIT, floorheight: 0 });
    const harness = makeHarness();
    const ceilings = new ActiveCeilings();
    const ceiling = new Ceiling(sector, CeilingType.silentCrushAndRaise, harness.callbacks);
    ceiling.action = (t) => tMoveCeiling(t, ceilings);
    ceiling.speed = CEILSPEED;
    ceiling.direction = CeilingDirection.down;
    ceiling.topheight = 64 * FRACUNIT;
    ceiling.bottomheight = 8 * FRACUNIT;

    for (let lt = 0; lt < 32; lt++) {
      harness.leveltime = lt;
      tMoveCeiling(ceiling, ceilings);
    }

    expect(harness.sounds.filter((s) => s.sfx === SFX_STNMOV).length).toBe(0);
  });

  it('gates on leveltime & 7 (plays at 0, 8, 16 — not at 1, 7, 9, 15)', () => {
    const sector = makeSector({ ceilingheight: 64 * FRACUNIT });
    const harness = makeHarness({ leveltime: 1 });
    const ceilings = new ActiveCeilings();
    const ceiling = new Ceiling(sector, CeilingType.lowerAndCrush, harness.callbacks);
    ceiling.action = (t) => tMoveCeiling(t, ceilings);
    ceiling.speed = CEILSPEED;
    ceiling.direction = CeilingDirection.down;
    ceiling.bottomheight = 0;

    for (const lt of [1, 7, 9, 15]) {
      harness.leveltime = lt;
      tMoveCeiling(ceiling, ceilings);
    }
    expect(harness.sounds.filter((s) => s.sfx === SFX_STNMOV).length).toBe(0);
  });
});

// ── T_MoveCeiling: UP branch ──────────────────────────────────────

describe('T_MoveCeiling UP branch', () => {
  it('raises one speed unit per tic when not at pastdest', () => {
    const sector = makeSector({ ceilingheight: 16 * FRACUNIT });
    const harness = makeHarness({ leveltime: 1 });
    const ceilings = new ActiveCeilings();
    const ceiling = new Ceiling(sector, CeilingType.raiseToHighest, harness.callbacks);
    ceiling.action = (t) => tMoveCeiling(t, ceilings);
    ceiling.speed = CEILSPEED;
    ceiling.direction = CeilingDirection.up;
    ceiling.topheight = 64 * FRACUNIT;

    tMoveCeiling(ceiling, ceilings);
    expect(sector.ceilingheight).toBe(17 * FRACUNIT);
    expect<ThinkFunction | typeof REMOVED | null>(ceiling.action).not.toBe(REMOVED);
  });

  it('passes crush=false LITERAL to movePlane regardless of ceiling.crush', () => {
    const sector = makeSector({ ceilingheight: 16 * FRACUNIT });
    const harness = makeHarness({ leveltime: 1 });
    const ceilings = new ActiveCeilings();
    const ceiling = new Ceiling(sector, CeilingType.crushAndRaise, harness.callbacks);
    ceiling.action = (t) => tMoveCeiling(t, ceilings);
    ceiling.speed = CEILSPEED;
    ceiling.direction = CeilingDirection.up;
    ceiling.crush = true;
    ceiling.topheight = 64 * FRACUNIT;

    let captured: { crush: boolean } | null = null;
    const realMovePlane = harness.callbacks.movePlane;
    harness.callbacks.movePlane = (sec, speed, dest, crush, foc, dir) => {
      captured = { crush };
      return realMovePlane(sec, speed, dest, crush, foc, dir);
    };

    tMoveCeiling(ceiling, ceilings);
    expect(captured).not.toBeNull();
    expect(captured!.crush).toBe(false);
  });

  it('raiseToHighest UP-pastdest removes the ceiling from the active registry', () => {
    const sector = makeSector({ ceilingheight: 63 * FRACUNIT });
    const harness = makeHarness({ leveltime: 1 });
    const ceilings = new ActiveCeilings();
    const ceiling = new Ceiling(sector, CeilingType.raiseToHighest, harness.callbacks);
    ceiling.action = (t) => tMoveCeiling(t, ceilings);
    ceiling.speed = CEILSPEED;
    ceiling.direction = CeilingDirection.up;
    ceiling.topheight = 64 * FRACUNIT;
    sector.specialdata = ceiling;
    ceilings.add(ceiling);

    tMoveCeiling(ceiling, ceilings);

    expect(sector.ceilingheight).toBe(64 * FRACUNIT);
    expect(sector.specialdata).toBeNull();
    expect<ThinkFunction | typeof REMOVED | null>(ceiling.action).toBe(REMOVED);
    expect(ceilings.slots.every((s) => s !== ceiling)).toBe(true);
  });

  it('silentCrushAndRaise UP-pastdest plays sfx_pstop AND reverses to down', () => {
    const sector = makeSector({ ceilingheight: 63 * FRACUNIT, floorheight: 0 });
    const harness = makeHarness({ leveltime: 1 });
    const ceilings = new ActiveCeilings();
    const ceiling = new Ceiling(sector, CeilingType.silentCrushAndRaise, harness.callbacks);
    ceiling.action = (t) => tMoveCeiling(t, ceilings);
    ceiling.speed = CEILSPEED;
    ceiling.direction = CeilingDirection.up;
    ceiling.crush = true;
    ceiling.topheight = 64 * FRACUNIT;
    ceiling.bottomheight = 8 * FRACUNIT;

    tMoveCeiling(ceiling, ceilings);

    expect(harness.sounds.map((s) => s.sfx)).toEqual([SFX_PSTOP]);
    expect<CeilingDirection>(ceiling.direction).toBe(CeilingDirection.down);
    expect<ThinkFunction | typeof REMOVED | null>(ceiling.action).not.toBe(REMOVED);
  });

  it('crushAndRaise UP-pastdest reverses silently', () => {
    const sector = makeSector({ ceilingheight: 63 * FRACUNIT, floorheight: 0 });
    const harness = makeHarness({ leveltime: 1 });
    const ceilings = new ActiveCeilings();
    const ceiling = new Ceiling(sector, CeilingType.crushAndRaise, harness.callbacks);
    ceiling.action = (t) => tMoveCeiling(t, ceilings);
    ceiling.speed = CEILSPEED;
    ceiling.direction = CeilingDirection.up;
    ceiling.crush = true;
    ceiling.topheight = 64 * FRACUNIT;
    ceiling.bottomheight = 8 * FRACUNIT;

    tMoveCeiling(ceiling, ceilings);

    expect(harness.sounds.filter((s) => s.sfx === SFX_PSTOP).length).toBe(0);
    expect<CeilingDirection>(ceiling.direction).toBe(CeilingDirection.down);
  });

  it('fastCrushAndRaise UP-pastdest reverses silently without changing speed', () => {
    const sector = makeSector({ ceilingheight: 62 * FRACUNIT, floorheight: 0 });
    const harness = makeHarness({ leveltime: 1 });
    const ceilings = new ActiveCeilings();
    const ceiling = new Ceiling(sector, CeilingType.fastCrushAndRaise, harness.callbacks);
    ceiling.action = (t) => tMoveCeiling(t, ceilings);
    ceiling.speed = CEILSPEED * 2;
    ceiling.direction = CeilingDirection.up;
    ceiling.crush = true;
    ceiling.topheight = 64 * FRACUNIT;
    ceiling.bottomheight = 8 * FRACUNIT;

    tMoveCeiling(ceiling, ceilings);

    expect(harness.sounds.filter((s) => s.sfx === SFX_PSTOP).length).toBe(0);
    expect<CeilingDirection>(ceiling.direction).toBe(CeilingDirection.down);
    expect(ceiling.speed).toBe(CEILSPEED * 2);
  });

  it('non-crusher types (lowerAndCrush, lowerToFloor) are no-op at UP-pastdest', () => {
    const sector = makeSector({ ceilingheight: 63 * FRACUNIT });
    const harness = makeHarness({ leveltime: 1 });
    const ceilings = new ActiveCeilings();
    const ceiling = new Ceiling(sector, CeilingType.lowerAndCrush, harness.callbacks);
    ceiling.action = (t) => tMoveCeiling(t, ceilings);
    ceiling.speed = CEILSPEED;
    ceiling.direction = CeilingDirection.up;
    ceiling.topheight = 64 * FRACUNIT;

    tMoveCeiling(ceiling, ceilings);

    expect<CeilingDirection>(ceiling.direction).toBe(CeilingDirection.up);
    expect<ThinkFunction | typeof REMOVED | null>(ceiling.action).not.toBe(REMOVED);
  });
});

// ── T_MoveCeiling: DOWN branch ────────────────────────────────────

describe('T_MoveCeiling DOWN branch', () => {
  it('lowers one speed unit per tic when not at pastdest', () => {
    const sector = makeSector({ ceilingheight: 64 * FRACUNIT, floorheight: 0 });
    const harness = makeHarness({ leveltime: 1 });
    const ceilings = new ActiveCeilings();
    const ceiling = new Ceiling(sector, CeilingType.lowerToFloor, harness.callbacks);
    ceiling.action = (t) => tMoveCeiling(t, ceilings);
    ceiling.speed = CEILSPEED;
    ceiling.direction = CeilingDirection.down;
    ceiling.bottomheight = 0;

    tMoveCeiling(ceiling, ceilings);
    expect(sector.ceilingheight).toBe(63 * FRACUNIT);
  });

  it('passes ceiling.crush through to movePlane on the down leg', () => {
    const sector = makeSector({ ceilingheight: 64 * FRACUNIT, floorheight: 0 });
    const harness = makeHarness({ leveltime: 1 });
    const ceilings = new ActiveCeilings();
    const ceiling = new Ceiling(sector, CeilingType.crushAndRaise, harness.callbacks);
    ceiling.action = (t) => tMoveCeiling(t, ceilings);
    ceiling.speed = CEILSPEED;
    ceiling.direction = CeilingDirection.down;
    ceiling.crush = true;
    ceiling.bottomheight = 8 * FRACUNIT;

    let captured: { crush: boolean } | null = null;
    const realMovePlane = harness.callbacks.movePlane;
    harness.callbacks.movePlane = (sec, speed, dest, crush, foc, dir) => {
      captured = { crush };
      return realMovePlane(sec, speed, dest, crush, foc, dir);
    };

    tMoveCeiling(ceiling, ceilings);

    expect(captured).not.toBeNull();
    expect(captured!.crush).toBe(true);
  });

  it('lowerToFloor DOWN-pastdest removes the ceiling', () => {
    const sector = makeSector({ ceilingheight: FRACUNIT, floorheight: 0 });
    const harness = makeHarness({ leveltime: 1 });
    const ceilings = new ActiveCeilings();
    const ceiling = new Ceiling(sector, CeilingType.lowerToFloor, harness.callbacks);
    ceiling.action = (t) => tMoveCeiling(t, ceilings);
    ceiling.speed = CEILSPEED;
    ceiling.direction = CeilingDirection.down;
    ceiling.bottomheight = 0;
    sector.specialdata = ceiling;
    ceilings.add(ceiling);

    tMoveCeiling(ceiling, ceilings);

    expect(sector.ceilingheight).toBe(0);
    expect(sector.specialdata).toBeNull();
    expect<ThinkFunction | typeof REMOVED | null>(ceiling.action).toBe(REMOVED);
  });

  it('lowerAndCrush DOWN-pastdest removes the ceiling', () => {
    const sector = makeSector({ ceilingheight: 9 * FRACUNIT, floorheight: 0 });
    const harness = makeHarness({ leveltime: 1 });
    const ceilings = new ActiveCeilings();
    const ceiling = new Ceiling(sector, CeilingType.lowerAndCrush, harness.callbacks);
    ceiling.action = (t) => tMoveCeiling(t, ceilings);
    ceiling.speed = CEILSPEED;
    ceiling.direction = CeilingDirection.down;
    ceiling.bottomheight = 8 * FRACUNIT;
    sector.specialdata = ceiling;
    ceilings.add(ceiling);

    tMoveCeiling(ceiling, ceilings);

    expect(sector.specialdata).toBeNull();
    expect<ThinkFunction | typeof REMOVED | null>(ceiling.action).toBe(REMOVED);
  });

  it('silentCrushAndRaise DOWN-pastdest plays sfx_pstop, resets speed to CEILSPEED, and reverses to up', () => {
    const sector = makeSector({ ceilingheight: 8 * FRACUNIT + 100, floorheight: 0 });
    const harness = makeHarness({ leveltime: 1 });
    const ceilings = new ActiveCeilings();
    const ceiling = new Ceiling(sector, CeilingType.silentCrushAndRaise, harness.callbacks);
    ceiling.action = (t) => tMoveCeiling(t, ceilings);
    ceiling.speed = (CEILSPEED / 8) | 0;
    ceiling.direction = CeilingDirection.down;
    ceiling.crush = true;
    ceiling.topheight = 64 * FRACUNIT;
    ceiling.bottomheight = 8 * FRACUNIT;

    tMoveCeiling(ceiling, ceilings);

    expect(harness.sounds.map((s) => s.sfx)).toEqual([SFX_PSTOP]);
    expect(ceiling.speed).toBe(CEILSPEED);
    expect<CeilingDirection>(ceiling.direction).toBe(CeilingDirection.up);
  });

  it('crushAndRaise DOWN-pastdest resets speed to CEILSPEED and reverses silently', () => {
    const sector = makeSector({ ceilingheight: 8 * FRACUNIT + 100, floorheight: 0 });
    const harness = makeHarness({ leveltime: 1 });
    const ceilings = new ActiveCeilings();
    const ceiling = new Ceiling(sector, CeilingType.crushAndRaise, harness.callbacks);
    ceiling.action = (t) => tMoveCeiling(t, ceilings);
    ceiling.speed = (CEILSPEED / 8) | 0;
    ceiling.direction = CeilingDirection.down;
    ceiling.crush = true;
    ceiling.topheight = 64 * FRACUNIT;
    ceiling.bottomheight = 8 * FRACUNIT;

    tMoveCeiling(ceiling, ceilings);

    expect(harness.sounds.filter((s) => s.sfx === SFX_PSTOP).length).toBe(0);
    expect(ceiling.speed).toBe(CEILSPEED);
    expect<CeilingDirection>(ceiling.direction).toBe(CeilingDirection.up);
  });

  it('fastCrushAndRaise DOWN-pastdest reverses silently WITHOUT resetting speed', () => {
    const sector = makeSector({ ceilingheight: 10 * FRACUNIT, floorheight: 0 });
    const harness = makeHarness({ leveltime: 1 });
    const ceilings = new ActiveCeilings();
    const ceiling = new Ceiling(sector, CeilingType.fastCrushAndRaise, harness.callbacks);
    ceiling.action = (t) => tMoveCeiling(t, ceilings);
    ceiling.speed = CEILSPEED * 2;
    ceiling.direction = CeilingDirection.down;
    ceiling.crush = true;
    ceiling.topheight = 64 * FRACUNIT;
    ceiling.bottomheight = 8 * FRACUNIT;

    tMoveCeiling(ceiling, ceilings);

    expect(harness.sounds.filter((s) => s.sfx === SFX_PSTOP).length).toBe(0);
    expect<CeilingDirection>(ceiling.direction).toBe(CeilingDirection.up);
    expect(ceiling.speed).toBe(CEILSPEED * 2);
  });

  it('raiseToHighest DOWN-pastdest is a no-op (raiseToHighest is up-only)', () => {
    const sector = makeSector({ ceilingheight: FRACUNIT, floorheight: 0 });
    const harness = makeHarness({ leveltime: 1 });
    const ceilings = new ActiveCeilings();
    const ceiling = new Ceiling(sector, CeilingType.raiseToHighest, harness.callbacks);
    ceiling.action = (t) => tMoveCeiling(t, ceilings);
    ceiling.speed = CEILSPEED;
    ceiling.direction = CeilingDirection.down;
    ceiling.bottomheight = 0;
    sector.specialdata = ceiling;
    ceilings.add(ceiling);

    tMoveCeiling(ceiling, ceilings);

    expect(sector.specialdata).toBe(ceiling);
    expect<ThinkFunction | typeof REMOVED | null>(ceiling.action).not.toBe(REMOVED);
    expect<CeilingDirection>(ceiling.direction).toBe(CeilingDirection.down);
  });
});

// ── T_MoveCeiling: DOWN crushed branch ─────────────────────────────

describe('T_MoveCeiling DOWN crushed branch', () => {
  it('silentCrushAndRaise slows to CEILSPEED/8 when movePlane returns crushed', () => {
    const sector = makeSector({ ceilingheight: 32 * FRACUNIT, floorheight: 0 });
    const harness = makeHarness({ blockMove: true, leveltime: 1 });
    const ceilings = new ActiveCeilings();
    const ceiling = new Ceiling(sector, CeilingType.silentCrushAndRaise, harness.callbacks);
    ceiling.action = (t) => tMoveCeiling(t, ceilings);
    ceiling.speed = CEILSPEED;
    ceiling.direction = CeilingDirection.down;
    ceiling.crush = true;
    ceiling.bottomheight = 8 * FRACUNIT;

    tMoveCeiling(ceiling, ceilings);

    expect(ceiling.speed).toBe((CEILSPEED / 8) | 0);
  });

  it('crushAndRaise slows to CEILSPEED/8 when crushed', () => {
    const sector = makeSector({ ceilingheight: 32 * FRACUNIT, floorheight: 0 });
    const harness = makeHarness({ blockMove: true, leveltime: 1 });
    const ceilings = new ActiveCeilings();
    const ceiling = new Ceiling(sector, CeilingType.crushAndRaise, harness.callbacks);
    ceiling.action = (t) => tMoveCeiling(t, ceilings);
    ceiling.speed = CEILSPEED;
    ceiling.direction = CeilingDirection.down;
    ceiling.crush = true;
    ceiling.bottomheight = 8 * FRACUNIT;

    tMoveCeiling(ceiling, ceilings);

    expect(ceiling.speed).toBe((CEILSPEED / 8) | 0);
  });

  it('lowerAndCrush slows to CEILSPEED/8 when crushed', () => {
    const sector = makeSector({ ceilingheight: 32 * FRACUNIT, floorheight: 0 });
    const harness = makeHarness({ blockMove: true, leveltime: 1 });
    const ceilings = new ActiveCeilings();
    const ceiling = new Ceiling(sector, CeilingType.lowerAndCrush, harness.callbacks);
    ceiling.action = (t) => tMoveCeiling(t, ceilings);
    ceiling.speed = CEILSPEED;
    ceiling.direction = CeilingDirection.down;
    ceiling.bottomheight = 8 * FRACUNIT;

    tMoveCeiling(ceiling, ceilings);

    expect(ceiling.speed).toBe((CEILSPEED / 8) | 0);
  });

  it('fastCrushAndRaise KEEPS speed when crushed — fast crushers never slow down', () => {
    const sector = makeSector({ ceilingheight: 32 * FRACUNIT, floorheight: 0 });
    const harness = makeHarness({ blockMove: true, leveltime: 1 });
    const ceilings = new ActiveCeilings();
    const ceiling = new Ceiling(sector, CeilingType.fastCrushAndRaise, harness.callbacks);
    ceiling.action = (t) => tMoveCeiling(t, ceilings);
    ceiling.speed = CEILSPEED * 2;
    ceiling.direction = CeilingDirection.down;
    ceiling.crush = true;
    ceiling.bottomheight = 8 * FRACUNIT;

    tMoveCeiling(ceiling, ceilings);

    expect(ceiling.speed).toBe(CEILSPEED * 2);
  });

  it('lowerToFloor KEEPS speed when crushed', () => {
    const sector = makeSector({ ceilingheight: 32 * FRACUNIT, floorheight: 0 });
    const harness = makeHarness({ blockMove: true, leveltime: 1 });
    const ceilings = new ActiveCeilings();
    const ceiling = new Ceiling(sector, CeilingType.lowerToFloor, harness.callbacks);
    ceiling.action = (t) => tMoveCeiling(t, ceilings);
    ceiling.speed = CEILSPEED;
    ceiling.direction = CeilingDirection.down;
    ceiling.bottomheight = 0;

    tMoveCeiling(ceiling, ceilings);

    expect(ceiling.speed).toBe(CEILSPEED);
  });
});

// ── T_MoveCeiling: inStasis branch ─────────────────────────────────

describe('T_MoveCeiling inStasis branch', () => {
  it('is a no-op — no movePlane call, no sound', () => {
    const sector = makeSector({ ceilingheight: 64 * FRACUNIT, floorheight: 0 });
    const harness = makeHarness({ leveltime: 0 });
    const ceilings = new ActiveCeilings();
    const ceiling = new Ceiling(sector, CeilingType.crushAndRaise, harness.callbacks);
    ceiling.action = (t) => tMoveCeiling(t, ceilings);
    ceiling.speed = CEILSPEED;
    ceiling.direction = CeilingDirection.inStasis;
    ceiling.crush = true;
    ceiling.topheight = 64 * FRACUNIT;
    ceiling.bottomheight = 8 * FRACUNIT;

    let callCount = 0;
    const realMovePlane = harness.callbacks.movePlane;
    harness.callbacks.movePlane = (...args) => {
      callCount++;
      return realMovePlane(...args);
    };

    tMoveCeiling(ceiling, ceilings);

    expect(callCount).toBe(0);
    expect(harness.sounds.length).toBe(0);
    expect(sector.ceilingheight).toBe(64 * FRACUNIT);
  });
});

// ── EV_DoCeiling: per-type construction ────────────────────────────

describe('EV_DoCeiling lowerToFloor', () => {
  it('creates a down-mover with bottomheight=floorheight (no 8-unit clearance)', () => {
    const sector = makeSector({ ceilingheight: 64 * FRACUNIT, floorheight: 8 * FRACUNIT, tag: 3 });
    const harness = makeHarness();
    const thinkerList = new ThinkerList();
    const ceilings = new ActiveCeilings();

    const created = evDoCeiling(makeLine(3), CeilingType.lowerToFloor, [sector], thinkerList, ceilings, harness.callbacks);

    expect(created).toBe(1);
    const ceiling = sector.specialdata as Ceiling;
    expect(ceiling).toBeInstanceOf(Ceiling);
    expect(ceiling.bottomheight).toBe(8 * FRACUNIT);
    expect<CeilingDirection>(ceiling.direction).toBe(CeilingDirection.down);
    expect(ceiling.speed).toBe(CEILSPEED);
    expect(ceiling.crush).toBe(false);
  });
});

describe('EV_DoCeiling lowerAndCrush', () => {
  it('creates a down-mover with bottomheight=floorheight+8, crush=false', () => {
    const sector = makeSector({ ceilingheight: 64 * FRACUNIT, floorheight: 8 * FRACUNIT, tag: 4 });
    const harness = makeHarness();
    const thinkerList = new ThinkerList();
    const ceilings = new ActiveCeilings();

    evDoCeiling(makeLine(4), CeilingType.lowerAndCrush, [sector], thinkerList, ceilings, harness.callbacks);

    const ceiling = sector.specialdata as Ceiling;
    expect(ceiling.bottomheight).toBe(8 * FRACUNIT + 8 * FRACUNIT);
    expect<CeilingDirection>(ceiling.direction).toBe(CeilingDirection.down);
    expect(ceiling.speed).toBe(CEILSPEED);
    expect(ceiling.crush).toBe(false);
  });
});

describe('EV_DoCeiling crushAndRaise', () => {
  it('sets crush=true, topheight=ceilingheight, bottomheight=floorheight+8, direction=down, speed=CEILSPEED', () => {
    const sector = makeSector({ ceilingheight: 64 * FRACUNIT, floorheight: 0, tag: 5 });
    const harness = makeHarness();
    const thinkerList = new ThinkerList();
    const ceilings = new ActiveCeilings();

    evDoCeiling(makeLine(5), CeilingType.crushAndRaise, [sector], thinkerList, ceilings, harness.callbacks);

    const ceiling = sector.specialdata as Ceiling;
    expect(ceiling.crush).toBe(true);
    expect(ceiling.topheight).toBe(64 * FRACUNIT);
    expect(ceiling.bottomheight).toBe(8 * FRACUNIT);
    expect<CeilingDirection>(ceiling.direction).toBe(CeilingDirection.down);
    expect(ceiling.speed).toBe(CEILSPEED);
  });
});

describe('EV_DoCeiling silentCrushAndRaise', () => {
  it('matches crushAndRaise geometry but keeps the silent type discriminator', () => {
    const sector = makeSector({ ceilingheight: 128 * FRACUNIT, floorheight: 16 * FRACUNIT, tag: 6 });
    const harness = makeHarness();
    const thinkerList = new ThinkerList();
    const ceilings = new ActiveCeilings();

    evDoCeiling(makeLine(6), CeilingType.silentCrushAndRaise, [sector], thinkerList, ceilings, harness.callbacks);

    const ceiling = sector.specialdata as Ceiling;
    expect<CeilingType>(ceiling.type).toBe(CeilingType.silentCrushAndRaise);
    expect(ceiling.crush).toBe(true);
    expect(ceiling.topheight).toBe(128 * FRACUNIT);
    expect(ceiling.bottomheight).toBe(16 * FRACUNIT + 8 * FRACUNIT);
    expect<CeilingDirection>(ceiling.direction).toBe(CeilingDirection.down);
    expect(ceiling.speed).toBe(CEILSPEED);
  });
});

describe('EV_DoCeiling fastCrushAndRaise', () => {
  it('sets speed=CEILSPEED*2, crush=true, and the standard crusher geometry', () => {
    const sector = makeSector({ ceilingheight: 64 * FRACUNIT, floorheight: 0, tag: 7 });
    const harness = makeHarness();
    const thinkerList = new ThinkerList();
    const ceilings = new ActiveCeilings();

    evDoCeiling(makeLine(7), CeilingType.fastCrushAndRaise, [sector], thinkerList, ceilings, harness.callbacks);

    const ceiling = sector.specialdata as Ceiling;
    expect(ceiling.crush).toBe(true);
    expect(ceiling.topheight).toBe(64 * FRACUNIT);
    expect(ceiling.bottomheight).toBe(8 * FRACUNIT);
    expect<CeilingDirection>(ceiling.direction).toBe(CeilingDirection.down);
    expect(ceiling.speed).toBe(CEILSPEED * 2);
  });
});

describe('EV_DoCeiling raiseToHighest', () => {
  it('targets findHighestCeilingSurrounding, direction=up, speed=CEILSPEED, crush=false', () => {
    const sector = makeSector({ ceilingheight: 64 * FRACUNIT, tag: 8 });
    const harness = makeHarness({ highestCeiling: 200 * FRACUNIT });
    const thinkerList = new ThinkerList();
    const ceilings = new ActiveCeilings();

    evDoCeiling(makeLine(8), CeilingType.raiseToHighest, [sector], thinkerList, ceilings, harness.callbacks);

    const ceiling = sector.specialdata as Ceiling;
    expect(ceiling.topheight).toBe(200 * FRACUNIT);
    expect<CeilingDirection>(ceiling.direction).toBe(CeilingDirection.up);
    expect(ceiling.speed).toBe(CEILSPEED);
    expect(ceiling.crush).toBe(false);
  });
});

// ── EV_DoCeiling: tag matching, specialdata guard, registry ───────

describe('EV_DoCeiling tag matching', () => {
  it('ignores sectors with different tags', () => {
    const matching = makeSector({ ceilingheight: 64 * FRACUNIT, tag: 20 });
    const other = makeSector({ ceilingheight: 64 * FRACUNIT, tag: 21 });
    const harness = makeHarness();
    const thinkerList = new ThinkerList();
    const ceilings = new ActiveCeilings();

    const created = evDoCeiling(makeLine(20), CeilingType.lowerAndCrush, [matching, other], thinkerList, ceilings, harness.callbacks);

    expect(created).toBe(1);
    expect(matching.specialdata).not.toBeNull();
    expect(other.specialdata).toBeNull();
  });

  it('skips sectors that already have specialdata without bumping rtn', () => {
    const sector = makeSector({ ceilingheight: 64 * FRACUNIT, floorheight: 0, tag: 22 });
    const harness = makeHarness();
    const thinkerList = new ThinkerList();
    const ceilings = new ActiveCeilings();
    const dummy = new Ceiling(sector, CeilingType.crushAndRaise, harness.callbacks);
    sector.specialdata = dummy;

    const created = evDoCeiling(makeLine(22), CeilingType.crushAndRaise, [sector], thinkerList, ceilings, harness.callbacks);

    expect(created).toBe(0);
    expect(sector.specialdata).toBe(dummy);
  });

  it('returns 0 when no sectors match the tag', () => {
    const sector = makeSector({ ceilingheight: 64 * FRACUNIT, tag: 99 });
    const harness = makeHarness();
    const thinkerList = new ThinkerList();
    const ceilings = new ActiveCeilings();

    const created = evDoCeiling(makeLine(1), CeilingType.crushAndRaise, [sector], thinkerList, ceilings, harness.callbacks);

    expect(created).toBe(0);
    expect(sector.specialdata).toBeNull();
  });

  it('registers every newly-created ceiling in the ActiveCeilings registry', () => {
    const a = makeSector({ ceilingheight: 64 * FRACUNIT, floorheight: 0, tag: 30 });
    const b = makeSector({ ceilingheight: 64 * FRACUNIT, floorheight: 0, tag: 30 });
    const harness = makeHarness();
    const thinkerList = new ThinkerList();
    const ceilings = new ActiveCeilings();

    evDoCeiling(makeLine(30), CeilingType.crushAndRaise, [a, b], thinkerList, ceilings, harness.callbacks);

    const registered = ceilings.slots.filter((s) => s !== null);
    expect(registered.length).toBe(2);
    expect(registered).toContain(a.specialdata as Ceiling);
    expect(registered).toContain(b.specialdata as Ceiling);
  });
});

// ── EV_DoCeiling: in-stasis reactivation ──────────────────────────

describe('EV_DoCeiling in-stasis reactivation', () => {
  it('reactivates matching in-stasis ceilings BEFORE iterating sectors for crushAndRaise', () => {
    const existing = makeSector({ ceilingheight: 32 * FRACUNIT, floorheight: 0, tag: 41 });
    const harness = makeHarness();
    const thinkerList = new ThinkerList();
    const ceilings = new ActiveCeilings();

    const stasised = new Ceiling(existing, CeilingType.crushAndRaise, harness.callbacks);
    stasised.tag = 41;
    stasised.direction = CeilingDirection.inStasis;
    stasised.olddirection = CeilingDirection.down;
    stasised.action = null;
    ceilings.add(stasised);
    existing.specialdata = stasised;

    evDoCeiling(makeLine(41), CeilingType.crushAndRaise, [], thinkerList, ceilings, harness.callbacks);

    expect<CeilingDirection>(stasised.direction).toBe(CeilingDirection.down);
    expect<ThinkFunction | typeof REMOVED | null>(stasised.action).not.toBeNull();
  });

  it('reactivates for silentCrushAndRaise', () => {
    const harness = makeHarness();
    const thinkerList = new ThinkerList();
    const ceilings = new ActiveCeilings();
    const victim = makeSector({ ceilingheight: 32 * FRACUNIT, floorheight: 0, tag: 42 });

    const stasised = new Ceiling(victim, CeilingType.silentCrushAndRaise, harness.callbacks);
    stasised.tag = 42;
    stasised.direction = CeilingDirection.inStasis;
    stasised.olddirection = CeilingDirection.up;
    stasised.action = null;
    ceilings.add(stasised);

    evDoCeiling(makeLine(42), CeilingType.silentCrushAndRaise, [], thinkerList, ceilings, harness.callbacks);

    expect<CeilingDirection>(stasised.direction).toBe(CeilingDirection.up);
  });

  it('reactivates for fastCrushAndRaise', () => {
    const harness = makeHarness();
    const thinkerList = new ThinkerList();
    const ceilings = new ActiveCeilings();
    const victim = makeSector({ ceilingheight: 32 * FRACUNIT, floorheight: 0, tag: 43 });

    const stasised = new Ceiling(victim, CeilingType.fastCrushAndRaise, harness.callbacks);
    stasised.tag = 43;
    stasised.direction = CeilingDirection.inStasis;
    stasised.olddirection = CeilingDirection.down;
    stasised.action = null;
    ceilings.add(stasised);

    evDoCeiling(makeLine(43), CeilingType.fastCrushAndRaise, [], thinkerList, ceilings, harness.callbacks);

    expect<CeilingDirection>(stasised.direction).toBe(CeilingDirection.down);
  });

  it('does NOT reactivate for non-crusher types (lowerToFloor, lowerAndCrush, raiseToHighest)', () => {
    const harness = makeHarness();
    const thinkerList = new ThinkerList();
    const ceilings = new ActiveCeilings();
    const victim = makeSector({ ceilingheight: 32 * FRACUNIT, floorheight: 0, tag: 44 });

    const stasised = new Ceiling(victim, CeilingType.crushAndRaise, harness.callbacks);
    stasised.tag = 44;
    stasised.direction = CeilingDirection.inStasis;
    stasised.olddirection = CeilingDirection.down;
    stasised.action = null;
    ceilings.add(stasised);

    evDoCeiling(makeLine(44), CeilingType.lowerToFloor, [], thinkerList, ceilings, harness.callbacks);

    expect<CeilingDirection>(stasised.direction).toBe(CeilingDirection.inStasis);
  });

  it('in-stasis reactivation does NOT count toward rtn', () => {
    const harness = makeHarness();
    const thinkerList = new ThinkerList();
    const ceilings = new ActiveCeilings();
    const victim = makeSector({ ceilingheight: 32 * FRACUNIT, floorheight: 0, tag: 45 });

    const stasised = new Ceiling(victim, CeilingType.crushAndRaise, harness.callbacks);
    stasised.tag = 45;
    stasised.direction = CeilingDirection.inStasis;
    stasised.olddirection = CeilingDirection.down;
    stasised.action = null;
    ceilings.add(stasised);

    const created = evDoCeiling(makeLine(45), CeilingType.crushAndRaise, [], thinkerList, ceilings, harness.callbacks);

    expect(created).toBe(0);
  });
});

// ── ActiveCeilings registry ────────────────────────────────────────

describe('ActiveCeilings registry', () => {
  it('add: first NULL slot wins', () => {
    const ceilings = new ActiveCeilings();
    const harness = makeHarness();
    const sector = makeSector({ ceilingheight: 64 * FRACUNIT });
    const a = new Ceiling(sector, CeilingType.crushAndRaise, harness.callbacks);
    const b = new Ceiling(sector, CeilingType.crushAndRaise, harness.callbacks);

    ceilings.add(a);
    ceilings.add(b);

    expect(ceilings.slots[0]).toBe(a);
    expect(ceilings.slots[1]).toBe(b);
  });

  it('add: silently drops overflow ceilings (vanilla parity — no I_Error)', () => {
    const ceilings = new ActiveCeilings();
    const harness = makeHarness();
    const sector = makeSector({ ceilingheight: 64 * FRACUNIT });

    for (let i = 0; i < MAXCEILINGS; i++) {
      ceilings.add(new Ceiling(sector, CeilingType.crushAndRaise, harness.callbacks));
    }
    const overflow = new Ceiling(sector, CeilingType.crushAndRaise, harness.callbacks);
    expect(() => ceilings.add(overflow)).not.toThrow();
    expect(ceilings.slots.every((s) => s !== overflow)).toBe(true);
  });

  it('remove: clears sector specialdata, marks REMOVED, frees slot', () => {
    const ceilings = new ActiveCeilings();
    const harness = makeHarness();
    const sector = makeSector({ ceilingheight: 64 * FRACUNIT });
    const ceiling = new Ceiling(sector, CeilingType.crushAndRaise, harness.callbacks);
    ceiling.action = (t) => tMoveCeiling(t, ceilings);
    ceilings.add(ceiling);
    sector.specialdata = ceiling;

    ceilings.remove(ceiling);

    expect(sector.specialdata).toBeNull();
    expect<ThinkFunction | typeof REMOVED | null>(ceiling.action).toBe(REMOVED);
    expect(ceilings.slots.every((s) => s !== ceiling)).toBe(true);
  });

  it('remove: silent no-op when ceiling is not registered (vanilla parity — no I_Error)', () => {
    const ceilings = new ActiveCeilings();
    const harness = makeHarness();
    const sector = makeSector({ ceilingheight: 64 * FRACUNIT });
    const orphan = new Ceiling(sector, CeilingType.crushAndRaise, harness.callbacks);

    expect(() => ceilings.remove(orphan)).not.toThrow();
  });

  it('remove: reuses freed slots on subsequent adds', () => {
    const ceilings = new ActiveCeilings();
    const harness = makeHarness();
    const sector = makeSector({ ceilingheight: 64 * FRACUNIT });
    const a = new Ceiling(sector, CeilingType.crushAndRaise, harness.callbacks);
    const b = new Ceiling(sector, CeilingType.crushAndRaise, harness.callbacks);

    ceilings.add(a);
    ceilings.add(b);
    ceilings.remove(a);
    const c = new Ceiling(sector, CeilingType.crushAndRaise, harness.callbacks);
    ceilings.add(c);

    expect(ceilings.slots[0]).toBe(c);
    expect(ceilings.slots[1]).toBe(b);
  });
});

// ── pActivateInStasisCeiling ───────────────────────────────────────

describe('pActivateInStasisCeiling', () => {
  it('restores olddirection and re-attaches an action for matching stasised ceilings', () => {
    const ceilings = new ActiveCeilings();
    const harness = makeHarness();
    const sector = makeSector({ ceilingheight: 64 * FRACUNIT, tag: 50 });
    const ceiling = new Ceiling(sector, CeilingType.crushAndRaise, harness.callbacks);
    ceiling.tag = 50;
    ceiling.direction = CeilingDirection.inStasis;
    ceiling.olddirection = CeilingDirection.down;
    ceiling.action = null;
    ceilings.add(ceiling);

    pActivateInStasisCeiling(makeLine(50), ceilings);

    expect<CeilingDirection>(ceiling.direction).toBe(CeilingDirection.down);
    expect<ThinkFunction | typeof REMOVED | null>(ceiling.action).not.toBeNull();
  });

  it('ignores ceilings whose tag does not match', () => {
    const ceilings = new ActiveCeilings();
    const harness = makeHarness();
    const sector = makeSector({ ceilingheight: 64 * FRACUNIT });
    const ceiling = new Ceiling(sector, CeilingType.crushAndRaise, harness.callbacks);
    ceiling.tag = 51;
    ceiling.direction = CeilingDirection.inStasis;
    ceiling.olddirection = CeilingDirection.down;
    ceiling.action = null;
    ceilings.add(ceiling);

    pActivateInStasisCeiling(makeLine(99), ceilings);

    expect<CeilingDirection>(ceiling.direction).toBe(CeilingDirection.inStasis);
    expect<ThinkFunction | typeof REMOVED | null>(ceiling.action).toBeNull();
  });

  it('ignores ceilings that are not in stasis', () => {
    const ceilings = new ActiveCeilings();
    const harness = makeHarness();
    const sector = makeSector({ ceilingheight: 64 * FRACUNIT });
    const ceiling = new Ceiling(sector, CeilingType.crushAndRaise, harness.callbacks);
    ceiling.tag = 52;
    ceiling.direction = CeilingDirection.down;
    ceiling.olddirection = CeilingDirection.up;
    const originalAction = (t: any) => tMoveCeiling(t, ceilings);
    ceiling.action = originalAction;
    ceilings.add(ceiling);

    pActivateInStasisCeiling(makeLine(52), ceilings);

    expect<CeilingDirection>(ceiling.direction).toBe(CeilingDirection.down);
    expect<ThinkFunction | typeof REMOVED | null>(ceiling.action).toBe(originalAction);
  });
});

// ── EV_CeilingCrushStop ────────────────────────────────────────────

describe('EV_CeilingCrushStop', () => {
  it('suspends matching active ceilings: saves olddirection, detaches action, sets direction=inStasis', () => {
    const ceilings = new ActiveCeilings();
    const harness = makeHarness();
    const sector = makeSector({ ceilingheight: 64 * FRACUNIT });
    const ceiling = new Ceiling(sector, CeilingType.crushAndRaise, harness.callbacks);
    ceiling.tag = 60;
    ceiling.direction = CeilingDirection.up;
    ceiling.action = (t) => tMoveCeiling(t, ceilings);
    ceilings.add(ceiling);

    const rtn = evCeilingCrushStop(makeLine(60), ceilings);

    expect(rtn).toBe(1);
    expect<CeilingDirection>(ceiling.direction).toBe(CeilingDirection.inStasis);
    expect(ceiling.olddirection).toBe(CeilingDirection.up);
    expect<ThinkFunction | typeof REMOVED | null>(ceiling.action).toBeNull();
  });

  it('ignores ceilings with a mismatched tag and does NOT set rtn', () => {
    const ceilings = new ActiveCeilings();
    const harness = makeHarness();
    const sector = makeSector({ ceilingheight: 64 * FRACUNIT });
    const ceiling = new Ceiling(sector, CeilingType.crushAndRaise, harness.callbacks);
    ceiling.tag = 61;
    ceiling.direction = CeilingDirection.down;
    const originalAction = (t: any) => tMoveCeiling(t, ceilings);
    ceiling.action = originalAction;
    ceilings.add(ceiling);

    const rtn = evCeilingCrushStop(makeLine(99), ceilings);

    expect(rtn).toBe(0);
    expect<CeilingDirection>(ceiling.direction).toBe(CeilingDirection.down);
    expect<ThinkFunction | typeof REMOVED | null>(ceiling.action).toBe(originalAction);
  });

  it('ignores already-stasised ceilings (direction !== 0 test in vanilla)', () => {
    const ceilings = new ActiveCeilings();
    const harness = makeHarness();
    const sector = makeSector({ ceilingheight: 64 * FRACUNIT });
    const ceiling = new Ceiling(sector, CeilingType.crushAndRaise, harness.callbacks);
    ceiling.tag = 62;
    ceiling.direction = CeilingDirection.inStasis;
    ceiling.olddirection = CeilingDirection.up;
    ceiling.action = null;
    ceilings.add(ceiling);

    const rtn = evCeilingCrushStop(makeLine(62), ceilings);

    expect(rtn).toBe(0);
    expect(ceiling.olddirection).toBe(CeilingDirection.up);
  });

  it('suspends every matching active ceiling in a single call', () => {
    const ceilings = new ActiveCeilings();
    const harness = makeHarness();
    const sectorA = makeSector({ ceilingheight: 64 * FRACUNIT });
    const sectorB = makeSector({ ceilingheight: 64 * FRACUNIT });
    const a = new Ceiling(sectorA, CeilingType.crushAndRaise, harness.callbacks);
    const b = new Ceiling(sectorB, CeilingType.crushAndRaise, harness.callbacks);
    a.tag = 70;
    b.tag = 70;
    a.direction = CeilingDirection.up;
    b.direction = CeilingDirection.down;
    a.action = (t) => tMoveCeiling(t, ceilings);
    b.action = (t) => tMoveCeiling(t, ceilings);
    ceilings.add(a);
    ceilings.add(b);

    const rtn = evCeilingCrushStop(makeLine(70), ceilings);

    expect(rtn).toBe(1);
    expect<CeilingDirection>(a.direction).toBe(CeilingDirection.inStasis);
    expect<CeilingDirection>(b.direction).toBe(CeilingDirection.inStasis);
    expect(a.olddirection).toBe(CeilingDirection.up);
    expect(b.olddirection).toBe(CeilingDirection.down);
  });
});

// ── ThinkerList integration ────────────────────────────────────────

describe('ThinkerList integration', () => {
  it('running a completed ceiling through ThinkerList.run marks REMOVED and unlinks on the next tic', () => {
    const sector = makeSector({ ceilingheight: FRACUNIT, floorheight: 0 });
    const harness = makeHarness({ leveltime: 1 });
    const thinkerList = new ThinkerList();
    const ceilings = new ActiveCeilings();

    evDoCeiling(makeLine(0), CeilingType.lowerToFloor, [sector], thinkerList, ceilings, harness.callbacks);

    const ceiling = sector.specialdata as Ceiling;
    expect(ceiling).toBeInstanceOf(Ceiling);

    // Tic 1: movement reaches pastdest, the thinker is removed from the
    // registry (marks REMOVED, clears specialdata) but is still linked
    // in the ring — vanilla P_RunThinkers unlinks on the NEXT tic.
    thinkerList.run();
    expect<ThinkFunction | typeof REMOVED | null>(ceiling.action).toBe(REMOVED);
    expect(sector.specialdata).toBeNull();

    // Tic 2: the ring walker sees REMOVED and unlinks.
    thinkerList.run();
    let found = false;
    thinkerList.forEach((node) => {
      if (node === ceiling) found = true;
    });
    expect(found).toBe(false);
  });
});
